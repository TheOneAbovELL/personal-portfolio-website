import type { NowGroup } from "./types";

/**
 * What Omjee is doing right now. Meant to be edited every few months —
 * update `updated` whenever the list changes. Only list things that are actually current.
 */
export const now: { updated: string; groups: NowGroup[] } = {
  updated: "2026-10",
  groups: [
    {
      label: "Building",
      items: [
        {
          title: "Legal Lens",
          note: "The retrieval pipeline, its evaluation harness and the research workspace.",
          href: "/work/legal-lens",
        },
        {
          title: "ARGUS",
          note: "A deterministic quantitative research backend.",
          href: "/work/argus",
        },
      ],
    },
    {
      label: "Researching",
      items: [
        {
          title: "Multi-branch qEEG subtyping",
          note: "CNN, graph and Transformer branches over 19-channel EEG.",
          href: "/work/qeeg",
        },
      ],
    },
    {
      label: "Exploring",
      items: [
        { title: "Agentic AI" },
        { title: "Advanced retrieval" },
        { title: "Quantitative systems" },
        { title: "AI infrastructure" },
      ],
    },
  ],
};
