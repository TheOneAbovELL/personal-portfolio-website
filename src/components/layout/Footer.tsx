import Link from "next/link";
import { formatMonth, now, profile } from "@/content";

/** End of session: identity, the ways out, and when the data was last touched. */
export function Footer() {
  const year = new Date().getFullYear();
  const links = [
    ...profile.socials.map((social) => ({ label: social.label, href: social.href, external: true })),
    { label: "Email", href: `mailto:${profile.email}`, external: false },
    { label: "Résumé", href: profile.resume.href, external: true },
  ];

  return (
    <footer className="relative z-10 border-t border-rule bg-carbon">
      <div className="scale-ticks opacity-60" aria-hidden="true" />
      <div className="shell grid gap-x-10 gap-y-10 py-12 md:grid-cols-12">
        <div className="md:col-span-5">
          <p className="display text-[1.75rem]">{profile.name}</p>
          <p className="label mt-3 text-steel">{profile.roles.join(" · ")}</p>
        </div>

        <nav aria-label="Footer" className="md:col-span-4">
          <p className="label text-faint">Elsewhere</p>
          <ul className="mt-3 grid grid-cols-2 gap-x-6">
            {links.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="inline-flex min-h-10 items-center text-[0.9375rem] text-steel transition-colors duration-[var(--dur-fast)] hover:text-bone"
                >
                  <span className="link-draw">{link.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="md:col-span-3">
          <p className="label text-faint">Site</p>
          <ul className="mt-3">
            <li>
              <Link href="/work" className="inline-flex min-h-10 items-center text-[0.9375rem] text-steel transition-colors duration-[var(--dur-fast)] hover:text-bone">
                <span className="link-draw">All case studies</span>
              </Link>
            </li>
            <li>
              <Link href="/#ask" className="inline-flex min-h-10 items-center text-[0.9375rem] text-steel transition-colors duration-[var(--dur-fast)] hover:text-bone">
                <span className="link-draw">Ask Omjee</span>
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-rule">
        <div className="shell flex flex-wrap items-center justify-between gap-x-8 gap-y-2 py-4">
          <p className="label text-faint">
            © {year} {profile.name}
          </p>
          <p className="label hidden text-faint lg:block" aria-hidden="true">
            {profile.loop.join(" → ")}
          </p>
          <p className="label flex items-center gap-2 text-faint">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-champagne" />
            Content updated {formatMonth(now.updated)}
          </p>
        </div>
      </div>
    </footer>
  );
}
