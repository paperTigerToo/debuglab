# 01: Walking skeleton

**What to build:** A Learner opens the site and sees a home page that explains what DebugLab is and offers the four areas (Concepts, Playbook, Incident Lab, Resources). Persistent navigation moves between the areas (placeholders for now). The site has a dark operations-console look with a light theme toggle that is remembered, and every page address survives a refresh and a direct visit when served from the GitHub Pages sub-path. Unit tests and browser tests both run in a GitHub Actions workflow.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Home page explains the site and links to the four areas
- [x] Navigation between the four areas is visible on every page and marks the current one
- [x] Dark theme by default, light theme toggle, choice remembered across reloads, site still works when storage is unavailable
- [x] Each area has its own address; loading it directly or refreshing it shows the right page under the project sub-path
- [x] Unit test runner and browser test runner are set up, each with passing tests
- [x] A GitHub Actions workflow runs typecheck, unit tests, build and browser tests on push and pull request

## Comments

- Done. React Router with a `/DebugLab/` base; the build copies `index.html` to `404.html` so deep links and refreshes work on GitHub Pages. Browser tests run against a local server that mimics Pages (missing paths get `404.html`). CI runs typecheck, unit tests, build and browser tests; deploying is ticket 02.
