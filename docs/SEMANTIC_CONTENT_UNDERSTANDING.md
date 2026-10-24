# Phase 14: Semantic Content Understanding Architecture

## 1. Pretrained Embedding Model Selection

| Specification | Configuration |
| :--- | :--- |
| **Model Identifier** | `sentence-transformers/all-MiniLM-L6-v2` |
| **Backbone Architecture** | MiniLM-L6-H384-uncased (6 transformer layers, 384 hidden dimensions) |
| **Embedding Dimensionality** | **384 dense floating-point dimensions** |
| **Max Sequence Length** | 256 wordpiece tokens |
| **Output Normalization** | $L_2$ Unit Normalization ($\|\mathbf{v}\|_2 = 1.0 \implies \sum_{i=1}^{384} v_i^2 = 1.0$) |
| **Local Weight Footprint** | ~80–90 MB |
| **Memory Footprint** | ~120 MB RAM in runtime memory |
| **Inference Device** | CPU by default (automatic CUDA GPU acceleration when hardware is present) |

### Rationale
- **High Semantic Expressiveness**: Fine-tuned on over 1 billion sentence pairs for semantic search, asymmetric similarity, and clustering.
- **CPU Efficiency**: Extremely lightweight 6-layer design achieves 10–25ms single-sentence inference on standard modern server CPUs without requiring dedicated GPU infrastructure for initial production tiers.
- **Geometric Cosine Invariance**: Because embeddings are unit-normalized upon extraction, the cosine similarity between two embeddings simplifies to their Euclidean dot product:
  $$\cos(\mathbf{u}, \mathbf{v}) = \frac{\mathbf{u} \cdot \mathbf{v}}{\|\mathbf{u}\|_2 \|\mathbf{v}\|_2} = \mathbf{u} \cdot \mathbf{v}$$

---

## 2. Text Normalization Pipeline (`text_normalizer.py`)

Raw social media content is noisy, containing erratic capitalization, custom emojis, camelCase hashtags, URLs, and repeated post boilerplate. The normalization pipeline enforces:

1. **Unicode NFKC Normalization**: Standardizes decomposed characters, accent variations, and compatibility glyphs.
2. **Noise and Control Character Removal**: Strips null bytes (`\x00`), non-printable ASCII control codes (`\x00-\x1f`), and raw hyperlinks (`http://`, `https://`).
3. **Hashtag Tokenization and Cleaning**:
   - Removes leading `#`.
   - Splits camelCase and alphanumeric transitions (e.g. `#CleanSkincare2026` $\to$ `clean skincare 2026`).
   - Normalizes underscores to spaces and lowercases.
   - Deduplicates tags while preserving discovery order.
4. **Caption Deduplication**:
   - Detects identical or whitespace-equivalent captions across post histories.
   - Eliminates redundant sponsored boilerplates and repeated video re-uploads.
5. **Structured Document Composition**:
   - Compiles creator profile fields (`Bio`, `Niches`, `Recent Content`, `Keywords`) and campaign briefs (`Title`, `Niche`, `Objective`, `Brief`, `Product Description`, `Target Audience`) into clean, coherent text corpora.

---

## 3. Reusable Embedding Service & Caching Architecture (`embedding_service.py`)

### Separation of Concerns
1. **Model Download & Lifecycle**: Pretrained weights are downloaded and verified once during cold start, stored in standard local HuggingFace cache directories.
2. **Batch Generation**: `embed_batch(texts, batch_size=32)` provides high-throughput ingestion for background data imports without locking the API event loop.
3. **Request-Time Inference**: `embed_text(text)` handles single-string synchronous API lookups with sub-millisecond cache hits.

### Versioned Cache Design
To prevent redundant neural network forward passes for identical campaign briefs or creator bios:
- **Cache Key**: Deterministic SHA-256 digest:
  $$\text{Key} = \text{SHA256}(\text{model\_name} \,\|\, \text{model\_version} \,\|\, \text{normalized\_text})$$
- **Capacity**: Thread-safe in-memory LRU cache (`MAX_CACHE_SIZE = 5000` entries).
- **Invalidation**: Upgrading the model name or version automatically produces distinct hash keys, safely invalidating previous embeddings.

### Blocker Error Transparency (No Silent Fakes)
> [!IMPORTANT]
> If model weights cannot be downloaded or loaded (e.g., HuggingFace network outage, corrupted weights file, offline environment without cached assets), the service **strictly raises `ModelUnavailableError`** and returns **HTTP 503 Service Unavailable** with the actionable blocker message.
> **The service NEVER generates silent random vectors or mock fake embeddings.**

---

## 4. Mathematical Definitions and Calibration Disclaimers

### Cosine Similarity Definition
For normalized vectors $\mathbf{u}, \mathbf{v} \in \mathbb{R}^{384}$:
$$\text{Sim}(\mathbf{u}, \mathbf{v}) = \sum_{i=1}^{384} u_i \cdot v_i, \quad \text{clamped to } [-1.0, 1.0]$$

### Qualitative Alignment Bands
- **High Alignment**: $\text{Sim} \ge 0.55$ (Strong thematic and contextual overlap)
- **Moderate Alignment**: $0.30 \le \text{Sim} < 0.55$ (Noticeable conceptual relevance)
- **Low Alignment**: $0.15 \le \text{Sim} < 0.30$ (Peripheral or incidental association)
- **Minimal Alignment**: $\text{Sim} < 0.15$ (Distinct or unrelated domain)

> [!WARNING]
> **Strict Semantic Disclaimer**:
> **Cosine similarity reflects directional proximity in the 384-dimensional latent embedding space, NOT a calibrated probability of campaign conversion or creator performance.**
> It must never be presented to brands as a percentage guarantee of commercial success.

---

## 5. Support for the 8 Initial Content Niches

The platform evaluates semantic proximity against 8 canonical niche prototypes:
1. `beauty`: Cosmetics, skincare routines, makeup artistry, dermatological care, serums, facial aesthetics.
2. `food`: Culinary recipes, cooking techniques, restaurants, gourmet dining, sourdough baking, meal prep.
3. `fitness`: Physical exercise, workout routines, strength training, athletic conditioning, gym workouts, bodybuilding.
4. `fashion`: Apparel styling, runway trends, seasonal fashion collections, footwear, streetwear, designer clothing.
5. `home`: Interior design, home decor, modern furnishings, home organization, architectural styling, renovation.
6. `technology`: Consumer electronics, software engineering, machine learning, gadgets, AI, hardware reviews, smartphones.
7. `parenting`: Family life, child development, parenting tips, toddler care, infant health, maternal guidance.
8. `wellness`: Mental well-being, mindfulness meditation, holistic health, stress relief, healthy lifestyle habits.

> [!WARNING]
> **Niche Alignment Disclaimer**:
> **Niche alignment scores represent geometric proximity to benchmark prototype vectors, NOT ground-truth supervised classification probabilities.** Evaluation is uncalibrated without domain-specific labeled ground truth.

---

## 6. Hardware, Runtime & Deployment Limitations

1. **Max Sequence Length**: 256 tokens. Texts exceeding 256 WordPiece tokens are truncated by the tokenizer.
2. **CPU Throughput**: ~40–100 texts/sec on modern 4-core CPUs.
3. **Multi-Process Concurrency**: When deploying FastAPI with multiple Uvicorn worker processes (`--workers N`), set `torch.set_num_threads(1)` per process to prevent CPU thread contention across PyTorch OpenMP/MKL runtimes.
4. **Cold Start Latency**: First-time model initialization takes ~1.5–3.0 seconds on CPU. Subsequent cached inference runs in ~10–25ms per text (or <0.1ms for cache hits).
