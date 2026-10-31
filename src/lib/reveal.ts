import type { CSSProperties } from "react";

/**
 * The motion grammar (see globals.css → "Motion grammar"):
 *   rise    body copy — a short lift, decelerating
 *   mask    large type — clipped from below, line by line
 *   snap    small instrumentation — fast and mechanical
 *   trace   lines — drawn left to right
 *   settle  figures and panels — settle with inertia
 *   tick    a timing beat — a readout switching on, lit rosso for a moment
 */
export type RevealKind = "rise" | "mask" | "snap" | "trace" | "settle" | "tick";

/**
 * Props that opt an element into scroll reveals (driven by components/motion/RevealObserver).
 * `index` staggers siblings; `delay` (ms) holds the element back by a fixed beat, e.g. body copy
 * waiting for its heading. Spread onto any element: <p {...reveal("rise", 1)} />
 */
export const reveal = (kind: RevealKind = "rise", index = 0, delay?: number) => ({
  "data-reveal": kind,
  style: {
    "--reveal-index": index,
    ...(delay !== undefined ? { "--reveal-delay": `${delay}ms` } : {}),
  } as CSSProperties,
});

/* ------------------------------------------------------------------------------------------
   Line splitting for `mask` reveals (browser only).

   A heading wrapped so that every rendered line can rise out of its own clip. The split is
   measured from the text as the browser laid it out (Range rects), so it matches the real
   wrapping; it lives only for the duration of the reveal, and `restore` hands the original
   nodes back so the heading wraps naturally again afterwards (and React's own references to
   those nodes stay valid: the originals are moved, never cloned or re-created).
   ------------------------------------------------------------------------------------------ */

interface Segment {
  node: Text;
  start: number;
  end: number;
  top: number;
}

/** Inline ancestors of a text node up to (excluding) `root`, outermost first. */
function inlineChain(node: Text, root: HTMLElement): Element[] {
  const chain: Element[] = [];
  let parent = node.parentElement;
  while (parent && parent !== root) {
    chain.unshift(parent);
    parent = parent.parentElement;
  }
  return chain;
}

/** Deep-ish clone of an inline chain holding `text`: the same tags, classes and styles. */
function wrapInChain(chain: Element[], text: string): Node {
  let inner: Node = document.createTextNode(text);
  for (let i = chain.length - 1; i >= 0; i--) {
    const clone = chain[i].cloneNode(false) as Element;
    clone.removeAttribute("id");
    clone.appendChild(inner);
    inner = clone;
  }
  return inner;
}

/**
 * Splits `mask` into `.mask-line > .mask-line-in` rows. Returns a function that restores the
 * original children, or null when the content is not plain inline text (a block subtitle, an
 * image) — the caller then falls back to the whole-mask clip.
 */
export function splitMaskLines(mask: HTMLElement): (() => void) | null {
  // A clone of a link or control would not carry its event handlers: leave those headings whole.
  if (mask.querySelector("a, button, input, img, svg")) return null;
  for (const child of mask.children) {
    if (child.tagName === "BR") continue;
    if (getComputedStyle(child).display !== "inline") return null;
  }

  // Measure every word in place.
  const segments: Segment[] = [];
  const walker = document.createTreeWalker(mask, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const text = node.data;
    const words = /\S+/g;
    for (let match = words.exec(text); match; match = words.exec(text)) {
      range.setStart(node, match.index);
      range.setEnd(node, match.index + match[0].length);
      const rects = range.getClientRects();
      if (rects.length === 0) continue;
      segments.push({ node, start: match.index, end: match.index + match[0].length, top: rects[0].top });
    }
  }
  if (segments.length === 0) return null;

  // Group by line: a new line starts when a word's top moves by more than half a line.
  const lineHeight = parseFloat(getComputedStyle(mask).lineHeight) || 24;
  const lines: Segment[][] = [];
  let lineTop = Number.NEGATIVE_INFINITY;
  for (const segment of segments) {
    if (segment.top - lineTop > lineHeight * 0.5) {
      lines.push([]);
      lineTop = segment.top;
    }
    lines[lines.length - 1].push(segment);
  }
  if (lines.length < 2) return null;

  const original = Array.from(mask.childNodes);
  const rows = document.createDocumentFragment();
  lines.forEach((line, index) => {
    const row = document.createElement("span");
    row.className = "mask-line";
    row.style.setProperty("--line", String(index));
    const inner = document.createElement("span");
    inner.className = "mask-line-in";

    // Consecutive words from the same text node become one run; runs keep their inline styling.
    let run = "";
    let runNode: Text | null = null;
    const flush = () => {
      if (runNode && run) inner.appendChild(wrapInChain(inlineChain(runNode, mask), run));
      run = "";
      runNode = null;
    };
    let prev: Segment | null = null;
    for (const segment of line) {
      const word = segment.node.data.slice(segment.start, segment.end);
      if (runNode && segment.node !== runNode) {
        flush();
        // Two text nodes on one line: keep a space only where the source had whitespace
        // between them ("something<span>.</span>" stays tight).
        const spaced =
          prev !== null &&
          (/\s/.test(prev.node.data.charAt(prev.end)) || /\s/.test(segment.node.data.charAt(segment.start - 1)));
        if (spaced) inner.appendChild(document.createTextNode(" "));
      }
      runNode = segment.node;
      run = run ? `${run} ${word}` : word;
      prev = segment;
    }
    flush();
    row.appendChild(inner);
    rows.appendChild(row);
  });

  mask.replaceChildren(rows);
  mask.dataset.split = "";

  return () => {
    mask.replaceChildren(...original);
    delete mask.dataset.split;
  };
}
