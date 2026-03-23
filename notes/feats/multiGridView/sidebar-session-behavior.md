# Sidebar Session Behavior

## Problem
The workspace sidebar had a few compounding problems:
- initial load could feel out of order after refresh or workspace switches
- the default root-session page size was too small
- `Load more` could appear even when no additional visible chats existed
- hover previews were biased toward pinned sessions instead of actual recent activity

## Fixes Landed

### Ordering
- Removed the special-case root sort that mixed pin priority with a one-minute ID-based ordering rule.
- Standardized root session ordering on latest activity so refreshes and workspace switches are stable.

### Paging
- Raised the default root-session page size from 5 to 10.
- Raised each `Load more` increment to 10 as well.

### False-Positive `Load more`
- Changed the optimistic root-session probe to fetch one extra row and derive `hasMore` from the actual extra row.
- Added a client-side clamp so if clicking `Load more` reveals nothing new, the button disappears immediately.
- Fixed backend root-session listing to exclude archived sessions, which were previously counted in the probe even though the sidebar hid them.

### Hover Preview
- Updated workspace/project hover cards to show the most recently updated root chats rather than effectively favoring pinned chats first.

## Result
The sidebar now behaves much closer to user expectation: newer chats stay on top, more chats are visible up front, and `Load more` is much less likely to lie.
