# M1 product decisions

Made by the M1 implementation subagent on 2026-11-27 while the user slept, under [Unattended authority](../preferences/unattended-authority.md). Each one is recorded on its ticket's comments (#4–#18) and in PR #20. None had been reviewed by the user as of 2026-11-27.

- Inbox: a To-do leaves the Inbox once it has an Area, a Project, a Start date or Someday. Anytime leaves out Inbox To-dos. As of `@7d900c9`, `GLOSSARY.md` didn't state the Anytime part.
- Storage: as of `@7d900c9`, the whole store was saved as one JSON snapshot in AsyncStorage, not SQLite. The core didn't depend on that choice.
- Navigation: as of `@7d900c9`, a small custom stack, not react-navigation. Wide screens showed the sidebar beside the content.
- Owner: every record's owner was "me" until sign-in exists (Milestone 3).
- Deadline flag: shows from 3 days before the Deadline, and turns to "overdue" once it has passed.
- Upcoming: day by day for 7 days, then week by week up to day 28, then month by month.
- Project progress counts Sub-to-dos and To-dos already in the Logbook.
- Deleting an Area: you choose to keep its contents or Trash them. The Area itself is removed for good.
- Archiving a Heading moves its To-dos to the Logbook; reopening one of them brings the Heading back.
- Deleting a parent Tag moves its children up a level.
- Sub-to-dos don't inherit the parent's Tags. One restored after its parent is gone becomes a normal To-do.
- Dragging uses a ≡ handle, not a long press. Today keeps its own order; the other lists share one position per To-do.
- Bulk Move skips Sub-to-dos. The row ⋯ menu was web-only as of `@7d900c9`.
- Quick Find: every word typed must appear in the same piece of text (the title, the notes, or one Checklist item).
- Six accent colours. The splash screen is set through the expo-splash-screen plugin config.
- Known gaps as of `@7d900c9`: Checklist items reorder with ↑/↓ buttons, not dragging; pulling down for Quick Find only works where lists bounce.

Related: [Milestone 1 run log](../runs/milestone-1.md).
