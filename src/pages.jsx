import { useCanvasController } from './useCanvasController.js'
import { validateCanvasProps } from './validateCanvas.js'
import { CanvasSample } from './designs/index.js'

/**
 * The ready-made canvas: controller + design.
 *
 * One component, every capability; a builder switches on what it needs.
 *
 *   dashboard / UI creator   features={{ resize: true, marquee: true }}
 *   workflow / dataset       edges={[...]}  (drag and snap are on by default)
 *
 * @prop items            [{ id, x, y, w, h, z?, groupId? }]
 * @prop units            'px' (default) | 'fraction'
 * @prop features         { drag, resize, snap, grid, marquee } — see DEFAULT_FEATURES
 * @prop selection        ids (array or Set) — controlled; omit to let the canvas own it
 * @prop onSelectionChange(Set)
 * @prop onItemChange     (id, patch) — on drop, in the item's own units
 * @prop onItemClick      (id, event) — a press that never became a drag
 * @prop onRaise          (id) — on grab
 * @prop renderItem       (item, { selected }) → node — REQUIRED
 * @prop minSizeFor       (item) → { minWidth, minHeight }
 * @prop edges            [{ id, from, to | toOffset, fromPort?, toPort?, variant?, className? }]
 * @prop getAnchor        (item, port, 'from'|'to', rect) → { x, y } — for port edges
 * @prop renderEdgeLabel  (edge, { from, to, mid }) → node — absolutely positioned by you
 * @prop edgeMinOffset    minimum sideways reach of an edge's curve, px (default 60)
 * @prop padding          room beyond the furthest item: number or { x, y }
 * @prop minWidth, minHeight  the smallest the inner canvas gets
 * @prop pageAspect       fraction units only: a page is width × pageAspect tall,
 *                        instead of the visible height — proportions then hold
 *                        at any size
 * @prop underlay, overlay    extra layers under the edges / over everything
 * @prop className, style     on the scrolling wrapper
 */
export function XeplrCanvas(props) {
  validateCanvasProps(props)
  const ctrl = useCanvasController(props)
  return (
    <CanvasSample
      ctrl={ctrl}
      renderItem={props.renderItem}
      getAnchor={props.getAnchor}
      renderEdgeLabel={props.renderEdgeLabel}
      edgeMinOffset={props.edgeMinOffset}
      underlay={props.underlay}
      overlay={props.overlay}
      className={props.className}
      style={props.style}
    />
  )
}
