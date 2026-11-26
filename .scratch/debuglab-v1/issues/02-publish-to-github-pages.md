# 02: Publish to GitHub Pages

**What to build:** The site is live at its public GitHub Pages address and republishes automatically when the main branch changes, only if the tests pass. Needs the owner: creating the public repository and the first push.

**Blocked by:** 01 Walking skeleton

**Status:** resolved

- [x] Public repository named DebugLab exists and holds the code
- [x] Workflow deploys to GitHub Pages after tests pass on main
- [x] The live site loads, and a deep link to an area loads directly

## Comments

- Published 2026-11-26 at the owner's request: https://github.com/paperTigerToo/debuglab, live at https://papertigertoo.github.io/debuglab/.
- The repository is named debuglab (lower case), as the owner asked, not DebugLab. Pages paths are case-sensitive, so the site's base path is /debuglab/.
- CI's deploy job runs only on pushes to main and only after typecheck, unit tests, the build and the browser tests pass. Pages takes its source from GitHub Actions.
- Deep links work through 404.html, a copy of index.html, so they load with HTTP status 404 before the app routes them. Browsers show the page; crawlers and link previews see a 404. A prerendered page per route would fix that if search ever matters.
