import { useCallback, useRef, useState } from 'react'

// The measured size of an element — what a PAGE is on a fractional canvas.
//
// Returns [size, ref]. Put the ref on the element to measure (the scrolling
// wrapper, not the canvas inside it: measuring the canvas would feed its own
// growth back into the page height and never settle).
//
// A CALLBACK ref, not an effect with a dependency list. The observer has to
// attach when the NODE appears, and there is no dependency list that reliably
// names that moment: a page that renders "Loading…" first has no node on
// mount, the effect runs once against a null ref and never again, and every
// fractional item is converted against a null canvas — present in the DOM,
// sized to nothing. A callback ref is called BY React when the node mounts
// and unmounts, so it cannot be out of step with the DOM.
export function useCanvasSize() {
  const [size, setSize] = useState(null)
  const observerRef = useRef(null)
  const ref = useCallback((el) => {
    observerRef.current?.disconnect()
    observerRef.current = null
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      // Ignored while zero — a hidden tab reports 0x0, and taking that as the
      // canvas would collapse every item to nothing and then scale them back
      // up on return.
      if (width <= 0 || height <= 0) return
      // Compared before storing: an unchanged size must not be a new object,
      // or every scroll and reflow re-renders the whole board.
      setSize((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }))
    })
    observer.observe(el)
    observerRef.current = observer
  }, [])
  return [size, ref]
}
