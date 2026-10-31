/** A function that gives the event loop a turn, resolving on a later task. */
export type Yield = () => Promise<void>;

/** Longest the yield waits for a frame before carrying on regardless (frames can be throttled). */
const FRAME_WAIT_MS = 50;

const channel = typeof MessageChannel === "undefined" ? null : new MessageChannel();
const waiters: (() => void)[] = [];
if (channel) {
  channel.port1.onmessage = () => {
    const batch = waiters.splice(0);
    for (const resolve of batch) resolve();
  };
}

/** Resolve on a fresh macrotask: a MessageChannel message, which (unlike setTimeout) is never throttled. */
const task = (): Promise<void> => {
  if (!channel) return new Promise((resolve) => setTimeout(resolve, 0));
  return new Promise((resolve) => {
    waiters.push(resolve);
    if (waiters.length === 1) channel.port2.postMessage(null);
  });
};

/** Resolve once the next frame has been painted, or after FRAME_WAIT_MS if none comes. */
const frame = (): Promise<void> =>
  new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    const timer = setTimeout(finish, FRAME_WAIT_MS);
    requestAnimationFrame(() => {
      clearTimeout(timer);
      // The callback runs before paint; the task after it runs once the frame is out.
      task().then(finish);
    });
  });

/**
 * Hand the main thread back between the steps of a long build, so that a frame — the
 * loader's lap, the page's own animation — is painted between every two steps. A plain
 * `scheduler.yield` is not enough: its continuations are run ahead of rendering, so a chain
 * of 30 ms steps still shows as one long frame. In a hidden tab frames never come, so there
 * the yield is just a task boundary.
 */
export const yieldToMain: Yield = () => {
  if (typeof document !== "undefined" && document.hidden) return task();
  return frame();
};

/** Run every step without yielding: for callers that need the result at once. */
export const noYield: Yield = () => Promise.resolve();
