# 01: Walking skeleton

**What to build:** A Learner opens the site and sees a home page that explains what DebugLab is and offers the four areas (Concepts, Playbook, Incident Lab, Resources). Persistent navigation moves between the areas (placeholders for now). The site has a dark operations-console look with a light theme toggle that is remembered, and every page address survives a refresh and a direct visit when served from the GitHub Pages sub-path. Unit tests and browser tests both run in a GitHub Actions workflow.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Home page explains the site and links to the four areas
- [ ] Navigation between the four areas is visible on every page and marks the current one
- [ ] Dark theme by default, light theme toggle, choice remembered across reloads, site still works when storage is unavailable
- [ ] Each area has its own address; loading it directly or refreshing it shows the right page under the project sub-path
- [ ] Unit test runner and browser test runner are set up, each with passing tests
- [ ] A GitHub Actions workflow runs typecheck, unit tests, build and browser tests on push and pull request
