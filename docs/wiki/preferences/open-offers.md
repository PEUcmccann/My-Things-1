# Open offers

Changes waiting on the user's decision. Each entry is dated. When the user answers, add their answer as a new dated line; don't remove the offer.

- 2026-11-27, offered: change the chief-of-staff skill so `implement-spec` runs from the chief-of-staff session, with only single tickets delegated. Source: [M1 retro](../retros/2026-11-27-m1-build.md) #1.
- 2026-11-27, offered: add a rule to the chief-of-staff skill against committing into a working tree a subagent is using. Source: M1 retro #8.
- 2026-11-27, offered: allow `docs.expo.dev` and the hosts `expo install` uses on this repo's cloud environment. Source: M1 retro #5.
- 2026-11-27, offered: replace the hand-written PanResponder gestures, either with one shared hook or with `react-native-gesture-handler`. Source: M1 retro #6.

Answers:

- 2026-11-27, the user said "Go" to all four offers. Both skill changes were made in `55d0000`. The network hosts are on a new personal environment, "My-Things-1", saved for this repo; see [Cloud environment](../subsystems/cloud-environment.md). The gesture change is ADR 0004 (`348fa0b`) and `8f65b7c`.
- 2026-11-27, offered: add the M2 retro's rule to the chief-of-staff skill: before merging a ticket, compare the implementer's checklist with the ticket's criteria and Decisions. Source: [M2 retro](../retros/2026-11-27-m2-build.md) #1.
- 2026-11-27, the user said "Implement the retro findings and update the Chief of Staff skill". The M2 retro's skill change was made (see the chief-of-staff `SOURCE.md`), and the `item` rename and lint rule (finding 7) were delegated.
