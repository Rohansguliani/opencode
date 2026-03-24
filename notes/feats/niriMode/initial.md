# Niri Mode (Infinite Strip)

## Working Idea
Grid Mode is good when I want a fixed comparison layout. Niri Mode should feel different: less like arranging a dashboard, more like moving through a living strip of chats.

- Chats live in one horizontal, ordered lane.
- The active chat is the one I am "standing in" right now.
- Moving focus left/right should feel instant and keyboard-first.
- Resizing should bias attention toward the active chat without forcing a full relayout ceremony.
- Adding a chat should place it into the strip instead of replacing context.
- The strip should preserve state in the URL so a working set can survive refreshes and workspace switches.

## Why This Could Be Better Than Grid Mode
- It scales to more chats before everything gets cramped.
- It matches the way prompt work often happens: move to a nearby thread, do a thing, move back.
- It gives OpenCode a more opinionated multi-chat UX instead of a generic tiled dashboard.

## First Slice
Keep the first version intentionally narrow.

- Titlebar toggle next to Grid Mode.
- Mutually exclusive with Grid Mode.
- URL-backed ordered strip state.
- Multiple live sessions mounted side by side.
- `Cmd+Shift+Left/Right` changes focused chat.
- `Cmd+Shift+Plus/Minus` grows or shrinks the focused chat.

## Constraints To Watch
- Rendering cost will climb fast if too many full sessions stay mounted.
- Focus rules need to stay simple; click and keybind focus is safer than hover focus here.
- Terminal ownership may need a follow-up once several active sessions are visible at once.

## Nice Follow-Ups
- Center the focused chat more aggressively.
- Add reorder controls or drag reordering.
- Virtualize distant chats.
- Let width presets snap between a few useful sizes instead of purely linear growth.
