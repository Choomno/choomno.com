# Personal website — editing guide

A hand-made static website: plain HTML, CSS, and a little vanilla JavaScript.
No framework, no build step. You edit files and reload the page.

This README is your manual for editing the site. (Keeping a README is standard
practice — it's the first thing anyone reading the repo looks for, and on a site
that doubles as a portfolio it shows you document your work.)

---

## Hyperbolic homepage

The home page now includes an intrinsic WebGL 2 ray tracer for the complete
Borromean rings complement, with the complete-limit rhombic dodecahedral lattice, exact integer
SnapPy face pairings, and an exact gluing certificate. See [RENDERING.md](RENDERING.md) for the computation, upstream
repositories, precision limits, and verification commands. The secondary pages
retain the original shared layout.

## 1. Preview it locally

The pages load their shared header/footer with JavaScript's `fetch`, and browsers
block `fetch` when you open a file directly (a `file://` address). So you have to
**serve** the folder over http, not double-click the `.html`. Any one of these:

- **VS Code — Live Server extension** (easiest): install *Live Server*, then
  right-click `index.html` → **Open with Live Server**. It auto-reloads on save.
- **Python:** in this folder run
  ```
  py -m http.server 8000
  ```
  then open <http://localhost:8000>.
- **Node:** `npx serve`

If you open a page as a bare file instead, the `<main>` content and the math
still render, but the header and footer won't appear (you'll see a note in the
browser's developer console explaining why).

---

## 2. How a page is put together

Every page is a thin shell plus your content:

```
<head>  … stylesheet, MathJax, scripts …        ← shared boilerplate
<div id="head">   </div>   ← header.html gets injected here
<div id="macros"> </div>   ← macros.html gets injected here
<main>  … YOUR CONTENT …    </main>              ← the part you write
<div id="foot">   </div>   ← footer.html gets injected here
```

`includes.js` fills the three placeholder `<div>`s from `header.html`,
`footer.html`, and `macros.html`, so the nav, footer, and math shortcuts live in
**one file each** — edit them once and every page updates.

> **Why is the `<head>` repeated on every page instead of shared like the header?**
> The head has to be real HTML in each file: it loads the stylesheet and MathJax
> *before* the page renders, and it holds the page-specific `<title>`. Injecting it
> with JavaScript would cause a flash of unstyled content and hurt search/preview.
> So you copy it — via `_template.html` — rather than trying to share it. (If you
> ever want to eliminate the copying entirely, that's what a static-site generator
> or a small build script does; see §8.)

---

## 3. File map

| File / folder        | What it is |
|----------------------|------------|
| `index.html`         | Home page |
| `about.html`         | About page |
| `_template.html`     | Blank page template — copy it to start any new page |
| `header.html`        | Shared nav bar (edit once) |
| `footer.html`        | Shared footer (edit once) |
| `macros.html`        | **Your LaTeX math shortcuts** (see §6) |
| `light.css`          | All styling; theme variables at the top |
| `mathjax-config.js`  | **MathJax engine settings** (see §5) |
| `includes.js`        | Injects header/footer/macros; runs the math typeset |
| `helpful_stuff.js`   | Collapsible sections |
| `fonts/`             | New Computer Modern (the LaTeX serif), 4 weights |
| `images/`            | `favicon.svg` and any images you add |

---

## 4. Common tasks

**Add a new page.** Copy `_template.html` to e.g. `notes.html`, change the
`<title>` and description, write your content in `<main>`, and add a link to it in
`header.html` (the nav) if you want it there.

**Change the nav or footer.** Edit `header.html` / `footer.html` once; the change
shows on every page. Replace the placeholder name, tagline, email, and GitHub link.

**Re-theme colours or the font.** Open `light.css` and edit the variables in the
`:root` block at the very top — it's the single place colours and the base font
are defined. For example, `--link` changes every link colour; `--font-body`
swaps the typeface site-wide.

**Add your résumé.** Drop a `resume.pdf` into this folder. The nav already links
to `/resume.pdf`.

**Change the favicon.** Replace `images/favicon.svg` with your own (any square
SVG, or swap in a `.ico`/`.png` and update the `<link rel="icon">` in each head).

---

## 5. Writing math (MathJax) — settings

The site renders LaTeX in the browser with [MathJax](https://www.mathjax.org/).
You write ordinary LaTeX in your HTML and it becomes typeset math.

**Inline math** — inside a sentence — with single dollar signs or `\( … \)`:

```
The area of a circle is $A = \pi r^2$.
```

**Displayed math** — centered on its own line — with `\[ … \]` or `$$ … $$`:

```
\[ \int_{-\infty}^{\infty} e^{-x^2}\,dx = \sqrt{\pi}. \]
```

**A literal dollar sign** in prose: write `\$` so it isn't read as math.

**Dollar signs in code are safe.** MathJax is told to ignore `<code>` and `<pre>`
blocks, so `echo "$HOME"` in a code sample renders as-is.

**Where the settings live:** `mathjax-config.js`. That one file (loaded by every
page) sets the delimiters above and the "skip code blocks" rule. You rarely need
to touch it; if you do, change it there and it applies everywhere.

**Loading / offline:** MathJax is loaded from a CDN
(`cdn.jsdelivr.net/npm/mathjax@3/...`), so math needs an internet connection to
render. To make it work fully offline, download MathJax into the folder and point
the second `<script>` in each head (or in `_template.html`) at your local copy.

---

## 6. Math macros — your LaTeX shortcuts

Macros are `\newcommand` shortcuts so you don't retype the same LaTeX. They live
in **`macros.html`** and are available on every page.

Open `macros.html` and you'll see a hidden block like:

```html
<div style="display:none">$
    \newcommand\R{\mathbb{R}}
    \newcommand\Z{\mathbb{Z}}
    \newcommand\abs[1]{\left|#1\right|}
$</div>
```

**To add a macro,** add a `\newcommand` line inside that `$ … $` block. Two kinds:

- No argument: `\newcommand\eps{\varepsilon}` → then type `$\eps$` anywhere.
- With arguments: `\newcommand\norm[1]{\left\lVert #1 \right\rVert}` → type
  `$\norm{v}$`. The `[1]` is the number of arguments; `#1` is where the first one
  goes.

You write them in **normal LaTeX** here (this is why macros live in an HTML file
rather than the JS config — no backslash-escaping to fight with).

Delete any example macros you don't want.

---

## 7. Troubleshooting

- **Header/footer missing, page looks bare.** You opened the file directly. Serve
  it instead (§1).
- **Math shows as raw `$...$` text.** MathJax didn't load — check your internet
  connection, or the browser console for errors.
- **A macro shows up red / "undefined control sequence".** The macro isn't
  defined — check spelling in `macros.html`, and that your `$...$` uses the exact
  command name.
- **A whole page has no math.** Make sure its `<head>` includes both
  `mathjax-config.js` and `includes.js` (copy `_template.html` to be safe).

---

## 8. Deploying (GitHub Pages + custom domain choomno.com)

This site deploys to GitHub Pages on the custom domain **choomno.com**. Because a
custom domain serves at the domain root, the site's root-absolute paths
(`/light.css`, `/about.html`) work unchanged, and the repo can be named anything.

Repo files that make this work (already created):
- **`CNAME`** — contains `choomno.com`; tells Pages the custom domain. Keep it
  committed, or a push can drop your domain.
- **`.nojekyll`** — turns off GitHub's Jekyll step so every file (including
  `_template.html`) is served as-is and code containing `{{ }}` isn't mangled.
- **`404.html`** — shown for unknown URLs.

**First-time setup:**
1. Create an empty repo on GitHub and push this folder to `main`:
   ```
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```
2. Repo → **Settings → Pages** → Source: *Deploy from a branch* → `main` / `(root)`.
3. On that page, set the custom domain to `choomno.com` (the `CNAME` file already
   declares it).
4. At your DNS registrar, add records for `choomno.com`:
   - Apex `A` records → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`,
     `185.199.111.153`
   - `www` `CNAME` → `<you>.github.io`
5. When the DNS check passes, tick **Enforce HTTPS**.

**Updating the site:** commit and `git push`; Pages republishes in ~1 minute.

**If you later want to kill the head duplication entirely,** a static-site
generator (Eleventy/Jekyll/Hugo) or a small build script lets you define one
layout and stamp it into every page at build time — output is still plain static
HTML. More powerful, but adds tooling; this site is deliberately buildless.

---

## 9. Notes

- No jQuery, no `polyfill.io`, no analytics, no trackers — nothing loads except
  the stylesheet, your scripts, and MathJax from its CDN.
- Paths are root-absolute (`/light.css`, `/about.html`) so every page's `<head>` is
  identical regardless of folder depth — at the cost of needing to be served from
  the site root (see §8).
