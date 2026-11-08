# Automatic disclosure updates after Save Implementation Plan

> For agentic workers: use the executing-plans workflow in the regular repository; the user explicitly prohibited new worktrees.

**Goal:** after the manager saves a new order, JavaScript explicitly updates existing rendered superscripts and targets without a browser reload. The user confirmed November 8 that updates belong after Save, rather than while dragging.

**Architecture:** the durable operation captures rendered reference state before source writes and publishes verified mapping/set snapshots after completion. The author listener reconciles unchanged references once and refreshes footer targets from saved source rather than stale preview delivery. Source persistence remains in the existing authenticated batch.

**Tech stack:** existing JavaScript modules, DA SDK/Source API, same-origin BroadcastChannel, Node test runner and linkedom. No new dependencies.

**Spec:** the previously approved disclosure-numbering design and the user's November 8 after-Save clarification.

## Constraints

Work in the regular repo/current branch. Reuse existing fragments and draft sources. Do not manipulate active ProseMirror DOM, add permanent identities, invent DA bridge messages, push, merge or publish.

## Tasks

- [x] Add failing tests for capture → verified save → remap of numeric/grouped/legacy references, rich marks, external links, stale/native-updated nodes, duplicate operations, scope and rollback. Capture before source writes to distinguish old nodes from already updated native nodes.
- [x] Add prepare/ack to the same-origin channel using the durable operation ID. Await a bounded handshake before content writes. Completion includes temporary mapping and verified before/after set snapshots. Expired queued preparation cannot capture already updated content.
- [x] Refresh the author footer from the verified saved set snapshot, retaining it until delivery agrees. Suspend links while footer targets change; restore standalone links afterward. Active editing stays under DA's control.
- [x] Integrate save, restore and recovery. Classify original/already-target plain references; do not infer source/render ordering for custom blocks or embeddings. Ambiguous recovery pauses links with a reopen notice. Run full checks and fix final review findings.

## Verification and review

`npm run check`: lint and all 471 tests passed. Integration tests exercise the actual durable operation and real channel, plus real footer rendering and reference linking: existing Offer 1 becomes Offer 2 while #disclosure-homepage-2 still contains Offer terms, even when preview delivery remains old.

The fresh review found tooltip-state invalidation, excluded code/form contexts, ambiguous resume states, standalone links, and source/render ordering differences. Each received a regression; the implementation uses conservative classification and coherent unlinked fallback when identity cannot be proven. Actual source-operation resume tests cover original, target, mixed and block-rendered states.

This closes the explicit JavaScript synchronization gap in code. Real DA Canvas verification still requires the user to push this commit and perform the manager save. No new DA content, schema or legal fragment changes were made during this fix.
