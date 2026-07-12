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

1. Create a Google Sheet. **Extensions → Apps Script**.
2. Paste [`apps-script/Code.gs`](apps-script/Code.gs), save.
3. **Deploy → New deployment → Web app.** Execute as **Me**, access **Anyone**.
4. Copy the Web App URL (ends in `/exec`).
5. Add a **Roster** tab with columns: `First`, `Last`, `Email`, `UNB ID`, `Default comp`, `Region`,
   and seed it once with your existing reps. (If you skip this, the script creates it on first new-rep submission.)

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
