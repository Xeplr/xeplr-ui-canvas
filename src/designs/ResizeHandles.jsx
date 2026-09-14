import { RESIZE_HANDLES } from '../geometry.js'

// The eight grab points on a selected item. Rendered INSIDE the item's own
// positioned element, so they move with it during a drag for free.
//
// `onStart(event, handleKey)` — hand it to useCanvasDrag's startResize.
export default function ResizeHandles({ onStart }) {
  return RESIZE_HANDLES.map((h) => (
    <span
      key={h.key}
      className={`xeplr-canvas-handle xeplr-canvas-handle-${h.key}`}
      onMouseDown={(e) => onStart(e, h.key)}
    />
  ))
}
