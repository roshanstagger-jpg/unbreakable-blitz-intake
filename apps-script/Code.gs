/**
 * Unbreakable → Sequifi blitz intake — Google Sheet receiver.
 *
 * SETUP (2 minutes):
 * 1. Create a Google Sheet (any name). Extensions → Apps Script.
 * 2. Delete the sample code, paste this whole file, Save.
 * 3. Deploy → New deployment → type "Web app".
 *      Execute as: Me
 *      Who has access: Anyone
 *    Deploy, authorize, and COPY the Web App URL (ends in /exec).
 * 4. Open the live intake site → "Connect" → paste that URL.
 *    (or share a preconfigured link: <site>?sheet=<THE_URL> )
 *
 * TABS this script maintains:
 *   • "Submissions" — one row per blitz submitted.
 *   • "Roster"      — the master rep list. Seed it once (First, Last, Email,
 *                     UNB ID, Default plan, Office). New reps added on the
 *                     intake form are appended here automatically.
 *
 * The form loads the roster via doGet (JSONP) and posts blitzes via doPost.
 * Export to Excel anytime: File → Download → Microsoft Excel (.xlsx).
 */

var ROSTER_HEADERS = ['First', 'Last', 'Email', 'UNB ID', 'Default plan', 'Office'];
var COMPPLAN_HEADERS = ['Plan name', 'Rate ($/acct)', 'Holdback %', 'Active'];
var ISP_HEADERS = ['ISP name', 'Abbr', 'Active', 'Rep-ID column on report', 'Has order #?', 'Phone bonus $', 'Mesh bonus $'];
var SUBMISSION_HEADERS = [
  'Received', 'Submitted by', 'Email', 'Blitz', 'Start', 'End',
  'Manager', 'ISP(s)', '# Reps', 'Reps (name / ID / comp / change)',
  'Manager overrides', 'Divisional overrides', 'New ISPs', 'Notes', 'Full summary'
];

// Defaults seeded when a tab is created from a blank sheet (the .xlsx template
// already ships these). Editing the tabs in the sheet overrides them.
var DEFAULT_ISPS = [
  ['Gonetspeed', 'GNS', 'yes', '', 'yes', '', ''],
  ['Brightspeed', 'BS', 'yes', '', 'yes', '', ''],
  ['Joink / CTI', 'CTI', 'yes', '', 'yes', '', ''],
  ['Fiber First', 'FF', 'yes', '', 'yes', '', ''],
  ['Lightcurve', 'LC', 'yes', '', 'yes', '', ''],
  ['Fatbeam', 'FB', 'yes', '', 'yes', '', '']
];
var DEFAULT_COMPPLANS = [
  ['Rate 150', 150, 10, 'yes'], ['Rate 175', 175, 10, 'yes'], ['Rate 200', 200, 10, 'yes'],
  ['Rate 210', 210, 10, 'yes'], ['Rate 225', 225, 10, 'yes'], ['Rate 240', 240, 10, 'yes'],
  ['Rate 250', 250, 10, 'yes'], ['Rate 265', 265, 10, 'yes'], ['Rate 275', 275, 10, 'yes'],
  ['Rate 280', 280, 10, 'yes'], ['Rate 290', 290, 10, 'yes'], ['Rate 300', 300, 10, 'yes'],
  ['Rate 300 AW', 300, 10, 'yes'], ['Rate 325', 325, 10, 'yes'], ['Rate 350', 350, 10, 'yes'],
  ['Rate 375', 375, 10, 'yes'], ['400 Sub', 400, 10, 'yes'], ['400 - Sub Dealer', 400, 10, 'yes'],
  ['400 - Sub Dealer No Holdback', 400, 0, 'yes'], ['Sub Dealer', '', 10, 'yes'],
  ["Landon's Comp Plan", '', 10, 'yes'], ['Enlite Plan', '', 0, 'yes'], ['Top G Plan', '', 0, 'yes']
];

/* ------------------------------------------------------------------ *
 * onOpen — adds a menu so you can build the tabs from a blank sheet   *
 * without waiting for the first submission.                           *
 * ------------------------------------------------------------------ */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Unbreakable Intake')
    .addItem('Set up / repair tabs', 'setupSheet')
    .addToUi();
}

// Idempotent: creates the tabs with headers (and seeds CompPlans / ISPs) only
// where missing. Never touches existing rows, so it is safe to re-run.
function setupSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureTab(ss, 'Submissions', SUBMISSION_HEADERS);
  ensureTab(ss, 'Roster', ROSTER_HEADERS);
  ensureTab(ss, 'CompPlans', COMPPLAN_HEADERS, DEFAULT_COMPPLANS);
  ensureTab(ss, 'ISPs', ISP_HEADERS, DEFAULT_ISPS);
  SpreadsheetApp.getActive().toast('Tabs are ready. Deploy → Web app, then connect the form.', 'Unbreakable Intake', 5);
}

function ensureTab(ss, name, headers, seedRows) {
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    (seedRows || []).forEach(function (row) { sheet.appendRow(row); });
  }
  return sheet;
}

// Generic reader: returns the tab's data rows as arrays (header dropped).
function readRows(name) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var values = sheet.getDataRange().getValues();
  values.shift();
  return values;
}

function readCompPlans() {
  return readRows('CompPlans')
    .filter(function (r) { return String(r[0]).trim() !== '' && String(r[3]).toLowerCase() !== 'no'; })
    .map(function (r) { return { name: r[0], rate: r[1], holdback: r[2] }; });
}

function readISPs() {
  return readRows('ISPs')
    .filter(function (r) { return String(r[0]).trim() !== '' && String(r[2]).toLowerCase() !== 'no'; })
    .map(function (r) {
      return { name: r[0], abbr: r[1], repcol: r[3], ordernum: r[4], phonebonus: r[5], meshbonus: r[6] };
    });
}

/* ------------------------------------------------------------------ *
 * doGet — serves the Roster tab as JSONP so the static site can load  *
 * it cross-origin (Apps Script sends no CORS headers, so we use a     *
 * <script> callback instead of fetch()).                              *
 * ------------------------------------------------------------------ */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || '';
  var cb = (e && e.parameter && e.parameter.callback) || '';

  if (action === 'roster' || action === 'bootstrap') {
    return jsonp(cb, {
      ok: true,
      roster: readRoster(),
      compPlans: readCompPlans(),
      isps: readISPs()
    });
  }
  return jsonp(cb, { ok: true, message: 'Unbreakable blitz intake receiver is live.' });
}

function readRoster() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Roster');
  if (!sheet || sheet.getLastRow() < 2) return [];
  var values = sheet.getDataRange().getValues();
  values.shift(); // drop header row
  return values
    .filter(function (r) { return (r[0] + '' + r[1]).trim() !== ''; })
    .map(function (r) {
      return {
        first: r[0] || '', last: r[1] || '', email: r[2] || '',
        id: r[3] || '', plan: r[4] || '', office: r[5] || ''
      };
    });
}

/* ------------------------------------------------------------------ *
 * doPost — appends the blitz to "Submissions" and any brand-new reps  *
 * to "Roster" (deduped by email, then by first+last).                 *
 * ------------------------------------------------------------------ */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000); // avoid collisions if two people submit at once
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ensureTab(ss, 'Submissions', SUBMISSION_HEADERS);

    var d = JSON.parse(e.postData.contents);
    var b = d.blitz || {};

    var reps = (d.reps || []).map(function (r) {
      return r.name + (r.id ? ' [' + r.id + ']' : '') + ' $' + r.comp +
        (r.plan ? ' (' + r.plan + ')' : '') +
        why(r.compChanged, ' (chg from $' + r.previousComp + ' eff ' + r.effectiveDate + ')');
    }).join('; ');

    var mgrOvr = (d.overrides || []).filter(function (o) { return o.type !== 'divisional'; })
      .map(fmtOvr).join('; ');
    var divOvr = (d.overrides || []).filter(function (o) { return o.type === 'divisional'; })
      .map(fmtOvr).join('; ');

    var newIsps = (d.newISPs || []).map(function (n) {
      return (n.name || 'New ISP') + (n.abbr ? ' (' + n.abbr + ')' : '') +
        ' | id-col: ' + (n.repcol || '-') +
        ' | order#: ' + (n.ordernum === 'no' ? 'no (use phone)' : 'yes') +
        (n.phonebonus ? ' | phone +$' + n.phonebonus : '') +
        (n.meshbonus ? ' | mesh +$' + n.meshbonus : '');
    }).join('  ||  ');

    sheet.appendRow([
      new Date(),
      (d.submitter || {}).name || '',
      (d.submitter || {}).email || '',
      (b.city || '') + ' ' + (b.state || ''),
      b.start || '', b.end || '',
      b.manager || '',
      (d.isps || []).join(', '),
      (d.reps || []).length,
      reps, mgrOvr, divOvr, newIsps,
      b.notes || '',
      d.summary || ''
    ]);

    appendNewReps(ss, d.reps || []);
    appendNewISPs(ss, d.newISPs || []);

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/* Append reps flagged isNew to the Roster tab, deduped by email / name. */
function appendNewReps(ss, reps) {
  var fresh = reps.filter(function (r) { return r.isNew; });
  if (!fresh.length) return;

  var sheet = ss.getSheetByName('Roster');
  if (!sheet) {
    sheet = ss.insertSheet('Roster');
    sheet.appendRow(ROSTER_HEADERS);
    sheet.getRange(1, 1, 1, ROSTER_HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  var existing = readRoster();
  var emails = {}, names = {};
  existing.forEach(function (r) {
    if (r.email) emails[String(r.email).toLowerCase()] = true;
    names[(String(r.first) + ' ' + String(r.last)).toLowerCase().trim()] = true;
  });

  fresh.forEach(function (r) {
    var parts = String(r.name || '').trim().split(/\s+/);
    var first = parts.shift() || '';
    var last = parts.join(' ');
    var emailKey = String(r.email || '').toLowerCase();
    var nameKey = (first + ' ' + last).toLowerCase().trim();
    if (emailKey && emails[emailKey]) return;
    if (!emailKey && names[nameKey]) return;
    sheet.appendRow([first, last, r.email || '', r.id || '', r.plan || '', '']);
    if (emailKey) emails[emailKey] = true;
    names[nameKey] = true;
  });
}

/* Append ISPs submitted via the "new ISP" block to the ISPs tab, deduped by name. */
function appendNewISPs(ss, newISPs) {
  if (!newISPs || !newISPs.length) return;
  var sheet = ensureTab(ss, 'ISPs', ISP_HEADERS, DEFAULT_ISPS);
  var existing = {};
  readRows('ISPs').forEach(function (r) { existing[String(r[0]).toLowerCase().trim()] = true; });
  newISPs.forEach(function (n) {
    var name = String(n.name || '').trim();
    if (!name || existing[name.toLowerCase()]) return;
    sheet.appendRow([name, n.abbr || '', 'yes', n.repcol || '', n.ordernum || 'yes',
      n.phonebonus || '', n.meshbonus || '']);
    existing[name.toLowerCase()] = true;
  });
}

function fmtOvr(o) {
  var scope = o.scope === 'specific' ? (o.reps || []).join(', ') : 'everyone going';
  return o.earner + ' $' + o.amount + '/acct on ' + scope;
}

// tiny helper so a blank never prints "undefined"
function why(cond, text) { return cond ? text : ''; }

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// JSONP wrapper: returns callback({...}) as JavaScript when a callback name
// is supplied, otherwise plain JSON.
function jsonp(cb, obj) {
  var body = JSON.stringify(obj);
  if (cb && /^[\w$.]+$/.test(cb)) {
    return ContentService
      .createTextOutput(cb + '(' + body + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}
