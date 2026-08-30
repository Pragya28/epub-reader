---
name: sprint-workflow
description: Use when starting a new sprint in this repo, or when asked to write a sprint status document ("Sprint - NNB – Implementation Status.md"). Covers the kickoff gap-list process and the status-doc format.
---

# Sprint workflow

## Starting a new sprint

1. Read the sprint spec from `central-docs/06 - Implementation/Sprint - NN <name>.md`.
2. Compare it against the current codebase and write `docs/tasks/SPRINT-NN-TASKS.md` — a gap list (✅ done / 🟡 partial / ❌ missing) of what the spec asks for vs. what already exists, following the format of prior `docs/tasks/SPRINT-*-TASKS.md` files.
3. Run `/impeccable audit` to get a fresh `docs/AUDIT_REPORT.md`.
4. Reconcile the audit findings into the sprint task list:
   - If a finding overlaps a task already in the list (e.g. a dead button that's really an unbuilt feature), cross-reference it there instead of duplicating.
   - If a finding is in-scope for this sprint's surfaces/days but not yet listed, add it as a new task under the relevant day.
   - If a finding is out of scope (project-wide, or squarely belongs to a later sprint's stated focus), add it to a "Deferred" section with a one-line reason.

## Sprint status documents

When asked to create a sprint status document (e.g. `Sprint - NNB – Implementation Status.md`) for the current/most recent sprint:

1. Write it to `central-docs/06 - Implementation/Sprint - NNB – Implementation Status.md`, following the format of prior `Sprint - NNB` files (grouped by architectural area, each item with a description, "Architectural Areas", and an "Originally Planned" line).
2. Only include items that were **not specifically planned** or are **completely new** — i.e. the sprint doc didn't call for that exact mechanism, or it wasn't in the sprint doc at all. Leave out anything that was implemented as the sprint spec literally described it; those don't need a status entry.
3. If the sprint is still in progress when the doc is created, say so explicitly in the intro (don't imply the sprint is done), and **remind the user to update the document once the sprint actually finishes** — later days may add more unplanned/new items worth folding in.
