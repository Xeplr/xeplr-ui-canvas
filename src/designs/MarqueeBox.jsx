import { useSyncExternalStore } from 'react'

// The band itself. Its own leaf on the same bargain as DragGuides: one frame
// re-renders this and nothing else on the canvas.
export default function MarqueeBox({ store }) {
  const frame = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  if (!frame.rect) return null
  const { x, y, w, h } = frame.rect
  return <div className="xeplr-canvas-marquee" style={{ left: x, top: y, width: w, height: h }} />
}
