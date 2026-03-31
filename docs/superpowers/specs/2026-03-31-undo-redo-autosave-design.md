# Undo/Redo + Autosave Design

## Goal

Add reliable undo/redo for project content and local autosave with an explicit restore prompt, without polluting history with editor-only UI state.

## Scope

This feature covers the editable project document in `src/App.tsx`:

- `elements`
- `variables`
- project-level document settings that affect content behavior:
  - `snapToGrid`

This feature does not cover editor-only UI preferences or transient interface state:

- selected element ids
- panel open/closed state
- inspector width
- theme
- settings popover open/closed
- preview-mode runtime state

## Current Project Context

The editor already stores most project content in top-level React state inside `src/App.tsx`:

- `documentElements`
- `documentVariables`
- `snapToGrid`

Manual persistence already exists through export/import:

- `exportDocument()` serializes the current document into `AppDocument`
- `importDocument()` replaces the current document state

Some editor preferences are already persisted independently with `localStorage`, such as theme, inspector sections, logic disclosure state, snap-to-grid, and inspector width.

The current mutation model is direct and distributed. Many operations call `setDocumentElements`, `setDocumentVariables`, or `setSnapToGrid` directly. To support consistent undo/redo and autosave, document-changing edits need to flow through a shared document commit path.

## Recommended Approach

Use snapshot-based history for the project document only.

Each history entry stores the full editable project document:

- `elements`
- `variables`
- `settings.snapToGrid`

History lives in memory and is separate from autosave storage.

Autosave writes the latest document snapshot to `localStorage`, but does not store the full history stack.

This keeps the implementation robust because many editor operations are compound changes:

- drag and group changes affect multiple elements
- delete can affect group membership
- import replaces the whole document
- future editor features are likely to produce similarly broad state changes

An action-based undo system would be more fragile and harder to extend safely in this codebase.

## Data Model

Add a focused in-memory history model in `src/App.tsx`:

- `past: DocumentSnapshot[]`
- `future: DocumentSnapshot[]`
- `present` remains the live React state already driving the UI

Introduce a helper snapshot type based on the existing `AppDocument` shape but narrowed to undoable content:

- `elements`
- `variables`
- `settings.snapToGrid`

Do not include:

- panel visibility
- viewport
- runtime state
- editor preferences

This history model should be implemented in a way that could later be moved into a dedicated hook such as `useDocumentHistory`, but it does not need that extraction yet.

## Commit Model

Introduce one shared document commit helper in `src/App.tsx` that:

1. builds the next document snapshot
2. normalizes/clamps content as needed
3. updates live React state
4. optionally records a history entry
5. clears redo history when a new undoable change is committed
6. updates autosave scheduling

This helper should support two commit modes:

- immediate history commit
- debounced history commit for rapid text-like edits

### Immediate commit

Use for:

- add/delete element
- add/delete variable
- drag end
- group in/out
- z-order changes
- inspector toggles/selects
- trigger edits
- import
- snap-to-grid toggle

### Debounced commit

Use for:

- typing text content
- repeated numeric input edits while the user is actively typing

Behavior:

- update live document state immediately so the UI stays responsive
- delay creation of the undo snapshot until the user pauses for about `500ms`
- also flush the pending history entry on blur/unmount where practical

This means one typing burst becomes one undo step instead of one step per keystroke.

## Undo/Redo Behavior

Undo and redo operate only in edit mode.

### Undo

- if `past` is empty, do nothing
- move current snapshot to `future`
- restore the most recent snapshot from `past`

### Redo

- if `future` is empty, do nothing
- move current snapshot to `past`
- restore the next snapshot from `future`

### History rules

- any new undoable commit clears `future`
- importing a document creates one undoable commit
- restoring an autosave becomes the new working document with a clean history baseline
- starting fresh from the restore prompt should clear the stored autosave and start with an empty history

### Keyboard shortcuts

Add document-level keyboard handling in edit mode:

- `Cmd+Z` / `Ctrl+Z` -> undo
- `Cmd+Shift+Z` -> redo
- `Ctrl+Y` -> redo

Guardrails:

- do not intercept when focus is inside text inputs or editable controls if that would conflict with native text editing semantics
- only trigger document undo/redo when the event is intended for the editor rather than a text field’s internal editing buffer

## Autosave Behavior

Autosave stores the latest document snapshot to `localStorage`.

### Storage contents

- current document snapshot
- save timestamp
- optional small schema/version tag for future-proofing

### Triggering

Autosave should be debounced to avoid excessive writes.

Recommended behavior:

- schedule autosave whenever the undoable document changes
- wait about `800-1200ms` after the last change before writing

### Restore prompt

On app launch:

- check for autosaved document in `localStorage`
- if found and the current working document is empty, show a centered modal prompt

Prompt actions:

- `Restore`: load autosaved document into the editor, clear runtime preview state, and initialize history with this restored document as the baseline
- `Start fresh`: clear the stored autosave and continue with the empty document

The prompt should not appear if the current document is already non-empty.

## UI Changes

### Restore modal

Add a simple centered modal overlay in `src/App.tsx` (or a small extracted component if that is cleaner) with:

- title
- short explanation
- `Restore`
- `Start fresh`

This should match the project’s existing visual language and avoid introducing a heavy modal framework.

### Undo/Redo controls

Add visible undo/redo controls in an existing low-clutter location.

Recommended placement:

- the settings popover action area, or
- the top toolbar if there is room without reintroducing clutter

Minimum behavior:

- visible buttons for `Undo` and `Redo`
- disabled when unavailable
- hidden or disabled in preview mode

## Import/Export Interaction

Manual export remains unchanged.

Import should:

- replace the current document
- normalize/clamp the imported content as it already does
- clear active runtime preview state
- create one undoable history step from the previous document
- refresh autosave from the imported result

## Error Handling

If autosave parsing fails:

- log the error to the console
- discard the invalid autosave payload
- do not block app startup

If imported JSON is invalid:

- preserve current behavior (console logging is acceptable for now)
- do not corrupt current history state

## Testing Strategy

Focus on behavioral verification rather than large architecture changes.

### Unit-level targets

Extract small pure helpers where useful for:

- snapshot cloning
- empty-document detection
- autosave payload parsing/validation
- history transition behavior (`undo`, `redo`, `commit`)

### App-level interaction targets

Verify:

- add element -> undo removes it -> redo restores it
- drag element -> undo restores previous position
- typing multiple characters quickly produces one undo step
- import creates one undo step
- autosave writes after edits
- launch with autosave shows restore prompt
- `Restore` loads the autosaved project
- `Start fresh` clears autosave and leaves the document empty

## Risks and Mitigations

### Risk: distributed document mutations bypass history

Mitigation:

- centralize document-changing paths behind shared commit helpers
- only allow direct React state setters for non-document UI state

### Risk: keyboard undo conflicts with input field editing

Mitigation:

- only run editor undo/redo when focus is not inside editable controls, or when the desired behavior is clearly document-level

### Risk: autosave writes stale state during debounced edits

Mitigation:

- autosave should observe the latest committed live document state, not only finalized history entries

### Risk: restore prompt feels intrusive

Mitigation:

- only show it when autosave exists and the current document is empty
- provide a clear `Start fresh` exit path

## Out of Scope

- persistent multi-session undo history
- cloud sync
- named project slots
- version browsing
- collaborative editing
- restoring panel/theme/editor preferences as part of project history
