# @xeplr/ui-canvas

**One free-placement canvas for every builder.** Drag, resize, alignment guides, snapping, marquee select and edges — in a single React package, so a dashboard designer, a workflow editor, a join diagram and a form builder all feel like the same product.

(The package name on npm is `@xeplr/ui-canvas` — the GitHub repo and folder are named `xeplr-ui-canvas`.)

## Why

Every builder ends up writing its own canvas: mousedown, window listeners, apply the delta, clean up. Then one of them gets snapping, another gets a marquee, a third draws bezier edges, and none of them agree on what a drag feels like.

This package is the superset. It has every capability once, and each builder switches on the ones it needs:

| Builder | drag | resize | guides & snap | marquee & groups | edges |
|---|:-:|:-:|:-:|:-:|:-:|
| Dashboard / page designer | ✓ | ✓ | ✓ | ✓ | |
| Workflow / flow editor | ✓ | | ✓ | | ✓ |
| Join diagram (column ports) | ✓ | | ✓ | | ✓ |
| Form / UI builder | ✓ | ✓ | ✓ | ✓ | |

## Install

```sh
npm i @xeplr/ui-canvas
```

Peer dependency: `react ^18 || ^19`. No other runtime dependencies.

## Quick start — boxes you can move and resize

```jsx
import { useState } from 'react'
import { XeplrCanvas } from '@xeplr/ui-canvas'

export function Board() {
  const [items, setItems] = useState([
    { id: 'sales', x: 40, y: 40, w: 320, h: 200 },
    { id: 'orders', x: 400, y: 40, w: 320, h: 200 }
  ])

  return (
    <XeplrCanvas
      style={{ height: 600 }}
      items={items}
      features={{ resize: true, marquee: true }}
      onItemChange={(id, patch) =>
        setItems((all) => all.map((it) => (it.id === id ? { ...it, ...patch } : it)))
      }
      renderItem={(item, { selected }) => <div className="card">{item.id}</div>}
    />
  )
}
```

## Quick start — nodes joined by edges

```jsx
<XeplrCanvas
  items={steps}                                  // [{ id, x, y, w, h }]
  edges={[
    { id: 'a-b', from: 'fetch', to: 'transform' },
    { id: 'b-c', from: 'transform', to: 'load', variant: 'dashed' },
    { id: 'c-end', from: 'load', toOffset: { x: 130, y: 0 }, done: true }
  ]}
  onItemChange={(id, { x, y }) => moveStep(id, x, y)}
  onItemClick={(id) => openStep(id)}             // a press that never became a drag
  renderItem={(step, { selected }) => <StepCard step={step} selected={selected} />}
  renderEdgeLabel={(edge, { to }) =>
    edge.done ? <span className="pill" style={{ position: 'absolute', left: to.x, top: to.y }}>Done</span> : null
  }
/>
```

Edges follow their node **while** it is being dragged, not only after the drop.

## What you get

- **Drag without re-renders.** A drag writes a CSS transform straight onto the moving element, one frame at a time. React hears about the new position exactly once, on drop — so a board of 300 items stays smooth.
- **Alignment guides.** An edge or centre that comes within 6px of another item's edge or centre snaps to it, and a guide line shows why it jumped. When nothing is close, it falls back to a 10px grid. Hold **Alt** to place freely.
- **Resize from eight handles**, with snapping on the edge being dragged and a per-item minimum size (`minSizeFor`).
- **Marquee select** that takes everything it *touches*, not only what it encloses — so it also reaches items hidden under others. Ctrl/Cmd/Shift adds to the selection.
- **Groups.** Items sharing a `groupId` select and move as one.
- **Edges.** Bezier curves with arrowheads, dashed variant, labels, stubs to non-item targets (`toOffset`), and port anchors inside an item (`getAnchor`).
- **Pixel or fractional units.** `units="fraction"` stores `x`/`w` as fractions of the width and `y`/`h` as fractions of the visible height, so a layout made on a large screen still reads on a laptop.
- **Fails loudly.** A missing `renderItem`, or an item with no id or a duplicate id, throws a clear error instead of rendering a board that half works.

## `<XeplrCanvas>` props

| prop | type | default | notes |
|---|---|---|---|
| `items` | `Array<{ id, x, y, w, h, z?, groupId? }>` | required | `z` sets paint order |
| `renderItem` | `(item, { selected }) => ReactNode` | required | the item's content; the canvas positions it |
| `units` | `'px' \| 'fraction'` | `'px'` | see above |
| `pageAspect` | number | — | fraction units only: one page is `width × pageAspect` tall instead of the visible height, so a layout keeps the same proportions at any size |
| `features` | `{ drag, resize, snap, grid, marquee }` | `{ drag: true, resize: false, snap: true, grid: 10, marquee: false }` | merged over the defaults |
| `onItemChange` | `(id, patch) => void` | — | once per item, on drop, in the item's own units |
| `onItemClick` | `(id, event) => void` | — | a press that moved less than 4px |
| `onRaise` | `(id) => void` | — | when an item is grabbed — e.g. `bringToFront` |
| `selection` | `Array<id> \| Set<id>` | — | controlled selection; omit to let the canvas own it |
| `onSelectionChange` | `(Set<id>) => void` | — | |
| `minSizeFor` | `(item) => { minWidth, minHeight }` | 48 × 28 | per-item resize floor |
| `edges` | `Array<Edge>` | `[]` | see below |
| `getAnchor` | `(item, port, 'from' \| 'to', rect) => { x, y }` | right / left middle | for edges that attach to ports |
| `renderEdgeLabel` | `(edge, { from, to, mid }) => ReactNode` | — | absolutely position it yourself |
| `edgeMinOffset` | number | `60` | minimum sideways reach of a curve |
| `padding` | `number \| { x, y }` | `80` | room beyond the furthest item (px units) |
| `minWidth`, `minHeight` | number | `0` | smallest the canvas gets |
| `underlay`, `overlay` | ReactNode | — | extra layers under the edges / over everything |
| `className`, `style` | | — | on the scrolling wrapper |

### Edge

| field | notes |
|---|---|
| `id` | required |
| `from` | item id |
| `to` *or* `toOffset` | item id, or `{ x, y }` relative to where the edge leaves |
| `fromPort`, `toPort` | passed to `getAnchor` |
| `fromSide`, `toSide` | `'left' \| 'right' \| 'top' \| 'bottom'` when not using `getAnchor` |
| `variant` | `'dashed'` |
| `className` | extra class on the path |
| `arrow` | `false` to hide the arrowhead |

Anything else you put on an edge comes back to you in `renderEdgeLabel`.

## Three ways to use it

Like every `@xeplr/ui-*` package, it is split into model, controller and design, so you take as much as you want:

1. **Ready-made** — `<XeplrCanvas>` as above.
2. **Your own design** — the hooks, with your own markup. Use this when your builder already has a selection model of its own.

   ```jsx
   import { useCanvasDrag, useMarquee, useCanvasSize, DragGuides, MarqueeBox, ResizeHandles } from '@xeplr/ui-canvas'

   const drag = useCanvasDrag({ items, units: 'fraction', canvas, rootRef, onUpdate })
   // on an item:   <div data-canvas-item-id={item.id} onMouseDown={(e) => drag.startDrag(e, [item.id])}>
   // on a handle:  <ResizeHandles onStart={(e, handle) => drag.startResize(e, item.id, handle)} />
   // in the canvas: <DragGuides store={drag.guideStore} />
   ```

3. **Geometry only** — no React at all, runs in Node:

   ```js
   import { moveRect, resizeRect, hits, toFraction } from '@xeplr/ui-canvas/geometry'
   import { bezierPath, anchorOf } from '@xeplr/ui-canvas/edges'
   ```

## Controls inside an item

An item can hold real controls — the field that names it, a dropdown, a Remove button. A press that lands on one of those belongs to the control, and the drag leaves it alone:

```js
import { NOT_A_DRAG, startsADrag } from '@xeplr/ui-canvas'
// NOT_A_DRAG  → 'button, input, select, textarea, label, a[href], [contenteditable=…], [data-canvas-no-drag]'
// startsADrag(e.target) → false when the press belongs to a control
```

This matters more than it looks. Starting a drag means calling `preventDefault()` on the mousedown, and for a field that default IS the focus — so a text input in an item used to take no caret, and the item read as *unresponsive* rather than as *dragged*. Nothing about the press said which. The list was `button` alone; now it covers every control, and `data-canvas-no-drag` on a wrapper opts out anything it has not thought of.

Your own design can ask the same question rather than keeping a second copy of the list — `startsADrag(e.target)` before treating a press as a grab.

## Styling

Everything is namespaced `.xeplr-canvas-*`, and colours come from the xeplr theme variables with fallbacks: `--xeplr-accent` for guides, handles and the marquee, and `--xeplr-border-strong` for edges. Set those variables to restyle, or override the classes:

| class | what |
|---|---|
| `.xeplr-canvas` / `.xeplr-canvas-inner` | scrolling wrapper / sized canvas |
| `.xeplr-canvas-item` (`.is-selected`) | the positioned box around each item |
| `.xeplr-canvas-edge` (`--dashed`), `.xeplr-canvas-edge-arrow` | edges |
| `.xeplr-canvas-guide-x` / `-y` | alignment guides |
| `.xeplr-canvas-handle-{nw,n,ne,w,e,sw,s,se}` | resize handles |
| `.xeplr-canvas-marquee` | the selection band |

## Exports

- **Component:** `XeplrCanvas`
- **Hooks:** `useCanvasController`, `useCanvasDrag`, `useMarquee`, `useCanvasSize`
- **Designs:** `CanvasSample`, `DragGuides`, `MarqueeBox`, `ResizeHandles`, `EdgeLayer`
- **Geometry:** `moveRect`, `resizeRect`, `rectOf`, `pixelRect`, `canvasBounds`, `bringToFront`, `inStackOrder`, `toFraction`, `toPixels`, `hits`, `overlaps`, `RESIZE_HANDLES`, `GRID`, `SNAP_TOLERANCE`, `MIN_WIDTH`, `MIN_HEIGHT`, `DEFAULT_SIZE`, `DEFAULT_FRACTION`
- **Edges:** `bezierPath`, `anchorOf`, `midpoint`, `edgeEnds`
- **Presses:** `NOT_A_DRAG`, `startsADrag`
- **Other:** `createFrameStore`, `validateCanvasProps`, `DEFAULT_FEATURES`, `ITEM_ID_ATTR`, `SWEEPING_CLASS`

## Files

```
src/
  index.js                 ─ public exports
  pages.jsx                ─ XeplrCanvas (controller + design)
  geometry.js              ─ move, resize, snap, stack, fractions, hit-testing
  edges.js                 ─ anchors and bezier paths
  frameStore.js            ─ per-frame store the overlays subscribe to
  validateCanvas.js        ─ loud failure on a mis-wired canvas
  useCanvasController.js   ─ features, selection, groups
  useCanvasDrag.js         ─ drag and resize pointer lifecycle
  press.js                 ─ which presses belong to a control, not the canvas
  useMarquee.js            ─ marquee select
  useCanvasSize.js         ─ measured canvas size
  designs/
    CanvasSample.jsx · EdgeLayer.jsx · DragGuides.jsx · MarqueeBox.jsx · ResizeHandles.jsx
    canvas.css
```

## Tests

```sh
npm test
```

Geometry, snapping, resize limits, fractions, marquee hits and edge paths are covered by plain Node scripts, with no test framework. `press.js` is tested the same way — it is deliberately React-free so it can be.

## License

MIT
