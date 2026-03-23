# Workspace Creation And UI

## Problem
The first pass at Add Workspace technically created logical workspaces, but the flow felt bolted on:
- browse opened a second modal
- picking a folder could dump the user out of the create flow
- the chosen directory and workspace name were easy to lose
- recent/open project UI started surfacing logical workspace suffixes directly

## Fixes Landed

### Single Modal Flow
- Reworked Add Workspace into a single dialog that embeds the directory picker UI directly.
- Kept the optional workspace name field at the top of the same view.
- Defaulted the picker state to `~/` so creating a workspace starts from a sensible home location.
- Restored visible footer actions so the default directory can be accepted immediately without clicking elsewhere first.

### Selection Behavior
- Selecting a folder now updates the active directory inline instead of replacing the whole modal stack.
- The chosen path stays visible in the footer while editing.
- Submitting creates the logical workspace and immediately opens it with the selected display name.

### Cleaner Presentation
- Recent project rows in the picker are de-duped back to the physical directory.
- UI labels show human-readable folder names and paths instead of raw logical workspace URLs.
- Workspace hover cards now show the folder path under the project name.

### Titlebar Polish
- Moved sidebar open/close, back, and forward controls into the unused top-left corner.
- Moved Grid Mode out of the sidebar and into the titlebar as a dedicated toggle.
- Tuned the titlebar toggle styling after dogfooding so it feels lighter and less boxed-in.

## Result
Add Workspace now feels like a native variant of Open Project instead of a side quest.
