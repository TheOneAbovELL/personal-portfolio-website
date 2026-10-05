import { About } from "@/components/sections/About";
import { Ask } from "@/components/sections/Ask";
import { Capabilities } from "@/components/sections/Capabilities";
import { Contact } from "@/components/sections/Contact";
import { Experience } from "@/components/sections/Experience";
import { Garage } from "@/components/sections/Garage";
import { Hero } from "@/components/sections/Hero";
import { SelectedWork } from "@/components/sections/SelectedWork";
import { profile, site } from "@/content";

// Re-generate at most every six hours so the Garage and the Codeforces figure stay current.
export const revalidate = 21600;

const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: profile.name,
  url: site.url,
  email: `mailto:${profile.email}`,
  jobTitle: profile.roles[0],
  description: site.description,
  sameAs: profile.socials.map((social) => social.href),
  alumniOf: [
    { "@type": "CollegeOrUniversity", name: "Birla Institute of Technology, Mesra" },
    { "@type": "CollegeOrUniversity", name: "Indian Institute of Technology, Madras" },
  ],
};

/**
 * The homepage, in narrative order:
 *   who he is → how he thinks → what he can do → ask anything → the proof (and the
 *   research inside it) → where he has worked → everything else he builds → how to reach him.
 * The order of sections here must match `site.sections`, which numbers the sectors.
 */
export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd).replace(/</g, "\\u003c") }}
      />
      <Hero />
      <About />
      <Capabilities />
      <Ask />
      <SelectedWork />
      <Experience />
      <Garage />
      <Contact />
    </>
  );
}
