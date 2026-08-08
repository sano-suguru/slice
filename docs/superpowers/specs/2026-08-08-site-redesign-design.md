# GitHub Pages site redesign — Design

**Status:** approved (brainstorming) — 2026-08-08

## Problem

`docs/index.html` is the project's public landing page, deployed to GitHub Pages by
`.github/workflows/pages.yml` (which uploads `docs/` verbatim — no build step). It is a
911-line, 78 KB single file whose visual language (glassmorphism, blue radial gradients,
rounded panels, backdrop blur) is dated, and whose delivery mechanism is unsound:

**Six external CDN requests across four hosts, five of them avoidable.**

| Dependency | Purpose | Verdict |
|---|---|---|
| `cdn.tailwindcss.com` | styling | **Tailwind Play CDN — the vendor explicitly documents it as not for production.** It ships the JIT compiler to every visitor and compiles CSS in the browser at runtime, causing a flash of unstyled content and blocking render. |
| `cdnjs` highlight.js CSS | code theme | Avoidable — the page has exactly 3 fixed code samples. |
| `cdnjs` highlight.js JS | runtime highlighting | Avoidable — same reason. |
| `cdnjs` highlight.js csharp | language grammar | Avoidable — same reason. |
| `unpkg` lucide | icons | Avoidable — 14 distinct icons, inlineable as SVG. |
| `fonts.googleapis.com` | Inter / JetBrains Mono / Noto Sans JP | **Kept.** Carries the design identity with no zero-cost substitute. |

A framework whose central enforced constraint is that `SliceFx.Core` never gains a
`<PackageReference>` (guarded in both `Directory.Build.targets` and CI) should not need a
third-party JIT compiler running in the visitor's browser to render its own homepage. The
redesign is the occasion to fix that.

A user-supplied HTML draft establishes the target aesthetic: neo-brutalist / blueprint —
2px hard borders, no border radius, unblurred offset shadows, a 32px grid background,
uppercase wide-tracked labels, violet accent on near-black.

## Goal & non-goals

**Goal:** Replace `docs/index.html` with a zero-runtime-dependency static page that adopts the
draft's aesthetic, preserves 100% of the current site's content, bilingual support, SEO
metadata, and accessibility affordances, and corrects the factual overclaims present in the
draft. `pages.yml` stays unchanged.

**Non-goals:**
- Any change to `.github/workflows/pages.yml`, or introduction of a build step.
- Redesign of `docs/ogp.svg` (its existing alt text is in fact adopted as the new headline).
- Changes to `docs/*.md` content pages or `docs/ja/**`.
- Changes to `docs/sitemap.xml` (its structure remains correct for the chosen i18n approach).

## Decisions taken during brainstorming

| Question | Decision | Rationale |
|---|---|---|
| Bilingual EN/JA? | **Keep** | `docs/ja/**` exists; JA readers are a real audience. |
| Content scope | **Preserve every section**, restyled | The `#engineering` section is the only path from Pages to `docs/*.md`. |
| Copy tone | **Keep the current restrained tone** | CLAUDE.md forbids presenting upstream preview tooling as a SliceFx guarantee. |
| Build step | **None** | `pages.yml` uploads `docs/` verbatim; hand-written CSS needs no toolchain. |
| Fonts | **Keep Google Fonts** | The one external dependency that earns its cost. |

### Approaches considered and rejected

- **Keep the Play CDN, restyle only.** Lowest effort, but leaves the render-blocking
  in-browser compiler and the FOUC in place. Rejected on the merits.
- **Add a Tailwind CLI build step to `pages.yml`.** Removes the runtime compiler but makes
  deployment depend on a Node toolchain for a page that changes a few times a year. (Note: a
  failing build would *not* take the site down — the previous deployment stays live — so this
  is safer than it first appears, just not worth the machinery.)
- **JSON dictionary + JS for i18n.** Halves the HTML but leaves nothing readable with JS
  disabled and exposes only one language to crawlers. A regression from today.

## Architecture

```
docs/
  index.html          # structure only
  assets/
    site.css          # design tokens, layout, components (hand-written)
    site.js           # language toggle + copy button (~70 lines, vanilla)
  ogp.svg             # unchanged
  sitemap.xml         # unchanged
.github/workflows/pages.yml   # unchanged
```

Three files with one job each: `index.html` holds structure and content, `site.css` holds all
presentation, `site.js` holds the only two behaviors on the page. No file needs the others to
be understood, and the page renders completely with `site.js` blocked.

## Design system

Tokens are CSS custom properties carrying the draft's palette:

```css
:root {
  --base:    #09090b;   --surface: #18181b;   --line:  #27272a;
  --accent:  #8b5cf6;   --success: #10b981;
  --fg:      #f4f4f5;   --fg-mute: #a1a1aa;   --fg-dim: #8b8b94;
  --shadow-hard: 4px 4px 0 0 var(--accent);
}
```

Structural language, carried over from the draft unchanged: 2px borders, zero border radius,
unblurred offset shadows, 32px blueprint grid, uppercase wide-tracked mono labels, violet
accent. The current glassmorphism and blue gradients are removed entirely.

### Deviations from the draft: contrast

Three of the draft's greys fail WCAG AA (4.5:1) for body text against `--base`:

| Use | Draft | Measured | Replaced with |
|---|---|---|---|
| Footer links, small text | `zinc-500` #71717a | **4.06:1** ✗ | `--fg-mute` #a1a1aa (7.7:1) |
| `.token.comment` | #52525b | **2.59:1** ✗ | `--fg-dim` #8b8b94 (5.3:1) |
| CLI block comment line | `zinc-600` #52525b | **2.59:1** ✗ | `--fg-dim` #8b8b94 (5.3:1) |

The accent `#8b5cf6` measures 4.70:1 against `--base` and is retained for body-sized text.

The draft's `tailwind.config` also defines `colors.base`, which collides with Tailwind's
built-in `text-base` font-size utility (visible in the logo's `font-bold text-base text-white`).
Dropping Tailwind removes the class of problem, not just this instance.

## Page structure

| # | Section | Source | Treatment |
|---|---|---|---|
| — | Sticky nav + language select + skip link | current site behavior | draft styling |
| 1 | Hero | current hero | draft's asymmetric split (copy/CTA left, code window right) |
| 2 | Release-status disclosure | current, inside hero | promoted to its own block below hero |
| 3 | Ticker band | new | draft, with fact-checked wording |
| 4 | `#features` — three things it solves | current `#features` | draft's sticky-left / staggered-right |
| 5 | `#positioning` — comparison + who it's for | current `#positioning` **+** "Who is SliceFx for?" | hard-bordered tables |
| 6 | Seven strengths + eight shipped capabilities | current "What you get" | two columns |
| 7 | `#code` — three code windows + `[FromServices]` note | current `#code` | draft's code window |
| 8 | `#portability` — three classes | current `#portability` | draft's three cards |
| 9 | `#packages` — six packages | current `#packages` | hard-bordered grid |
| 10 | `#engineering` — seven doc cards + link row | current `#engineering` | hard-bordered grid |
| — | Footer, three columns | draft structure, real URLs | draft |

**One consolidation:** the current `#positioning` (framework comparison) and the untitled
"Who is SliceFx for?" section are both three-row tables covering adjacent ground, and become
two blocks under `#positioning`. No sentence is dropped; the heading hierarchy loses one level.

## Factual corrections to the draft

| Draft | Problem | Correction |
|---|---|---|
| `C# 12` badge | `net10.0` + `LangVersion=latest` is **C# 14** | `C# feature` — version-independent, as today |
| `NET 10.0 Native AOT Ready` | CLAUDE.md says Native AOT *minded* | `Native AOT-minded` |
| `One file. One feature. Zero drift.` | "Zero drift" is not a claim the project can support | **`One file. One feature. Generated contracts.`** — already the alt text of `ogp.svg`, so the OGP image and the headline finally agree |
| `Zero API Drift` (feature 02) | same | `Generated contracts` |
| `dotnet add package SliceFx.Core` | ① `0.1.0-preview.17` is prerelease, so this **does not resolve without `--prerelease`** ② Core alone does nothing — `SliceFx.SourceGenerator` is required | two lines: `dotnet add package SliceFx.Core --prerelease` / `dotnet add package SliceFx.SourceGenerator --prerelease` |
| `Built for ASP.NET. Ready for the Edge.` | WASI depends on componentize-dotnet, NativeAOT-LLVM and jco — upstream preview tooling that CLAUDE.md forbids presenting as a SliceFx guarantee | `Start with ASP.NET Core. WASI is optional.` (current wording) |
| `Class: Portable` — "Returns plain record/void" | Actually `SliceResult<T>`, `SliceResult`, POCO, `Task<T>`, `ValueTask<T>` | current wording |
| Footer `href="#"` × 6 | placeholders | NuGet package pages (`nuget.org/packages/SliceFx.Core` etc.) and real docs URLs |
| `v0.x_PREVIEW` | would drift from `Directory.Build.props` | `0.x preview` — no pinned version baked into the page |
| `lucide@latest` | unpinned | eliminated with the dependency (inline SVG) |

The ticker band keeps the draft's shape with four statements that hold: `Core FrameworkReference
only`, `Native AOT-minded`, `WASI dispatch (experimental)`, `Generated contracts`.

## i18n

The current mechanism is carried over unchanged: paired `.lang-en` / `.lang-ja` spans toggled
by CSS on `body[data-lang]`, persisted to `localStorage`, with `<html lang>` updated in step.
Both languages remain in the DOM with JS disabled — the property that makes this approach worth
its verbosity.

## SEO and accessibility

**Preserved in full:** canonical link, `rel=sitemap`, three `hreflang` alternates, nine Open
Graph properties, four Twitter Card properties, the `SoftwareApplication` JSON-LD block, the
skip link, `aria-label="Primary navigation"`, and `tabindex="-1"` on `#main-content`.

**Added:**
- A visible `:focus-visible` ring (absent from the draft) — a 2px accent outline, matching the
  hard-edged visual language.
- `prefers-reduced-motion` suppression of the draft's hover translate.
- `tabindex="0"` on `<pre>` blocks. The draft's `no-scrollbar` rule hides the scrollbar on
  horizontally scrolling code, which leaves keyboard users unable to read past the fold without
  it.

## Verification

1. Serve `docs/` via `python3 -m http.server` and review visually.
2. Exercise the EN/JA toggle, confirm persistence across reload, and test the copy button on
   both the `navigator.clipboard` and `execCommand` fallback paths.
3. **Disable JavaScript and confirm both languages remain readable.**
4. Check layout at 320 / 768 / 1280 px.
5. Verify every link resolves — `docs/*.md` targets, NuGet URLs, GitHub URLs.
6. Re-measure contrast ratios against the table above.
7. Confirm no CI impact: `docs/` is outside `dotnet format`'s scope and `pages.yml` is untouched.
