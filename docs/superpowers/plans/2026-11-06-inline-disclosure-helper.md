# Sequence citations and inline disclosure help

The user's November 6 clarification is the binding specification: reuse existing disclosure fragments and sets; new superscripts identify the 1-based sequence, including while old IDs are phased out. On blur DA resolves the citation. An inline helper offers the matching legal excerpt or other existing numbers. Manager reorders rewrite saved references, and the open author receives those changes without reload.

Work in the regular repository on the current branch. No new worktrees, sets, legal fragments, pushes, publications, or schema writes. Retain legacy renderer compatibility only. Schema authoring is numeric-only.

## Task 1: Sequence authoring during phaseout

Add regression coverage for numeric superscripts against legacy sets and strict numeric schema patching. Implement ordinal target aliases and sequence-based manager assistance, with existing alternatives. Verify focused disclosure tests. Commit the contract changes.

## Task 2: Native inline helper

Use the native quick-edit mini-editor's feature-detected EditorView. Read the selected superscript from ProseMirror state; apply a guarded native transaction, preserving marks, Undo and saving. Offer a matching excerpt and other existing choices outside authored content. Reject external links, non-superscripts, stale selections/documents and read-only views. Test using actual ProseMirror state/model development libraries and UI events. Commit the helper.

## Task 3: Author refresh after reorder

A same-origin notification is sent only after a verified manager batch completes. The author listener refreshes the footer and static citation decoration; DA's native collaborative source updates carry the rewritten superscripts, avoiding a second permutation. Validate scoping, duplicate suppression, cleanup and native reload behavior. Update the existing test page to numeric citations; restore the temporary source-sync probe. Run full checks, document the verified/pending QA boundary, obtain a fresh final review, and commit. The user pushes the branch.

Evidence: uploading only a changed QA heading updated the already-open Canvas on November 6 without reload. DA quick-edit exposes editorParent.view and dispatches native NODE_UPDATE for transactions. Its reloadEditable hook runs after settled local/remote edits. Never mutate an active contenteditable DOM or invent native bridge messages.


## Completion record

Implemented in the regular repository on the current branch. Full lint and 447 tests passed. Browser verification used DA's actual public parser/state/view with the existing homepage disclosures: matching excerpt, 13 alternatives, pointer selection, keyboard selection and blur resolution passed. The source-probe heading was restored through DA's native editor.

The single final review identified two correctness issues. Regression tests first reproduced both failures, then passed after the fixes: an open inline suggestion now rejects a changed footer; the manager assistant and audit share the nonempty effective sequence used by the footer and insertion.

Decisions: honor the user's regular-repo requirement; let DA's source collaboration deliver rewritten references and use a same-origin completion notification only to refresh footer targets; retain existing QA page markers and existing shared fragments/set until the user pushes compatible code and completes shared-set reorder/Undo/save QA. No shared set, schema, legal fragment or published content was changed by this implementation.
