/* =============================================================================
   mathjax-config.js — MathJax engine settings, shared by every page.

   Loaded once in each page's <head>, BEFORE the MathJax library, so all your
   math settings live in one place instead of being copied into every file.

   This is separate from macros.html on purpose:
     - THIS file  = engine settings (delimiters, what to skip). Rarely touched.
     - macros.html = your LaTeX \newcommand shortcuts. Edited often.

   Docs: https://docs.mathjax.org/en/latest/options/index.html
   ============================================================================= */

window.MathJax = {
    tex: {
        // What turns text into math:
        inlineMath:  [['$', '$'], ['\\(', '\\)']],    //  $...$   and  \(...\)
        displayMath: [['$$', '$$'], ['\\[', '\\]']]   //  $$...$$ and  \[...\]
    },
    options: {
        // Never typeset the contents of these tags — so a literal $ inside a
        // code sample (e.g. echo "$HOME") is left alone.
        skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
    },
    startup: {
        // Don't auto-typeset. includes.js runs the single typeset once the
        // macros from macros.html are in the DOM (avoids a load-order race).
        typeset: false
    }
};
