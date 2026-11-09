# Compact Disclosure Manager Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for this closely coupled UI change. Follow the existing user authorization; do not create a worktree or push.

**Goal:** Make the DA sidebar easy to scan while preserving disclosure editing and reviewed saving.
**Architecture:** Keep the current controller, assistant and source operations. Change the presentation and UI state at their existing boundaries.
**Tech Stack:** Native HTML, CSS and JavaScript; existing Node/linkedom tests.
**Spec:** `docs/superpowers/specs/2026-11-08-disclosure-manager-compact-design.md`

## Global Constraints

Regular repository; no schema/content migration, new dependencies, backend changes or edits to vendored aem.js. The user pushes. Preserve all save/conflict/recovery guards.

## Review Focus

Narrow panels and long legal content; keyboard move/discard; unsupported helper selections; helper status isolation; review/cancel/save transitions and recovery.

## Task 1: Compact manager and contextual helper

Files: manager HTML/CSS/controller, assistant.js, existing manager/assistant tests.

- [x] Add regressions for short row labels, expandable full content, Discard without source writes, review/footer state, contextual helper visibility and status isolation. Run and confirm the failures.
- [x] Implement compact rows, collapsed footer preview, helper visibility/fallback state, and footer actions. Preserve source behavior.
- [x] Run focused tests, then the complete project checks.
- [x] Verify narrow-panel and desktop demo behavior in the browser; capture screenshots. Review the complete change and fix findings.
- [x] Commit the UI change with its tests and verification notes.

## Execution record

Initial state: clean branch at a917d63. Existing save operations are unchanged by this plan. User approved trying the three UI recommendations; detailed layout choices are implementation judgment.

Verification: 38 focused interaction tests and all 478 project tests passed. Project lint passed, including a final lint run after the two-line label adjustment. The browser confirmed compact rows, full Details text, review/Back, in-memory save, reorder/Discard, and contextual linking with independent manager status. At 250px width rows measured 100–119px with no horizontal overflow; the save bar remained at the bottom of the 800px viewport. A 960px layout also had no horizontal overflow.

A fresh reviewer caught the `[hidden]` rule losing to the grid display rule. The browser reproduced visible grid content despite hidden=true; moving the hidden rule last produced display:none. The reviewer confirmed that correction and footer/focus transitions with no remaining important findings. Screenshots are in test/screenshots/disclosure-manager-compact-{sidebar,desktop,helper}.jpg. These are local in-memory demo checks; DA must load the pushed code for authenticated verification.
