# README Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the repository landing experience into a polished bilingual project homepage with a new SVG logo, architecture diagram, and real UI screenshots.

**Architecture:** Keep the work scoped to documentation and documentation assets. README structure and tone are updated in place, visual assets are stored under `docs/assets/`, and screenshots are captured from the real local app using Playwright so the final presentation stays grounded in the working product.

**Tech Stack:** Markdown, SVG, Mermaid, FastAPI, React/Vite, Playwright CLI

---

## File Structure

- Create: `docs/assets/brand/translip-logo.svg`
- Create: `docs/assets/readme/dashboard.png`
- Create: `docs/assets/readme/task-detail.png`
- Create: `docs/assets/readme/new-task.png` or `docs/assets/readme/settings.png`
- Create: `README.en.md`
- Modify: `README.md`
- Create: `docs/superpowers/plans/2026-04-15-readme-redesign.md`

### Task 1: Create README Asset Directories And Brand Logo

**Files:**
- Create: `docs/assets/brand/translip-logo.svg`

- [ ] **Step 1: Create asset directories**

Run:

```bash
mkdir -p docs/assets/brand docs/assets/readme output/playwright
```

Expected: the brand, readme, and temporary screenshot directories exist.

- [ ] **Step 2: Create the SVG logo**

Add a vector logo that combines:

- a timeline bar motif
- a waveform / speech contour
- a compact technical blue palette
- a readable mark that works above the README title

Implementation target:

```text
docs/assets/brand/translip-logo.svg
```

- [ ] **Step 3: Verify the SVG is valid**

Run:

```bash
file docs/assets/brand/translip-logo.svg
```

Expected: reports SVG/XML text.

### Task 2: Rewrite The Chinese README As A Project Homepage

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace the top section**

Rewrite the hero so it includes:

- centered logo image
- Chinese title and subtitle
- factual badges
- quick links
- explicit `Beta / Early Access` positioning

- [ ] **Step 2: Reorganize the content sections**

Restructure the README into:

1. Hero
2. Why `translip`
3. Screenshots
4. Architecture
5. Core capabilities
6. Pipeline stages
7. Requirements
8. Installation
9. Quick start
10. Web UI
11. CLI commands
12. Environment variables
13. Development
14. Documentation links
15. English README

- [ ] **Step 3: Add the Mermaid architecture diagram**

Embed a Mermaid graph that shows:

- input media
- stage/task pipeline
- orchestration
- FastAPI backend
- SQLite task store
- React UI
- outputs

- [ ] **Step 4: Keep all claims factual**

Before moving on, skim every new section and remove anything that implies:

- production readiness
- verified performance claims
- unsupported quality claims

### Task 3: Create The Full English README

**Files:**
- Create: `README.en.md`

- [ ] **Step 1: Mirror the Chinese README structure**

Create a full English README with the same core sections and the same assets.

- [ ] **Step 2: Adapt language instead of literal translation**

Use English phrasing that reads naturally for GitHub users while preserving:

- the same architecture diagram
- the same screenshots
- the same beta positioning
- the same installation and usage instructions

- [ ] **Step 3: Link the two READMEs together**

Ensure:

- `README.md` links to `README.en.md`
- `README.en.md` links back to `README.md`

### Task 4: Capture Real UI Screenshots With Playwright

**Files:**
- Create: `docs/assets/readme/dashboard.png`
- Create: `docs/assets/readme/task-detail.png`
- Create: `docs/assets/readme/new-task.png` or `docs/assets/readme/settings.png`

- [ ] **Step 1: Verify Playwright prerequisites**

Run:

```bash
command -v npx >/dev/null 2>&1
```

Expected: exit code `0`.

- [ ] **Step 2: Start the local app**

Run the backend and frontend in separate sessions, for example:

```bash
uv run uvicorn translip.server.app:app --host 127.0.0.1 --port 8765
cd frontend && npm run dev -- --host 127.0.0.1 --port 5173
```

Expected: backend on `8765`, frontend on `5173`.

- [ ] **Step 3: Use Playwright to inspect the UI**

Use the Playwright wrapper:

```bash
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"
"$PWCLI" open http://127.0.0.1:5173 --headed
"$PWCLI" snapshot
```

Expected: the current UI can be navigated and inspected.

- [ ] **Step 4: Capture clean screenshots**

Capture at least three screens with readable content and copy the approved images into `docs/assets/readme/`.

- [ ] **Step 5: Verify image files exist**

Run:

```bash
find docs/assets/readme -maxdepth 1 -type f | sort
```

Expected: screenshot files are present and named consistently.

### Task 5: Final Render And Consistency Review

**Files:**
- Modify: any README or asset file if review reveals issues

- [ ] **Step 1: Check markdown links and image paths**

Run:

```bash
rg -n 'docs/assets|README\\.en|README\\.md|```mermaid' README.md README.en.md
```

Expected: both READMEs reference the expected assets and cross-links.

- [ ] **Step 2: Review the rendered top sections**

Open the final README markdown locally or review the generated Git diff to confirm:

- hero layout is readable
- badges render
- screenshots display
- mermaid syntax is well formed

- [ ] **Step 3: Review git diff**

Run:

```bash
git diff -- README.md README.en.md docs/assets docs/superpowers/plans/2026-04-15-readme-redesign.md
```

Expected: changes are confined to README content and related assets.

- [ ] **Step 4: Commit**

```bash
git add README.md README.en.md docs/assets docs/superpowers/plans/2026-04-15-readme-redesign.md
git commit -m "docs: redesign repository readme"
```

## Self-Review

- Spec coverage:
  - Chinese README homepage: Task 2
  - full English README: Task 3
  - SVG logo: Task 1
  - real screenshots: Task 4
  - render and consistency checks: Task 5
- Placeholder scan:
  - no `TODO`, `TBD`, or unspecified output locations remain
- Consistency:
  - asset locations are fixed under `docs/assets/`
  - screenshot capture uses Playwright against the real local app
  - both READMEs share the same visual asset set and maturity positioning
