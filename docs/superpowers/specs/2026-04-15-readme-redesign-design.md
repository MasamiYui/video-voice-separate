# README Redesign And Branding Design

## Summary

Rebuild the repository landing experience so `README.md` reads like a credible open-source project homepage rather than a raw engineering memo.
The new presentation will position `translip` as a research-driven but engineering-complete **Beta / Early Access** system, with:

- a custom SVG logo
- factual badges
- a clearer information hierarchy
- an architecture diagram
- real project screenshots captured from the local web UI
- a full English companion README

## Context

The current `README.md` already contains strong technical content, including installation steps, pipeline stage explanations, web UI setup, and command examples.
What it lacks is structure and visual trust signaling:

- no brand identity beyond plain text
- no hero section that immediately explains the project
- no badges or project metadata at the top
- no architecture diagram for quick orientation
- no UI screenshots showing the management interface
- no dedicated English README file for international readers

As a result, the repo feels functional but not yet polished.

## Goals

- Keep the README technically accurate and grounded in the current codebase.
- Make the first screen of the repository look intentional and trustworthy.
- Present the project as a research-oriented yet product-shaped Beta system.
- Add a reusable SVG logo asset stored in the repo.
- Add a concise system architecture diagram directly in the README.
- Add real screenshots taken from the local FastAPI + React UI using Playwright.
- Publish a full English README as a separate file.
- Preserve the existing installation and usage value while improving scanability.

## Non-Goals

- Rebranding the application UI itself.
- Claiming production readiness or adding unsupported maturity signals.
- Inventing metrics, performance claims, benchmarks, or adoption stats.
- Creating a marketing site outside the repository README.
- Adding animated GIFs unless static screenshots prove insufficient.

## Product Positioning

The repository should communicate a blended identity:

- **Research-driven**: the pipeline is modular, model-aware, and designed for experimentation and extension.
- **Product-shaped**: there is a web management UI, task orchestration, persistent task state, and export flow.
- **Beta**: the project is complete enough to run end-to-end, but still positioned as fast-moving early software.

The top-level maturity signal should explicitly use `Beta / Early Access`, not `Production-ready`.

## Deliverables

### 1. Chinese Main README

`README.md` remains the primary entry point and is written in Chinese.
It should feel like a project homepage with a strong top section and a consistent narrative arc:

1. hero block
2. factual badges
3. quick links
4. short value proposition
5. screenshots
6. architecture
7. capabilities
8. quick start
9. pipeline and CLI detail
10. docs/development references

### 2. Full English README

Add `README.en.md` as a full English counterpart rather than a short summary.
It should mirror the same core structure and visual assets as the Chinese README, adapted for English phrasing instead of mechanically line-by-line translating every sentence.

### 3. SVG Logo

Create a repository-local SVG logo under a documentation assets directory.
The logo should look clean, technical, and slightly product-like without becoming overly decorative.

Recommended visual language:

- a compact mark that suggests audio, speech, and timeline flow
- strong geometry
- restrained blue/cyan palette with slate accents
- readable on GitHub light mode

The logo should be suitable for:

- the README hero section
- future reuse in docs or social previews

### 4. Architecture Diagram

Include a Mermaid architecture diagram in both READMEs.
The diagram should show the major system blocks:

- input media
- stage/task pipeline
- orchestration layer
- asset/output artifacts
- FastAPI backend
- SQLite/task state
- React management UI

The diagram should stay at the system level, not the file/module level.

### 5. Project Screenshots

Capture real screenshots from the local UI using Playwright.
At minimum include:

- dashboard overview
- task detail / pipeline progress view
- task creation flow or settings page

Screenshots should be saved in-repo and referenced from the README using relative paths.
The final screenshot set should show actual working screens, not placeholders or illustrative mockups.

## Information Architecture

### Hero Section

The hero should contain:

- logo
- project name
- one-line title
- short supporting description
- badges
- quick links to Chinese docs, English README, frontend README, and docs index

Suggested tone:

- direct
- technical
- credible
- not overhyped

### Recommended Section Order

For the Chinese README:

1. Hero
2. Why `translip`
3. Screenshots
4. System Architecture
5. Core Capabilities
6. Pipeline Stages
7. Environment Requirements
8. Installation
9. Quick Start
10. Web UI
11. CLI Commands
12. Configuration And Environment Variables
13. Development
14. Documentation Links
15. English README link

The English README should mirror this ordering closely.

## Badge Strategy

Use only factual badges.
Recommended badges:

- Python `3.11-3.12`
- FastAPI
- React
- Apache-2.0
- Beta / Early Access
- Local-first or Self-hosted, only if phrasing stays defensible

Avoid badges that require unstable external project state unless clearly maintained, such as CI status when no stable workflow is in place.

## Asset Strategy

Store README assets under `docs/assets/readme/` and brand assets under `docs/assets/brand/`.

Expected new files:

- `docs/assets/brand/translip-logo.svg`
- `docs/assets/readme/dashboard.png`
- `docs/assets/readme/task-detail.png`
- `docs/assets/readme/new-task.png` or `settings.png`

This keeps README presentation assets grouped and reusable.

## Screenshot Capture Strategy

Use Playwright against the real local app.

Implementation assumptions:

- start the FastAPI backend locally
- start the frontend locally when needed
- use existing task data if available
- if the dashboard is empty, use the safest existing local task state or seed a minimal demo state only if strictly necessary

The screenshots should prioritize credibility over idealized composition:

- consistent browser width
- clean framing
- readable content
- no devtool overlays
- no misleading fake states

## Writing Principles

- Keep claims grounded in implemented features.
- Prefer specific nouns over promotional adjectives.
- Reduce duplicate explanation across sections.
- Preserve command examples that are already useful.
- Improve headings and scannability before adding more words.
- State Beta maturity clearly once near the top instead of repeating it everywhere.

## Verification

Before finalizing:

- review both READMEs in raw markdown and rendered form
- verify every image path resolves
- verify Mermaid blocks are valid markdown syntax
- verify screenshots are clear and not obviously development-only artifacts
- run any necessary local preview checks for markdown rendering

## Risks And Mitigations

### Risk: Over-marketing

If the README becomes too polished relative to the actual current feature set, trust drops.

Mitigation:
- keep Beta positioning explicit
- avoid claims about scale, quality, or production readiness without proof

### Risk: Fake-looking screenshots

If screenshots look synthetic or empty, they weaken credibility.

Mitigation:
- capture real UI states from the running app
- favor dashboard/task detail screens with actual data

### Risk: Asset sprawl

If screenshots and logo files are scattered, the docs become harder to maintain.

Mitigation:
- centralize all README assets under `docs/assets/`

## Implementation Outline

1. Create the design spec and implementation plan.
2. Build the SVG logo asset.
3. Rewrite the Chinese README structure and tone.
4. Write the full English README.
5. Run the local app and capture screenshots with Playwright.
6. Add screenshot references and architecture diagram to both READMEs.
7. Render-check, self-review, and finalize.
