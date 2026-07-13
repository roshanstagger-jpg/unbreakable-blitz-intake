# Unbreakable → Sequifi · Blitz Intake

A single-page intake form for the Unbreakable Sales team to submit a new **blitz**
(sales sprint) as structured data, instead of pasting free text into Slack.

Each submission captures:

- **Blitz details** — city, state, start/end dates, manager, ISP(s), notes
- **Reps** — picked from a master roster (comp per account, for this blitz); brand-new
  reps can be added with just first name / last name / email and are appended to the roster
- **Overrides (recruiting plan)** — who earns on top of the reps (manager / divisional,
  $ per account, scoped to everyone or specific reps)
- **New ISP config** — captured once when a blitz uses an ISP that isn't set up yet
  (report rep-ID column, order # vs. phone matching, phone/mesh bonuses)

Submissions land as one row on the **Submissions** tab of a Google Sheet. New reps land
on the **Roster** tab.

## Architecture

```
┌─────────────────┐   POST blitz JSON   ┌──────────────────────┐
│  index.html     │ ──────────────────▶ │  Google Apps Script  │
│  (Vercel, static)│                     │  Web App (doPost)    │──▶ "Submissions" tab
│                 │ ◀────────────────── │  (doGet, JSONP)      │──▶ "Roster" tab
└─────────────────┘   load roster       └──────────────────────┘
```

- **Frontend:** one self-contained `index.html`, no build step. Hosted on Vercel.
- **Backend/storage:** Google Apps Script + a Google Sheet (`apps-script/Code.gs`).
- The form loads the roster via `doGet` (JSONP, since Apps Script sends no CORS headers)
  and submits blitzes via `doPost` (header-less `fetch`, a "simple" request that skips the
  CORS preflight).

## Setup

### 1. Backend (Google Sheet)

Fastest path — start from the prebuilt template:

1. Import [`template/Unbreakable-Blitz-Intake-Template.xlsx`](template/Unbreakable-Blitz-Intake-Template.xlsx)
   into Google Drive (it opens as a Google Sheet). Tabs:
   - `Roster` — ~54 reps seeded (name / UNB ID / office + a default plan). CS fills the yellow
     Email + Office columns and verifies the plan.
   - `CompPlans` — Sequifi's rate plans (Rate 150…375, 400 Sub, etc.); the form's comp dropdown reads this.
   - `ISPs` — the six ISPs + config columns; the form's ISP chips read this.
   - `Offices` — office list for the blitz Office dropdown (falls back to the Roster's Office column if empty).
   - `Blitzes` — active blitzes; the "add reps to existing blitz" picker reads this. New blitzes submitted on the form auto-append here.
   - `Submissions` — auto-fills, one row per blitz, each with a unique `Submission ID` (UNB-YYYYMMDD-NNN).
   - `Rep detail` — auto-fills, one row per rep per blitz (payroll-friendly), with the overrides that apply to each rep resolved onto their row.
   - `Instructions` — the CS guide.

   The form pulls Roster, CompPlans, and ISPs live via `doGet`, so adding a rep, a rate plan, or an
   ISP is just adding a row — no code change. New reps / new ISPs submitted on the form append back
   to the `Roster` / `ISPs` tabs automatically.
2. **Extensions → Apps Script**, paste [`apps-script/Code.gs`](apps-script/Code.gs), save.
   (Optional: reload the sheet → **Unbreakable Intake → Set up / repair tabs** to build tabs
   from scratch — it's non-destructive and never overwrites the roster.)
3. **Deploy → New deployment → Web app.** Execute as **Me**, access **Anyone**.
4. Copy the Web App URL (ends in `/exec`).

### 2. Frontend

- Open the deployed site and click **Connect**, paste the `/exec` URL (saved to the browser), or
- Share a preconfigured link: `https://<your-vercel-url>/?sheet=<THE_EXEC_URL>`

## Local development

It's a static file — just open `index.html`, or:

```bash
npx serve .
```

## Deploy

Hosted as a static site on Vercel (`vercel --prod`). No environment variables required;
the sheet URL is supplied per-browser or via the `?sheet=` query param.
