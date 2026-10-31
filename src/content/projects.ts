import type { Project } from "./types";

/**
 * All projects, featured or not.
 *
 * - `featured: true`  → appears on the homepage (sorted by `order`).
 * - `showcase: true`  → a programme on /projects, numbered on from the homepage's.
 * - `visible: false`  → hidden everywhere, kept for later.
 * - A project with a `caseStudy` gets a page at /work/<slug>.
 * - Featured projects are the homepage "programmes": `designation`, `theme` and `brief` shape
 *   that presentation. `brief` only restates the case study below it — keep the two in sync.
 *
 * Accuracy rule: every statement here should be checkable against the project's repository.
 * Prefer leaving a field out over estimating it.
 */
export const projects: Project[] = [
  {
    slug: "legal-lens",
    title: "Legal Lens",
    discipline: "AI / Retrieval systems",
    designation: "Evidence-grounded legal retrieval system",
    theme: "evidence",
    brief: {
      problem:
        "Legal questions punish confident guessing: a general-purpose chatbot will cite a section that does not exist. An answer is only useful if every claim can be traced to a source the reader can open.",
      system:
        "One LangGraph pipeline routes each query by complexity, fuses dense, sparse, metadata and optional graph retrieval, and validates every citation before an answer is accepted.",
    },
    tagline: "Evidence-grounded legal research for Indian law",
    summary:
      "A retrieval-augmented research assistant that answers questions about Indian statutes only from retrieved, cited evidence. The backend is a LangGraph pipeline that routes each query by complexity, fuses several retrieval sources, and validates every citation before an answer is accepted.",
    category: "research",
    status: "active",
    statusNote: "Evaluated on a fixture corpus so far; official corpus ingestion is the next step.",
    featured: true,
    visible: true,
    order: 1,
    year: "2026",
    role: "Backend and retrieval architecture",
    context: "Undergraduate research · Dept. of Computer Science, BIT Mesra",
    stack: [
      "Python",
      "FastAPI",
      "LangGraph",
      "Qdrant",
      "BGE-M3",
      "Groq",
      "SSE",
      "Docker",
      "GitHub Actions",
      "React",
      "TypeScript",
    ],
    figure: "pipeline",
    links: {
      repo: "https://github.com/TheOneAbovELL/legal-lens-backend",
    },
    facts: [
      { label: "Pipeline", value: "16-node LangGraph" },
      { label: "Retrieval", value: "Dense + sparse + metadata + graph" },
      { label: "Routing", value: "3 profiles by query complexity" },
      { label: "Tests", value: "160+ backend, 40+ frontend, Playwright E2E" },
    ],
    caseStudy: {
      problem: [
        "Legal questions punish confident guessing. A general-purpose chatbot will cite a section that does not exist, or quote the Indian Penal Code for an offence that now sits under the Bharatiya Nyaya Sanhita. For legal research, an answer is only useful if every claim can be traced to a source the reader can open.",
        "Legal Lens is built around that constraint. It provides legal information for education and research, answers only from retrieved evidence, and refuses outcome prediction, personal legal advice and litigation strategy.",
      ],
      approach: [
        "Every request — chat, streaming, search, diagnostics — runs through one LangGraph pipeline. API routes never touch the vector store or the prompts directly, so there is exactly one place where retrieval behaviour is defined.",
        "The pipeline understands the query before it retrieves anything: it normalises the text, runs a safety gate, and scores complexity. That score selects one of three retrieval profiles — FAST, BALANCED or DEEP — which decide how many candidates are fetched, which sources are used, and how much context the model receives.",
        "Retrieval is broad, then narrow. Dense and sparse search over Qdrant run concurrently with an exact metadata filter for provisions named in the query and an optional graph lookup. Results are fused with weighted reciprocal-rank fusion, reranked, and packed into a token-budgeted context where every chunk has a citation ID.",
        "The answer is streamed token by token and then checked: citation IDs that don't exist, section numbers that never appeared in the evidence, and uncited answers are all rejected.",
      ],
      architecture: [
        {
          title: "Understand",
          detail:
            "Query normalisation, entity extraction and intent detection are rule-based — no model call. A safety gate can end the request before any retrieval happens.",
        },
        {
          title: "Route",
          detail:
            "A weighted feature score classifies the query as simple, moderate or complex and maps it to FAST (top-k 6), BALANCED (top-k 10) or DEEP (top-k 16, with query decomposition).",
        },
        {
          title: "Retrieve",
          detail:
            "BGE-M3 dense vectors, a BM25-style sparse encoder, an exact act-and-section filter, and an optional Neo4j statute lookup — fused with weighted RRF and de-duplicated by chunk ID and content hash.",
        },
        {
          title: "Ground",
          detail:
            "Reranking, a budgeted context with C1…Cn citation IDs, IPC↔BNS provision mapping, and an evidence gate that returns a fixed \"insufficient evidence\" reply without calling the model.",
        },
        {
          title: "Answer",
          detail:
            "Streaming generation over SSE with typed events for every stage, followed by citation validation. Non-streaming requests get one corrective regeneration.",
        },
      ],
      decisions: [
        {
          title: "One graph for everything",
          detail:
            "Chat, both streaming endpoints, search and route diagnostics share a single graph definition, so there is one description of retrieval behaviour to test and reason about.",
        },
        {
          title: "Routing without a model call",
          detail:
            "Query complexity is a weighted, inspectable feature score rather than an LLM classification. It costs nothing, adds no latency, and can be explained when it routes a query wrong.",
        },
        {
          title: "The simpler reranker won — for now",
          detail:
            "On the fixture set, a lightweight lexical reranker scored slightly better than a cross-encoder at roughly a quarter of the latency, so it is the default. The cross-encoder stays wired in to be re-tested on a real corpus.",
        },
        {
          title: "Named provisions are pinned",
          detail:
            "When a query names a specific section, exact metadata hits enter the context first. Testing showed the reranker could drop the very provision the user asked about.",
        },
        {
          title: "Never truncate legal text",
          detail:
            "Chunks that don't fit the context budget are skipped whole. Half a statutory provision is worse than none.",
        },
        {
          title: "Retrieved evidence is untrusted input",
          detail:
            "Evidence is placed only in the user message, and the system prompt forbids following instructions found inside it.",
        },
      ],
      reliability: [
        "Model calls go through a router with per-target retries, exponential backoff with full jitter, and fallback to the next configured model. For streams, fallback is only allowed before the first token is sent.",
        "Model calls, vector search and the pipeline as a whole each have timeouts, and the optional graph store sits behind a circuit breaker so the pipeline degrades instead of failing.",
        "The test suite runs fully offline — in-memory Qdrant, a hashing embedder and a scripted model — so CI needs no network access or API keys.",
        "CI runs linting, backend tests, an OpenAPI contract diff, frontend type-checks, unit tests and build, and Playwright journeys against a deterministic server.",
      ],
      outcome: [
        "A working end-to-end system: streamed, cited answers; persisted conversations; a search mode that uses the same retrieval engine without generation; and IPC→BNS mapping cards.",
        "An evaluation harness that reports Recall@K, Precision@K, MRR, nDCG, citation validity and latency per query, used to compare chunking and reranking strategies.",
        "Current numbers come from a small fixture corpus of 18 labelled queries. They validate that the pipeline behaves as designed; they are not a claim about answer quality.",
      ],
      limitations: [
        "The official statutory corpus has not been ingested yet, so evaluation is fixture-only.",
        "The IPC↔BNS mapping dataset is curated and still marked unverified.",
        "Rate limiting and session memory are per-process; a shared store is not implemented.",
        "Scanned PDFs are not supported — there is no OCR step.",
      ],
      learnings: [
        "Measure before believing. The component that was supposed to be better lost to a simpler one on this data.",
        "Most reliability work is deciding what should happen when something is missing — weak evidence, a failing provider, an unconfigured store.",
        "A small labelled set is enough to catch regressions and far too small to claim quality. Knowing the difference matters.",
      ],
      next: [
        "Ingest official statute texts and re-run the full benchmark.",
        "Calibrate the evidence threshold and evaluate a legal or multilingual reranker.",
        "Move rate limits and session memory to a shared store.",
      ],
    },
  },

  {
    slug: "argus",
    title: "ARGUS",
    discipline: "Quantitative systems",
    designation: "Deterministic quantitative research backend",
    theme: "market",
    brief: {
      problem:
        "Most \"AI for finance\" projects wire a market-data API to a chatbot, and the model then produces the numbers. A Sharpe ratio that a language model estimated is not a Sharpe ratio.",
      system:
        "A deterministic engine of pure functions computes return, volatility, Sharpe, beta and drawdown. Four rule-based agents interpret the metrics concurrently, and a retrieval layer attaches page-level citations.",
    },
    tagline: "A quantitative research backend where every number is computed, not generated",
    summary:
      "A research terminal for equities built on one rule: no performance metric ever comes from a language model. A deterministic engine computes return, volatility, Sharpe, beta and drawdown; rule-based specialist agents interpret them; and a retrieval layer attaches page-level citations.",
    category: "engineering",
    status: "in-development",
    statusNote: "A research and engineering project — not a trading system.",
    featured: true,
    visible: true,
    order: 5,
    year: "2026",
    role: "Design and implementation",
    context: "Personal project",
    stack: ["Python", "FastAPI", "AsyncIO", "Pydantic", "ChromaDB", "yfinance", "Next.js"],
    figure: "risk",
    links: {
      repo: "https://github.com/TheOneAbovELL/ARGUS",
    },
    facts: [
      { label: "Engine", value: "Return, volatility, Sharpe, beta, drawdown" },
      { label: "Agents", value: "4 rule-based specialists, run concurrently" },
      { label: "Retrieval", value: "Page-level provenance on every excerpt" },
      { label: "Tests", value: "56+ automated tests" },
    ],
    caseStudy: {
      problem: [
        "Most \"AI for finance\" projects are a market-data API wired to a chatbot. The model then does the one thing it should never do: produce numbers. A Sharpe ratio that a language model estimated is not a Sharpe ratio.",
        "ARGUS starts from the opposite assumption. Analytics must be deterministic, reproducible and unit-tested, and any narrative built on top must be traceable to data or to a cited document.",
      ],
      approach: [
        "The backend is layered so that each concern can be tested alone: market data behind a provider interface, a quant engine of pure functions, a portfolio engine that reuses it, an agent layer, and a knowledge layer for document retrieval.",
        "The quant engine computes annualised return, volatility, Sharpe ratio, beta against a benchmark, and maximum drawdown from one year of daily prices. Asset and benchmark histories are fetched concurrently and aligned on shared dates before anything is calculated.",
        "Four specialist agents — market, risk, news and strategy — run concurrently and turn the metrics into a structured read. In this phase they are deliberately rule-based: fixed, documented thresholds and templates, with no language model involved.",
      ],
      architecture: [
        {
          title: "Market data",
          detail:
            "A provider interface over yfinance (quote, adjusted history, news) with retries and thread offloading, plus a mock provider so tests never touch the network.",
        },
        {
          title: "Quant engine",
          detail:
            "Pure functions: CAGR-style annual return, sample volatility × √252, Sharpe on daily excess returns, beta as covariance over benchmark variance, and running-peak drawdown.",
        },
        {
          title: "Portfolio engine",
          detail:
            "Builds a daily-rebalanced, fixed-weight return series and reuses the same five metrics at portfolio level, with strict input validation.",
        },
        {
          title: "Agents",
          detail:
            "Market, risk, news and strategy agents coordinated with asyncio. The strategy agent assembles bull, bear and neutral cases from the others' outputs.",
        },
        {
          title: "Knowledge layer",
          detail:
            "PDF and text loaders, overlapping word-window chunks with stable SHA-256 IDs, ChromaDB with cosine similarity, and ticker-filtered retrieval that returns page-level provenance.",
        },
      ],
      decisions: [
        {
          title: "No metric is ever generated",
          detail:
            "Every number is the output of a tested function. A model may eventually explain a metric; it will never produce one.",
        },
        {
          title: "Agents before language models",
          detail:
            "The agent layer is rule-based on purpose. Contracts, orchestration and concurrency are built and tested first, so a model can later replace the template inside an agent without changing the system around it.",
        },
        {
          title: "Provenance is part of the data type",
          detail:
            "A retrieved excerpt always carries its title, document type, page number, chunk ID and similarity score. Uncited context cannot enter a report.",
        },
        {
          title: "Decisions are written down",
          detail:
            "Architecture decision records live in the repository next to the code they explain.",
        },
      ],
      reliability: [
        "56+ automated tests cover the quant maths, portfolio logic, agents and their coordinator, the retrieval layer, API validation and error handling.",
        "Tests run offline using a mock market-data provider and a hash-based embedding function, so results are deterministic.",
      ],
      outcome: [
        "A FastAPI backend with endpoints for single-asset analysis, portfolio analysis and research, each returning typed, validated responses.",
        "A Next.js client that presents the metrics and agent output as cards and tables.",
      ],
      limitations: [
        "Document ingestion exists as a library but is not yet exposed through the API, so the knowledge store starts empty.",
        "Agents are rule-based; there is no language model in this phase.",
        "No persistence layer or authentication yet.",
        "No trading, order or broker integration — by design.",
      ],
      learnings: [
        "Determinism has to be designed in. Once the numbers are pure functions, everything built on top of them becomes testable.",
        "Writing the boring version of an \"agent\" first makes it obvious which parts actually need a model.",
      ],
      next: [
        "An ingestion pipeline for filings and transcripts.",
        "Model-written narrative inside the existing agent contracts, grounded in retrieved citations.",
        "Persistence, and covariance-based portfolio risk decomposition.",
      ],
    },
  },

  {
    slug: "qeeg",
    title: "qEEG Subtyping",
    fullTitle: "Agentic precision-psychiatry system on multi-branch qEEG subtyping",
    discipline: "Research / Neural signals",
    designation: "Multi-branch deep-learning study on 19-channel EEG",
    theme: "signal",
    brief: {
      problem:
        "Researchers have long asked whether quantitative EEG contains consistent subtypes that symptom-based categories miss. This study asks whether a model can learn them from 19-channel recordings, and what an inspectable pipeline around that model should look like.",
      system:
        "A hybrid classifier fused before a six-class output: a 1D-CNN, a graph convolutional network over channel coherence, and a Transformer. Each stage around it is a separate, replaceable workflow step.",
    },
    tagline: "A multi-branch deep-learning study on 19-channel EEG",
    summary:
      "An exploratory research system that classifies quantitative-EEG recordings into subtypes with a hybrid model — a 1D-CNN, a graph convolutional network over channel coherence, and a Transformer — and wraps the pipeline in an agentic orchestration layer.",
    category: "research",
    status: "research",
    statusNote: "Research prototype. Not clinically validated and not for diagnostic or treatment use.",
    featured: true,
    visible: true,
    order: 2,
    year: "2026",
    role: "Research and implementation",
    context: "Research project",
    stack: ["Python", "PyTorch", "MNE-Python", "NumPy", "SciPy", "n8n", "FastAPI"],
    figure: "montage",
    links: {},
    facts: [
      { label: "Input", value: "19-channel EEG" },
      { label: "Model", value: "1D-CNN + GCN + Transformer" },
      { label: "Output", value: "6-class subtype" },
      { label: "Status", value: "In progress — no results reported" },
    ],
    caseStudy: {
      problem: [
        "Quantitative EEG is an inexpensive, non-invasive recording of brain activity, and researchers have long asked whether it contains consistent subtypes that symptom-based categories miss.",
        "This project explores two questions: can a model learn such subtypes from 19-channel recordings when it is given temporal, spatial and long-range views of the same signal — and what should an automated, inspectable pipeline around that model look like?",
      ],
      approach: [
        "Recordings pass through a conventional signal pipeline first: band-pass filtering, ICA-based artifact removal, re-referencing and epoching.",
        "Three families of features are extracted from the cleaned signal — spectral (Welch band power, frontal alpha asymmetry), connectivity (phase-locking value, coherence) and nonlinear (sample entropy, Hjorth parameters).",
        "The classifier has three branches that are fused before a six-class output: a 1D-CNN for local temporal patterns, a graph convolutional network over a channel graph, and a Transformer with multi-head self-attention for long-range dependencies.",
        "An orchestration workflow carries a recording from file-drop through preprocessing, feature extraction and inference to a recommendation layer that drafts a structured report for clinician review.",
      ],
      architecture: [
        {
          title: "Signal pipeline",
          detail: "Filtering, ICA artifact removal, re-referencing and epoching with MNE-Python.",
        },
        {
          title: "Feature extraction",
          detail: "Spectral, connectivity and nonlinear descriptors computed per epoch.",
        },
        {
          title: "CNN branch",
          detail: "One-dimensional convolutions over each channel's time series.",
        },
        {
          title: "GCN branch",
          detail:
            "Graph convolution over the 19 electrodes, with adjacency built from inter-channel coherence and symmetrically normalised (D^-1/2 · A · D^-1/2).",
        },
        {
          title: "Transformer branch",
          detail: "Multi-head self-attention over the sequence for long-range temporal structure.",
        },
        {
          title: "Orchestration",
          detail:
            "An n8n workflow that sequences preprocessing, features, inference and the report-drafting agent as separate, replaceable steps.",
        },
      ],
      decisions: [
        {
          title: "Three views of one signal",
          detail:
            "Local waveform shape, relationships between electrodes, and long-range temporal structure are different kinds of information. Each branch is given the one it is suited to, rather than asking a single architecture to find all three.",
        },
        {
          title: "The graph comes from the data",
          detail:
            "Electrode adjacency is derived from measured coherence between channels instead of fixed scalp distance, so the graph reflects functional rather than only physical proximity.",
        },
        {
          title: "Orchestration lives outside the model",
          detail:
            "Keeping each stage a separate workflow step makes the pipeline observable and lets any stage be replaced or re-run without touching the others.",
        },
      ],
      outcome: [
        "The signal pipeline and feature extraction are implemented. The hybrid classifier and the orchestration workflow are being built.",
        "No results are reported yet.",
      ],
      limitations: [
        "This is a research prototype. Nothing it produces is validated for clinical decisions.",
        "The recommendation layer is a research artefact intended for study, not for use with patients.",
        "The code is not public yet.",
      ],
      next: [
        "Complete training and evaluation of the fused classifier.",
        "Ablate each branch to measure what it contributes.",
      ],
    },
  },

  {
    slug: "ripple",
    title: "Ripple",
    discipline: "AI / Agent memory",
    designation: "Dependency-aware memory for long-running AI agents",
    theme: "ripple",
    brief: {
      problem:
        "Agents now remember and act for months, and their worst failure is not forgetting — it is acting confidently on knowledge that has gone stale. Most memory systems update the contradicted fact and leave everything built on it behind.",
      system:
        "Every memory is linked to the memories it was derived from. When a fact changes, deterministic code walks those links wave by wave to decide which beliefs are affected; domain rules settle what they can compute, and a schema-validated model decides only how to fix the rest.",
    },
    tagline: "Memory that knows what else to forget",
    summary:
      "A memory system for AI agents that makes the dependencies between memories explicit. When a fact changes, a deterministic engine walks those links wave by wave, and every belief that rested on the fact is kept, updated, retired or turned into a question — with an audit record of why. The first product built on it is a job-hunt assistant for engineering students.",
    category: "research",
    status: "in-development",
    statusNote:
      "In development. RippleBench is synthetic, with a scripted oracle resolver; the real-model comparison and the student pilot have not been run yet.",
    featured: true,
    visible: true,
    order: 3,
    year: "2026",
    role: "Design and implementation",
    context: "Personal project",
    stack: [
      "Python",
      "FastAPI",
      "PostgreSQL",
      "pgvector",
      "SQLAlchemy",
      "Anthropic API",
      "ModernBERT",
      "MCP",
      "Next.js",
      "Redis",
      "Docker",
    ],
    figure: "ripple",
    links: {
      repo: "https://github.com/TheOneAbovELL/RIPPLE",
    },
    facts: [
      { label: "Decisions", value: "Keep, update, retire or ask — per belief" },
      { label: "Propagation", value: "Graph traversal, never a model call" },
      { label: "Invariants", value: "I1–I8, each with a named test" },
      { label: "Evaluation", value: "RippleBench — synthetic, three domains" },
    ],
    caseStudy: {
      problem: [
        "Agents now remember and act for months. Their worst failure is not forgetting; it is acting confidently on knowledge that has gone stale. When a student's CGPA rises, the eligibility verdicts, recommendations and search criteria that were built on the old CGPA have to change too.",
        "Most memory systems update the contradicted fact and leave its dependents behind. Ripple makes the dependencies between memories explicit, and when one changes it re-examines exactly what rested on it — no more, and no less.",
      ],
      approach: [
        "The split is the whole idea: deterministic code decides which memories a change affects, and a language model decides only how to fix each one. Every memory is linked to the memories it was derived from, so the question \"what else does this change?\" is a graph query, not a judgement call.",
        "When a fact changes, intake detects it and links the new version. The ripple engine then walks the dependency links wave by wave — the beliefs derived directly from the fact, then whatever depended on those — by graph traversal alone.",
        "Each affected belief goes to a resolver chain. Domain rules settle what they can compute, such as eligibility from a CGPA and a cutoff. Only the rest goes to the model, and its answer is validated against a schema before it can touch memory.",
        "Every belief ends a ripple kept, updated, retired, or turned into a question for the user when guessing would be wrong — a CGPA on a 4-point scale set against 10-point cutoffs, for example. Each state change leaves an audit record with its reason and evidence.",
      ],
      architecture: [
        {
          title: "Core",
          detail:
            "Models, the store protocol, the ripple engine, intake and the resolver chain — domain-agnostic, so the job-hunt product is one adapter on top of it.",
        },
        {
          title: "Storage",
          detail:
            "PostgreSQL with pgvector through async SQLAlchemy 2 and Alembic migrations; for development it runs embedded, so Docker is not needed.",
        },
        {
          title: "Linking",
          detail:
            "Link finders that propose typed dependency links: rules, a language model, and a trained ModernBERT-base pair classifier.",
        },
        {
          title: "Retrieval",
          detail: "Validity-aware hybrid retrieval with graph expansion, so a retired belief is not served as current.",
        },
        {
          title: "Model layer",
          detail:
            "A provider router, schemas and versioned prompts — the only code in the system that calls a language model.",
        },
        {
          title: "Product",
          detail:
            "The job-hunt adapter (vocabulary, rules, parsers, ranking), agents for conversation, scouting, curation and tailoring, a FastAPI API, an MCP server, Telegram alerts, scheduled jobs and a Next.js dashboard.",
        },
      ],
      decisions: [
        {
          title: "Propagation is never a model call",
          detail:
            "Which beliefs a change reaches is decided by walking explicit links. The traversal is deterministic, testable and the same every time (invariant I3).",
        },
        {
          title: "Rules before the model",
          detail:
            "Anything a domain rule can compute — eligibility from a CGPA and a cutoff — is settled by the rule. The model is asked only about what is left.",
        },
        {
          title: "The model's answer is validated",
          detail:
            "A resolver's output must pass a schema before it changes memory (I4); a malformed answer cannot quietly rewrite a belief.",
        },
        {
          title: "Ask instead of guessing",
          detail:
            "When a belief cannot be settled honestly, it becomes a question parked for the user rather than a confident guess.",
        },
        {
          title: "Nothing changes without a record",
          detail:
            "Every state change writes an audit record with its reason and evidence (I2), which is what answers \"why do you believe this?\".",
        },
        {
          title: "The agent never invents profile facts",
          detail:
            "Facts extracted from a résumé are shown beside the exact line they came from, and nothing enters memory until the student confirms it (I5). Ripple never applies to a job or acts on an external site (I6).",
        },
      ],
      reliability: [
        "Each invariant, I1 to I8, has a named test, and behaviour scenarios replay a user's timeline and assert every memory's state after each event.",
        "The database suite runs against a throwaway embedded Postgres; linting, formatting and type checks run with Ruff and Pyright, and the dashboard has its own lint, tests and build.",
        "When the model is unavailable, the API says so and lists the change events the nightly sweep will finish later. It never claims a ripple it did not complete.",
        "Forgetting removes a memory's whole version chain and cascades along its dependencies (I7); everything can be exported or deleted.",
      ],
      outcome: [
        "A working local system: résumé intake with source lines, openings from pasted job descriptions or forwarded placement emails, derived beliefs with \"why do you believe this?\" one click away, a wave-by-wave view of each ripple, parked questions, Telegram digests and alerts, and an MCP server for other agents.",
        "Structured facts, the rules, the ripple engine, retrieval, the inspector, questions, export and forget all work without a model key; parsing free text and the fallback resolver need one.",
        "RippleBench compares Ripple with append-only, newest-wins and check-everything memory on synthetic, labelled timelines in three domains — jobs, news and finance — with ablations, and the link finder is evaluated against the rule linker with cross-domain transfer.",
      ],
      limitations: [
        "The benchmarks are synthetic and use a scripted oracle resolver, and the reported results come from an uncommitted tree.",
        "The real-model comparison and the student pilot have not been run; the reports give the exact commands and protocol for each.",
        "Paper and thesis drafts render every number from the results directory (invariant I8), so they carry the same limits.",
      ],
      next: [
        "Run the real-model comparison against the same timelines.",
        "Run the student pilot with the job-hunt assistant.",
      ],
    },
  },

  {
    slug: "satquery",
    title: "SatQuery AI",
    fullTitle: "An interactive vision-language assistant for multimodal remote-sensing image analysis through text queries",
    discipline: "AI / Remote sensing",
    designation: "Vision-language assistant for satellite imagery, with measured evidence",
    theme: "orbital",
    brief: {
      problem:
        "Asked about satellite imagery, a vision-language model will happily produce a changed area or a backscatter level it never measured. For remote sensing an answer is only useful if its numbers came from the pixels.",
      system:
        "A modality-aware router sends each question to deterministic geospatial tools — change detection, SAR statistics, cross-modal overlap — and Qwen2-VL with a remote-sensing LoRA interprets the measured evidence. Every answer carries a five-stage execution trace.",
    },
    tagline: "Questions about satellite imagery, answered with measurements and a trace",
    summary:
      "A vision-language assistant for ISRO's Smart India Hackathon 2026 problem statement 26167. It answers natural-language questions over optical, multispectral and SAR imagery by routing each query to deterministic geospatial tools for the measurements, so the model interprets evidence but never invents numbers.",
    category: "engineering",
    status: "prototype",
    statusNote:
      "Feature-frozen team prototype for SIH 2026. Benchmarks (VRSBench, RSVQA, CDVQA) have not been run, and no ISRO/SAC validation is claimed.",
    featured: true,
    visible: true,
    order: 4,
    year: "2026",
    context: "Smart India Hackathon 2026 · Team project",
    stack: ["Python", "FastAPI", "Qwen2-VL", "PEFT (LoRA)", "Rasterio", "Shapely", "NumPy", "SciPy", "Next.js"],
    figure: "satquery",
    links: {
      repo: "https://github.com/TheOneAbovELL/SATQUERY",
    },
    facts: [
      { label: "Modalities", value: "Optical, multispectral, SAR" },
      { label: "Model", value: "Qwen2-VL-2B-Instruct + rank-8 LoRA" },
      { label: "Flows", value: "4 verified: VQA, change, SAR, optical + SAR" },
      { label: "Tests", value: "54 passed, 1 skipped" },
    ],
    caseStudy: {
      problem: [
        "Remote-sensing analysis usually means choosing the right GIS algorithm by hand. A general vision-language model removes that step — and replaces it with a worse one: asked what changed between two scenes, it will produce a changed area it never measured.",
        "SatQuery AI was built for ISRO's Smart India Hackathon 2026 problem statement 26167, an interactive vision-language assistant for multimodal remote-sensing imagery, around one separation: the model interprets imagery and evidence, and deterministic geospatial tools perform the measurements.",
      ],
      approach: [
        "A user uploads imagery and asks a question in plain language. Each GeoTIFF is validated first — coordinate reference system, affine transform, bounds, resolution and band descriptions — and its metadata decides the modality: RGB, multispectral, SAR or grayscale. Invalid files are rejected with a structured error.",
        "A router then picks the capability from the assets themselves: one optical image goes to visual question answering, two optical images to bi-temporal change analysis, one SAR image to the SAR specialist, and an optical image with a SAR image to cross-modal evidence.",
        "The tools compute the numbers: changed-pixel counts and change fractions from masked array differencing and connected regions, SAR statistics in decibels with outlier clipping, and bounding-box IoU between optical and SAR evidence.",
        "Qwen2-VL-2B-Instruct with a remote-sensing LoRA adapter receives that evidence as structured text and writes the answer. It describes and contextualises the measurements; it does not perform the arithmetic.",
      ],
      architecture: [
        {
          title: "Input validation",
          detail:
            "Rasterio inspects CRS, transform, bounds, resolution and band tags; metadata such as Sentinel-1 VV/VH tags determines the modality, and a valid projected CRS enables physical area calculations.",
        },
        {
          title: "Router",
          detail:
            "A deterministic, modality-aware router keyed on asset counts, behind provider interfaces designed to admit open-ended model planning later.",
        },
        {
          title: "Bi-temporal change",
          detail:
            "CRS and overlap checks, NoData masking, pixel differencing, thresholding, a change mask, connected regions, and counts and fractions.",
        },
        {
          title: "SAR specialist",
          detail:
            "VV/VH detection, linear backscatter to decibels, and robust statistics (mean, median, p99) with 2nd–98th percentile clipping against speckle.",
        },
        {
          title: "Cross-modal evidence",
          detail:
            "Change regions on the optical pair against thresholded SAR returns, compared by bounding-box IoU and classified as agreement, disagreement or complementary.",
        },
        {
          title: "Vision-language model",
          detail:
            "Qwen2-VL-2B-Instruct with a PEFT LoRA adapter (rank 8, alpha 16, on the attention projections) loaded at runtime; the base weights are not in the repository.",
        },
        {
          title: "Interface",
          detail:
            "A FastAPI backend and a map-centric Next.js 16 dashboard with asset upload, an image canvas, a query bar, and a timeline trace with an evidence drawer.",
        },
      ],
      decisions: [
        {
          title: "Measurement is not generation",
          detail:
            "Changed-pixel counts, change fractions, area, spectral indices, SAR statistics and bbox IoU come from deterministic code paths where supported. The language model cannot invent them.",
        },
        {
          title: "A deterministic router, for now",
          detail:
            "Routing on asset modality is reliable offline and easy to explain. The interfaces for model-driven planning exist, but the heuristic router is the default.",
        },
        {
          title: "Cautious language for SAR",
          detail:
            "A high-backscatter region is reported as an observation — a candidate reflective target — never automatically as a building, vehicle or metal object.",
        },
        {
          title: "Agreement is corroboration, not truth",
          detail:
            "Optical and SAR agreement is treated as spatial evidence. It is computed on bounding-box envelopes and labelled that way, not as pixel-mask IoU.",
        },
        {
          title: "Confidence is not dressed up",
          detail:
            "Deterministic tools return a fixed confidence of 1.0 and model generations a placeholder; no calibrated probability is claimed.",
        },
        {
          title: "Show the work",
          detail:
            "Every request produces a five-stage execution trace — tool requested, input validated, execution started, execution completed, result validated — so a judge can see which tool produced each number.",
        },
      ],
      reliability: [
        "The backend test suite spans unit, integration and regression tests; the README records 54 passed, 1 skipped (a fixture that needs benchmark data) and none failed.",
        "A pre-flight script checks the environment before a demo, and four flows — single-image VQA, change, SAR and optical + SAR — are documented and verified on generated sample data.",
        "Deterministic analytics run in under a second. Model interpretation on a CPU takes roughly 60–90 seconds, which is the system's bottleneck.",
      ],
      outcome: [
        "A feature-frozen working prototype: single-image VQA and captioning, bi-temporal change detection, SAR analysis and optical + SAR cross-modal comparison, each answered with evidence and an execution trace.",
        "A LoRA adapter trained on 500 UCM-Captions samples on a Colab T4 — a development adaptation, not a proxy for the SIH evaluation sets.",
        "Benchmark adapters for VRSBench, RSVQA and CDVQA are implemented. They have not been run, and no scores are reported.",
      ],
      limitations: [
        "Cross-modal comparison uses bounding-box IoU, not pixel-level mask overlap.",
        "The SAR demonstration data is semi-synthetic, and the second optical scene carries simulated change.",
        "Confidence is heuristic, and routing is rule-based rather than open-ended planning.",
        "Pixel-accurate grounding from the 2B model is limited, and the UCM-Captions licence needs verification before any non-academic use.",
      ],
      next: [
        "Exact pixel-mask cross-modal IoU.",
        "Evaluation on the official benchmarks and on Sentinel-1 / ISRO data.",
        "GPU workers for model throughput, and model-driven routing behind the existing interfaces.",
      ],
    },
  },

  {
    slug: "indian-option-pricer",
    title: "Indian Option Pricer",
    tagline: "Three pricing models side by side, using Indian market conventions",
    summary:
      "An option pricing calculator built around NSE/BSE conventions. Black–Scholes–Merton, antithetic Monte Carlo and a CRR binomial tree are computed side by side, with per-lot Greeks and a Newton–Raphson implied-volatility solver.",
    category: "engineering",
    status: "completed",
    featured: false,
    visible: true,
    order: 10,
    year: "2026",
    stack: ["Python", "FastAPI", "NumPy", "SciPy", "React", "Recharts"],
    links: {
      repo: "https://github.com/TheOneAbovELL/Indian-Option-Pricer",
      demo: "https://indian-option-pricer.vercel.app",
    },
  },

  {
    slug: "signal-feed-india",
    title: "Signal Feed India",
    tagline: "A real-time news dashboard over Indian and global feeds",
    summary:
      "Aggregates RSS feeds with asynchronous ingestion in a separate worker, de-duplication and story clustering, and pushes updates to the browser over WebSockets. Enrichment scores are heuristic.",
    category: "engineering",
    status: "prototype",
    featured: false,
    visible: true,
    order: 12,
    year: "2026",
    stack: ["Python", "FastAPI", "aiohttp", "WebSockets", "SQLAlchemy", "Docker"],
    links: {
      repo: "https://github.com/TheOneAbovELL/signal-feed-india",
    },
  },

  /* ----------------------------------------------------------------------------------------
     /projects — programmes 06–13, in sequence. `showcase: true` puts a project there. Every
     statement comes from the project's own README; numbers are descriptions, not results.
     ---------------------------------------------------------------------------------------- */

  {
    slug: "tracegrade",
    title: "TraceGrade",
    discipline: "AI / Agent evaluation",
    designation: "Execution-tracing evaluation workbench for tool-using agents",
    theme: "trace",
    brief: {
      problem:
        "An agent can give a convincing answer while calling the wrong tool, passing the wrong arguments, breaking a business rule, or claiming an action that never happened. Reading the final answer cannot see any of that.",
      system:
        "An engine runs a fresh agent per scenario, records every tool call, argument, output and side effect, then scores that one execution twice over: exact deterministic checks and, separately, LLM-as-judge metrics with their reasoning kept.",
    },
    tagline: "Evaluate what an agent does, not just what it says",
    summary:
      "A reproducible evaluation workbench for tool-using LangChain agents. It runs an agent against structured scenarios, records the tool calls, arguments, outputs, side effects and trace of each run, and scores behaviour with deterministic checks and LLM-as-judge metrics that are never merged into one number.",
    category: "engineering",
    status: "prototype",
    statusNote:
      "The bundled offline model verifies the pipeline, not model quality. Live runs are recorded on Groq; the OpenAI path is tested offline only.",
    featured: false,
    showcase: true,
    visible: true,
    order: 20,
    year: "2026",
    role: "Design and implementation",
    context: "Personal project",
    stack: ["Python", "LangChain", "DeepEval", "Streamlit", "pytest", "uv", "mypy"],
    figure: "agent-trace",
    links: {
      repo: "https://github.com/TheOneAbovELL/AI-Agent-Evaluation",
    },
    facts: [
      { label: "Scenarios", value: "16 synthetic refund cases" },
      { label: "Metrics", value: "7 deterministic and rule-based, 6 LLM-judge" },
      { label: "Policy modes", value: "Enforced in tools vs prompt-only" },
      { label: "Interfaces", value: "Streamlit UI and CLI on one engine" },
    ],
    caseStudy: {
      problem: [
        "An agent can produce a convincing answer while calling the wrong tools, passing incorrect arguments, violating a business rule, or claiming to have completed an action that never happened. An evaluation that reads only the final answer cannot see any of these failures.",
        "TraceGrade makes them observable. It treats an agent run as evidence — the tool calls, their arguments and outputs, the side effects that actually occurred — and scores behaviour against that record rather than against the agent's own account of it.",
      ],
      approach: [
        "Scenarios are structured JSON: the customer message, a reference answer, the tool calls expected with their arguments, the tools that must never be called, and the refund total that should result. A fixed reference date stands in for \"today\", so time-dependent decisions are reproducible.",
        "For each scenario the engine builds a fresh agent and tool context, executes it once, and records the final answer, every tool call, the tickets issued and the full trace. Every selected metric then scores that same execution; the agent is never re-run per metric.",
        "Scoring has two families, kept apart on purpose. Deterministic checks verify the outcome, tool coverage, arguments, ordering, forbidden actions, and whether the answer matches what was actually done. LLM-as-judge metrics assess task completion, step efficiency, plan quality, plan adherence and answer correctness, with the judge's explanation stored beside each score.",
        "The system under test is a bundled customer-support refund agent built with LangChain's create_agent: it looks up purchase history, checks a 30-day refund window, calculates the refund and issues a ticket.",
      ],
      architecture: [
        {
          title: "Dataset loader",
          detail:
            "Loads and validates scenarios, customer purchase records, the reference date and the expected behaviour for each case.",
        },
        {
          title: "Evaluation engine",
          detail:
            "Coordinates execution, metric evaluation, aggregation and persistence, with configurable concurrency. The web interface and the CLI share it.",
        },
        {
          title: "Agent, tools and ledger",
          detail:
            "The refund agent and its tools — purchase lookup, date, refund calculation, ticket issuance — with a ledger of the side effects that really happened.",
        },
        {
          title: "Trace recorder",
          detail: "Captures tool calls and execution behaviour through the agent's tracing callbacks.",
        },
        {
          title: "Metrics",
          detail:
            "Deterministic checks against expected outcomes, calls, arguments and order, plus DeepEval-backed judge metrics for completion, planning, efficiency and correctness.",
        },
        {
          title: "Run storage",
          detail:
            "Each run is a local JSON record that can be inspected case by case, compared against a baseline, resumed, and exported as JSON, CSV or Markdown.",
        },
      ],
      decisions: [
        {
          title: "One execution, every metric",
          detail:
            "Each scenario runs once and every metric reads the same record, so metrics can disagree about behaviour but never about which run they saw.",
        },
        {
          title: "No single overall score",
          detail:
            "Tool correctness, task completion and answer correctness measure different properties. Mean score and pass rate are reported per metric and never merged.",
        },
        {
          title: "Skipped is not failed",
          detail:
            "A metric that does not apply, or whose judge is unavailable, is recorded as skipped; one that could not be computed is an error. Neither counts as a pass or a failure.",
        },
        {
          title: "Guardrails versus instructions",
          detail:
            "Two policy modes — enforced inside the tools, or stated only in the prompt — separate a model that follows the rules from one that is merely stopped by them. A correct outcome under enforcement does not prove the model understood the policy.",
        },
        {
          title: "Start without keys",
          detail:
            "A deterministic, rule-based offline reference model drives the real agent graph, tools, metrics and storage, so the pipeline can be exercised before any provider is configured.",
        },
      ],
      reliability: [
        "Deterministic metrics are the primary regression gates; LLM-judge scores are treated as model opinions and shown with their explanations.",
        "Runs can be resumed after an interruption, optionally retrying failed cases, and compared against a baseline for metric deltas and case-level regressions.",
        "The CLI validates datasets, checks provider configuration without making a request unless asked, and can fail a CI job on evaluation failures.",
        "The development setup runs unit, integration and UI tests with Ruff, mypy, bandit and pip-audit; live-provider tests are opt-in.",
      ],
      outcome: [
        "A working workbench: a Streamlit interface for configuring evaluations, watching per-case progress, inspecting results, comparing runs, browsing datasets and talking to the agent in a playground — and a CLI over the same engine.",
        "The repository's verification report records the live Groq agent and judge integrations. The OpenAI integration is implemented and tested offline.",
      ],
      limitations: [
        "The offline reference model parses English with simple rules; its results verify the pipeline and dataset, not LLM quality.",
        "LLM-judge scores vary with the judge model and between runs, and DeepEval's plan metrics can return 1.0 when the judge finds no plan in the trace.",
        "The bundled dataset is 16 synthetic, single-turn scenarios — a fixture for the pipeline, not a benchmark.",
        "Runs are stored as local JSON files. There is no multi-user server or authentication.",
      ],
    },
  },

  {
    slug: "rag-workbench",
    title: "RAG Evaluation Workbench",
    discipline: "AI / Retrieval evaluation",
    designation: "Statistically honest evaluation for RAG pipelines",
    theme: "bench",
    brief: {
      problem:
        "RAG systems are easy to demonstrate and hard to evaluate: tooling scores the model's description of its sources, treats failed scores as zero, and reports averages from small datasets with no sense of uncertainty.",
      system:
        "Every case stores the exact context the retriever returned and is scored against it. Skipped and errored scores are counted, not averaged in, and runs are compared question by question with bootstrap confidence intervals.",
    },
    tagline: "Measure a RAG pipeline against the evidence it actually saw",
    summary:
      "A workbench for evaluating retrieval-augmented question answering honestly: it runs a pipeline over a dataset, keeps every answer beside the exact context it was given, and compares runs with paired statistics. It works fully offline, or with an OpenAI-compatible provider for LLM judges.",
    category: "engineering",
    status: "completed",
    statusNote:
      "Version 1.4.1. Judge calibration so far uses AI-generated labels, not human ones, and live provider runs are verified on Groq's free tier only.",
    featured: false,
    showcase: true,
    visible: true,
    order: 21,
    year: "2026",
    role: "Design and implementation",
    context: "Personal project",
    stack: ["Python", "Streamlit", "SQLite", "DeepEval", "fastembed", "uv", "Docker"],
    figure: "run-compare",
    links: {
      repo: "https://github.com/TheOneAbovELL/RAG-evaluation",
    },
    facts: [
      { label: "Retrieval", value: "BM25, local BGE, hybrid RRF" },
      { label: "Answering", value: "Extractive, retrieve-then-generate, tool-calling agent" },
      { label: "Statistics", value: "Bootstrap CIs and paired comparison" },
      { label: "Baseline", value: "Fully offline — no key, no network" },
    ],
    caseStudy: {
      problem: [
        "Retrieval-augmented systems are easy to demonstrate and difficult to evaluate reliably. Three problems recur in typical tooling: the score is computed against the model's description of its sources rather than the evidence it was actually given; failed or skipped scores are quietly treated as zero; and averages from small datasets are reported without any measure of uncertainty.",
        "The workbench is built to answer each of those directly — and to be useful without an account, a server or an API key.",
      ],
      approach: [
        "A run takes a dataset of questions with reference answers and expected context, a document collection, a retriever, an answering mode and a set of metrics. Before anything is written, the runner validates all of it — dataset, documents, metrics, thresholds, credentials and local model availability — and rejects an invalid configuration outright.",
        "For each case the retriever returns its top-k chunks, and that exact context is captured beside the generated answer. Metrics score the answer against the captured context and the reference. In tool-calling agent mode the model chooses its own searches, and the context its tool returned is what gets scored.",
        "Results are committed per case with a heartbeat, so finished work survives and an interrupted run is identifiable. Each metric is reported as a mean with a bootstrap confidence interval, and two runs are compared question by question as wins, ties, losses and paired differences.",
        "A complete offline baseline — BM25 retrieval, extractive answering and lexical metrics — gives every LLM-powered pipeline something reproducible to be measured against.",
      ],
      architecture: [
        {
          title: "Front ends",
          detail:
            "A Streamlit application, the ragwb CLI and a one-command launcher. Both interfaces call the same Python package in-process; there is no separate backend server.",
        },
        {
          title: "Orchestration",
          detail:
            "The runner validates, executes and summarises: retries are centralised here, runs can be cancelled, and each case has its own time limit.",
        },
        {
          title: "Answering",
          detail:
            "Retrievers — BM25, local BGE embeddings through fastembed, a hybrid of the two fused with reciprocal-rank fusion, or OpenAI-compatible embeddings — feeding an extractive, generative or tool-calling answerer.",
        },
        {
          title: "Scoring",
          detail:
            "Lexical, semantic and DeepEval judge metrics per case; aggregation into means, bootstrap intervals, paired comparisons and metadata slices.",
        },
        {
          title: "Persistence",
          detail:
            "SQLite records each run's configuration, dataset and document hashes, package versions, per-case latency, token counts and errors; runs export to CSV, Markdown or re-importable JSON bundles.",
        },
        {
          title: "Operations",
          detail:
            "Health checks, validated backup and restore, pruning that never touches runs tagged keep, judge-noise measurement, calibration, abstention tuning and a regression gate.",
        },
      ],
      decisions: [
        {
          title: "Score the evidence, not the claim",
          detail:
            "A model's description of its sources is not evidence. The context that is scored is the context the retriever or tool returned, captured on every call.",
        },
        {
          title: "Missing is not zero",
          detail:
            "Skipped and errored scores are excluded from averages and counted explicitly, so an unavailable judge cannot drag a metric down unnoticed.",
        },
        {
          title: "Report the uncertainty",
          detail:
            "Small evaluation sets make averages fragile. Bootstrap confidence intervals and paired, question-level comparison show whether a difference between runs is worth believing.",
        },
        {
          title: "Validate before writing",
          detail:
            "Every configuration passes through prepare() before any run data exists, so an invalid setup can never leave a misleading partial run behind.",
        },
        {
          title: "An empty comparison does not pass",
          detail:
            "The regression gate exits with its own code when no valid comparison could be made, rather than reporting that nothing regressed.",
        },
      ],
      reliability: [
        "Per-case time limits run on daemon threads, so a hung provider call cannot block the evaluation; retries live only in the runner, so they never multiply across layers.",
        "SQLite with short-lived connections keeps deployment simple and tolerates Streamlit reruns and worker threads. A backup is validated before it is restored, and a safety copy is taken first.",
        "Access control offers a shared password or named accounts with scrypt-hashed passwords and viewer, editor and admin roles. Listening on the network refuses to start without a login configured, and logs are redacted.",
        "The README's recorded verification for v1.4.1 lists 453 passing tests at 97% coverage; the suite never reaches the network.",
      ],
      outcome: [
        "A versioned release (1.4.1): a Streamlit application and a CLI covering runs, comparison, slicing, export and import, the regression gate, judge-noise measurement, calibration, and backup, restore and pruning.",
        "Judge-validation tools — agreement analysis, Cohen's kappa and threshold sweeps against pass/fail labels — are implemented. The labels used with them so far are AI-generated.",
      ],
      limitations: [
        "No human judge calibration has been done yet: a 30-case labelling sheet exists but is blank, and calibration results so far use AI-generated labels.",
        "Live provider evidence comes from Groq's free tier; runs against OpenAI itself have not been performed.",
        "The Dockerfile has not been built, there has been no independent security review, and screen-reader testing has not been done.",
        "Lexical and semantic metrics are proxies and LLM judges are noisy; thresholds are starting points for calibration, not standards.",
      ],
    },
  },

  {
    slug: "context-illusion",
    title: "The Context Illusion",
    discipline: "Research / Transformer context",
    designation: "CPU-only laboratory for context and retrieval in small Transformers",
    theme: "context",
    brief: {
      problem:
        "Holding information in context is not the same as using it. A model can have the evidence in front of it and still fail to retrieve it — and whether length, position, distractors or the positional encoding is to blame is a question for controlled experiments.",
      system:
        "Synthetic recall tasks set length, evidence position, distance, distractors and lures independently. A small decoder-only Transformer is trained with each of six positional schemes under matched budgets, then inspected with diagnostics and causal interventions.",
    },
    tagline: "When, where and why small Transformers lose the information in their context",
    summary:
      "A local research laboratory for studying how small Transformers lose access to relevant information as context grows: controlled synthetic retrieval tasks, six positional encodings behind one interface, mechanistic diagnostics and causal interventions — on CPU, with no pretrained model and no network.",
    category: "research",
    status: "research",
    statusNote:
      "Research laboratory. Measured results and their limits are documented in the repository; this page describes the experimental design.",
    featured: false,
    showcase: true,
    visible: true,
    order: 22,
    year: "2026",
    role: "Design and implementation",
    context: "Personal project",
    stack: ["Python", "PyTorch", "NumPy", "pandas", "SciPy", "statsmodels", "Streamlit"],
    figure: "context-window",
    links: {
      repo: "https://github.com/TheOneAbovELL/The-Context-Illusion",
    },
    facts: [
      { label: "Positional schemes", value: "6 — NoPE, learned, sinusoidal, T5, ALiBi, RoPE" },
      { label: "Tasks", value: "A–F synthetic retrieval, incl. multi-hop" },
      { label: "Compute", value: "CPU only, no pretrained model" },
      { label: "Interface", value: "12 sections over a study registry" },
    ],
    caseStudy: {
      problem: [
        "Context windows keep growing, but holding information in context is not the same as using it. A model can have the relevant evidence in front of it and still fail to retrieve it — and whether that failure comes from length, from where the evidence sits, from distractors or from the positional encoding is hard to see inside a large pretrained model.",
        "The Context Illusion asks the question under control: when, where and why do small Transformers lose access to relevant information as context grows?",
      ],
      approach: [
        "Every variable is synthetic and adjustable. Tasks A–F are associative-recall problems in which context length, evidence position, distance, distractors, lures and near-miss keys can each be set independently, along with multi-hop chains. An independent oracle validator checks the generated data, and baselines sit beside the models.",
        "The model is a small pre-LN decoder-only Transformer with explicit attention and a hook point on every activation. Six positional schemes — NoPE, learned absolute, sinusoidal, T5 relative bias, ALiBi and RoPE — sit behind one interface, so a comparison changes one thing at a time.",
        "Each research question is a single YAML study specification. A study trains every variant and seed, evaluates the full grid with its controls, and aggregates the result into a report.",
        "Diagnostics and interventions then ask why: attention by role, score gaps, the logit lens, evidence sweeps and positional structure, followed by attention knockout with matched controls, activation patching and head ablation.",
      ],
      architecture: [
        {
          title: "Tasks",
          detail:
            "Generators for tasks A–F with controllable length, evidence position, distance, distractors, lures and near-miss keys; multi-hop chains; an independent oracle validator; baselines.",
        },
        {
          title: "Model",
          detail:
            "A pre-LN decoder-only Transformer with explicit attention and hook points for every activation.",
        },
        {
          title: "Positional schemes",
          detail:
            "NoPE, learned absolute, sinusoidal, T5 relative bias, ALiBi and RoPE behind one interface.",
        },
        {
          title: "Training",
          detail: "AdamW with warm-up and cosine decay, a loss on the answer position, and matched step budgets.",
        },
        {
          title: "Evaluation",
          detail:
            "Example-level result rows, evaluation grids, and Wilson, seed-level and paired statistics.",
        },
        {
          title: "Diagnostics and interventions",
          detail:
            "Attention by role, score gaps, logit lens, evidence sweeps and positional structure; attention knockout, activation patching and head ablation.",
        },
        {
          title: "Studies and interface",
          detail:
            "YAML study specifications, cached runs and a registry that aggregates and analyses them; a Streamlit interface with 12 sections, all backed by registry data.",
        },
      ],
      decisions: [
        {
          title: "Synthetic on purpose",
          detail:
            "Controlled tasks make length, position, distance and interference separately adjustable — something a natural-language benchmark cannot offer.",
        },
        {
          title: "One interface, six encodings",
          detail:
            "Positional schemes are interchangeable behind a single interface, so the encoding is the only thing that changes between variants.",
        },
        {
          title: "No silent extrapolation",
          detail:
            "Learned absolute positions have a hard limit. Asking for a longer sequence is an error, not a quietly degraded result.",
        },
        {
          title: "Matched budgets",
          detail:
            "Variants train for the same number of steps, so a difference between them is not an artefact of unequal training.",
        },
        {
          title: "Runs keyed by configuration",
          detail:
            "A run is cached by a hash of its resolved configuration; rerunning a study trains only what is missing.",
        },
      ],
      reliability: [
        "One command runs environment and package checks and a quick self-check of the data generators and all six positional schemes before the interface opens; tests, studies and the lab report can be added to the same run.",
        "Evaluation keeps example-level rows and reports intervals and paired statistics across seeds, not single numbers.",
        "The code makes no network calls and has no telemetry.",
      ],
      outcome: [
        "The laboratory — tasks, model, six positional schemes, training, evaluation, diagnostics, interventions and the study registry — is implemented and runs locally on CPU.",
        "Measured results and their interpretation are kept in the repository's results document, with a separate limitations document beside it. They are not summarised here.",
      ],
      limitations: [
        "Everything concerns small models trained from scratch on synthetic tasks; nothing here is a claim about large pretrained models.",
        "The repository's limitations document sets out what the results do not show, and is meant to be read alongside them.",
      ],
    },
  },

  {
    slug: "inside-transformers",
    title: "Inside the Transformers",
    fullTitle: "Inside the Transformer — a mechanistic interpretability laboratory",
    discipline: "Research / Mechanistic interpretability",
    designation: "Mechanistic interpretability laboratory for small Transformers",
    theme: "circuit",
    brief: {
      problem:
        "A high accuracy score does not show that a model learned the intended algorithm. It may be copying by position, memorising evaluation sequences, or using a mechanism nobody hypothesised.",
      system:
        "Transparent Transformers trained on tasks with exact solvers are inspected and intervened on — ablation, activation patching, path patching through Q, K and V — and circuit hypotheses are frozen before testing, then replicated on fresh seeds.",
    },
    tagline: "Train small Transformers, inspect their circuits, test what they learn",
    summary:
      "A local laboratory for finding out how small Transformers implement algorithmic tasks: transparent models, controlled tasks with exact solvers, ablation, activation and path patching, and preregistered circuit hypotheses tested on held-out examples across multiple seeds.",
    category: "research",
    status: "research",
    statusNote:
      "Findings are scoped to small models on synthetic tasks — and include results that contradicted the starting hypothesis.",
    featured: false,
    showcase: true,
    visible: true,
    order: 23,
    year: "2026",
    role: "Design and implementation",
    context: "Personal project",
    stack: ["Python", "PyTorch", "Streamlit", "pandas", "pytest", "YAML"],
    figure: "head-circuit",
    links: {
      repo: "https://github.com/TheOneAbovELL/Inside-the-Transformers",
    },
    facts: [
      { label: "Tasks", value: "4 algorithmic tasks with exact solvers" },
      { label: "Interventions", value: "Ablation, activation and path patching" },
      { label: "Hypotheses", value: "Preregistered and frozen before testing" },
      { label: "Ground truth", value: "Hand-wired induction reference model" },
    ],
    caseStudy: {
      problem: [
        "When a small Transformer learns an algorithmic task, its accuracy says that it works, not how. A model can reach a high score through a positional shortcut, by memorising evaluation sequences, or with a mechanism different from the one the researcher expected.",
        "This laboratory is built to ask the harder question — which internal components carry the computation, which are causally important, and how strongly the evidence supports a specific circuit hypothesis — and to make it possible for that hypothesis to be wrong.",
      ],
      approach: [
        "The work follows a fixed sequence: state a hypothesis, build a controlled dataset, train, establish a baseline, inspect, intervene, measure, replicate, and record the conclusion. Each stage is an executable command that leaves a reproducible artefact.",
        "The tasks have known solutions — repeated patterns, associative recall, variable-offset induction, and single-pair induction with distractors and decoys — with exact solvers, held-out pairs and targeted corruptions. A task audit records what each one tests, which shortcuts it allows and what it cannot establish.",
        "Models are transparent decoder-only Transformers with explicit per-head attention, pre-, post- or no layer normalisation, learned, sinusoidal, ALiBi or no positional information, and hook points throughout. Analysis runs from activation caching, direct logit attribution and the logit lens to zero, mean and resample ablation of heads, MLPs and neurons, activation patching with recovery confidence intervals, and path interventions through queries, keys or values.",
        "Circuit hypotheses are written as specifications and frozen, then tested on separate selection and test splits with controls, producing a quantitative verdict that is replicated on seeds trained after the specification was written.",
      ],
      architecture: [
        {
          title: "Models",
          detail:
            "A transparent decoder-only Transformer with explicit attention computations and configurable normalisation and positional schemes.",
        },
        {
          title: "Hand-wired reference",
          detail: "An induction model wired by hand, with known ground truth, for validating the analysis methods themselves.",
        },
        {
          title: "Tasks",
          detail: "Synthetic algorithmic tasks with exact solvers, held-out pairs and corruptions.",
        },
        {
          title: "Training",
          detail: "Resumable, configuration-driven training with recorded seeds and a leakage audit.",
        },
        {
          title: "Interpretability",
          detail:
            "Activation caching and tracing, attribution, ablation and scans, activation patching, and path interventions between heads and MLPs.",
        },
        {
          title: "Hypotheses and registry",
          detail:
            "Preregistered specifications with selection and test splits, controls and verdicts; an experiment registry with reports, comparison and reruns; a CLI and a local Streamlit interface.",
        },
      ],
      decisions: [
        {
          title: "Validate the tools first",
          detail:
            "Before an analysis method is trusted on a learned model, it is checked against the hand-wired model, whose mechanism is already known.",
        },
        {
          title: "Freeze the hypothesis",
          detail:
            "A preregistered analysis refuses to run if its specification has changed after freezing, so a hypothesis cannot be rewritten after the results are in.",
        },
        {
          title: "Separate discovery from confirmation",
          detail:
            "Exploratory investigations generate hypotheses. Only analyses run under a frozen specification are reported as confirmations.",
        },
        {
          title: "Replicate on unseen seeds",
          detail:
            "A result observed on the runs used to form a hypothesis is weak evidence, so findings are rechecked on held-out examples and independently trained seeds.",
        },
        {
          title: "Keep negative results",
          detail: "Failed generalisation, wrong hypotheses and leakage discoveries stay in the research record.",
        },
      ],
      reliability: [
        "A rerun command re-executes a recorded analysis from its saved record and diffs every value against the original; a verify command audits every recorded run for reproducibility.",
        "The test suite spans unit, integration, scientific and regression tests, including validation of the methods against hand-wired ground truth.",
        "Everything runs locally: no telemetry, no remote logging, and the interface binds to localhost.",
      ],
      outcome: [
        "The repository reports its findings with artefact paths, each scoped to the tested models and tasks. In the reported setup, the positional scheme strongly influenced whether an induction circuit formed: with learned absolute positions a two-layer attention-only model plateaued near 35% accuracy on a positional shortcut, while ALiBi runs reached 91–95% across three seeds.",
        "The textbook hypothesis was partly wrong. The expected sharp previous-token head did not emerge; the learned circuit was distributed across layer-1 heads and dominated by key composition, a finding replicated on seeds not used to form the hypothesis.",
        "Accuracy did not identify the mechanism: a fixed-offset model reached 100% accuracy while copying purely by position, and scored 0% on a content-induction control with shuffled inputs.",
      ],
      limitations: [
        "The findings describe small Transformers on synthetic algorithmic tasks; they do not establish how larger language models behave.",
        "Ablation and patching measure the effect of a particular intervention, not a complete explanation of the model's algorithm.",
        "Some observations are exploratory rather than preregistered, and are labelled that way in the repository.",
      ],
      learnings: [
        "Task accuracy is where a mechanistic investigation starts, not where it ends — the controls that separate positional copying from content are what made the difference visible.",
        "Changing the architecture can change the route a computation takes: once MLPs were added, layer-0 information reached the keys mainly through MLP0.",
      ],
    },
  },

  {
    slug: "beyond-quadratic",
    title: "Beyond Quadratic Attention",
    discipline: "Research / ML systems",
    designation: "CPU-first laboratory for attention beyond the quadratic baseline",
    theme: "attention",
    brief: {
      problem:
        "Attention optimisation is usually reported as a speed race. But better complexity does not guarantee faster execution, lower memory does not guarantee the same numbers, and a faster kernel says nothing about task behaviour.",
      system:
        "Eight attention backends share one interface. A float64 correctness lab, an instrumented benchmark runner, an analytical cost model labelled theory_*, retrieval probes and a switchable tiny Transformer each measure one dimension on its own.",
    },
    tagline: "What attention really costs as sequences grow — in arithmetic, memory, accuracy and time",
    summary:
      "A local research laboratory comparing eight attention implementations — exact softmax, restricted patterns and linear attention — on numerical correctness, memory, memory traffic and wall-clock time as sequence length grows. Theory is labelled as theory, and measurement as measurement.",
    category: "research",
    status: "research",
    statusNote: "Measurements are CPU-only, from the machine actually used. No GPU performance is claimed.",
    featured: false,
    showcase: true,
    visible: true,
    order: 24,
    year: "2026",
    role: "Design and implementation",
    context: "Personal project",
    stack: ["Python", "PyTorch", "NumPy", "pandas", "Matplotlib", "Streamlit", "pytest"],
    figure: "attention-masks",
    links: {
      repo: "https://github.com/TheOneAbovELL/Beyond-Quadratic-Attention",
    },
    facts: [
      { label: "Backends", value: "8 — 5 exact, 2 restricted, 1 linear" },
      { label: "Reference", value: "float64 correctness checks" },
      { label: "Theory", value: "Analytical cost model, labelled theory_*" },
      { label: "Tasks", value: "Local copy, offset induction, MQAR" },
    ],
    caseStudy: {
      problem: [
        "Attention scales quadratically with sequence length, and there are many ways around it. They are usually compared as a single speed contest — but an algorithm with better complexity is not necessarily faster on a given CPU and tensor shape, lower measured memory does not establish numerical equivalence, and a faster kernel says nothing about whether a model can still retrieve what it needs.",
        "This laboratory separates those questions: how do attention algorithms trade off computational complexity, memory traffic, numerical accuracy and practical speed as sequences grow?",
      ],
      approach: [
        "Eight backends implement attention behind one interface. Five target the same exact softmax operation: a naive reference that materialises the full score tensor, PyTorch SDPA forced onto its math path, PyTorch's fused tiled CPU kernel, a Python online-softmax tiled implementation, and a tiled variant with a custom backward pass that recomputes probability tiles. Two restrict the pattern — a sliding local window and a local, global and random block-sparse layout — and one, linear attention with φ(x) = elu(x) + 1, is a different formulation altogether.",
        "Each dimension has its own instrument. A correctness lab compares the exact methods against a float64 reference across outputs, gradients, masks, dtypes and magnitudes. A benchmark runner sweeps scaling, tile sizes, thread counts, shapes and dtypes, with three separately scoped memory instruments and a background-load monitor. An analytical model gives theoretical cost, and every one of its outputs is prefixed theory_*.",
        "Task behaviour is tested apart from both: attention-level retrieval probes that need no training, and token-level tasks — local copy, variable-offset induction and multi-query associative recall — on a tiny Transformer whose attention backend can be switched.",
      ],
      architecture: [
        {
          title: "Backends",
          detail:
            "naive, sdpa_math, sdpa_flash_cpu, tiled and tiled_recompute (exact softmax); local_window and block_sparse (restricted); linear_elu (linear attention).",
        },
        {
          title: "Correctness lab",
          detail: "Forward and gradient agreement with a float64 reference across masks, dtypes and numerical magnitudes.",
        },
        {
          title: "Benchmark runner",
          detail:
            "Configured sweeps with raw results, generated tables and figures, three memory instruments and a background-load monitor.",
        },
        {
          title: "Complexity model",
          detail: "Theoretical arithmetic and memory cost for each method, kept apart from measurement by name.",
        },
        {
          title: "Probes and tasks",
          detail:
            "Retrieval probes without training; synthetic tasks on a switchable tiny Transformer; an instrumented recall-training diagnostic.",
        },
        {
          title: "Reporting",
          detail:
            "Findings traceable to the runs recorded under experiments/results, a reproduce command, a CLI over every workflow, and a Streamlit interface.",
        },
      ],
      decisions: [
        {
          title: "Theory is never measurement",
          detail:
            "Analytical estimates carry a theory_* prefix, so a complexity calculation cannot be mistaken for an observed time or memory reading.",
        },
        {
          title: "Correctness and speed are separate",
          detail:
            "Numerical tests contain no timing thresholds, and a method's speed is never taken as evidence of its accuracy.",
        },
        {
          title: "Name the kernel honestly",
          detail:
            "The fused CPU path is PyTorch's own SDPA kernel, not the FlashAttention CUDA library, and it is labelled that way.",
        },
        {
          title: "Compare like with like",
          detail:
            "Restricted and linear methods do not compute dense softmax attention. They are grouped and reported separately rather than presented as drop-in replacements.",
        },
        {
          title: "Failed runs stay visible",
          detail: "Failed, skipped and contended benchmark runs are recorded, not removed.",
        },
      ],
      reliability: [
        "The README reports 420 tests across unit, numerical, integration, scientific and performance-smoke categories; none of them assert on timing.",
        "A smoke benchmark exercises every method on small shapes as an execution-path check, not as a basis for performance conclusions.",
        "A reproduce command reruns the experiments behind the results document, with a dry-run plan and per-experiment selection.",
      ],
      outcome: [
        "All eight backends, the correctness lab, the benchmark runner, the complexity model, the probes, the synthetic tasks, a recall-training diagnostic and a Streamlit interface are implemented.",
        "Machine-specific findings are kept in the repository's results document with the artefacts behind them, together with a write-up of a training plateau on the MQAR task and its diagnosis.",
      ],
      limitations: [
        "Results are CPU measurements on the hardware actually used; they do not predict GPU behaviour.",
        "Synthetic-task results are evidence about those task setups, not about general model capability.",
        "Memory readings depend on the scope and sampling of each instrument and have to be compared with that in mind.",
      ],
    },
  },

  {
    slug: "chesslab",
    title: "ChessLab",
    discipline: "Engineering / Game analysis",
    designation: "Local-first chess analysis lab with a from-scratch engine",
    theme: "chess",
    brief: {
      problem:
        "Chess analysis usually lives behind an account on someone else's server, and the engine doing it is a black box. Understanding where a player's results come from — and how an engine actually searches — needs the games themselves and an engine that can be read.",
      system:
        "A FastAPI backend validates every move, drives Stockfish over UCI with live analysis on a WebSocket, imports public games into SQLite and reviews them in resumable background workers. A pure-Python alpha-beta engine sits beside it to be studied.",
    },
    tagline: "Play, import and review games locally — and study an engine written from scratch",
    summary:
      "A local-first chess analysis laboratory: live Stockfish analysis, game import from Chess.com and Lichess, move-by-move review, statistics drawn only from real games, and an educational UCI engine written in Python. No accounts, no API keys, no telemetry.",
    category: "engineering",
    status: "completed",
    statusNote: "Single-user and local by design. Docker and CI configuration are included but were not executed.",
    featured: false,
    showcase: true,
    visible: true,
    order: 25,
    year: "2026",
    role: "Design and implementation",
    context: "Personal project",
    stack: ["Python", "FastAPI", "python-chess", "Stockfish", "SQLite", "React", "TypeScript", "Vite"],
    figure: "chess-board",
    links: {
      repo: "https://github.com/TheOneAbovELL/Chess-Engine",
    },
    facts: [
      { label: "Engine", value: "Alpha-beta / PVS, PeSTO tapered evaluation" },
      { label: "Imports", value: "Chess.com and Lichess public APIs" },
      { label: "Play", value: "10 Stockfish levels plus the custom engine" },
      { label: "Storage", value: "Local SQLite — no accounts" },
    ],
    caseStudy: {
      problem: [
        "Most chess analysis happens on someone else's server, behind an account, with an engine whose workings are hidden. That is fine for a quick check, and poor for two things: understanding where a player's results actually come from, and understanding how an engine decides what is best.",
        "ChessLab does both on the player's own computer. Games stay in a local database; the analysis comes from Stockfish; and a second engine, written from scratch in Python, is there to be read, measured and improved.",
      ],
      approach: [
        "An interactive board — drag or click, legal-move hints, typed moves, FEN set-up and PGN load and export — is connected to live Stockfish analysis over a WebSocket, with up to five candidate lines, an evaluation bar, a best-move arrow and a variation tree with undo and redo.",
        "Public games are imported by username from Chess.com's Published-Data API and Lichess's games export, with filters, live progress, cancel and retry, and duplicate-safe refreshes that fetch only what is new. PGN upload works too.",
        "Every imported game can be reviewed in the background, position by position and resumably across restarts: the best move against the one played, expected-score and centipawn loss, a documented move classification and a clickable evaluation graph. A dashboard and a personal opening explorer are built from the same games.",
        "The Engine Lab puts Stockfish and the ChessLab engine on the same position and breaks the custom engine's evaluation down by term.",
      ],
      architecture: [
        {
          title: "Frontend",
          detail:
            "React and TypeScript on Vite, using chess.js for instant feedback on the board.",
        },
        {
          title: "API and services",
          detail:
            "Thin FastAPI routers over services for analysis, games, imports, review, statistics and the opening explorer.",
        },
        {
          title: "Engine manager",
          detail:
            "A dedicated engine thread driving Stockfish over UCI, with the ChessLab engine run as its own UCI subprocess.",
        },
        {
          title: "Background workers",
          detail: "Imports and reviews run in background workers, off the request path; a review resumes after a restart.",
        },
        {
          title: "Providers",
          detail: "Polite httpx clients for the public Chess.com and Lichess endpoints — public data only.",
        },
        {
          title: "Custom engine",
          detail:
            "Alpha-beta with PVS, iterative deepening, quiescence search, a transposition table, killer and history heuristics, null-move pruning, late-move reductions, MultiPV and a PeSTO-based tapered evaluation, with benchmarks and a match runner.",
        },
      ],
      decisions: [
        {
          title: "The server has the final word",
          detail:
            "The board uses chess.js to respond instantly, but the backend validates every position and move it receives.",
        },
        {
          title: "Real statistics only",
          detail:
            "The dashboard reports what the games show. Inferred patterns always carry their sample size and confidence.",
        },
        {
          title: "Classifications are documented",
          detail:
            "Moves are classified from best to blunder by ChessLab's own published thresholds, and the app says so — they are not Chess.com's or Lichess's.",
        },
        {
          title: "Engine paths stay on the server",
          detail:
            "Stockfish's location can only be configured on the server, never through the web interface; threads, hash and depth are adjustable within server-set ceilings.",
        },
        {
          title: "Works without Stockfish",
          detail: "If Stockfish is missing, the application still runs on the much weaker built-in engine.",
        },
      ],
      reliability: [
        "Backend tests mock the providers' HTTP but use the real custom engine and the real Stockfish; Stockfish tests are reported as skipped, not passed, when it is not installed.",
        "One check script runs linting, types, unit and integration tests and the build, with Playwright browser tests and live API calls as opt-in flags.",
        "SQLite runs in WAL mode, and re-imports are duplicate-safe.",
      ],
      outcome: [
        "A working local application covering analysis, play, import, game history, review, a statistics dashboard, a personal opening explorer and the Engine Lab.",
      ],
      limitations: [
        "Standard chess only: Chess960 and other variants are skipped on import, with the reason shown.",
        "Single user with no authentication — not meant to face the internet as it is.",
        "The custom engine is pure Python at roughly 10k nodes per second. It plays legal, sensible chess but is far weaker than Stockfish, and no Elo is claimed.",
        "Opening names come from the source; plain PGNs without them show none.",
        "Docker and CI configuration are provided but were not executed in the development environment.",
      ],
      next: [
        "Opening preparation from the explorer, and puzzles generated from a player's own blunders.",
        "A faster engine core — bitboards in Rust or C behind a Python extension — and Texel-tuned evaluation.",
        "Optional authentication for multi-user hosting.",
      ],
    },
  },

  {
    slug: "f1-replay",
    title: "F1 Replay Dashboard",
    discipline: "Engineering / Real-time data",
    designation: "Race replay from OpenF1 car-location data, streamed live",
    theme: "telemetry",
    brief: {
      problem:
        "Community timing data is uneven: coordinates arrive in unexpected units, a session's scheduled times do not bracket the race, and fields go missing. A replay has to be built on what the data contains, not on what the schema promises.",
      system:
        "A Node.js backend ingests a completed race once, converts units at the boundary, derives the circuit and the replay window from the data itself, and streams replay state to a React dashboard over Socket.IO.",
    },
    tagline: "A completed Formula 1 race, replayed from car-location data",
    summary:
      "An unofficial race replay dashboard. A Node.js backend loads a completed race from OpenF1, derives the circuit outline from car-location samples, and streams replay state to a responsive React dashboard over Socket.IO.",
    category: "engineering",
    status: "completed",
    statusNote:
      "Unofficial — not affiliated with or endorsed by Formula 1. Replays completed races from OpenF1 community data.",
    featured: false,
    showcase: true,
    visible: true,
    order: 26,
    year: "2026",
    role: "Design and implementation",
    context: "Personal project",
    stack: ["TypeScript", "Node.js", "React", "Socket.IO", "Vite", "Docker"],
    figure: "race-replay",
    links: {
      repo: "https://github.com/TheOneAbovELL/F1_dashboard",
    },
    facts: [
      { label: "Data", value: "OpenF1 car-location and lap data" },
      { label: "Circuit", value: "Derived from location samples" },
      { label: "Transport", value: "Socket.IO replay stream" },
      { label: "Delivery", value: "One process or one Docker image" },
    ],
    caseStudy: {
      problem: [
        "OpenF1 is a community mirror of a live timing feed, and its data is uneven. Location coordinates are in decimetres, not metres. A session's scheduled start and end do not reliably bracket the race — sessions have been observed whose lap data starts 93 minutes after the scheduled start and runs 79 minutes past the scheduled end. Some fields, such as DRS, are often simply absent.",
        "A replay built on the schema's promises would be wrong in all three places. This one is built on what the data actually contains.",
      ],
      approach: [
        "The backend takes the most recent completed race, or one pinned by session key, and downloads the full session once. Responses are cached on disk, so the first load takes minutes and later starts are quick; the dashboard shows progress while it loads.",
        "The circuit outline is derived from the cars' own location samples, and the replay window from the lap data itself rather than the session's scheduled times.",
        "Replay state is streamed to a responsive React dashboard over Socket.IO. In development Vite proxies the API and the socket to the backend; in production a single process serves the dashboard, the REST API and the stream from one origin.",
      ],
      architecture: [
        {
          title: "Ingest",
          detail: "An OpenF1 client with an on-disk response cache; units are converted once, at ingest, in a single module.",
        },
        {
          title: "Domain",
          detail: "The circuit outline from car-location samples, and the replay window from lap data.",
        },
        {
          title: "Stream and API",
          detail: "Replay state over Socket.IO, and a REST API that lists sessions so a race can be pinned.",
        },
        {
          title: "Dashboard",
          detail: "A responsive React dashboard with its own shell and replay controls, built with Vite.",
        },
        {
          title: "Delivery",
          detail:
            "A plain-Node launcher that runs both services from any shell, a single production process, and a Docker image that keeps the cache on a named volume.",
        },
      ],
      decisions: [
        {
          title: "Convert units once, at the edge",
          detail:
            "Decimetre coordinates become metres in one place at ingest, so nothing downstream has to remember the feed's convention.",
        },
        {
          title: "Trust the laps, not the schedule",
          detail:
            "The replay window comes from the lap data, because a session's scheduled times were observed not to bracket the race.",
        },
        {
          title: "Degrade, and say so",
          detail:
            "When a field is missing for a session, the backend carries on without it and records that in its log instead of failing.",
        },
        {
          title: "Fetch a race once",
          detail:
            "Full-session responses are cached locally — and on a Docker volume — so restarting never refetches a race.",
        },
      ],
      reliability: [
        "69 tests across the backend and frontend run against fixtures and never reach the network.",
        "A verify command checks what OpenF1 is actually returning before a first run.",
        "CI type-checks, tests and builds on Node 22 and 24, audits dependencies, and builds the container image on every push and pull request.",
      ],
      outcome: [
        "A working replay dashboard that runs as two development services, a single production process, or one Docker image.",
      ],
      limitations: [
        "Unofficial: not affiliated with or endorsed by Formula 1, FOM, the FIA or any team, and subject to OpenF1's terms.",
        "It replays completed races; it is not a live-timing client.",
        "The replay can only be as complete as OpenF1's data — some fields are absent for some sessions.",
      ],
    },
  },

  {
    slug: "semantic-recommender",
    title: "Semantic Recommendation Engine",
    fullTitle: "Aisle — explainable product recommendations",
    discipline: "AI / Search and ranking",
    designation: "Hybrid retrieve-then-rank recommender that explains every result",
    theme: "recommend",
    brief: {
      problem:
        "Shoppers describe what they want in plain language — budgets, product types, use — and a pure embedding search misses the constraints: it returns a laptop bag for \"laptop\" and results over budget. A ranked list with no reasons is also hard to trust.",
      system:
        "MiniLM embeddings in FAISS, BM25 and product-type matching retrieve candidates; a ranking function blends relevance, a Bayesian-smoothed rating, popularity, discount and profile fit, and every result shows the signals that ranked it.",
    },
    tagline: "Retrieve, then rank — and show the signals behind every result",
    summary:
      "A product recommendation engine over a 33,670-product Amazon India catalogue snapshot. Natural-language queries, budgets included, are parsed and answered by hybrid retrieval and a multi-signal ranking with shopper profiles, and each result carries its explanation. Without the Python backend, the web app serves an identical keyword-only pipeline and says so.",
    category: "engineering",
    status: "completed",
    statusNote:
      "Independent portfolio project, not affiliated with Amazon. Prices and ratings are from a March 2023 snapshot; the public demo currently runs the keyword engine.",
    featured: false,
    showcase: true,
    visible: true,
    order: 27,
    year: "2026",
    role: "Design and implementation",
    context: "Personal project",
    stack: ["Python", "Sentence-Transformers", "FAISS", "FastAPI", "Next.js", "Pandas", "scikit-learn", "Streamlit"],
    figure: "rec-engine",
    links: {
      repo: "https://github.com/TheOneAbovELL/AMAZON-REC-ENGINE",
      demo: "https://amazon-rec-engine.vercel.app",
    },
    facts: [
      { label: "Catalogue", value: "33,670 products, March 2023 snapshot" },
      { label: "Retrieval", value: "MiniLM + FAISS, BM25, product type" },
      { label: "Ranking", value: "5 signals, 4 shopper profiles" },
      { label: "Tests", value: "65 Python, 17 JavaScript, incl. parity" },
    ],
    caseStudy: {
      problem: [
        "Shoppers say what they want the way they would to a person: \"laptop for AI under 90k\", \"wireless earbuds under 2000\". Embedding similarity alone handles the meaning and misses the constraints — it will return a laptop bag for a laptop, or a result well over budget.",
        "A ranked list is also only as useful as it is explainable. Aisle is built so that every result shows the signals that put it where it is.",
      ],
      approach: [
        "Queries are parsed first: budgets in their many forms (\"under ₹2,000\", \"between 60k and 1 lakh\", \"around 15000\"), the product type with accessory handling so a laptop is not a laptop bag, and spelling and unit normalisation.",
        "Retrieval is hybrid. all-MiniLM-L6-v2 sentence embeddings searched with FAISS, BM25 keyword search and product-type matching each propose candidates.",
        "Ranking then blends five signals — relevance, a Bayesian-smoothed rating, popularity, discount and fit with a declared shopper profile (general, student, AI/ML builder, gamer) — and the explainer records each signal's contribution for the interface.",
        "If the Python API is not configured or not healthy, the Next.js app answers with a JavaScript engine that mirrors the Python keyword mode exactly, and the interface says which engine answered.",
      ],
      architecture: [
        {
          title: "Web",
          detail:
            "A Next.js application with recommend, similar-items, catalogue and health routes, deployable on Vercel; the catalogue and configuration ship with the functions.",
        },
        {
          title: "Python API",
          detail:
            "FastAPI with request validation, readiness that returns 503 while loading, request IDs and a per-IP rate limit; the hybrid engine runs here.",
        },
        {
          title: "Engine",
          detail:
            "Query parser, BM25, embeddings, a FAISS vector store, ranking, personalisation, an explainer and an orchestrator, plus item-to-item nearest neighbours for similar products.",
        },
        {
          title: "Keyword fallback",
          detail: "A JavaScript engine with the same pipeline minus embeddings, used whenever the Python backend is unavailable.",
        },
        {
          title: "Shared configuration",
          detail: "One engine configuration — ranking weights, query rules, product types, profiles — read by both engines.",
        },
        {
          title: "Data pipeline",
          detail:
            "A catalogue build that keeps listings with a price and at least 20 ratings, collapses colour and size variants and balances departments; an index build whose manifest records the catalogue hash.",
        },
      ],
      decisions: [
        {
          title: "Retrieve broadly, rank deliberately",
          detail:
            "Dense, lexical and type signals find candidates; the decision about order is a separate, configurable function that can be explained term by term.",
        },
        {
          title: "Two engines, one answer",
          detail:
            "A parity test runs the Python and JavaScript keyword modes on the same requests and requires identical rankings, scores and explanations.",
        },
        {
          title: "Degrade, and say so",
          detail:
            "Without the semantic backend the app still answers — with keyword results, labelled as such in the interface rather than passed off as the full engine.",
        },
        {
          title: "Never serve stale embeddings",
          detail:
            "The index manifest records the catalogue hash; a catalogue change forces an embedding rebuild instead of silently mixing old vectors with new products.",
        },
        {
          title: "Queries are personal data",
          detail: "The optional query log is off by default.",
        },
      ],
      reliability: [
        "65 Python tests cover the parser, ranking, engine, API contract, JavaScript/Python parity and the real model; 17 JavaScript tests cover the keyword engine and the Next.js routes, including backend fallback.",
        "Both services are stateless: rollback is redeploying the previous image or commit, and the API image bakes in the model and embeddings so it starts offline.",
        "No secrets are required to run it.",
      ],
      outcome: [
        "On 32 rule-labelled queries at k = 10 over the full catalogue, the README reports Precision@10 0.969, nDCG@10 0.996 and MRR 1.000 for the hybrid engine, with no results over budget — against 0.875, 0.953 and 0.954 for dense-only retrieval.",
        "A deployed web app with natural-language search, shopper profiles, similar items and per-result explanations; a CLI and a Streamlit analyst console over the same engine.",
      ],
      limitations: [
        "Relevance labels are regex rules on product name and price — a silver standard. There are no human judgements or online metrics.",
        "The catalogue is a 2023 snapshot: prices, ratings and availability are not live, and laptops are thin (about 85 listings).",
        "Personalisation uses declared profiles, not behaviour; there is no history, click feedback or collaborative filtering yet.",
        "The public demo runs the keyword engine unless a Python backend is configured for it.",
      ],
    },
  },
];
