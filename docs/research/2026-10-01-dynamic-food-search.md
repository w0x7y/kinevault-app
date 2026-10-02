# Dynamic food search options

Researched 2026-10-01. Scope is research only. No application code, dependencies, configuration, or nutrition records changed.

## Recommendation

Keep search local while typing. Add generated spelling keys first, then consider MiniSearch for bounded token typos. Use the existing Open Food Facts product flow to obtain actual brand data. These solve different problems: spelling normalization can equate `DrPepper` and `Dr Pepper` when that name exists; it cannot discover that Pepsi is a cola or supply Pepsi's product nutrition.

My preferred combination is option 1 plus option 2, with option 4 for brands. Fuse.js is a credible alternative to MiniSearch. Neither library is installed in this app today, and neither has been benchmarked on this app's Expo native runtime.

## What the app already does

These findings come from the checked-out source and read-only probes, not assumptions about a search library.

- [catalog.ts](../../src/food/catalog.ts) normalizes both names/brands and queries with NFKD, removes combining marks, lowercases, and splits on Unicode letters/numbers. It already handles case, many diacritics, punctuation used as separators, word order, token prefixes, and a small English plural heuristic. NFKD is compatibility decomposition; stripping marks is an additional application policy. It does not transliterate every alphabet or equate every accented-looking letter. [Unicode normalization specification](https://www.unicode.org/reports/tr15/)
- Every query token must match a prefix of some indexed token. Order changes acceptance only indirectly through ranking: `brown rice` and `rice brown` each return 66 records, with different top results. The matcher does not require different query terms to consume different record tokens.
- `red-bull` finds the two Red Bull records; `redbull` finds none. `O'Brien` and `O Brien` match a temporary in-memory fixture; `OBrien` does not. Some possessives appear to work through plural stripping, which is not a general apostrophe solution.
- `drpepper`, `drpeper`, and `Pepsi` return four generic drinks only because [drink-aliases.ts](../../src/food/drink-aliases.ts) contains those exact variants. `Monster zero` also needs a qualifier alias. Turning alias attachment off in an in-memory catalog yields no matches for these queries.
- Search indexes names and optional brands, not categories. Alias matches preserve the original object, USDA ID, description, and nutrition. Generic fallback keys are returned separately for labeling. Ranking currently favors direct exact/prefix name matches over generic aliases; it does not universally boost all custom foods ahead of all built-in foods.
- [custom-provider.tsx](../../src/food/custom-provider.tsx) already combines saved foods and meals with USDA data. A future search index must update with this collection and resolve result IDs back to these original records. [database.ts](../../src/food/database.ts) also builds the bundled catalog.

### The actual source data

[usda-fndds.json](../../assets/food/usda-fndds.json) contains 5,431 records from FNDDS 2021-2023, released 2024-10-31. Each has only `fdcId`, `name`, `category`, `per100g`, `details`, and `portions`. None has a `brand` field. There are no Pepsi or Coca-Cola names, while Monster has three named entries, Red Bull two, and Rockstar two. Cola and pepper-type drinks are generic descriptions. [import-food-catalog.py](../../scripts/import-food-catalog.py) imports Survey Foods and does not import branded fields.

USDA distinguishes FNDDS nutrients/portion weights for foods reported in dietary surveys from its separate Branded Foods label data. The occasional brand in a survey description does not make this bundled dataset a catalog of exact retail variants. [USDA data-type comparison](https://fdc.nal.usda.gov/data-documentation/)

## Four practical options

| Option | Handles | Offline typing | Main tradeoff |
| --- | --- | --- | --- |
| 1. Generated normalized and compact keys | Spaces, apostrophes, hyphens, joined brand names | Yes | Smallest change; no general typo correction |
| 2. MiniSearch with bounded fuzzy tokens | Prefixes, multiword queries, modest typos | Yes | New dependency and index; precision policy still belongs to the app |
| 3. Fuse.js token search | Multiword fuzzy matching and field weighting | Yes | Convenient scoring; less direct control over absolute edit counts |
| 4. Product metadata plus existing Open Food Facts import | Brands missing from USDA, actual saved product names/nutrition | Saved/imported products, yes | New product lookup needs a barcode |

### 1. Generate spelling variants from the available text

Preserve the current token path and add secondary compact keys built from original names and brand fields. Generate an apostrophe-folded form and a separators-removed form; do not write a list of every possible typo. Keep original display text and nutrition unchanged. Normalization is a comparison operation, not a transformation of the stored food. [Unicode normalization specification](https://www.unicode.org/reports/tr15/)

Suggested design, not implemented: brand phrase `Dr Pepper` produces `drpepper`; `Red Bull` produces `redbull`; `O'Brien` produces `obrien`. For records without separate brand metadata, generate compact keys for short contiguous token spans with a measured maximum span/length. Compacting an entire long USDA description is inadequate when the brand is a trailing parenthetical. Do not sort every token and concatenate the whole food name.

Retain token boundaries and all query terms. Query `redbull sugarfree` needs two spans that match the same record; blindly searching that compact query as one substring loses this structure. Prefer exact compact keys, then carefully bounded compact prefixes for the final unfinished term. Reject arbitrary interior substring matching. Even existing token prefixes make `cola` match `colada`; whole-string `includes('cola')` would also match `chocolate`.

This handles spelling forms only when the underlying name or brand exists. For a saved Dr Pepper product, the key can replace manual `drpepper` spelling aliases. For the generic USDA `Soft drink, pepper type`, the key has no Dr Pepper text to derive from.

### 2. MiniSearch, preferred library candidate

MiniSearch is a dependency-free JavaScript full-text engine intended for local indexes, including search while typing in web/mobile applications. It supports incremental document updates and custom token processing. Registry `latest` was 7.2.0 during this research. Its published browser/Node positioning supports considering it for Expo, but is not proof of Hermes compatibility. [Maintainer README](https://github.com/lucaong/minisearch), [package registry](https://registry.npmjs.org/minisearch)

Configure `combineWith: 'AND'`, because the default is OR. Its `fuzzy` option accepts an absolute Levenshtein edit count or a fraction of token length; fractional values round to the nearest integer. A per-token callback can control fuzziness and prefix behavior. `maxFuzzy` caps fractional fuzziness. Field boosting, exact/prefix/fuzzy weights, filters, tokenizers, and term processors are available. [MiniSearch search options](https://lucaong.github.io/minisearch/types/MiniSearch.SearchOptions.html)

Suggested initial policy: exact and prefix results first, then at most one edit for an eligible ordinary token of four or more characters. Disable fuzziness for short tokens, numbers, and protected nutrition qualifiers. Match all terms, cap candidates, and keep fuzzy results below direct matches. Validate this policy with the actual dataset before choosing final lengths. `chiken` can reach `chicken` with one insertion; `chikcen` is a transposition requiring two Levenshtein edits, so one-edit settings must not promise it. Increasing to two edits globally would be a precision regression.

Use generated compact keys alongside the token index. Ordinary token fuzziness alone does not reliably bridge a query `drpeper` to separate source tokens `dr` and `pepper`. A stored `drpepper` compact key makes the missing `p` a one-edit problem.

### 3. Fuse.js token search

Current Fuse supports `useTokenSearch: true` and `tokenMatch: 'all'`. Its default token mode is `any`, so explicitly require all words. The tokenizer can be customized; the full build is required. Token search uses per-term Bitap matching and IDF weighting and does not depend on query word order. [Fuse token search](https://www.fusejs.io/token-search.html)

Fuse's threshold is a fuzzy score cutoff, not a universal absolute typo budget. Default `0.6` is too permissive to adopt without evaluation. A trial around `0.2` to `0.3`, followed by app-level token/boundary and qualifier validation, is more defensible. Standard fuzzy mode has position scoring; `ignoreLocation: true` removes that penalty. Token mode already searches terms without the position penalty. Whole-field fuzzy matching can accept substrings that are unsuitable for food identity, so a stricter validation pass remains necessary. [Fuse fuzzy matching](https://www.fusejs.io/fuzzy-search.html)

The live docs banner currently points to `7.6.0-beta.0`, but the registry's stable `latest` is 7.5.0. The changelog places token matching before that stable release, and inspection of the published 7.5.0 tarball confirmed `useTokenSearch`, `tokenMatch`, and custom `tokenize`. No beta is needed for this option. [Maintainer changelog](https://github.com/krisk/Fuse/blob/main/CHANGELOG.md), [package registry](https://registry.npmjs.org/fuse.js), [published stable artifact](https://registry.npmjs.org/fuse.js/-/fuse.js-7.5.0.tgz)

I prefer MiniSearch here because its explicit per-term edit limits fit this precision-sensitive matcher. Fuse is useful if the team prefers its scoring and accepts an additional validation layer.

### 4. Add source-backed brand metadata through the product flow

[product-provider.ts](../../src/food/product-provider.ts) looks up an individual Open Food Facts product by barcode. It validates parsed products, caches up to 50 responses for five minutes and budgets lookup at 15 requests per minute. Save product name, brand, source and barcode metadata, then derive spelling keys dynamically for offline search.

The existing [product-model.ts](../../src/food/product-model.ts) leaves volume-based nutrition drafts empty rather than treating milliliters as grams. Product data may be incomplete; keep the review/import step. A matching name never licenses generating exact branded nutrients.

## Precision requirements and a staged migration

The following are recommendations derived from the source audit. They are not promises supplied by either library.

1. Establish a regression corpus covering current plurals/prefixes, accents, apostrophes, `redbull`, joined/spaced brands, one-edit ordinary typos, multiword queries, and misleading substrings. Include `Pepsi mango` and `drpeper banana` so incomplete brand matches do not discard the additional word.
2. Add generated keys while preserving current match IDs, nutrition, pagination, generic labels, and direct-match ranking. Require exact saved branded results to precede generic suggestions. Do not force an unrelated custom food above a more precise built-in match.
3. Prototype MiniSearch against the same corpus and 5,431 foods plus saved records. Measure cold index build, memory, and typing latency on native Expo/Hermes and web. Browser-only Web Workers are not a cross-platform strategy. No native performance claims were established in this research.
4. Treat `zero`, `diet`, `sugar free`, their compact forms, and other nutrient-changing qualifiers as constraints before fuzzy matching. Never drop one to make a result fit. A semantic equivalence such as zero to diet needs explicit source-backed variant/category metadata or a maintained domain rule. The existing generic category alone does not establish that a particular brand's zero and diet recipes are identical. Audit conflicting or unknown variant data rather than letting a library guess. Consider preparation terms and negation in the same review.
5. Use barcode lookup or user-entered labels where local product data is missing. Once a particular brand exists in real searchable records, delete its spelling enumeration and let normalization/fuzziness handle text variants. Remove its generic alias fallback only when replacement coverage is demonstrated, or retain a clearly labeled optional generic suggestion. Never silently rename generic USDA cola as Pepsi or copy its nutrients into an invented branded product.

I would defer semantic/vector search. The present gaps are formatting, bounded typos, and missing brand records. Semantic similarity would still need product metadata and the same hard nutrition constraints, while adding another index or service to validate. It is not a justified first step for this dataset.

## Verification limits

Research read the repository, counted JSON fields/records, and ran in-memory catalog probes. It fetched official specifications, maintainer documentation/source, registry metadata, and the Fuse stable artifact without installing it. No remote product searches, runtime CORS checks, dependency prototypes, or native benchmarks were performed. The only saved artifact is this note.
