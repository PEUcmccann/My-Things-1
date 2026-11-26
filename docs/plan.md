# MyThings plan

Decisions from the design interview. Vocabulary is in `../GLOSSARY.md`; hard-to-reverse decisions are in `adr/`.

## Platform and data

- React Native + Expo, one codebase for iPhone (Expo Go), web and Android (ADR 0001).
- Local-first database on each device, synced through Supabase. Conflicts are resolved per field, and the most recent edit wins (ADR 0002).
- Built for one user. Every record carries an owner, so sharing can be added later.
- Sign in with email and a 6-digit one-time code.
- No Apple Developer account: the share sheet, Place Reminders, widgets, Siri, Watch and email-to-Inbox are built but switched off (ADR 0003).
- No import from Things 3.

## Behaviour rules

- Today: active To-dos with a Start date or Deadline of today or earlier. Choosing "Today" sets the Start date.
- To-dos in a Someday Project, or a Project starting in the future, are hidden unless they have their own Start date or Deadline.
- A Sub-to-do is one level deep, always sits in its parent's Project, Area and Heading, and can be promoted to a normal To-do.
- Completing a parent To-do or a Project with open children asks whether to complete or cancel the rest.
- Completed and Cancelled items move to the Logbook at the end of the day by default (can be set to immediately or manually).
- Trash empties itself after 30 days.
- Repeat rules use iCalendar RRULE, on schedule or after completion. Only the next occurrence exists. The next one copies the Checklist (unticked), Sub-to-dos (reopened), Tags, planning attributes, Time slot, notes and Reminders (shifted to the new date), but not attachments. Editing one asks "this one or all future ones".
- A To-do has at most one Time slot, on its Start date.
- Reminders: several per To-do, by time or by Place.
- Smart Lists: different kinds of filter combine with AND, and values of the same kind combine with OR. A parent Tag includes its children.
- Quick entry shorthand, e.g. `Buy milk tomorrow #errand !high ~15m @14:00`.
- Apple Reminders: watch one chosen list and move new items to the Inbox, checked each time the app opens.
- Attachments: any file type, up to 25 MB each; images shown as thumbnails.
- Quick Find covers titles, notes, Checklist items, container names and Tags, with Logbook items behind a toggle.
- Export: full JSON (can be restored), CSV of To-dos, and automatic weekly backups (keep the last 8).
- Look: follows the system light/dark setting; one accent colour, teal by default.

## Milestones

1. Core, offline, single device: Areas, Projects, Headings, To-dos, Checklists, Sub-to-dos, Tags, built-in lists, Start date and Deadline, Completed and Cancelled, Logbook, Trash, Magic Plus, swipe actions and multi-select, Quick Find.
2. Planning: Repeat rules, Priority, Energy, Estimate, Time slots with the day timeline, Smart Lists, quick entry shorthand.
3. Sync: sign-in, Supabase sync, attachments, export and backup. A Supabase project is created at this point.
4. Phone integrations: time Reminders and notifications, calendar events, Apple Reminders import.
5. Switched off until a developer account exists: share sheet, Place Reminders, widgets, Siri, Watch, email-to-Inbox.

## Verification, for every milestone

Automated tests for the rules above; the web version checked at iPhone size in a headless browser with screenshots; an Expo Go link for trying it on your phone (falling back to the web version if a tunnel is blocked).
