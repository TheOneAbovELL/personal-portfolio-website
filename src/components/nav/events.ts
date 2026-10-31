/**
 * The small contract between the navigator, the floating Ask control and the Ask console.
 * Window events keep them decoupled: none imports another's component.
 */

/** Open the navigator. `detail` is a NavigatorRequest. */
export const NAVIGATOR_EVENT = "omjee:navigator";

/** Hand a question to the Ask console. `detail` is { question: string }. */
export const ASK_EVENT = "omjee:ask";

/** Where a question waits while the visitor is taken to the homepage to have it answered. */
export const ASK_PENDING_KEY = "omjee:ask-pending";

export interface NavigatorRequest {
  /** Prefill the navigator's filter. */
  query?: string;
  /** Development stills only: the programme slug to preview on open. */
  preview?: string;
  /** Development stills only: open without the entrance motion, for screenshots. */
  still?: boolean;
}

export const openNavigator = (request: NavigatorRequest = {}): void => {
  window.dispatchEvent(new CustomEvent<NavigatorRequest>(NAVIGATOR_EVENT, { detail: request }));
};

/** True while focus is somewhere the visitor types, so single-key shortcuts must stand aside. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) {
    return !["button", "checkbox", "radio", "range", "reset", "submit", "color", "file", "image"].includes(target.type);
  }
  return false;
}

/** Ask the console a question now (it is on the page) or once the homepage has loaded. */
export function sendToAsk(question: string, onHomepage: boolean): void {
  if (onHomepage) {
    window.dispatchEvent(new CustomEvent(ASK_EVENT, { detail: { question } }));
    return;
  }
  try {
    sessionStorage.setItem(ASK_PENDING_KEY, question);
  } catch {
    // Storage can be unavailable (private windows); the visitor still lands on the console.
  }
}

/** A question left by `sendToAsk` before a navigation, taken once. */
export function takePendingQuestion(): string | null {
  try {
    const question = sessionStorage.getItem(ASK_PENDING_KEY);
    if (question) sessionStorage.removeItem(ASK_PENDING_KEY);
    return question;
  } catch {
    return null;
  }
}
