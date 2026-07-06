/* =============================================================================
   includes.js — client-side includes for the shared header, footer, and math
   macros. This replaces the three jQuery `.load()` calls the site used to make.

   Each page has three empty placeholders:
       <div id="head"></div>   <div id="macros"></div>   <div id="foot"></div>
   and this script fetches header.html / footer.html / macros.html and drops
   their contents in. Edit the nav or footer once, in those files, and every
   page updates.

   It also drives MathJax: the pages set `startup.typeset = false`, so MathJax
   does NOT typeset on its own. We trigger the single typeset here, AFTER the
   macros in macros.html are in the DOM — otherwise a fast (cached) MathJax
   could render before the macros load and show macro errors.

   NOTE: fetch() only works when the page is *served* over http(s) — a local
   server (e.g. VS Code's "Live Server") or a real host. Opening the .html file
   directly from disk (file://) will skip the includes; the body content and
   base math still render, but the header/footer won't. See README.md.
   ============================================================================= */

async function include(selector, url) {
    const target = document.querySelector(selector);
    if (!target) return;                 // page doesn't use this include; skip
    try {
        const response = await fetch(url);
        target.innerHTML = await response.text();
    } catch (err) {
        console.warn(
            `includes.js: couldn't load ${url}. ` +
            `Serve the site with a local server (see README) rather than opening the file directly.`,
            err
        );
    }
}

// Run the one MathJax typeset, once the library has finished loading from the
// CDN. Called after the macros are already in the DOM.
function typesetMath(triesLeft = 200) {
    if (window.MathJax && MathJax.startup && MathJax.startup.promise) {
        MathJax.startup.promise.then(() => MathJax.typesetPromise());
    } else if (triesLeft > 0) {
        setTimeout(() => typesetMath(triesLeft - 1), 50);   // MathJax not attached yet
    }
    // If MathJax never loads (e.g. offline), we simply give up quietly.
}

document.addEventListener("DOMContentLoaded", async () => {
    await Promise.all([
        include("#head", "/header.html"),
        include("#foot", "/footer.html"),
        include("#macros", "/macros.html"),   // fixed: every page now has a #macros div
    ]);
    typesetMath();
});
