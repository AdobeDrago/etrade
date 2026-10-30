# Handoff Documentation Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Implement the seven documentation improvements approved in chat: block selection, consistent catalog entries, image specifications, metadata reference, correct/incorrect examples, new-page checklist, and guide maintenance.

**Architecture:** Extend the existing standalone HTML guide and its scoped stylesheet. Preserve section anchors, catalog filtering, no-JavaScript access, printing, and the centered header. Use repository contracts and implementation as evidence; distinguish editorial recommendations from implemented requirements.

**Tech Stack:** Static HTML, scoped CSS, existing vanilla JavaScript, repository lint tools, browser verification.

**Spec:** The user's approval of the seven recommendations in the preceding chat message.

## Global Constraints

- Continue the existing uncommitted guide in this checkout; preserve unrelated work.
- No changes to customer-site blocks, runtime, dependencies, or vendored scripts/aem.js.
- Keep all 32 blocks, existing section anchors, and source links.
- Do not invent asset dimensions, metadata fields, ownership assignments, approval, or live verification.
- Keep technical details in reference material and use plain language in author instructions.
- Commit the finished work in focused commits, as subsequently requested by the user. Publishing and pushing remain outside the request.

## Review Focus

- Optional or absent block content must not be described as a runtime requirement.
- Image advice must distinguish recommendations from actual cropping and sizing rules.
- Metadata scope/defaults must match the consumer code and existing inherited behavior.
- Added reference sections must remain readable on mobile, without JavaScript, and in print.
- New content must not break catalog filters, existing deep links, or the header width.

### Task 1: Author task guidance and shared references

**Files:** Modify docs/site-handoff.html and docs/site-handoff.css.

**Interfaces:** Consume existing section anchors and author-guide styles; produce block-selection, asset-reference, metadata-reference, authoring-examples, and new-page-checklist anchors.

- [x] Read block contracts, image rules, and metadata consumers.
- [x] Add block-selection guidance and a complete new-page checklist.
- [x] Add image specifications, consolidated metadata reference, and correct/incorrect examples.
- [x] Link new subsections from relevant guide sections and navigation.
- [x] Verify claims against source and check new internal links and table accessibility.

### Task 2: Standardize the block catalog

**Files:** Modify docs/site-handoff.html; use existing blocks/*/README.md, JavaScript and CSS as read-only evidence.

**Interfaces:** Preserve .block-entry IDs, data-family values, source links, and authoring tables; give every entry purpose, required content, optional content, defaults, supported variants, common mistakes, and a rendered-result check.

- [x] Add concise, block-specific authoring facts to all 32 entries.
- [x] Use existing option paragraphs as the consistent Supported variants field.
- [x] Preserve useful detailed contracts and examples rather than repeating them in the new summaries.
- [x] Verify all 32 blocks have the same reference structure and all block names/options remain accurate.

### Task 3: Maintenance and verification

**Files:** Modify docs/site-handoff.html and docs/site-handoff.css only as needed.

**Interfaces:** Existing guide JS continues consuming unchanged top-level sections and catalog entries.

- [x] Add maintenance responsibility, evidence labels, review triggers, and a meaningful change record without inventing a named owner.
- [x] Update the guide revision date separately from the original implementation/preview verification date.
- [x] Run npm run lint, explicit docs CSS lint, git diff --check, and a temporary structural/link audit.
- [x] Review desktop and mobile rendering, catalog search, section navigation, and no-JavaScript access.
- [x] Request a fresh read-only review of the seven improvements and resolve material inaccuracies.
- [x] Save a browser screenshot and report the implemented changes and verification limits.

## Execution record

Implementation continues directly under the user's instruction to implement the agreed improvements. Verification uses source comparisons, structural checks, lint, and visual review; this documentation-only work does not add tests that merely repeat the prose. The user subsequently requested organized local commits after verification.

Verification: all 32 catalog entries have all seven reference fields; all 65 IDs are unique and internal anchors resolve; local assets and repository source links exist. Desktop, 390px mobile, 320px with 200% text and no JavaScript, catalog filtering/reset, mobile menu selection, checklist navigation and 1920px centered-header alignment were inspected. A fresh read-only reviewer identified breakpoint/action/fallback inaccuracies and image/rate-reference omissions; all were corrected against source. Guide ownership remains explicitly unassigned pending the site team’s assignment. No authenticated DA or live-service acceptance was performed.


Follow-up: added contextual official Adobe references and a task-based index. The project test suite passed all 352 tests.
