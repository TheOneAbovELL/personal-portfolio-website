/**
 * Re-mounted on every navigation, so each page fades in.
 * Opacity only: a transform here would break `position: fixed` inside the page.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
