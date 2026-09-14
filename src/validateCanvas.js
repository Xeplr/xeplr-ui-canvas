// Fails LOUDLY on a canvas wired up wrong, rather than rendering an empty or
// half-working board that looks like a data problem.
//
// The two mistakes that matter: no renderItem (nothing can be drawn) and an
// item with no id (drag, selection and edges all address items by id — two
// items sharing undefined move together, and an edge to one attaches to
// whichever was found first).
export function validateCanvasProps(props) {
  if (!Array.isArray(props.items)) {
    throw new Error('XeplrCanvas: `items` must be an array of { id, x, y, w, h }')
  }
  if (typeof props.renderItem !== 'function') {
    throw new Error('XeplrCanvas: `renderItem(item, { selected })` is required')
  }
  const seen = new Set()
  for (const item of props.items) {
    if (item == null || item.id == null || item.id === '') {
      throw new Error('XeplrCanvas: every item needs an `id`')
    }
    if (seen.has(item.id)) throw new Error(`XeplrCanvas: duplicate item id "${item.id}"`)
    seen.add(item.id)
  }
  if (props.units && props.units !== 'px' && props.units !== 'fraction') {
    throw new Error(`XeplrCanvas: units must be 'px' or 'fraction', got "${props.units}"`)
  }
}
