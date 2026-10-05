/**
 * The research thread: what is being studied and how a recording moves through the system.
 * Each step reflects the qEEG project as described in `projects.ts` — keep the two in sync.
 */

/**
 * Where a stage of the chain stands, per the case study's "results so far": the signal
 * pipeline and feature extraction are implemented; the classifier and the workflow that
 * drafts the report are being built. The recording itself is the input.
 */
export type ResearchStage = "input" | "implemented" | "in-build";

export const researchStageLabel: Record<ResearchStage, string> = {
  input: "Input",
  implemented: "Implemented",
  "in-build": "In build",
};

interface ResearchStep {
  label: string;
  note: string;
  stage: ResearchStage;
}

const flow: ResearchStep[] = [
  { label: "19 channels", note: "Raw EEG recording", stage: "input" },
  { label: "Signal", note: "Filter, ICA, re-reference, epoch", stage: "implemented" },
  { label: "Features", note: "Spectral, connectivity, nonlinear", stage: "implemented" },
  { label: "Model", note: "1D-CNN + GCN + Transformer", stage: "in-build" },
  { label: "Subtype", note: "Six-class output", stage: "in-build" },
  { label: "Report draft", note: "For clinician review", stage: "in-build" },
];

export const research = {
  project: "qeeg",
  intro:
    "The research side of the work asks a narrower question than the engineering side: given a noisy biological signal, what can a model actually learn from it — and how should the pipeline around that model be built so every stage can be inspected?",
  flow,
  disclaimer: "Research prototype. No results are reported yet, and nothing here is clinically validated.",
};
