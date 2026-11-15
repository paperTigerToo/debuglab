# 11: Motion and small screens

**What to build:** Graphs draw in and react, the alert pulses, terminal output streams, pages and panels transition; all switched off under reduced motion. Concepts, Playbook and Resources read well on phones; the Incident Lab shows a keyboard-needed notice on small screens.

**Blocked by:** 04 Bad Deploy dashboard, 06 Finish and Debrief

**Status:** resolved

- [x] Meaningful, short animations only
- [x] Reduced motion honoured; browser test confirms it
- [x] Responsive reading pages; Incident Lab notice on phones

## Comments
- Resolved. Motion, pinned to 14.9.0 (the newest release more than two weeks old), drives page transitions (180 ms) and the graphs: lines draw in (600 ms) and move to their new shape when the Target System changes (350 ms). CSS drives the firing alert's pulse, terminal output streaming in a line at a time (300 ms at most), and Hints and Debrief sections rising in (180 ms). Timings live in src/site/motion.ts and as --animate-* tokens in index.css. Under reduced motion a media query turns off every CSS animation and transition, and Motion components check useReducedMotion().
- The reduced-motion browser test checks both kinds: document.getAnimations() for CSS, and a MutationObserver for Motion, which animates on the main thread and is invisible to it. With the chart's guard removed the test fails.
- On phones the Incident Lab shows a "Best on a computer" notice with links to Concepts and the Playbook and an "Open it anyway" button; a browser test confirms the reading pages fit a Pixel 5 without sideways scrolling.
- Review leftovers: the notice uses a mouse as a stand-in for a keyboard, which no media query can detect, so a tablet with a keyboard but no mouse sees it. "Open it anyway" is not remembered between visits. Keying the page wrapper on the path remounts each page on navigation, which was already so for the Incident page.

