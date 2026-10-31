import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import { AskButton } from "@/components/layout/AskButton";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { INTRO_BOOT } from "@/components/loader/boot";
import { Intro } from "@/components/loader/Intro";
import { RevealObserver } from "@/components/motion/RevealObserver";
import { RaceEnvironment } from "@/components/race/RaceEnvironment";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { profile, site } from "@/content";
import "./globals.css";

// One family for display and body: the width axis gives the expanded display voice.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: site.title, template: site.titleTemplate },
  description: site.description,
  applicationName: profile.name,
  authors: [{ name: profile.name, url: site.url }],
  creator: profile.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: profile.name,
    title: site.title,
    description: site.description,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: site.title,
    description: site.description,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#07090b",
  colorScheme: "dark",
};

// Marks the document as script-capable before first paint, so reveal styles
// (which hide content until it scrolls in) never apply when JavaScript is unavailable.
// Also runs the intro timeline, so it plays (and can be skipped) before hydration (components/loader/boot.ts).
const JS_FLAG = "document.documentElement.classList.add('js');" + INTRO_BOOT;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the inline script below adds a class to <html> before hydration.
    <html
      lang={site.locale}
      className={`${archivo.variable} ${plexMono.variable} antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: JS_FLAG }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <Intro />
        <RaceEnvironment />
        <a
          href="#main"
          className="label fixed left-4 top-4 z-[100] -translate-y-20 bg-bone px-4 py-3 text-carbon focus:translate-y-0"
        >
          Skip to content
        </a>
        <Header />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
        <AskButton />
        <RevealObserver />
        <SmoothScroll />
      </body>
    </html>
  );
}
