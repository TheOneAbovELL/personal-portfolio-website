import Link from "next/link";
import type { ComponentProps } from "react";
import { Icon, type IconName } from "./Icon";

type Variant = "primary" | "secondary" | "ghost";

const BASE =
  "group/btn inline-flex min-h-11 items-center justify-center gap-2.5 whitespace-nowrap px-5 label text-[0.75rem] transition-colors duration-[var(--dur-fast)] ease-[var(--ease-snap)]";

const VARIANT: Record<Variant, string> = {
  primary: "bg-bone text-carbon hover:bg-signal",
  secondary: "border border-rule-strong text-bone hover:border-bone",
  ghost: "px-0 text-steel hover:text-bone",
};

interface ButtonLinkProps extends Omit<ComponentProps<"a">, "href"> {
  href: string;
  variant?: Variant;
  icon?: IconName;
}

const isExternal = (href: string) => /^(https?:|mailto:)/.test(href);
const isFile = (href: string) => /\.[a-z0-9]+$/i.test(href);

/** A link styled as a button. External links and files open in a new tab. */
export function ButtonLink({ href, variant = "primary", icon, className = "", children, ...rest }: ButtonLinkProps) {
  const classes = `${BASE} ${VARIANT[variant]} ${className}`;
  const content = (
    <>
      <span>{children}</span>
      {icon && (
        <Icon
          name={icon}
          size={14}
          className="transition-transform duration-[var(--dur-fast)] ease-out group-hover/btn:translate-x-0.5"
        />
      )}
    </>
  );

  if (isExternal(href) || isFile(href)) {
    const newTab = !href.startsWith("mailto:");
    return (
      <a
        href={href}
        className={classes}
        {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        {...rest}
      >
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={classes} {...rest}>
      {content}
    </Link>
  );
}
