// @xeplr/ui-canvas — one canvas for every xeplr builder.
//
// Three ways in, per the xeplr-ui-* convention:
//   1. <XeplrCanvas> as-is
//   2. the controller hooks with your own design (the BI dashboard does this)
//   3. the model alone — '@xeplr/ui-canvas/geometry' and '/edges' have no
//      React, so they run in node tests too

// Model
export {
  MIN_WIDTH, MIN_HEIGHT, SNAP_TOLERANCE, GRID, DEFAULT_SIZE, DEFAULT_FRACTION, RESIZE_HANDLES,
  rectOf, pixelRect, moveRect, resizeRect, canvasBounds, bringToFront, inStackOrder,
  toFraction, toPixels, hits, overlaps
} from './geometry.js'
export { anchorOf, bezierPath, midpoint, edgeEnds } from './edges.js'
export { createFrameStore } from './frameStore.js'
export { validateCanvasProps } from './validateCanvas.js'

// Controllers
export { useCanvasDrag, ITEM_ID_ATTR } from './useCanvasDrag.js'
// The drag's own rule about which presses are not drags — exported so a
// consumer can ask it too, rather than keeping a second copy of the list.
export { NOT_A_DRAG, startsADrag } from './press.js'
export { useMarquee, SWEEPING_CLASS } from './useMarquee.js'
export { useCanvasSize } from './useCanvasSize.js'
export { useCanvasController, DEFAULT_FEATURES } from './useCanvasController.js'

// Designs
export { CanvasSample, DragGuides, MarqueeBox, ResizeHandles, EdgeLayer } from './designs/index.js'

// Ready-made
export { XeplrCanvas } from './pages.jsx'
