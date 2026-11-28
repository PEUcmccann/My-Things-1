# Milestone 3 run log

- 2026-11-27: the owner created the Supabase project and connected it to GitHub (see [Supabase project](../subsystems/supabase.md)). Tickets #42 and #44–#50 were written with defaults (sub-issues of #2). #42 lists the owner's dashboard steps. The `ready-for-human` label doesn't exist, and agents can't create it.
- 2026-11-27/28: the first full run under the implementer brief (`docs/agents/implementer-brief.md`) and the rule to check each report against the ticket. The order was #44 → #48 → #49 → #45 → #46 → #47 → #50, one at a time where core files overlapped. Every report carried a checklist.
  - #48's two attachment criteria couldn't be met before #47, so they were moved to #47 rather than merged as gaps.
  - #45, #46, #47 and #50 each left only hand checks that need the owner's phone and a real sign-in.
- 2026-11-27: #46 measured the snapshot at about 17 MB for 2,000 To-dos (about 44 MB unsent). The web snapshot moved to IndexedDB, and #51 was filed for size.
- 2026-11-27: PR #52 (#44, #45, #46, #48, #49) merged as `8850c0f`. The GitHub integration didn't deploy its migration, so the coordinator applied it through the MCP and lined up the history version.
- 2026-11-28: the owner fixed the integration. PR #53 (#47) merged as `6d35998`, and the integration deployed `20261128120000` by itself.
- 2026-11-28: the milestone code review (standards plus spec, since `52c3349`) confirmed RLS, storage policies and sync ordering. It found:
  - the CSV attachments column was hard-coded to 0;
  - attachment files leaked after a restore;
  - a sign-out race could lose an edit;
  - glossary wording;
  - duplicated offline checks.

  All were fixed in `53e1345`..`45f57f6`. The wording changes are recorded on #47.

- 2026-11-28: PR #54 (#50 and the review fixes) merged as `570c3c3`. The integration deployed `20261128150000`: the `backups` bucket (private, 50 MB, JSON only) with 3 policies.
- Open on 2026-11-28:
  - #42 steps 1–2 (code emails) wait on the owner's iCloud SMTP setup; the free plan refused template edits with Supabase's built-in sender. Step 6 (sign-ups off) waits for the first sign-in.
  - Hand checks on #45, #46, #47 and #50 wait for a real sign-in.
  - #51 (snapshot size) is `needs-triage`.

Related: [Milestone 2 run log](milestone-2.md).
