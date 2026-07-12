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
 *                     UNB ID, Default comp, Region). New reps added on the
 *                     intake form are appended here automatically.
 *
 * The form loads the roster via doGet (JSONP) and posts blitzes via doPost.
 * Export to Excel anytime: File → Download → Microsoft Excel (.xlsx).
 */

var ROSTER_HEADERS = ['First', 'Last', 'Email', 'UNB ID', 'Default comp', 'Region'];

/* ------------------------------------------------------------------ *
 * doGet — serves the Roster tab as JSONP so the static site can load  *
 * it cross-origin (Apps Script sends no CORS headers, so we use a     *
 * <script> callback instead of fetch()).                              *
 * ------------------------------------------------------------------ */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || '';
  var cb = (e && e.parameter && e.parameter.callback) || '';

  if (action === 'roster') {
    var roster = readRoster();
    return jsonp(cb, { ok: true, roster: roster });
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
        id: r[3] || '', comp: r[4] || '', region: r[5] || ''
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
    var sheet = ss.getSheetByName('Submissions') || ss.insertSheet('Submissions');

    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'Received', 'Submitted by', 'Email', 'Blitz', 'Start', 'End',
        'Manager', 'ISP(s)', '# Reps', 'Reps (name / ID / comp / change)',
        'Manager overrides', 'Divisional overrides', 'New ISPs', 'Notes', 'Full summary'
      ]);
      sheet.getRange(1, 1, 1, 15).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }

    var d = JSON.parse(e.postData.contents);
    var b = d.blitz || {};

    var reps = (d.reps || []).map(function (r) {
      return r.name + (r.id ? ' [' + r.id + ']' : '') + ' $' + r.comp +
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
    sheet.appendRow([first, last, r.email || '', r.id || '', r.comp || '', '']);
    if (emailKey) emails[emailKey] = true;
    names[nameKey] = true;
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
