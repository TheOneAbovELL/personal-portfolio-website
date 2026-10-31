import type { TitledNote } from "./types";

export const profile = {
  name: "Omjee R Giri",
  firstName: "Omjee",
  /** Shown under the name; keep to three short descriptors. */
  roles: ["AI / ML Engineer", "Data Science", "Systems Builder"],
  statement:
    "I build intelligent systems and the engineering underneath them — retrieval pipelines, model architectures, and the backends that keep them reliable.",

  email: "omjeergiri@gmail.com",

  availability: {
    open: true,
    label: "Open to internships",
    note: "Open to internships in AI/ML engineering, software engineering, data science and quantitative research.",
  },

  /** Served by app/resume.pdf/route.ts from the Drive folder in lib/resume.ts; public/resume-fallback.pdf is the offline copy. */
  resume: {
    href: "/resume.pdf",
    fileName: "Omjee_R_Giri_Resume.pdf",
  },

  socials: [
    { id: "github", label: "GitHub", handle: "TheOneAbovELL", href: "https://github.com/TheOneAbovELL" },
    { id: "linkedin", label: "LinkedIn", handle: "omjee-r-giri", href: "https://www.linkedin.com/in/omjee-r-giri/" },
    { id: "codeforces", label: "Codeforces", handle: "The0NEAboveALL", href: "https://codeforces.com/profile/The0NEAboveALL" },
    { id: "leetcode", label: "LeetCode", handle: "TheOneAbovELL", href: "https://leetcode.com/u/TheOneAbovELL/" },
    { id: "instagram", label: "Instagram", handle: "omjeergiri", href: "https://www.instagram.com/omjeergiri/" },
  ],

  about: {
    lead: "I don't want to only build models. I want to understand the system around them.",
    paragraphs: [
      "I'm an engineering student working where machine learning meets systems. I'm pursuing a B.Tech in Artificial Intelligence & Machine Learning at BIT Mesra alongside a BS in Data Science from IIT Madras — and most of what I know, I learned by building.",
      "A model is one stage in a longer path. Data has to arrive clean, retrieval has to be measurable, and the API has to keep answering when a provider goes down. That whole path is the part I enjoy: making it work end to end, measuring it honestly, and then making it better.",
    ],
  },

  /** The layers Omjee works across, in order. */
  layers: [
    { label: "Data", note: "Parsing, chunking, signals, features" },
    { label: "Models", note: "Transformers, GNNs, CNNs, LLMs" },
    { label: "Systems", note: "Retrieval pipelines, orchestration graphs, typed APIs" },
    { label: "Infrastructure", note: "Containers, CI, retries and fallbacks" },
    { label: "Applications", note: "Research tools people can actually query" },
  ],

  /** The working loop. Appears as a recurring motif. */
  loop: ["Understand", "Build", "Measure", "Iterate", "Optimize"],

  principles: [
    {
      title: "Build",
      detail:
        "Working software teaches more than reading about it. I learn a system by building it end to end — ingestion to interface.",
    },
    {
      title: "Measure",
      detail:
        "If it isn't measured, it's a guess. Retrieval gets recall and rank metrics; analytics get unit tests; claims get caveats.",
    },
    {
      title: "Optimize",
      detail:
        "Improve on evidence: change one thing, measure again, keep what holds up. Sometimes the simpler component wins.",
    },
  ] satisfies TitledNote[],
} as const;

export type Profile = typeof profile;
