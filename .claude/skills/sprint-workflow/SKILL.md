---
name: sprint-workflow
description: Use when starting a new sprint in this repo, or when asked to write a sprint status document ("Sprint - NNB – Implementation Status.md"). Covers the kickoff gap-list process and the status-doc format.
---

# Sprint workflow

## Starting a new sprint

1. Read the sprint spec from its phase's Implementation folder — Development
   Phase sprints live in `central-docs/06 - Implementation/Sprint - NN <name>.md`;
   a Feature Phase's sprints live in `central-docs/<NN - Feature Phase Name>/06 - Implementation/Sprint - N <name>.md`.
2. Compare it against the current codebase and write the matching task list
   under `docs/tasks/<phase-slug>/` — e.g. `docs/tasks/development-phase/SPRINT-NN-TASKS.md`
   for a Development Phase sprint, `docs/tasks/feature-phase-1/SPRINT-N-TASKS.md`
   for a Feature Phase 1 sprint. A gap list (✅ done / 🟡 partial / ❌ missing)
   of what the spec asks for vs. what already exists, following the format of
   prior `SPRINT-*-TASKS.md` files in that same phase folder.
3. Run `/impeccable audit` to get a fresh `docs/AUDIT_REPORT.md`.
4. Reconcile the audit findings into the sprint task list:
   - If a finding overlaps a task already in the list (e.g. a dead button that's really an unbuilt feature), cross-reference it there instead of duplicating.
   - If a finding is in-scope for this sprint's surfaces/days but not yet listed, add it as a new task under the relevant day.
   - If a finding is out of scope (project-wide, or squarely belongs to a later sprint's stated focus), add it to a "Deferred" section with a one-line reason.

## Completing a task

A task is not done until its entry in that phase's `docs/tasks/<phase-slug>/SPRINT-*-TASKS.md` is updated in the same PR as the code:

- Flip the item's status (❌/🟡 → ✅) and note what was actually delivered, including work that landed under a different day's item.
- Update the affected day's Done Criteria.
- Move any scope cut or postponed by the task into the "Deferred / Out of Scope" section with a one-line reason. Every sprint task list keeps that section, even when it is short.
- When the task closes the sprint's last open day, flip that sprint's row in `docs/tasks/STATUS.md` to ✅ Complete.

## Sprint status documents

When asked to create a sprint status document (e.g. `Sprint - NNB – Implementation Status.md`) for the current/most recent sprint:

1. Write it to that phase's Implementation folder (`central-docs/06 - Implementation/Sprint - NNB – Implementation Status.md` for Development Phase, `central-docs/<NN - Feature Phase Name>/06 - Implementation/Sprint - NB – Implementation Status.md` for a Feature Phase), following the format of prior `Sprint - NNB` files (grouped by architectural area, each item with a description, "Architectural Areas", and an "Originally Planned" line).
2. Only include items that were **not specifically planned** or are **completely new** — i.e. the sprint doc didn't call for that exact mechanism, or it wasn't in the sprint doc at all. Leave out anything that was implemented as the sprint spec literally described it; those don't need a status entry.
3. If the sprint is still in progress when the doc is created, say so explicitly in the intro (don't imply the sprint is done), and **remind the user to update the document once the sprint actually finishes** — later days may add more unplanned/new items worth folding in.
