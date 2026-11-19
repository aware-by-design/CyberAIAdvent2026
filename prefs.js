/* Accessibility preferences, applied before the page is drawn (this file loads without defer, so nothing
   flashes): text size, paused animations, high contrast, easier reading. They are chosen in the
   Accessibility panel (common.js) and saved in this browser only. */
"use strict";
(() => {
  try {
    const p = JSON.parse(window.localStorage.getItem("cyber-advent:a11y") || "{}") || {};
    const c = document.documentElement.classList;
    if (p.size === 1 || p.size === 2) c.add("a11y-size-" + p.size);
    if (p.still === true) c.add("a11y-still");
    if (p.contrast === true) c.add("a11y-contrast");
    if (p.readable === true) c.add("a11y-readable");
  } catch (e) { /* storage blocked or unreadable: the defaults apply */ }
})();
