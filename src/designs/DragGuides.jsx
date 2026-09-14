import { useSyncExternalStore } from 'react'

// The alignment guides drawn while a drag is snapping.
//
// ITS OWN COMPONENT, subscribed to the drag store directly, because this is
// the one thing on the canvas that has to change on every frame of a drag.
// Held in a page's state instead, each frame re-rendered the page and every
// item under it. Here, a frame re-renders exactly this.
export default function DragGuides({ store }) {
  const frame = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  return frame.guides.map((g, i) => (
    <div
      key={i}
      className={`xeplr-canvas-guide xeplr-canvas-guide-${g.axis}`}
      style={g.axis === 'x' ? { left: g.at } : { top: g.at }}
    />
  ))
}
