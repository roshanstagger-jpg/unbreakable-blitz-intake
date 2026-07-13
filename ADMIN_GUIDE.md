# Blitz Intake — Admin Guide

For internal admin / CS staff. How to manage the intake sheet and review what the
Unbreakable team submits through the form. No coding required.

- **Form:** https://unbreakable-blitz-intake.vercel.app
- **Backend:** the intake Google Sheet
- **Shareable guide (web):** publish/see the Artifact version for a nicer read

## 1. How it works
1. **Unbreakable submits** — a manager opens the form and either creates a **new blitz**
   (typing a blitz name) or picks **add reps to an existing** one, adds reps + comp, and submits.
2. **It lands in the sheet** — one row in `Submissions` and one row per rep in `Rep detail`.
   New reps and blitzes add themselves to the reference tabs.
3. **You manage & review** — keep the reference lists current; use `Submissions` and
   `Rep detail` to onboard reps and hand clean data to payroll.

## 2. The tabs

| Tab | Kind | What it's for |
|---|---|---|
| `Roster` | Reference | Master rep list. The form's rep picker + default comp read from here. New reps append here with a blank UNB ID for you to assign. |
| `CompPlans` | Reference | Sequifi's named rate plans. The form's comp dropdown reads this. |
| `ISPs` | Reference | The ISP chips on the form. Add a row (name + abbr) to add one. |
| `Blitzes` | Reference | The list behind "add reps to an existing blitz." New blitzes auto-append. |
| `Submissions` | Auto-filled | One row per submission, each with a Submission ID. Your master log. |
| `Rep detail` | Auto-filled | One row per rep per blitz — built for payroll. |
| `Config` | Config | Stores the uploaded logo. Leave alone. |

**Reference** tabs = the form reads them; edit to change form options.
**Auto-filled** tabs = your record; review, don't hand-edit the headers.

## 3. Managing the lists
- Editing a reference tab changes the form — no developer needed.
- Changes appear when the form is **reloaded**, not live in an already-open tab.
- Use the `Active` column (`CompPlans`, `ISPs`, `Blitzes`) to **hide** an item (`no`) instead of deleting.
- Dedupe is by **email** — keep rep emails accurate.
- Don't rename header rows or delete the `Submissions` / `Rep detail` tabs.

## 4. Reviewing submissions
- **`Submissions`**: one row per submission. Submission ID = `UNB-YYYYMMDD-NNN`
  (date + that day's sequence). The `Full summary` column is a plain-English recap.
- A Blitz marked `(+reps added)` = reps added to an existing blitz, not a new one.
- **`Rep detail`** (payroll): one row per rep — comp plan, comp $, new-rep flag, and the
  overrides resolved onto each rep. Filter by **Blitz** or **Submission ID**.
- New reps to onboard show `New rep? = yes` with a blank UNB ID — that's your queue.
- Export: `File → Download → Microsoft Excel (.xlsx)`.

## 5. Common tasks
- **Onboard a new rep** — find `New rep? = yes` (or blank UNB ID in `Roster`), create them in
  Sequifi, paste the UNB ID back into the Roster row.
- **Add a comp plan / ISP** — add a row to `CompPlans` / `ISPs`.
- **Retire a blitz** — set its `Active` to `no` in `Blitzes`.
- **Change the logo** — form → **Upload logo** (SVG or small PNG).
- **Connect a new browser** — form → **Connect** / **Change sheet** → paste the `/exec` URL.
- **Fix a rep's comp** — edit their `Default plan` in `Roster` (pre-fill only; actual comp is
  chosen per blitz at submit time).

## 6. Troubleshooting
- **"Roster offline — using cache"** — form can't reach the sheet. Re-paste the `/exec` URL via
  Connect; if it persists, the Apps Script Web App must have access = **Anyone** with a fresh deployment.
- **New rep/plan/ISP not showing** — reload the form.
- **Two people editing** — fine; submissions are written under a lock.
- **A submission didn't appear** — check the form was connected (green dot) before Submit.

## 7. Train a new admin (15 min)
1. Tour the tabs together (section 2).
2. Submit one test blitz with two reps (make one brand-new).
3. Find it in `Submissions` — show the Submission ID + Full summary.
4. Open `Rep detail` — show the rep rows, comp columns, `New rep? = yes`.
5. Confirm the new rep landed in `Roster`; assign a UNB ID.
6. Edit a reference row (add a comp plan), reload the form, watch it appear.
7. Export `Rep detail` to Excel — the payroll hand-off.
