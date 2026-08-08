# GitHub Pages Site Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `docs/index.html` as a zero-runtime-dependency static page in the neo-brutalist style of the approved draft, preserving every sentence, both languages, all SEO metadata, and all accessibility affordances of the current site.

**Architecture:** Three files with one job each — `docs/index.html` (structure and content), `docs/assets/site.css` (all presentation, hand-written, CSS custom properties for tokens), `docs/assets/site.js` (the only two behaviors: language toggle and copy button). No build step; `.github/workflows/pages.yml` uploads `docs/` verbatim and stays untouched. The current site is rewritten section by section, each section transcribed from a frozen snapshot of the old file so no copy is lost in translation.

**Tech Stack:** Hand-written HTML5 + CSS (custom properties, flexbox, grid) + vanilla ES5-compatible JS. One external dependency: Google Fonts (Inter, JetBrains Mono, Noto Sans JP). No Tailwind, no highlight.js, no lucide, no bundler.

**Spec:** `docs/superpowers/specs/2026-08-08-site-redesign-design.md`

## Global Constraints

Every task's requirements implicitly include this section.

- **No build step.** `.github/workflows/pages.yml` must not be modified. Anything committed under `docs/` is served verbatim.
- **No new external dependency.** Google Fonts is the only permitted third-party request. No CDN scripts, no CDN stylesheets, no remote images.
- **Bilingual, always in pairs.** Every user-visible string ships as `<span class="lang-ja">…</span><span class="lang-en">…</span>`. Both must be present in the DOM; CSS hides one. Never emit a string in only one language.
- **Restrained copy.** Do not strengthen a claim beyond the current site's wording. Specifically: "Native AOT-minded" not "Native AOT Ready"; "WASI is optional" not "Ready for the Edge"; never state or imply zero drift, production readiness, or third-party adoption.
- **Contrast floor 4.5:1** for all text against its *actual* backdrop. Token roles: `--accent` #8b5cf6 for text on `--base`, `--accent-text` #a78bfa for text on `--surface`, `--accent-bg` #7c3aed for backgrounds under white text.
- **Code samples are transcribed verbatim** from the files they depict. Never paraphrase, abbreviate, or invent a signature.
- **File paths:** `docs/index.html`, `docs/assets/site.css`, `docs/assets/site.js`. Nothing else under `docs/` is created or modified.
- **Style:** 4-space indent, LF line endings, final newline. (`.editorconfig` governs the repo; `dotnet format` does not scan `docs/`, so this is by hand.)
- **Branch:** `site-redesign`, already checked out. Commit after every task.

## Reference snapshot

Task 1 freezes the current site to `.git`-independent scratch copies. **All line-number references in later tasks point at `SNAP` and `SNAPCSS`, not at the live `docs/index.html`,** which is being rewritten underneath you.

```bash
SNAP=/private/tmp/claude-501/-Users-sanosuguru-dev-slicefx/0f10ae0e-06b0-4c13-a654-874879d1f88e/scratchpad/index.old.html
```

If the scratch file is gone, regenerate it: `git show b8e106e~1:docs/index.html > "$SNAP"`

## Section source map

Content for each section comes from these line ranges in `$SNAP`:

| Section | `$SNAP` lines |
|---|---|
| `<head>` metadata, JSON-LD | 6–37, 793–812 |
| Skip link, nav, language select, GitHub SVG | 320–370 |
| Hero (badge, h1, sub, CTAs, metric pills) | 372–413 |
| Release-status disclosure | 414–417 |
| `#features` (3 cards + escape-hatch note) | 421–449 |
| `#positioning` (framework comparison) | 451–477 |
| "Who is SliceFx for?" (3 rows) | 479–498 |
| Seven strengths | 500–551 |
| "What works today" (8 items) | 553–568 |
| `#code` (3 windows + `[FromServices]` note) | 571–651 |
| `#portability` (intro + 3 classes) | 653–686 |
| `#packages` (6 cards) | 688–703 |
| `#engineering` (7 cards + link row) | 705–762 |
| Footer | 765–775 |
| Language toggle + copy JS | 814–909 |

---

### Task 1: Reference snapshot and CSS foundation

**Files:**
- Create: `docs/assets/site.css`
- Reference (not committed): `$SNAP`

**Interfaces:**
- Consumes: nothing.
- Produces: the token set and base classes every later task uses —
  - Tokens: `--base --surface --line --success --fg --fg-mute --fg-dim --accent --accent-text --accent-bg --shadow-hard --nav-h`
  - Layout: `.wrap` (max-width 80rem, centred, 2px side rules), `.band` (full-bleed section with bottom rule), `.blueprint` (32px grid background)
  - Type: `.mono`, `.label` (uppercase, wide tracking, mono, small), `.h-xl` `.h-lg` `.h-md`
  - Surfaces: `.panel` (2px border, `--surface` fill, no radius), `.panel--hard` (adds `--shadow-hard`)
  - Controls: `.btn` `.btn--primary` `.btn--ghost`
  - Code: `.code`, `.code__bar`, `.token.keyword` `.token.string` `.token.function` `.token.comment` `.token.type`
  - i18n: `body[data-lang="ja"] .lang-en { display: none }` and its mirror
  - a11y: `:focus-visible` ring, `scroll-padding-top`, `[id] { scroll-margin-top }`, `prefers-reduced-motion` block

- [ ] **Step 1: Freeze the reference snapshot**

```bash
cd /Users/sanosuguru/dev/slicefx
SNAP=/private/tmp/claude-501/-Users-sanosuguru-dev-slicefx/0f10ae0e-06b0-4c13-a654-874879d1f88e/scratchpad/index.old.html
cp docs/index.html "$SNAP"
wc -l "$SNAP"
```

Expected: `911`

- [ ] **Step 2: Create the contrast checker used by every later task**

Write this to the scratchpad (not to the repo — it is a working tool, not deliverable infrastructure):

```bash
cat > /private/tmp/claude-501/-Users-sanosuguru-dev-slicefx/0f10ae0e-06b0-4c13-a654-874879d1f88e/scratchpad/contrast.py <<'PY'
import sys
def lin(c):
    c = c / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
def L(h):
    h = h.lstrip('#')
    r, g, b = (int(h[i:i+2], 16) for i in (0, 2, 4))
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
def cr(a, b):
    l1, l2 = sorted((L(a), L(b)), reverse=True)
    return (l1 + 0.05) / (l2 + 0.05)
fg, bg = sys.argv[1], sys.argv[2]
r = cr(fg, bg)
print(f"{r:.2f}:1  {'PASS' if r >= 4.5 else 'FAIL'}  {fg} on {bg}")
sys.exit(0 if r >= 4.5 else 1)
PY
python3 /private/tmp/claude-501/-Users-sanosuguru-dev-slicefx/0f10ae0e-06b0-4c13-a654-874879d1f88e/scratchpad/contrast.py '#ffffff' '#7c3aed'
```

Expected: `5.70:1  PASS  #ffffff on #7c3aed`

- [ ] **Step 3: Write `docs/assets/site.css`**

Create `docs/assets/site.css` containing, in this order:

1. A `:root` block with exactly the tokens listed under **Produces** above. Values:

```css
:root {
    --base: #09090b;
    --surface: #18181b;
    --line: #27272a;
    --success: #10b981;
    --fg: #f4f4f5;
    --fg-mute: #a1a1aa;
    --fg-dim: #8b8b94;
    --accent: #8b5cf6;
    --accent-text: #a78bfa;
    --accent-bg: #7c3aed;
    --shadow-hard: 4px 4px 0 0 var(--accent);
    --nav-h: 4rem;
}
```

2. A minimal reset: `*, *::before, *::after { box-sizing: border-box }`, zero margin on `body` and headings, `img { max-width: 100% }`.

3. Base typography. `body` gets `background: var(--base)`, `color: var(--fg)`, `-webkit-font-smoothing: antialiased`, and a flex column with `min-height: 100vh`. Per-language font stacks, copied from `$SNAP:91-105`:

```css
body[data-lang="en"] { font-family: "Inter", system-ui, sans-serif; letter-spacing: -0.01em; }
body[data-lang="ja"] { font-family: "Noto Sans JP", "Hiragino Sans", "Yu Gothic", sans-serif; letter-spacing: 0.01em; }
code, pre, .mono { font-family: "JetBrains Mono", "Noto Sans JP", monospace; letter-spacing: 0; }
```

4. The i18n toggle:

```css
body[data-lang="ja"] .lang-en { display: none !important; }
body[data-lang="en"] .lang-ja { display: none !important; }
```

5. Layout primitives. `.wrap { max-width: 80rem; margin-inline: auto; border-inline: 2px solid var(--line); }`, `.band { border-bottom: 2px solid var(--line); }`, and:

```css
.blueprint {
    background-image:
        linear-gradient(var(--line) 1px, transparent 1px),
        linear-gradient(90deg, var(--line) 1px, transparent 1px);
    background-size: 32px 32px;
    background-position: center top;
}
```

6. `.label { font-family: "JetBrains Mono", monospace; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; }` and heading sizes `.h-xl` (clamp 2.5rem–4.5rem, `font-weight: 900`), `.h-lg` (2rem, 900), `.h-md` (1.25rem, 700).

7. `.panel { border: 2px solid var(--line); background: var(--surface); border-radius: 0; }` and `.panel--hard { box-shadow: var(--shadow-hard); }`.

8. Buttons. **`.btn--primary` uses `--accent-bg`, not `--accent`** — white on `--accent` is 4.23:1 and fails:

```css
.btn { display: inline-flex; align-items: center; gap: 0.5rem; padding: 1rem 1.5rem; border: 2px solid; font-weight: 700; text-transform: uppercase; text-decoration: none; }
.btn--primary { background: var(--accent-bg); border-color: var(--accent-bg); color: #fff; box-shadow: var(--shadow-hard); }
.btn--primary:hover { box-shadow: 2px 2px 0 0 var(--accent); transform: translate(2px, 2px); }
.btn--ghost { background: var(--surface); border-color: var(--line); color: var(--fg); }
```

9. Code blocks. Comments use `--fg-dim` (5.25:1 on `--surface`), never `#52525b` (2.29:1):

```css
.code { border: 2px solid var(--line); background: var(--surface); }
.code__bar { display: flex; justify-content: space-between; gap: 0.75rem; padding: 0.75rem 1rem; border-bottom: 2px solid var(--line); background: var(--base); font-size: 0.75rem; color: var(--fg-mute); }
.code pre { overflow-x: auto; padding: 1.5rem; margin: 0; font-size: 0.85rem; line-height: 1.6; }
.token.keyword { color: var(--accent-text); font-weight: 700; }
.token.string { color: var(--success); }
.token.function { color: #38bdf8; }
.token.comment { color: var(--fg-dim); font-style: italic; }
.token.type { color: var(--fg); font-weight: 700; }
```

Note `.token.keyword` uses `--accent-text`, because code sits on `--surface` where `--accent` is 4.18:1.

10. Accessibility, ported from `$SNAP:189-198, 279-287, 291-317`:

```css
.skip-link { position: fixed; top: 1rem; left: 1rem; z-index: 100; transform: translateY(-150%); transition: transform 0.2s ease; padding: 0.5rem 1rem; background: var(--fg); color: var(--base); font-weight: 700; }
.skip-link:focus { transform: translateY(0); }
:where(a, button, select, [tabindex]):focus-visible { outline: 2px solid var(--accent-text); outline-offset: 3px; }
html { scroll-behavior: smooth; scroll-padding-top: var(--nav-h); }
[id] { scroll-margin-top: var(--nav-h); }
@media (max-width: 767px) {
    html { scroll-padding-top: 8rem; }
    [id] { scroll-margin-top: 8rem; }
}
@media (prefers-reduced-motion: reduce) {
    html { scroll-behavior: auto !important; }
    *, *::before, *::after { animation: none !important; transition: none !important; }
    .btn--primary:hover { transform: none !important; }
}
```

- [ ] **Step 4: Verify the token contrasts**

```bash
cd /private/tmp/claude-501/-Users-sanosuguru-dev-slicefx/0f10ae0e-06b0-4c13-a654-874879d1f88e/scratchpad
for pair in "#ffffff #7c3aed" "#a78bfa #18181b" "#8b5cf6 #09090b" "#a1a1aa #18181b" "#8b8b94 #18181b" "#f4f4f5 #09090b" "#10b981 #18181b"; do
  python3 contrast.py $pair || echo "  ^^^ REGRESSION"
done
```

Expected: seven lines, all `PASS`, no `REGRESSION`.

- [ ] **Step 5: Verify no external references crept in**

```bash
cd /Users/sanosuguru/dev/slicefx
grep -nE 'https?://|@import|url\(' docs/assets/site.css || echo "CLEAN"
```

Expected: `CLEAN`.

- [ ] **Step 6: Commit**

```bash
cd /Users/sanosuguru/dev/slicefx
git add docs/assets/site.css
git commit -m "feat(site): hand-written CSS foundation with role-split accent tokens"
```

---

### Task 2: Behavior script

**Files:**
- Create: `docs/assets/site.js`

**Interfaces:**
- Consumes: `--` (CSS only, no shared symbols).
- Produces: DOM contract that Task 3 must satisfy —
  - `#langSelect` — a `<select>` with `value` of `en` or `ja`
  - `#copyCommandButton` — a `<button>` whose copy payload is read from `#copyCommand`
  - `#copyCommand` — the element holding the command text
  - `#copyStatus` — the `aria-live="polite"` status target
  - `body[data-lang]` — set to `en` or `ja` on load and on change

- [ ] **Step 1: Write `docs/assets/site.js`**

Port `$SNAP:814-909` with three changes: the inline `onclick` becomes `addEventListener`; the copy payload is read from `#copyCommand` rather than a hard-coded string; the status classes become `.is-ok` / `.is-error` rather than Tailwind utilities.

```javascript
(function () {
    'use strict';

    var STORAGE_KEY = 'slice-docs-language';
    var SUPPORTED = ['en', 'ja'];
    var langSelect = document.getElementById('langSelect');
    var copyButton = document.getElementById('copyCommandButton');
    var copyCommand = document.getElementById('copyCommand');
    var copyStatus = document.getElementById('copyStatus');
    var statusTimeout;

    function readSavedLanguage() {
        try {
            return localStorage.getItem(STORAGE_KEY);
        } catch (error) {
            return null;
        }
    }

    function saveLanguage(lang) {
        try {
            localStorage.setItem(STORAGE_KEY, lang);
        } catch (error) {
            /* private browsing — the toggle still works for this page view */
        }
    }

    function currentLanguage() {
        var lang = document.body.getAttribute('data-lang');
        return SUPPORTED.indexOf(lang) === -1 ? 'en' : lang;
    }

    function setLanguage(lang, persist) {
        var next = SUPPORTED.indexOf(lang) === -1 ? 'en' : lang;
        document.body.setAttribute('data-lang', next);
        document.documentElement.lang = next;
        if (langSelect && langSelect.value !== next) {
            langSelect.value = next;
        }
        if (persist) {
            saveLanguage(next);
        }
    }

    function setStatus(message, isError) {
        if (!copyStatus) {
            return;
        }
        window.clearTimeout(statusTimeout);
        copyStatus.textContent = message;
        copyStatus.classList.toggle('is-error', !!isError);
        copyStatus.classList.toggle('is-ok', !isError);
        statusTimeout = window.setTimeout(function () {
            copyStatus.textContent = '';
        }, 3000);
    }

    function legacyCopy(text) {
        var area = document.createElement('textarea');
        area.value = text;
        area.style.position = 'fixed';
        area.style.left = '-9999px';
        document.body.appendChild(area);
        area.select();
        try {
            return document.execCommand('copy')
                ? Promise.resolve()
                : Promise.reject(new Error('Copy command was not accepted.'));
        } finally {
            area.remove();
        }
    }

    function copyText(text) {
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text).catch(function () {
                return legacyCopy(text);
            });
        }
        return legacyCopy(text);
    }

    function onCopy() {
        var text = copyCommand ? copyCommand.textContent.trim() : '';
        copyText(text).then(function () {
            setStatus(currentLanguage() === 'ja' ? 'コピーしました。' : 'Copied.', false);
        }).catch(function () {
            setStatus(
                currentLanguage() === 'ja'
                    ? 'コピーできませんでした。手動でコピーしてください: ' + text
                    : 'Could not copy automatically. Please copy manually: ' + text,
                true
            );
        });
    }

    setLanguage(readSavedLanguage() || 'en', false);

    if (langSelect) {
        langSelect.addEventListener('change', function (event) {
            setLanguage(event.target.value, true);
        });
    }
    if (copyButton) {
        copyButton.addEventListener('click', onCopy);
    }
}());
```

- [ ] **Step 2: Add the status classes to `site.css`**

Append to `docs/assets/site.css`:

```css
.copy-status { min-height: 1.25rem; font-size: 0.75rem; }
.copy-status.is-ok { color: var(--success); }
.copy-status.is-error { color: #fca5a5; }
```

- [ ] **Step 3: Verify contrast of the error colour**

```bash
cd /private/tmp/claude-501/-Users-sanosuguru-dev-slicefx/0f10ae0e-06b0-4c13-a654-874879d1f88e/scratchpad
python3 contrast.py '#fca5a5' '#09090b'
```

Expected: PASS (roughly 9:1).

- [ ] **Step 4: Verify the script parses**

```bash
cd /Users/sanosuguru/dev/slicefx
node --check docs/assets/site.js && echo "PARSE OK"
```

Expected: `PARSE OK`. If `node` is unavailable, open the page in Task 3 and confirm the console is clean instead.

- [ ] **Step 5: Commit**

```bash
git add docs/assets/site.js docs/assets/site.css
git commit -m "feat(site): language toggle and copy button without inline handlers"
```

---

### Task 3: Document shell — head, skip link, nav, footer scaffold

**Files:**
- Rewrite: `docs/index.html`

**Interfaces:**
- Consumes: `site.css` tokens and classes (Task 1); the `#langSelect` / `#copyCommandButton` / `#copyCommand` / `#copyStatus` DOM contract (Task 2).
- Produces: `<main id="main-content" tabindex="-1">` with an empty body that Tasks 4–12 fill in order. Nav anchors — `#features`, `#positioning`, `#code`, `#packages`, `#engineering` — are written now and must all resolve by Task 12.

- [ ] **Step 1: Replace `docs/index.html` with the shell**

Structure, in order:

1. `<!DOCTYPE html>`, `<html lang="en">`.
2. `<head>`: transcribe `$SNAP:6-37` **verbatim** — `<title>`, `<meta name="description">`, `<meta name="robots" content="index, follow">`, canonical, `rel="sitemap"`, three `hreflang` alternates, nine `og:` properties, four `twitter:` properties. Then:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&amp;family=JetBrains+Mono:wght@400;700&amp;family=Noto+Sans+JP:wght@400;500;700;900&amp;display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/site.css">
```

3. `<body data-lang="en">` containing: the skip link (`$SNAP:320-322`, bilingual), `<nav>`, `<main id="main-content" tabindex="-1">` (empty for now), `<footer>` (empty for now), the JSON-LD block (`$SNAP:793-812`, verbatim), and `<script src="assets/site.js" defer></script>`.

4. `<nav aria-label="Primary navigation">` — a `.wrap` with a 4rem row: logo block (a 1.5rem `--accent-bg` square with `S`, the wordmark, and a `0.x preview` chip), the desktop link row, the language select, and the GitHub link. **Reuse the inline GitHub SVG from `$SNAP:355-357` verbatim** — the current site already inlines it, so no icon dependency is introduced. Below the row, the mobile horizontal-scroll link list from `$SNAP:361-367`.

Nav links, bilingual, exactly as `$SNAP:338-342`:

| href | JA | EN |
|---|---|---|
| `#features` | 特長 | Features |
| `#positioning` | 選ばれる理由 | Why SliceFx |
| `#code` | コード例 | Code |
| `#packages` | パッケージ | Packages |
| `#engineering` | 技術詳細 | Engineering |

The language select, with its `aria-label`:

```html
<select id="langSelect" class="lang-select" aria-label="Select language">
    <option value="en">EN</option>
    <option value="ja">JA</option>
</select>
```

The GitHub link gets `rel="noopener noreferrer"` if it carries `target="_blank"`.

5. Add nav styling to `site.css`: `.nav` (sticky, `top: 0`, `z-index: 50`, `background: var(--base)`, `border-bottom: 2px solid var(--line)`, `height: var(--nav-h)`), `.nav__links` (hidden below 768px), `.nav__mobile` (shown below 768px, `overflow-x: auto`), `.lang-select` (2px `--line` border, `--surface` fill, `--fg` text, square corners).

- [ ] **Step 2: Verify every metadata element survived**

```bash
cd /Users/sanosuguru/dev/slicefx
for probe in 'rel="canonical"' 'name="robots"' 'rel="sitemap"' 'hreflang="en"' 'hreflang="ja"' 'hreflang="x-default"' 'og:title' 'og:image' 'og:locale:alternate' 'twitter:card' 'application/ld+json' 'SoftwareApplication'; do
  printf '%-28s %s\n' "$probe" "$(grep -c -- "$probe" docs/index.html)"
done
```

Expected: every count `>= 1`. A `0` on any row is a regression — restore it from `$SNAP`.

- [ ] **Step 3: Verify the external-dependency budget**

```bash
grep -oE 'https?://[^"]+' docs/index.html | grep -vE 'sano-suguru\.github\.io|github\.com|schema\.org|opensource\.org|www\.w3\.org' | sort -u
```

Expected: exactly three lines, all `fonts.googleapis.com` / `fonts.gstatic.com`. Any `cdn.`, `unpkg`, or `cdnjs` line is a failure.

- [ ] **Step 4: Verify the page loads and the toggle works**

```bash
cd /Users/sanosuguru/dev/slicefx/docs && python3 -m http.server 8765 &
sleep 1 && curl -sf http://localhost:8765/ -o /dev/null && echo "SERVES OK"
curl -sf http://localhost:8765/assets/site.css -o /dev/null && echo "CSS OK"
curl -sf http://localhost:8765/assets/site.js -o /dev/null && echo "JS OK"
```

Expected: three `OK` lines. Then open `http://localhost:8765/` in a browser, switch the select to JA and back, reload, and confirm the choice persisted and the console is clean. Leave the server running for later tasks; stop it with `kill %1` when done.

- [ ] **Step 5: Commit**

```bash
cd /Users/sanosuguru/dev/slicefx
git add docs/index.html docs/assets/site.css
git commit -m "feat(site): document shell with metadata, nav and language select"
```

---

### Task 4: Hero, release-status disclosure, ticker band

**Files:**
- Modify: `docs/index.html` (inside `<main>`)
- Modify: `docs/assets/site.css`

**Interfaces:**
- Consumes: `.wrap` `.band` `.blueprint` `.btn--primary` `.btn--ghost` `.code` `.code__bar` `.label` `.h-xl` from Task 1; `#copyCommand` `#copyCommandButton` `#copyStatus` from Task 2.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Build the hero as the draft's asymmetric split**

A `.band .blueprint` section wrapping a `.wrap` that is `flex-direction: column` below 1024px and `row` above, with a 2px rule between the halves.

**Left half** — transcribe from `$SNAP:374-413`:

- Status chip: a 2px-bordered `--surface` box with a `--success` square and the bilingual eyebrow from `$SNAP:376` (JA `機能ファイルから API 契約を生成する .NET API フレームワーク。` / EN `Generate API contracts from feature files.`).
- `<h1 class="h-xl">`, bilingual, from `$SNAP:379-390` **with the gradient spans removed** — three lines, the third in `--accent`:
  - JA: `1ファイル。` / `1つの機能。` / `API契約は自動生成。`
  - EN: `One file.` / `One feature.` / `Generated API contracts.`
  - Do **not** write "Zero drift".
- Sub-paragraph from `$SNAP:391-392`.
- Two CTAs. Primary is `.btn .btn--primary` to `#code` with the bilingual label from `$SNAP:396` (JA `コードを見る` / EN `View code`). Secondary is the copy control:

```html
<div class="copy">
    <code id="copyCommand" data-kind="command">dotnet run --project samples/SliceFx.Sample</code>
    <button id="copyCommandButton" type="button" class="copy__btn" aria-label="Copy command">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
    </button>
</div>
<p id="copyStatus" class="copy-status" aria-live="polite"></p>
```

Keep the current command `dotnet run --project samples/SliceFx.Sample`. Do **not** substitute `dotnet add package SliceFx.Core` — as a single line it is both incomplete (the source generator package is also required) and wrong (`0.1.0-preview.17` is prerelease and needs `--prerelease`).

- Metric pills from `$SNAP:410-412`, restyled as 2px-bordered squares: `Native AOT-minded` / `SLICE diagnostics` / `Framework-only Core` (with their JA pairs).

**Right half** — a `.code` panel whose `.code__bar` reads `Features/Users/CreateUser.cs` on the left and a bilingual `C# feature` / `C# 機能` chip on the right. Do **not** write `C# 12`; the repo targets `net10.0` with `LangVersion=latest`.

The `<pre>` gets `tabindex="0"`. Its content is the **verbatim** body of `samples/SliceFx.Sample/Features/Users/CreateUser.cs` with XML doc comments stripped, wrapped in `.token` spans. Confirm the two lines that the draft got wrong:

```
public static async Task<Response> Handle(Request req, IUserStore store, CancellationToken ct)
{
    var user = await store.AddAsync(req.Name, req.Email, ct);
    return new Response(user.Id, user.Name, user.Email, user.CreatedAt);
}
```

and `public record Response(Guid Id, string Name, string Email, DateTime CreatedAt);` and `Summary = "Create a new user"`. Escape `<` and `>` as `&lt;` / `&gt;`.

- [ ] **Step 2: Add the release-status disclosure directly below the hero**

Transcribe `$SNAP:414-417` verbatim into a 2px `--success`-bordered panel — both paragraphs, both languages, including the `slicefx-inbox` link. This block states third-party adoption is 0; it must not be softened, shortened, or moved below the fold.

- [ ] **Step 3: Add the ticker band**

A `.band` with `background: var(--accent-bg)` and `color: #fff` — **not `--accent`**, which is 4.23:1 under white. Four bilingual statements separated by `/`:

| JA | EN |
|---|---|
| Core は FrameworkReference のみ | Core FrameworkReference only |
| Native AOT を意識 | Native AOT-minded |
| WASI ディスパッチ (実験的) | WASI dispatch (experimental) |
| API 契約を生成 | Generated contracts |

Do not write `Native AOT Ready` or `WASI/Edge Dispatch`.

- [ ] **Step 4: Verify the code sample matches the repository**

```bash
cd /Users/sanosuguru/dev/slicefx
python3 - <<'PY'
import html, re, pathlib
page = pathlib.Path('docs/index.html').read_text()
block = re.search(r'CreateUser\.cs.*?<pre[^>]*>(.*?)</pre>', page, re.S).group(1)
text = html.unescape(re.sub(r'<[^>]+>', '', block))
src = pathlib.Path('samples/SliceFx.Sample/Features/Users/CreateUser.cs').read_text()
src = re.sub(r'^\s*///.*$\n?', '', src, flags=re.M).replace('.ConfigureAwait(false)', '')
def norm(s):
    return [l.strip() for l in s.splitlines() if l.strip()]
missing = [l for l in norm(src) if l not in norm(text)]
print("MISSING FROM PAGE:", missing or "none")
PY
```

Expected: `MISSING FROM PAGE: none`.

- [ ] **Step 5: Verify the ticker and CTA contrast**

```bash
cd /Users/sanosuguru/dev/slicefx
grep -n 'accent-bg' docs/assets/site.css | grep -E 'ticker|btn--primary'
cd /private/tmp/claude-501/-Users-sanosuguru-dev-slicefx/0f10ae0e-06b0-4c13-a654-874879d1f88e/scratchpad
python3 contrast.py '#ffffff' '#7c3aed'
```

Expected: both the ticker and `.btn--primary` reference `--accent-bg`, and the ratio is `5.70:1 PASS`. If either references `--accent`, fix it.

- [ ] **Step 6: Verify the disclosure survived intact**

```bash
cd /Users/sanosuguru/dev/slicefx
grep -c 'Third-party production adoption: 0' docs/index.html
grep -c '第三者による本番採用は 0' docs/index.html
grep -c 'slicefx-inbox' docs/index.html
```

Expected: `1`, `1`, `2` (one per language).

- [ ] **Step 7: Commit**

```bash
git add docs/index.html docs/assets/site.css
git commit -m "feat(site): hero, release-status disclosure and ticker band"
```

---

### Task 5: `#features` — what SliceFx solves

**Files:**
- Modify: `docs/index.html`, `docs/assets/site.css`

**Interfaces:**
- Consumes: `.wrap` `.panel` `.label` `.h-lg` `.h-md`.
- Produces: the `#features` anchor that Task 3's nav links to.

- [ ] **Step 1: Build the section**

`<section id="features">` in the draft's sticky-left / staggered-right layout: a one-third column with `position: sticky; top: var(--nav-h)` holding the heading and lede, and a two-thirds column of stacked entries separated by 2px rules.

Left column, from `$SNAP:424-425`: heading JA `SliceFxが解決したいこと` / EN `What SliceFx solves`, and the lede beneath it. Below the lede, the draft's three-row fact strip:

| JA | EN | Value |
|---|---|---|
| 依存関係 | Dependency | Zero-added (Core) |
| 起動時リフレクション | Startup reflection | None (generated) |
| 離脱経路 | Exit path | Standard MapMethods |

Label the first row **Zero-added (Core)**, not `Zero-Added` — the guarantee covers `SliceFx.Core` only; satellite packages restore from nuget.org normally.

Right column, three entries transcribed from `$SNAP:428-443`, each numbered with a `.label` eyebrow:

1. `01.` — JA `機能単位で構成` / EN `Feature-shaped APIs`, plus its paragraph.
2. `02.` — JA `API契約がずれにくい` / EN `API contracts stay aligned`, plus its paragraph. Do **not** title this `Zero API Drift`. Append the CLI snippet in a `.code` block:

```
slicefx client csharp --output SliceApiClient.g.cs
slicefx client typescript --output slice-api-client.ts
```

Preface it with a `.token.comment` line, bilingual: JA `# 同じマニフェストから型付きクライアントを生成` / EN `# Typed clients from the same manifest`. Note the wording — the **CLI** reads the generated manifest and produces the clients; the generator itself does not emit them.

3. `03.` — JA `ASP.NET Core から離れない` / EN `Still ASP.NET Core`, plus its paragraph.

Then the escape-hatch note from `$SNAP:444-447` verbatim, including the link to `docs/guides/aspnet-features.md`.

- [ ] **Step 2: Verify the anchor resolves and the claim was not strengthened**

```bash
cd /Users/sanosuguru/dev/slicefx
grep -c 'id="features"' docs/index.html
grep -ci 'zero api drift\|zero drift' docs/index.html
```

Expected: `1` then `0`.

- [ ] **Step 3: Verify both languages are present**

```bash
python3 - <<'PY'
import re, pathlib
page = pathlib.Path('docs/index.html').read_text()
sec = re.search(r'<section id="features".*?</section>', page, re.S).group(0)
print("ja spans:", len(re.findall(r'class="lang-ja"', sec)))
print("en spans:", len(re.findall(r'class="lang-en"', sec)))
PY
```

Expected: the two counts are equal and greater than zero.

- [ ] **Step 4: Commit**

```bash
git add docs/index.html docs/assets/site.css
git commit -m "feat(site): features section"
```

---

### Task 6: `#positioning` — framework comparison and who it is for

**Files:**
- Modify: `docs/index.html`, `docs/assets/site.css`

**Interfaces:**
- Consumes: `.wrap` `.panel` `.h-lg` `.label`.
- Produces: the `#positioning` anchor.

This section merges two sections of the current site, per the spec. Every sentence carries over; only the heading depth changes.

- [ ] **Step 1: Build block one — the comparison**

Heading and lede from `$SNAP:454-458`. Then a three-row table, each row a 180px label column and a prose column separated by 2px rules, from `$SNAP:461-473`:

| Row | Source |
|---|---|
| Minimal APIs | `$SNAP:463` |
| FastEndpoints | `$SNAP:467` |
| SliceFx (accent-tinted label cell) | `$SNAP:471` |

Transcribe both languages verbatim, including the inline `<code>` elements for `SLICE001`, `slicefx routes`, `slicefx client csharp`, `slicefx openapi`.

- [ ] **Step 2: Build block two — who it is for**

Heading and lede from `$SNAP:481-482`, then three rows from `$SNAP:485-495`:

| Row | JA | EN |
|---|---|---|
| 1 | 小さなAPIチーム | Small API teams |
| 2 | Blazor/.NETクライアント | Blazor/.NET clients |
| 3 | Serverless/AOT も視野に入れるチーム | Serverless/AOT-minded teams |

Each with its paragraph, verbatim.

- [ ] **Step 3: Style inline code for the surface background**

Add to `site.css` — `--accent-text`, not `--accent`, because these sit on `--surface` where `--accent` is 4.18:1:

```css
:not(pre) > code {
    border: 1px solid var(--line);
    background: var(--base);
    color: var(--accent-text);
    padding: 0.1rem 0.4rem;
    font-size: 0.92em;
}
code[data-kind="command"] { color: var(--success); }
code[data-kind="command"]::before { content: "$"; margin-right: 0.35rem; }
```

- [ ] **Step 4: Verify**

```bash
cd /Users/sanosuguru/dev/slicefx
grep -c 'id="positioning"' docs/index.html
grep -c 'FastEndpoints' docs/index.html
grep -c 'Small API teams' docs/index.html
cd /private/tmp/claude-501/-Users-sanosuguru-dev-slicefx/0f10ae0e-06b0-4c13-a654-874879d1f88e/scratchpad
python3 contrast.py '#a78bfa' '#09090b'
```

Expected: `1`, `1`, `1`, then `PASS`.

- [ ] **Step 5: Commit**

```bash
git add docs/index.html docs/assets/site.css
git commit -m "feat(site): positioning — comparison and audience"
```

---

### Task 7: Strengths and shipped capabilities

**Files:**
- Modify: `docs/index.html`, `docs/assets/site.css`

**Interfaces:**
- Consumes: `.wrap` `.panel` `.h-lg` `.h-md`.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Build the two-column section**

Heading from `$SNAP:502`: JA `SliceFx の強み` / EN `What you get`.

Left column — seven entries from `$SNAP:504-551`, each a bold sub-heading plus paragraph, both languages, all inline `<code>` preserved:

1. JA `Core は NuGet 依存ゼロ` / EN `Zero-dependency core`
2. JA `生成された登録コード` / EN `Generated registrations`
3. JA `Native AOT を意識した起動経路` / EN `Native AOT-minded startup path`
4. JA `必要なアダプタだけ追加` / EN `Optional adapters`
5. JA `ルートマニフェスト` / EN `Route-manifest tooling`
6. JA `ロックインが小さい` / EN `Low lock-in`
7. JA `ASP.NET の機能はそのまま` / EN `Full ASP.NET surface` — including its trailing link to `docs/guides/aspnet-features.md`

Right column — a `.panel` headed JA `いま使える機能` / EN `What works today`, containing the eight-item list from `$SNAP:556-566`.

Replace the lucide check icon with one `<symbol>` declared once in the shell and referenced eight times. Add this immediately after `<body>` in `docs/index.html`:

```html
<svg width="0" height="0" aria-hidden="true" style="position:absolute">
    <symbol id="i-check" viewBox="0 0 24 24">
        <path d="M4 12l6 6L20 6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square"></path>
    </symbol>
</svg>
```

and reference it per item as `<svg class="i" aria-hidden="true"><use href="#i-check"></use></svg>`, with `.i { width: 1rem; height: 1rem; flex: none; color: var(--success); }` in `site.css`. Do not add an icon library.

- [ ] **Step 2: Verify all seven and all eight survived**

```bash
cd /Users/sanosuguru/dev/slicefx
for s in 'Zero-dependency core' 'Generated registrations' 'Native AOT-minded startup path' 'Optional adapters' 'Route-manifest tooling' 'Low lock-in' 'Full ASP.NET surface' 'What works today'; do
  printf '%-38s %s\n' "$s" "$(grep -c "$s" docs/index.html)"
done
```

Expected: every count `1`.

- [ ] **Step 3: Commit**

```bash
git add docs/index.html docs/assets/site.css
git commit -m "feat(site): strengths and shipped capabilities"
```

---

### Task 8: `#code` — the three code windows

**Files:**
- Modify: `docs/index.html`, `docs/assets/site.css`

**Interfaces:**
- Consumes: `.code` `.code__bar` `.token.*`.
- Produces: the `#code` anchor — the target of both the nav link and the hero's primary CTA. In the draft this ID did not exist and both links were inert.

- [ ] **Step 1: Build the section**

Heading `Hello, SliceFx` and the bilingual lede from `$SNAP:573-574`. Three `.code` panels, each with a `.code__bar` and a `<pre tabindex="0">`:

1. **`Features/Users/CreateUser.cs`** — the same verbatim transcription as Task 4, bar chip bilingual `C# feature` / `C# 機能`.
2. **`Program.cs`** — transcribed **in full and verbatim** from `samples/SliceFx.Sample/Program.cs`, comments included. It is 24 lines; do not abridge it. The current site shows a shortened form, which is how a sample and its documentation drift apart. Bar chip bilingual `Host setup` / `ホスト設定`.
3. **SliceFx CLI** — the five commands from `$SNAP:637-641`:

```
slicefx routes
slicefx routes --format json
slicefx client csharp --output SliceApiClient.g.cs
slicefx client typescript --output slice-api-client.ts
slicefx openapi --output openapi.json
```

Bar chip bilingual `Commands` / `コマンド`.

Then the `[FromServices]` portability note from `$SNAP:643-646` verbatim, both languages, including the link to `docs/guides/parameter-binding.md`.

- [ ] **Step 2: Verify the anchor now resolves**

```bash
cd /Users/sanosuguru/dev/slicefx
grep -c 'id="code"' docs/index.html
grep -c 'href="#code"' docs/index.html
```

Expected: `1` and `>= 2` (nav plus hero CTA).

- [ ] **Step 3: Verify Program.cs matches the sample**

```bash
python3 - <<'PY'
import html, re, pathlib
page = pathlib.Path('docs/index.html').read_text()
block = re.search(r'Program\.cs.*?<pre[^>]*>(.*?)</pre>', page, re.S).group(1)
shown = {l.strip() for l in html.unescape(re.sub(r'<[^>]+>', '', block)).splitlines() if l.strip()}
src = {l.strip() for l in pathlib.Path('samples/SliceFx.Sample/Program.cs').read_text().splitlines() if l.strip() and not l.strip().startswith('//')}
invented = shown - src
print("LINES NOT IN THE SAMPLE:", invented or "none")
PY
```

Expected: `LINES NOT IN THE SAMPLE: none`.

- [ ] **Step 4: Verify every `<pre>` is keyboard reachable**

```bash
python3 -c "
import re, pathlib
page = pathlib.Path('docs/index.html').read_text()
pres = re.findall(r'<pre[^>]*>', page)
print('pre total:', len(pres), 'with tabindex:', sum('tabindex' in p for p in pres))
"
```

Expected: the two numbers are equal.

- [ ] **Step 5: Commit**

```bash
git add docs/index.html docs/assets/site.css
git commit -m "feat(site): code section with verbatim samples"
```

---

### Task 9: `#portability` — the three classes

**Files:**
- Modify: `docs/index.html`, `docs/assets/site.css`

**Interfaces:**
- Consumes: `.wrap` `.panel` `.h-lg` `.label`.
- Produces: the `#portability` anchor.

- [ ] **Step 1: Build the section**

Eyebrow `WASI / WebAssembly / edge`, then the heading from `$SNAP:658`: JA `まずは ASP.NET Core。WASI は必須ではありません` / EN `Start with ASP.NET Core. WASI is optional.` Do **not** write `Built for ASP.NET. Ready for the Edge.` — the WASI path depends on componentize-dotnet, NativeAOT-LLVM and jco, which CLAUDE.md forbids presenting as SliceFx guarantees.

Then all three explanatory paragraphs from `$SNAP:659-671`, verbatim and bilingual: the "WASI is an experimental way to see whether feature files can move beyond ASP.NET" paragraph, the edge/WASI definition paragraph, and the "most projects use all three classes" paragraph.

Then three `.panel` cards from `$SNAP:673-684`, each with a coloured class name and its description:

| Class | Colour | Description source |
|---|---|---|
| `portable` | `--success` | `$SNAP:676` |
| `partial` | `#eab308` | `$SNAP:680` |
| `aspnet-only` | `--accent-text` | `$SNAP:684` |

Use the current site's descriptions, not the draft's. In particular `portable` is **"Plain request / response features"**, not "Returns plain record/void" — the real eligible return shapes are `SliceResult<T>`, `SliceResult`, a POCO, `Task<T>` and `ValueTask<T>`.

Add the sentence that the classification tells tooling where a feature can run, not whether it is well-written (`$SNAP:670`), and keep `aspnet-only`'s "Not bad code; simply an ASP.NET-specific choice."

Do **not** carry over the draft's lede sentence "the CLI classifies every endpoint's portability at build time". It is wrong twice: classification happens at build time in the *source generator*, which writes it into the route manifest, and the CLI only reads that manifest afterwards; and `slicefx openapi` excludes `aspnet-only` routes by default (`docs/cli.md:137`), so the coverage is not "every endpoint". The current site's paragraphs, transcribed as instructed above, make neither claim.

- [ ] **Step 2: Verify the wording was not strengthened**

```bash
cd /Users/sanosuguru/dev/slicefx
grep -ci 'ready for the edge' docs/index.html
grep -c 'WASI is optional' docs/index.html
grep -ci 'returns plain record' docs/index.html
```

Expected: `0`, `1`, `0`.

- [ ] **Step 3: Verify card contrast**

```bash
cd /private/tmp/claude-501/-Users-sanosuguru-dev-slicefx/0f10ae0e-06b0-4c13-a654-874879d1f88e/scratchpad
for pair in "#10b981 #18181b" "#eab308 #18181b" "#a78bfa #18181b"; do python3 contrast.py $pair; done
```

Expected: three `PASS` lines.

- [ ] **Step 4: Commit**

```bash
git add docs/index.html docs/assets/site.css
git commit -m "feat(site): portability classes"
```

---

### Task 10: `#packages` — the six packages

**Files:**
- Modify: `docs/index.html`, `docs/assets/site.css`

**Interfaces:**
- Consumes: `.wrap` `.panel` `.h-lg`.
- Produces: the `#packages` anchor, and the NuGet URLs the footer reuses in Task 12.

- [ ] **Step 1: Build the section**

Heading and lede from `$SNAP:691-692`. Then a two-column grid of six `.panel` cards, each transcribed from `$SNAP:695-700` and now **linked** to its NuGet page (the current site leaves them unlinked; the draft used `href="#"`):

| Package | URL |
|---|---|
| SliceFx.Core | `https://www.nuget.org/packages/SliceFx.Core` |
| SliceFx.SourceGenerator | `https://www.nuget.org/packages/SliceFx.SourceGenerator` |
| SliceFx.Lambda | `https://www.nuget.org/packages/SliceFx.Lambda` |
| SliceFx.Wasi | `https://www.nuget.org/packages/SliceFx.Wasi` |
| SliceFx.TestHost | `https://www.nuget.org/packages/SliceFx.TestHost` |
| SliceFx.Cli | `https://www.nuget.org/packages/SliceFx.Cli` |

- [ ] **Step 2: Confirm each package really is published before linking**

```bash
for p in SliceFx.Core SliceFx.SourceGenerator SliceFx.Lambda SliceFx.Wasi SliceFx.TestHost SliceFx.Cli; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "https://www.nuget.org/packages/$p")
  printf '%-26s %s\n' "$p" "$code"
done
```

Expected: `200` for each. **If any returns 404, do not link that card** — leave it as unlinked text and report which ones. A dead link on the packages page is worse than no link.

- [ ] **Step 3: Verify no placeholder hrefs remain**

```bash
cd /Users/sanosuguru/dev/slicefx
grep -c 'href="#"' docs/index.html
```

Expected: `0`.

- [ ] **Step 4: Commit**

```bash
git add docs/index.html docs/assets/site.css
git commit -m "feat(site): packages section with NuGet links"
```

---

### Task 11: `#engineering` — documentation entry points

**Files:**
- Modify: `docs/index.html`, `docs/assets/site.css`

**Interfaces:**
- Consumes: `.wrap` `.panel` `.h-lg`.
- Produces: the `#engineering` anchor. This section is the only path from the published site to `docs/*.md`; if it is dropped or its links rot, the documentation becomes unreachable from the homepage.

- [ ] **Step 1: Build the section**

Eyebrow, heading and lede from `$SNAP:707-710`. Then a three-column grid of seven cards, transcribed from `$SNAP:712-758`. **Drop the lucide icon from each card** — they were decorative, the hard-bordered cards read fine without them, and reintroducing an icon set for seven glyphs would undo the dependency removal. Use the numbered `.label` eyebrow style from Task 5 instead.

| Card | Target |
|---|---|
| Design decisions FAQ / 設計判断 FAQ | `docs/design-decisions.md` |
| Source generator / ソースジェネレータ | `docs/source-generator.md` |
| Migration guides / 移行ガイド | `docs/migrations/from-minimal-api.md` and `docs/migrations/from-controllers.md` |
| ASP.NET features and escape hatches | `docs/guides/aspnet-features.md` |
| NativeAOT deployment | `docs/aot.md` |
| Production readiness targets | `docs/production-readiness.md` |
| Latest benchmark chart | `perf/latest.svg` (relative, not GitHub) |

Keep the "Targets, not a completed claim" framing on the production-readiness card verbatim.

Then the bottom link row from `$SNAP:760-761`, both languages, all seven links: `docs/cli.md`, `docs/guides/openapi.md`, `docs/guides/aspnet-features.md`, `docs/aot.md`, `docs/lambda.md`, `docs/migrations/from-minimal-api.md`, `docs/product-direction.md`.

- [ ] **Step 2: Verify every referenced doc exists in the tree**

```bash
cd /Users/sanosuguru/dev/slicefx
grep -o 'blob/main/docs/[a-z0-9/.-]*\.md' docs/index.html | sed 's|blob/main/||' | sort -u | while read -r f; do
  [ -f "$f" ] && printf 'OK      %s\n' "$f" || printf 'MISSING %s\n' "$f"
done
```

Expected: every line starts `OK`. Any `MISSING` is a broken link — fix the path.

- [ ] **Step 3: Verify the relative asset link resolves**

```bash
curl -sf -o /dev/null -w '%{http_code}\n' http://localhost:8765/perf/latest.svg
```

Expected: `200`.

- [ ] **Step 4: Commit**

```bash
git add docs/index.html docs/assets/site.css
git commit -m "feat(site): engineering section linking the docs tree"
```

---

### Task 12: Footer

**Files:**
- Modify: `docs/index.html`, `docs/assets/site.css`

**Interfaces:**
- Consumes: `.wrap`, the NuGet URLs from Task 10.
- Produces: completes the page; Task 13 verifies the whole.

- [ ] **Step 1: Build the footer**

The draft's three-column structure, with the current site's content (`$SNAP:765-775`) and real URLs everywhere. Left: the logo mark, the bilingual descriptor `SliceFx Framework - An experimental .NET API framework.` / `SliceFx Framework - 実験的な .NET API フレームワーク`, and `Released under the MIT License.` / `MITライセンスで公開しています。`

Three link columns:

| Column | Entries |
|---|---|
| Packages / パッケージ | SliceFx.Core, SliceFx.SourceGenerator, SliceFx.Cli → their NuGet URLs from Task 10 |
| Adapters / アダプタ | SliceFx.Lambda, SliceFx.Wasi, SliceFx.TestHost → their NuGet URLs |
| Resources / リソース | GitHub Repo → `https://github.com/sano-suguru/slicefx`; Design Decisions → `https://github.com/sano-suguru/slicefx/blob/main/docs/design-decisions.md` |

Footer link colour is `--fg-mute` on `--surface` (7.0:1). Do **not** use `zinc-500` — it is 3.67:1 on this background.

- [ ] **Step 2: Verify link hygiene across the whole page**

```bash
cd /Users/sanosuguru/dev/slicefx
echo "placeholder hrefs: $(grep -c 'href="#"' docs/index.html)"
echo "blank targets:     $(grep -o 'target="_blank"' docs/index.html | wc -l)"
echo "with noopener:     $(grep -o 'target="_blank"[^>]*rel="noopener' docs/index.html | wc -l)"
```

Expected: `0` placeholders, and the last two counts equal.

- [ ] **Step 3: Verify every in-page anchor resolves**

```bash
python3 - <<'PY'
import re, pathlib
page = pathlib.Path('docs/index.html').read_text()
ids = set(re.findall(r'id="([^"]+)"', page))
dead = sorted({a for a in re.findall(r'href="#([^"]*)"', page) if a and a not in ids})
print("DEAD ANCHORS:", dead or "none")
PY
```

Expected: `DEAD ANCHORS: none`. This is the check the draft would have failed on `#code`.

- [ ] **Step 4: Commit**

```bash
git add docs/index.html docs/assets/site.css
git commit -m "feat(site): footer with real package and docs links"
```

---

### Task 13: Full-page verification

**Files:**
- Modify: `docs/index.html`, `docs/assets/site.css`, `docs/assets/site.js` (fixes only)

**Interfaces:**
- Consumes: everything.
- Produces: a verified page, and a short written report of what was checked.

- [ ] **Step 1: Run the automated sweep**

```bash
cd /Users/sanosuguru/dev/slicefx
python3 - <<'PY'
import re, pathlib
page = pathlib.Path('docs/index.html').read_text()

ja = len(re.findall(r'class="lang-ja"', page))
en = len(re.findall(r'class="lang-en"', page))
print(f"[{'PASS' if ja == en else 'FAIL'}] language span parity: ja={ja} en={en}")

ids = set(re.findall(r'id="([^"]+)"', page))
dead = sorted({a for a in re.findall(r'href="#([^"]*)"', page) if a and a not in ids})
print(f"[{'PASS' if not dead else 'FAIL'}] dead anchors: {dead or 'none'}")

for s in ('features', 'positioning', 'code', 'packages', 'engineering', 'portability', 'main-content'):
    print(f"[{'PASS' if s in ids else 'FAIL'}] section id #{s}")

hosts = {h for h in re.findall(r'https?://([^/"]+)', page)}
allowed = {'fonts.googleapis.com', 'fonts.gstatic.com', 'sano-suguru.github.io',
           'github.com', 'www.nuget.org', 'schema.org', 'opensource.org', 'www.w3.org'}
bad = sorted(hosts - allowed)
print(f"[{'PASS' if not bad else 'FAIL'}] external hosts: {bad or 'all allowed'}")

for probe in ('rel="canonical"', 'name="robots"', 'hreflang="x-default"', 'og:image',
              'twitter:card', 'application/ld+json', 'aria-live="polite"',
              'aria-label="Primary navigation"', 'tabindex="-1"', 'skip-link'):
    print(f"[{'PASS' if probe in page else 'FAIL'}] preserved: {probe}")

pres = re.findall(r'<pre[^>]*>', page)
ok = all('tabindex' in p for p in pres)
print(f"[{'PASS' if ok else 'FAIL'}] all {len(pres)} <pre> keyboard-reachable")

print(f"[{'PASS' if 'href=\"#\"' not in page else 'FAIL'}] no placeholder hrefs")
for banned in ('Zero drift', 'Zero API Drift', 'Native AOT Ready', 'Ready for the Edge', 'C# 12'):
    print(f"[{'PASS' if banned not in page else 'FAIL'}] overclaim absent: {banned}")
PY
```

Expected: every line `PASS`. Fix any `FAIL` before continuing.

- [ ] **Step 2: Re-measure every colour pair against its real backdrop**

```bash
cd /private/tmp/claude-501/-Users-sanosuguru-dev-slicefx/0f10ae0e-06b0-4c13-a654-874879d1f88e/scratchpad
fail=0
for pair in "#ffffff #7c3aed" "#f4f4f5 #09090b" "#a1a1aa #09090b" "#a1a1aa #18181b" \
            "#8b8b94 #18181b" "#8b5cf6 #09090b" "#a78bfa #18181b" "#10b981 #18181b" \
            "#eab308 #18181b" "#38bdf8 #18181b" "#fca5a5 #09090b"; do
  python3 contrast.py $pair || fail=1
done
[ $fail -eq 0 ] && echo "ALL PASS" || echo "CONTRAST REGRESSION"
```

Expected: `ALL PASS`.

- [ ] **Step 3: Confirm the workflow and CI are untouched**

```bash
cd /Users/sanosuguru/dev/slicefx
git diff --stat main...HEAD -- .github/ && echo "--- (empty above means pages.yml untouched)"
git diff --name-only main...HEAD | grep -v '^docs/' || echo "ONLY docs/ CHANGED"
```

Expected: no `.github/` changes, and `ONLY docs/ CHANGED`.

- [ ] **Step 4: Manual browser pass**

With the server from Task 3 running at `http://localhost:8765/`:

1. Toggle EN → JA → EN. Confirm no layout break and that `<html lang>` follows.
2. Reload. Confirm the language persisted.
3. Click the copy button. Confirm the status text appears and clears after 3s.
4. **Disable JavaScript and reload.** Confirm the page renders fully styled and that *both* languages are visible (the CSS toggle is inert without the `data-lang` attribute being changed, so English shows by default from the markup). Confirm no layout collapse.
5. Resize to 320, 768, 1280 px. Confirm no horizontal body scroll at any width, and that code blocks scroll within their own box.
6. Tab through the page from the top. Confirm the skip link appears first, the focus ring is visible on every control, and `<pre>` blocks receive focus.
7. Confirm the browser console is empty.

- [ ] **Step 5: Stop the server and write the report**

```bash
kill %1 2>/dev/null
```

Report to the user: which automated checks passed, the result of each manual step, and anything deliberately left undone. Do not claim a step passed without having run it.

- [ ] **Step 6: Commit any fixes**

```bash
cd /Users/sanosuguru/dev/slicefx
git add docs/
git commit -m "fix(site): address verification findings" || echo "nothing to fix"
```

---

## Out of scope

Noted here so they are not silently absorbed:

- A committed link/contrast/code-drift checker under `eng/`. It would genuinely prevent the code-sample drift found in the draft from recurring, but it is new CI infrastructure beyond the approved spec. Worth proposing separately.
- Redesigning `docs/ogp.svg` to match the new visual language. The current OGP image stays; its alt text is the source of the new headline.
- Self-hosting the three web fonts to reach zero external dependencies.
- Any change to `docs/*.md`, `docs/ja/**`, `docs/sitemap.xml`, or `.github/workflows/pages.yml`.
