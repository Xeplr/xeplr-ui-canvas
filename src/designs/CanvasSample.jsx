import DragGuides from './DragGuides.jsx'
import MarqueeBox from './MarqueeBox.jsx'
import ResizeHandles from './ResizeHandles.jsx'
import EdgeLayer from './EdgeLayer.jsx'
import { ITEM_ID_ATTR } from '../useCanvasDrag.js'

// The ready-made canvas design. Presentation only — everything arrives from
// useCanvasController plus the caller's render props.
//
// Layers, bottom to top: underlay, edges, items, guides and marquee, overlay.
// Edges sit UNDER items so a line never crosses the box it enters.
export default function CanvasSample({
  ctrl, renderItem, getAnchor, renderEdgeLabel, edgeMinOffset,
  underlay, overlay, className, style
}) {
  const { features, selected, rectById } = ctrl
  const soleSelection = selected.size === 1

  return (
    <div
      ref={ctrl.measureRef}
      className={'xeplr-canvas' + (className ? ' ' + className : '')}
      style={style}
    >
      <div
        ref={ctrl.rootRef}
        className="xeplr-canvas-inner"
        style={{ width: ctrl.size.width, height: ctrl.size.height }}
        onMouseDown={ctrl.onCanvasMouseDown}
      >
        {underlay}

        {ctrl.edges.length > 0 && (
          <EdgeLayer
            edges={ctrl.edges}
            rectById={rectById}
            itemById={ctrl.itemById}
            store={ctrl.guideStore}
            getAnchor={getAnchor}
            renderEdgeLabel={renderEdgeLabel}
            minOffset={edgeMinOffset}
          />
        )}

        {ctrl.stacked.map((item) => {
          const rect = rectById[item.id]
          const isSelected = selected.has(item.id)
          return (
            <div
              key={item.id}
              {...{ [ITEM_ID_ATTR]: item.id }}
              className={'xeplr-canvas-item' + (isSelected ? ' is-selected' : '')}
              style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, zIndex: (item.z || 0) + 1 }}
              onMouseDown={(e) => ctrl.onItemMouseDown(e, item.id)}
            >
              {renderItem(item, { selected: isSelected })}
              {features.resize && isSelected && soleSelection && (
                <ResizeHandles onStart={(e, handle) => ctrl.onResizeStart(e, item.id, handle)} />
              )}
            </div>
          )
        })}

        {features.snap && <DragGuides store={ctrl.guideStore} />}
        {features.marquee && <MarqueeBox store={ctrl.marqueeStore} />}

        {overlay}
      </div>
    </div>
  )
}
