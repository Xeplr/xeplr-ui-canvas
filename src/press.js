// WHOSE PRESS IS IT — the canvas's, or a control inside the item.
//
// Here rather than in useCanvasDrag.js because it is a plain question about a
// DOM node with no React in it, and because both sides need the same answer:
// the drag asks it before taking a mousedown, and a Design asks it before
// deciding a press was a drag.
//
// See useCanvasDrag's begin() for why this matters: taking the mousedown
// means cancelling its default, and for a field that default IS the focus.

/**
 * A press that lands on one of these belongs to the control, not the canvas.
 *
 * This list used to be `button` alone, which was the whole reason a text
 * input inside an item looked broken: no caret ever appeared, so the item
 * read as unresponsive rather than as dragged, and nothing about the press
 * said otherwise. Every consumer that puts a field in an item would have met
 * it again.
 *
 * `contenteditable` is here for the same reason as `input` — it is how a rich
 * cell is edited in place. `data-canvas-no-drag` is the way out for anything
 * this list has not thought of.
 */
export const NOT_A_DRAG = 'button, input, select, textarea, label, a[href], [contenteditable=""], [contenteditable="true"], [data-canvas-no-drag]'

/** Would a press here start a drag, or belong to a control inside the item? */
export function startsADrag(target) {
  return !(target && target.closest && target.closest(NOT_A_DRAG))
}
