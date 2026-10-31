import { RouteWipe } from "@/components/loader/RouteWipe";

/**
 * Re-mounted on every navigation, so each page fades in.
 * Opacity only: a transform here would break `position: fixed` inside the page.
 * The route veil sits beside the page, not around it, for the same reason.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="page-enter">{children}</div>
      <RouteWipe />
    </>
  );
}
