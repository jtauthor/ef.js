import createElement from './element-creator.js'
import DOM from './dom-helper.js'
import ARR from './array-helper.js'
import { DOMARR, _anchor } from './dom-arr-helper.js'
import { resolve } from './resolver.js'
import initSubscribe from './subscriber.js'
import { warn, warnAttachment } from '../debug.js'

// Reserved names
const reserved = 'attached data element methods subscribe unsubscribe update'.split(' ').map(i => `$${i}`)

const create = ({ ast, state, children, subscriber }) => {
	// First create an element according to the description
	const element = createElement(ast[0], state, subscriber)

	// Append child nodes
	for (let i = 1; i < ast.length; i++) {
		const node = ast[i]
		const nodeType = Object.prototype.toString.call(node)
		switch (nodeType) {
			case '[object String]': {
				// Static text node
				DOM.append(element, document.createTextNode(node))
				break
			}
			case '[object Array]': {
				if (Object.prototype.toString.call(node[0]) === '[object Object]') {
					// Create child element
					DOM.append(element, create({ ast: node, state, children, subscriber }))
				} else if (Object.prototype.toString.call(node[0]) === '[object String]') {
					// Data binding text node
					const name = node.pop()
					const textNode = document.createTextNode('')
					const { parentNode, subscriberNode } = resolve({
						path: node,
						name: name,
						parentNode: state.$data,
						subscriberNode: subscriber
					})
					// Subscribe value changing
					subscriberNode.push((value) => {
						textNode.textContent = value
					})
					// Bind operating methods if not exist
					initSubscribe({subscriberNode, parentNode, name, state})
					DOM.append(element, textNode)
				}
				break
			}
			case '[object Object]': {
				if (reserved.indexOf(node.name) !== -1) {
					warn(`No reserved name '${node.name}' should be used, ignoring.`)
					break
				}
				const anchor = (() => {
					if (ENV === 'production') return document.createTextNode('')
					return document.createComment(`Mounting point for '${node.name}'`)
				})()
				if (node.type === 'node') {
					Object.defineProperty(state, node.name, {
						get() {
							return children[node.name]
						},
						set(value) {
							if (children[node.name] && children[node.name].value === value) return
							if (value.$attached) return warnAttachment(value)
							// Update component
							if (children[node.name]) DOM.remove(children[node.name].$element)
							DOM.after(anchor, value.$element)
							// Update stored value
							children[node.name] = value
						},
						enumerable: true
					})
				} else if (node.type === 'list') {
					const initArr = Object.assign([], DOMARR)
					_anchor.set(initArr, anchor)
					children[node.name] = initArr
					Object.defineProperty(state, node.name, {
						get() {
							return children[node.name]
						},
						set(value) {
							if (children[node.name] && children[node.name].value === value) return
							_anchor.set(value, anchor)
							const fragment = document.createDocumentFragment()
							// Update components
							if (children[node.name]) {
								for (let j of value) {
									if (j.$attached) return warnAttachment(j)
									DOM.append(fragment, j.$element)
									ARR.remove(children[node.name], j)
								}
								for (let j of children[node.name]) DOM.remove(j.$element)
							} else for (let j of value) DOM.append(fragment, j.$element)
							// Update stored value
							children[node.name] = Object.assign(value, DOMARR)
							// Append to current component
							DOM.after(anchor, fragment)
						},
						enumerable: true
					})
				} else throw new TypeError(`Not a standard ef.js AST: Unknown mounting point type '${node.type}'`)
				// Append placeholder
				DOM.append(element, anchor)
				break
			}
			default: {
				throw new TypeError(`Not a standard ef.js AST: Unknown node type '${nodeType}'`)
			}
		}
	}

	return element
}

export default create
