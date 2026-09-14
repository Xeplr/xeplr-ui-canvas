// A tiny external store for per-frame gesture state — guides, the marquee
// band, live drag positions.
//
// The whole point is that NOTHING ELSE RE-RENDERS during a gesture. Held in a
// page's state, every frame of a drag re-rendered the page and every card on
// it, sixty times a second, to move two thin lines. Published here, only the
// overlay leaves that subscribe (useSyncExternalStore) re-render.
//
// A new snapshot object per publish, because useSyncExternalStore compares by
// identity.

export function createFrameStore(initial) {
  let snapshot = initial
  const subs = new Set()
  return {
    subscribe(cb) {
      subs.add(cb)
      return () => { subs.delete(cb) }
    },
    getSnapshot() { return snapshot },
    publish(next) {
      snapshot = next
      subs.forEach((cb) => cb())
    }
  }
}
