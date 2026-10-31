import Link from "next/link";
import type { ComponentProps } from "react";
import { Icon, type IconName } from "./Icon";

type Variant = "primary" | "secondary" | "ghost";

/* Colour eases over 300 ms; the press itself is quick and precise (scale 0.98 in 120 ms). */
const BASE =
  "group/btn inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-pill px-5.5 text-[0.9375rem] font-medium tracking-[-0.01em] transition-[background-color,border-color,color,transform] [transition-duration:300ms,300ms,300ms,120ms] ease-[var(--ease-soft)] active:scale-[0.98] active:[transition-duration:300ms,300ms,300ms,80ms]";

const VARIANT: Record<Variant, string> = {
  primary: "bg-bone text-carbon hover:bg-white",
  secondary:
    "border border-[rgb(239_235_228/0.12)] bg-[rgb(239_235_228/0.04)] text-bone hover:border-[rgb(239_235_228/0.24)] hover:bg-[rgb(239_235_228/0.08)]",
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
          className="transition-transform duration-[var(--dur-fast)] ease-[var(--ease-snap)] group-hover/btn:translate-x-0.5 group-active/btn:translate-x-1"
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
