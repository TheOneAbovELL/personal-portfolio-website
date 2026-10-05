import type { Project } from "./types";

/**
 * All projects, featured or not.
 *
 * - `featured: true`  → appears on the homepage (sorted by `order`).
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
    order: 3,
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
    slug: "satquery",
    title: "SatQuery",
    tagline: "Natural-language questions over satellite imagery",
    summary:
      "A hackathon prototype that separates measurement from interpretation: deterministic geospatial tools compute the numbers, and a LoRA-tuned vision-language model explains them. Built for a Smart India Hackathon 2026 problem statement.",
    category: "experiment",
    status: "prototype",
    statusNote: "Team hackathon prototype.",
    featured: false,
    visible: true,
    order: 11,
    year: "2026",
    stack: ["Python", "FastAPI", "Qwen2-VL", "LoRA", "Rasterio", "Shapely", "Next.js"],
    links: {
      repo: "https://github.com/TheOneAbovELL/SATQUERY",
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

  {
    slug: "semantic-recommender",
    title: "Semantic Recommendation Engine",
    tagline: "Retrieve-then-rank product recommendations",
    summary:
      "A two-stage recommender: sentence embeddings with exact FAISS search retrieve candidates, then a weighted multi-signal function ranks them. Includes a Precision / Recall / NDCG evaluation script and a Streamlit interface.",
    category: "experiment",
    status: "prototype",
    featured: false,
    visible: true,
    order: 13,
    year: "2026",
    stack: ["Python", "Sentence-Transformers", "FAISS", "Pandas", "Streamlit"],
    links: {
      repo: "https://github.com/TheOneAbovELL/AMAZON-REC-ENGINE",
    },
  },
];
