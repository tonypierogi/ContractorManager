# Employee & Admin Flow Redesign — Screen Inventory + User Stories (Spec)

## Context

The contractor app grew feature-by-feature from the legacy HTML app: SOPs and task lists are separate systems with duplicate editors, inventory/locations/equipment are ported but disconnected islands, and the contractor's day doesn't flow naturally from clock-in to "here's my work." The `work.tsx` / `MyWorkScreen` unification already started collapsing the contractor-facing SOP/task distinction.

**Decisions made with the user:**
- Admin side merges SOPs + Task Lists into a single **Templates library** (one list screen, one editor; "SOP" becomes a recurrence + shared-assignment setting on a template). Requires folding `sop_templates`/`sop_items` into `task_lists`/`task_list_items` via migration files (never applied directly — user applies them, per DB policy).
- "Arrangements" are **photo-anchored task blocks** (reusable chunks of tasks + reference photos, optionally zone-linked), not a drag-and-drop spatial editor.
- **This plan is a spec only.** No code is built from this session; build phases get picked later.

## Core product model

- **Template** — reusable definition: title, ordered items (tasks/sections with photos, video timestamps, equipment tags, from→to zones), optional zone link. Two authoring-time settings:
  - **Recurrence:** one-off / every shift / weekly (day-of-week)
  - **Assignment mode:** *shared* (whoever's on shift works one communal instance — today's `daily_sops` behavior) or *individual* (assigned to specific people, per-assignment checks — today's `task_list_assignments` behavior)
- **Instance** — a template pulled into a specific day/shift with checkmarks. Shared instances = today's `daily_sops` + `sop_item_checks`; individual instances = `task_list_assignments` + `task_list_item_checks`.
- **Block** — a reusable sub-template (e.g. "Big Room theater setup") composed into templates; hero photo first ("make it look like this").

---

## Contractor user stories

**Clock-in & daily work**
1. As a contractor, when I clock in I immediately see today's work — my personal assignments plus the shared daily checklist — without hunting through nav.
2. As a contractor, if no shared checklist is active for today, I can pick one from the recurring templates right there, and it becomes today's shared list for everyone on shift.
3. As a contractor, I check off items as I go; my personal-assignment checks are mine alone, shared-checklist checks are visible to everyone on shift.
4. As a contractor, I can add an ad-hoc task to today's list ("boss texted: also wipe the bar") so it's captured and checkable.
5. As a contractor, on any task I can see photos/video of what "done" looks like, what equipment I need, and where things go (from→to zones).

**Finding things**
6. As a contractor, I can search "vacuum" and see which zone it lives in, highlighted on the floor plan, with a photo of the spot.
7. As a contractor, I can browse the floor plan, tap a room, and see its name, photo, and any templates/tasks linked to that zone.

**Inventory**
8. As a contractor, I can run a full inventory walk: mark each item Plenty / Some / OUT with notes and a photo (exists today).
9. As a contractor, when I notice we're out of something mid-shift, I can flag that one item's status without doing a full run.
10. As a contractor, for any inventory item I can see where it's located and when it was last checked, and by whom.

**Existing flows kept as-is:** clock in/out, personal shift history, my schedule, my invoices, profile.

## Admin user stories

**Templates (merged SOPs + task lists)**
1. As an admin, I manage one library of templates, filterable by recurring vs one-off and shared vs assigned, instead of two parallel systems.
2. As an admin, I create a template once and set how it runs: every shift, weekly, or one-off; picked up by whoever's on shift or assigned to specific people.
3. As an admin, I can duplicate any template — and any individual task *with its photos and metadata* — into another template, so "reset water pitchers downstairs" is authored once.
4. As an admin, I can save a group of tasks as a named **block** (an "arrangement" like "Big Room set for theater") with a hero photo, and insert blocks when composing an event reset list.
5. As an admin, building a one-off event reset list is fast: start from blocks/an old event's list, tweak, assign to a date and people.
6. As an admin, I can see completion: who worked a list, what got checked, when it was marked done (today's completed-daily-SOPs view, generalized).

**Space & stuff**
7. As an admin, I maintain inventory items (name, zone, photo) and see per-item last-checked status at a glance (mostly exists).
8. As an admin, I link templates to zones so contractors see location context (exists).
9. As an admin, I manage equipment and tag it on tasks (exists).

**Existing flows kept as-is:** team, timesheets, schedule, invoices, settings.

---

## Contractor screens

### Modified
| Screen | File | Change |
|---|---|---|
| **Time Clock** | `features/timeclock/screens/TimeClockScreen.tsx` | After clock-in, surface "Today's work" summary + button (or auto-navigate) to My Work. The clock-in → work handoff is the key flow fix. |
| **My Work** | `features/work/screens/MyWorkScreen.tsx` | Already the hub; finish it: assigned instances on top, shared daily checklist below (`DailySopSection`), ad-hoc task add, empty-state template picker. Becomes the default landing for contractors. |
| **Task Checklist** | `features/task-lists/screens/TaskChecklistScreen.tsx` | Render item media (photos/video timestamp), equipment tags, from→to zone chips — the data exists on `task_list_items` but isn't shown. |
| **Locations** | `features/locations/screens/LocationsScreen.tsx` | Add a **search bar** across inventory items + equipment names → result taps highlight the zone on the floor plan (highlight assets already exist in `features/locations/zones.ts`). This is the "vending/tool map." |
| **Inventory Check** | `features/inventory/screens/InventoryCheckScreen.tsx` | Add per-item "last checked: date, by whom, status" (derive per-item latest check instead of last-run-only); add single-item quick status update outside a full run. |

### New
| Screen | Purpose |
|---|---|
| **Item Detail (find result)** | Lightweight view/modal from map search: item photo, zone highlighted on plan, zone photo, last-checked status. Could be a modal on Locations rather than a route. |

### Retired
- `app/(employee)/tasks.tsx`, `app/(employee)/sops.tsx` (already redirects to work) — delete once nav references are gone.
- `features/sops/screens/EmployeeSopsScreen.tsx`, `features/task-lists/screens/EmployeeTasksScreen.tsx` — superseded by MyWorkScreen.

Contractor nav becomes: **Time Clock · My Work · Find (map) · Inventory · Schedule · Shifts · Invoices · Profile**.

## Admin screens

### New
| Screen | Purpose |
|---|---|
| **Templates Library** | Replaces `AdminSopListScreen` + `AdminTaskListsScreen`. One list with filters (recurring/one-off, shared/assigned, zone) and a "Blocks" tab or filter. Entry point to create/duplicate/archive. |
| **Template Editor** | Replaces `SopEditorScreen` + `TaskListEditorScreen` (build on the task-list editor — it's the superset: media, equipment, from→to zones, video timestamps). Adds: recurrence setting, assignment-mode setting, **insert block**, **duplicate task from another template** (picker that copies title/desc/media/equipment/zones). |
| **Block Editor** | Authoring for reusable blocks; likely the Template Editor in "block" mode (hero photo + tasks, zone link) rather than a separate codebase screen. |
| **Template Detail / Runs** | Evolves `TaskListDetailScreen`: items + media preview, manage assignments, and completion history (generalizes the completed-daily-SOPs view from `AdminSopListScreen`). |

### Modified
| Screen | File | Change |
|---|---|---|
| **Inventory Admin** | `features/inventory/screens/InventoryAdminScreen.tsx` | Show per-item last-checked column/badge. |
| **Locations (admin)** | `features/locations/screens/LocationsScreen.tsx` | Same search as contractor side; zone panel lists linked templates + inventory in that zone. |
| **Admin nav** | `app/(admin)/_layout.tsx` | Operations group becomes: Templates · Equipment · Locations · Inventory (SOP + Task Lists entries collapse into Templates). |

### Retired (after migration)
- `AdminSopListScreen`, `SopEditorScreen` and routes `app/(admin)/sops/*`
- `AdminTaskListsScreen`, `TaskListEditorScreen` merge into Templates screens (files evolve rather than die)

---

## Data implications (for later phases — migration files only, user applies)

1. `task_lists` gains: `recurrence` (`none`/`per_shift`/`weekly` + day), `assignment_mode` (`shared`/`individual`), `is_block` flag, `hero_media`; `is_sop` deprecated in favor of these.
2. Migrate `sop_templates` → `task_lists`, `sop_items` → `task_list_items`; repoint `daily_sops.sop_template_id` and `sop_item_checks.sop_item_id` (or migrate shared instances into the assignment/check tables with a shared-instance representation).
3. Blocks: composition can be copy-on-insert (simplest — inserting a block copies its items, no live link) rather than referential; recommend starting there.
4. Ad-hoc tasks (`ad_hoc_tasks`) carry over to the unified daily instance.
5. Per-item inventory last-checked: query change only (`inventory_checks` latest per `item_id`), no schema change.

## Suggested build phases (for future sessions)

1. **Glue (no schema):** clock-in → My Work handoff; finish MyWork; checklist media/equipment/zone rendering; delete superseded contractor screens.
2. **Find (no schema):** map search over inventory + equipment; item detail modal.
3. **Inventory surfacing (no schema):** per-item last-checked + quick single-item update.
4. **Template unification (migrations):** merged library + editor, recurrence/assignment-mode, retire SOP admin screens.
5. **Blocks & duplication:** copy-task-with-media, block authoring/insertion ("arrangements").

## Verification

This session delivers the spec only — no code changes. Each build phase, when picked up, verifies via `npx expo start` web + iOS simulator walkthrough of the affected role's flow (clock in as a contractor test account, author as admin), plus applying migration files to a dev branch database before production.