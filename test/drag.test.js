// WHAT A PRESS BELONGS TO — the canvas, or a control inside the item.
//
// The drag cancels the browser's default on mousedown, which is what makes a
// drag a drag. That same default is the FOCUS: a press on a text field inside
// an item was being taken by the canvas, no caret appeared, and the item read
// as broken rather than as dragged. So this is not a styling detail — it is
// the difference between a card you can fill in and one you cannot.
import { NOT_A_DRAG, startsADrag } from '../src/press.js'

const results = []
const check = (name, cond) => { results.push([name, cond]); console.log((cond ? '  ok   ' : '  FAIL ') + name) }

// A stand-in for a DOM node: `closest` walks up the parents and matches a
// selector the way the browser would for the shapes this list uses — a tag
// name, `a[href]`, or an attribute in brackets.
function el(tag, attrs, parent) {
  const node = { tag: tag.toLowerCase(), attrs: attrs || {}, parent: parent || null }
  node.closest = (selector) => {
    const parts = selector.split(',').map((s) => s.trim())
    for (let cur = node; cur; cur = cur.parent) {
      if (parts.some((p) => matches(cur, p))) return cur
    }
    return null
  }
  return node
}

function matches(node, part) {
  const m = /^([a-z]*)(?:\[([^\]=]+)(?:=("?)([^\]"]*)\3)?\])?$/.exec(part)
  if (!m) return false
  const [, tag, attr, , value] = m
  if (tag && node.tag !== tag) return false
  if (!attr) return Boolean(tag)
  if (!(attr in node.attrs)) return false
  // `[attr]` is "present at all"; `[attr=""]` is "present and empty", which
  // is not the same question — contenteditable="false" answers yes to the
  // first and no to the second, and the second is what the list asks.
  return value === undefined ? true : node.attrs[attr] === value
}

console.log('\nthe controls a press belongs to')
{
  const card = el('div', { 'data-canvas-item-id': '1' })
  check('a press on the card itself drags it', startsADrag(el('span', {}, card)))

  // The one that was broken. Everything else here is the same mistake waiting
  // in a different tag.
  check('a text field takes its own press', !startsADrag(el('input', {}, card)))
  check('a dropdown does too', !startsADrag(el('select', {}, card)))
  check('and a textarea', !startsADrag(el('textarea', {}, card)))
  check('a button still does, as it always did', !startsADrag(el('button', {}, card)))
  check('a link is followed, not dragged', !startsADrag(el('a', { href: '/x' }, card)))
  check('a label, because clicking one focuses its field', !startsADrag(el('label', {}, card)))
  check('an anchor with no href is not a link', startsADrag(el('a', {}, card)))
}

console.log('\nnested, which is how a card is actually built')
{
  const card = el('div', { 'data-canvas-item-id': '1' })
  const row = el('span', {}, card)
  check('a field wrapped in a row is still a field', !startsADrag(el('input', {}, row)))
  check('an icon inside a button is the button', !startsADrag(el('svg', {}, el('button', {}, row))))
}

console.log('\nan escape hatch for anything not in the list')
{
  const card = el('div', { 'data-canvas-item-id': '1' })
  check('data-canvas-no-drag opts a subtree out', !startsADrag(el('div', { 'data-canvas-no-drag': '' }, card)))
  check('an edited cell opts out', !startsADrag(el('div', { contenteditable: 'true' }, card)))
  check('contenteditable="false" does not', startsADrag(el('div', { contenteditable: 'false' }, card)))
}

console.log('\nthe list is one answer, in one place')
{
  // A Design asks the same question the drag asks. If these ever diverge, a
  // card guards fields the canvas still steals, or the reverse.
  check('the selector is exported for consumers', typeof NOT_A_DRAG === 'string' && NOT_A_DRAG.length > 0)
  check('startsADrag reads that selector', ['input', 'select', 'textarea', 'button'].every((t) => NOT_A_DRAG.includes(t)))
  check('nothing to ask about is not a drag-stopper', startsADrag(null))
}

const failed = results.filter(([, ok]) => !ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
