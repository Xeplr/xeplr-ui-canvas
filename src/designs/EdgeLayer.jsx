import { Fragment, useId, useMemo, useSyncExternalStore } from 'react'
import { bezierPath, edgeEnds, midpoint } from '../edges.js'

// The lines between items.
//
// Subscribed to the drag store, like the guides, so an edge FOLLOWS its item
// while it is dragged — the item itself is moved by a transform React never
// hears about until the drop, so an edge drawn only from React state would be
// left behind pointing at where the item used to be.
//
// Edge shape: { id, from, to | toOffset, fromPort?, toPort?, fromSide?,
// toSide?, variant?: 'dashed', className?, arrow?: false, ... } — anything
// else on it is the caller's, handed back to renderEdgeLabel.
export default function EdgeLayer({ edges, rectById, itemById, store, getAnchor, renderEdgeLabel, minOffset }) {
  const frame = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const markerId = 'xeplr-canvas-arrow-' + useId().replace(/:/g, '')

  // Committed rects, overlaid with whatever is moving this frame.
  const live = useMemo(() => {
    if (!frame.patches) return rectById
    const next = { ...rectById }
    frame.patches.forEach((p) => {
      if (next[p.id]) next[p.id] = { ...next[p.id], ...p }
    })
    return next
  }, [rectById, frame.patches])

  const drawn = edges
    .map((edge) => {
      const ends = edgeEnds(edge, live, itemById, getAnchor)
      return ends ? { edge, ...ends } : null
    })
    .filter(Boolean)

  return (
    <>
      <svg className="xeplr-canvas-edges" width="100%" height="100%">
        <defs>
          <marker id={markerId} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path className="xeplr-canvas-edge-arrow" d="M0,0 L8,4 L0,8 z" />
          </marker>
        </defs>
        {drawn.map(({ edge, from, to }) => (
          <path
            key={edge.id}
            className={
              'xeplr-canvas-edge' +
              (edge.variant ? ' xeplr-canvas-edge--' + edge.variant : '') +
              (edge.className ? ' ' + edge.className : '')
            }
            d={bezierPath(from, to, { minOffset, fromDir: edge.fromDir, toDir: edge.toDir })}
            markerEnd={edge.arrow === false ? undefined : `url(#${markerId})`}
          />
        ))}
      </svg>
      {renderEdgeLabel && drawn.map(({ edge, from, to }) => {
        const label = renderEdgeLabel(edge, { from, to, mid: midpoint(from, to) })
        return label ? <Fragment key={edge.id}>{label}</Fragment> : null
      })}
    </>
  )
}
