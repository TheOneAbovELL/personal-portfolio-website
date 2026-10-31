import { prefersReducedMotion } from "@/lib/motion";

/**
 * Glide to a homepage section. While Lenis drives the page (fine pointers, no reduced-motion
 * preference) the glide is Lenis's own: it listens for clicks on same-page anchors, so a
 * throwaway anchor is clicked and its native jump cancelled — Lenis still sees the click and
 * eases there, honouring the section's scroll-margin. Without Lenis the browser scrolls.
 */
export function scrollToSection(id: string): void {
  const target = document.getElementById(id);
  if (!target) return;

  if (document.documentElement.classList.contains("lenis") && !prefersReducedMotion()) {
    const anchor = document.createElement("a");
    anchor.href = `${window.location.pathname}#${id}`;
    anchor.hidden = true;
    anchor.addEventListener("click", (event) => event.preventDefault());
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    return;
  }

  target.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
}
