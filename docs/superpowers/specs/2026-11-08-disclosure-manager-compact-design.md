# Compact Disclosure Manager

The user accepted the review's recommendation to try compact disclosure rows, a contextual helper, and a pinned Save/Discard bar. Implement in the regular repository on the current branch.

The default view prioritizes the ordered list. Use readable fragment filenames as short labels, retain a brief excerpt, and expand full legal text and source information on demand. Collapse the duplicate footer preview by default. Existing fragments, schema, sequence identities, source guards, reviewed batch writes and recovery remain unchanged.

Keep a small action to check the selected superscript. Show the helper panel only for a suggestion or an explicit request/result. Keep its messages separate from the manager's save status. Show direct-edit actions when supported and copy actions when direct editing is unavailable.

Keep Save order and Discard changes visible in a footer outside the scrolling content. Save order opens the existing guarded review, where the footer offers Save changes and Back. Discard changes resets the proposed order without writing source. Retain grouped insertion and keyboard-accessible move controls.

Approaches considered: tightening spacing alone retains the competing tasks; a compact list with expandable details addresses the observed sidebar problem; a separate full-page tool would interrupt Canvas authoring. The accepted recommendation is the compact sidebar.

Verification: controller/assistant regressions, complete project checks, and a local narrow-panel browser check. A local demo cannot establish authenticated Canvas save behavior; the user pushes commits for DA testing.
