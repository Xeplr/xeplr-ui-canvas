import { useCallback, useMemo, useRef, useState } from 'react'
import { GRID, canvasBounds, inStackOrder, pixelRect, toFraction } from './geometry.js'
import { useCanvasDrag } from './useCanvasDrag.js'
import { useMarquee } from './useMarquee.js'
import { useCanvasSize } from './useCanvasSize.js'

// The ready-made canvas's controller: features, selection and the gestures,
// wired together. No JSX — XeplrCanvas (pages.jsx) hands this to a design.
//
// A builder with a selection model of its own (the BI dashboard: groups you
// click into, a property drawer) uses useCanvasDrag / useMarquee directly
// instead, and keeps its own. This is the version for a builder that just
// wants a canvas.

export const DEFAULT_FEATURES = {
  drag: true,
  resize: false,
  snap: true,
  grid: GRID,
  marquee: false
}

/** Below this, a press on an item is a click and not a drag. */
const CLICK_THRESHOLD = 4

export function useCanvasController(props) {
  const {
    items, units = 'px', features, edges, selection,
    onItemClick, onRaise, minSizeFor,
    padding, minWidth = 0, minHeight = 0
  } = props
  // onItemChange and onSelectionChange are read through propsRef below, so a
  // new inline handler from the caller never rebuilds the gestures.

  const f = useMemo(() => ({ ...DEFAULT_FEATURES, ...features }), [features])
  const fraction = units === 'fraction'

  // Measured only for a fractional canvas, where a page IS the visible size.
  const [measured, measureRef] = useCanvasSize()
  const canvas = fraction ? measured : null
  const canvasRef = useRef(canvas); canvasRef.current = canvas
  const rootRef = useRef(null)

  // SELECTION — controlled when `selection` is passed, owned here otherwise.
  const [ownSelection, setOwnSelection] = useState(() => new Set())
  const selected = useMemo(
    () => (selection ? new Set(selection) : ownSelection),
    [selection, ownSelection]
  )
  // Read through refs by the handlers, so they stay stable.
  const selectedRef = useRef(selected); selectedRef.current = selected
  const itemsRef = useRef(items); itemsRef.current = items
  const propsRef = useRef(props); propsRef.current = props

  const setSelected = useCallback((next) => {
    if (!propsRef.current.selection) setOwnSelection(next)
    propsRef.current.onSelectionChange?.(next)
  }, [])

  // A GROUP IS ONE THING: touching any member takes the whole group.
  const withGroups = useCallback((ids) => {
    const all = itemsRef.current
    const picked = new Set()
    ids.forEach((id) => {
      const item = all.find((x) => x.id === id)
      if (item?.groupId) all.filter((x) => x.groupId === item.groupId).forEach((x) => picked.add(x.id))
      else picked.add(id)
    })
    return picked
  }, [])

  // Pixels in, the item's own units out.
  const commit = useCallback((id, patch) => {
    const { onItemChange: write, units: u } = propsRef.current
    if (!write) return
    if (u !== 'fraction') return write(id, patch)
    const current = itemsRef.current.find((w) => w.id === id)
    if (!current || !canvasRef.current) return write(id, patch)
    write(id, toFraction({ ...pixelRect(current, 'fraction', canvasRef.current), ...patch }, canvasRef.current))
  }, [])

  const drag = useCanvasDrag({
    items,
    units,
    canvas,
    rootRef,
    onUpdate: commit,
    onRaise,
    onClick: onItemClick,
    minSizeFor,
    snap: f.snap,
    grid: f.grid,
    clickThreshold: CLICK_THRESHOLD
  })
  const dragRef = useRef(drag); dragRef.current = drag

  const marquee = useMarquee({
    items,
    units,
    canvas,
    canvasElRef: rootRef,
    onSelect: useCallback((ids, additive) => {
      const picked = withGroups(ids)
      if (!additive) return setSelected(picked)
      const next = new Set(selectedRef.current)
      picked.forEach((id) => next.add(id))
      setSelected(next)
    }, [withGroups, setSelected]),
    onClear: useCallback(() => {
      if (selectedRef.current.size) setSelected(new Set())
    }, [setSelected])
  })

  // PRESS ON AN ITEM. Modifier toggles it in the selection; otherwise it
  // drags — the whole selection when the item is part of one, else the item
  // (and its group) alone.
  const onItemMouseDown = useCallback((e, id) => {
    if (e.button !== 0) return
    const modifier = e.ctrlKey || e.metaKey || e.shiftKey
    const members = [...withGroups([id])]
    const current = selectedRef.current

    if (modifier) {
      const next = new Set(current)
      const allIn = members.every((m) => next.has(m))
      members.forEach((m) => (allIn ? next.delete(m) : next.add(m)))
      setSelected(next)
      return
    }

    const ids = current.has(id) && current.size > 1 ? [...current] : members
    const same = ids.length === current.size && ids.every((x) => current.has(x))
    if (!same) setSelected(new Set(ids))
    if (propsRef.current.features?.drag === false) return
    dragRef.current.startDrag(e, ids)
  }, [withGroups, setSelected])

  const onResizeStart = useCallback((e, id, handle) => {
    dragRef.current.startResize(e, id, handle)
  }, [])

  // Pixel rects, by id — what the items and edges are drawn from.
  const rectById = useMemo(() => {
    const map = {}
    items.forEach((item) => { map[item.id] = pixelRect(item, units, canvas) })
    return map
  }, [items, units, canvas])

  const itemById = useMemo(() => {
    const map = {}
    items.forEach((item) => { map[item.id] = item })
    return map
  }, [items])

  // How big the inner canvas is: enough for everything on it, never less
  // than the minimum. A fractional canvas is at least one page.
  const size = useMemo(() => {
    const bounds = canvasBounds(Object.values(rectById), padding)
    if (fraction) {
      return { width: '100%', height: Math.max(canvas ? canvas.height : 0, bounds.height, minHeight) }
    }
    return { width: Math.max(minWidth, bounds.width), height: Math.max(minHeight, bounds.height) }
  }, [rectById, padding, fraction, canvas, minWidth, minHeight])

  return {
    rootRef,
    measureRef,
    features: f,
    stacked: useMemo(() => inStackOrder(items), [items]),
    rectById,
    itemById,
    edges: edges || [],
    selected,
    size,
    guideStore: drag.guideStore,
    marqueeStore: marquee.marqueeStore,
    onCanvasMouseDown: f.marquee ? marquee.onMouseDown : undefined,
    onItemMouseDown,
    onResizeStart
  }
}
