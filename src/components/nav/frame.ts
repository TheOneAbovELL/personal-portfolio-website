/**
 * The page's scroll offset, read once per animation frame and shared.
 *
 * Reading `window.scrollY` inside a scroll listener forces layout, and a wheel burst fires many
 * scroll events per frame. Everything in the header that follows the scroll — the backdrop,
 * the tuck, the Ask capsule — subscribes here instead: one listener, one rAF, one read, and
 * subscribers are only told when the offset actually changed.
 */

type Listener = () => void;

let y = 0;
let frame = 0;
let bound = false;
const listeners = new Set<Listener>();

const read = () => {
  frame = 0;
  const next = window.scrollY;
  if (next === y) return;
  y = next;
  listeners.forEach((listener) => listener());
};

const onScroll = () => {
  if (!frame) frame = requestAnimationFrame(read);
};

export const scrollFrame = {
  /** The offset as of the last frame; never forces layout. */
  getY: (): number => y,

  subscribe(listener: Listener): () => void {
    if (!bound) {
      bound = true;
      y = window.scrollY;
      window.addEventListener("scroll", onScroll, { passive: true });
    }
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (listeners.size > 0) return;
      bound = false;
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    };
  },
};
