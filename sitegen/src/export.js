// Export of the highlighted data as CSV or XLSX (export.js). Loaded on the first click on "CSV" or "XLSX".
// Rows: with a selection, the findings, edges and gaps it highlights (items the filters hide are left out,
// the selected item always stays). With no selection: every finding, edge and gap that the filters,
// the lens and the search leave visible. Values are the pack's own (data/<panel>.json), unchanged;
// label columns sit beside the raw values. No network call, no library.
(function () {
'use strict';
var Q = window.Q1, doc = document, enc = new TextEncoder();
var XT = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
var GAPL = 'No evidence: no study in this corpus tested this pairing (a gap, not a negative result)';
var FAR = 'Further step: a separate body of evidence, not one tested effect';
var HEAD = ['panel', 'edge id', 'kind', 'from', 'to', 'from id', 'to id', 'step', 'step note', 'direction', 'direction label',
  'certainty', 'certainty label', 'certainty_rationale', 'studies', 'claims', 'study directions', 'claim directions',
  'searched_for', 'claim ids', 'document ids'];
var CHEAD = ['edge id', 'claim id', 'subject', 'predicate', 'object', 'negated', 'claim direction', 'claim grade',
  'evidence types', 'comparator', 'quote', 'paper title', 'year', 'DOI or document id'];

function num(v) { return v == null ? '' : v; }
function L(m, k) { return m[k] ? m[k][1] : ''; }
// {increase: 1, mixed: 2} -> "increase 1; mixed 2", in the app's direction order.
function counts(o) {
  var D = Q.DORD;
  return o ? Object.keys(o).sort(function (a, b) { return (D.indexOf(a) + 1 || 99) - (D.indexOf(b) + 1 || 99); })
    .map(function (d) { return d + ' ' + o[d]; }).join('; ') : '';
}
function pick(p) {
  var D = p.data, R = p.pin ? Q.related(p, p.pin) : null, rows = [];
  Object.keys(D.items).forEach(function (r, i) {
    var it = D.items[r];
    if (it.ty !== 'finding' && it.ty !== 'edge' && it.ty !== 'gap') return;
    if (R ? R.keep[r] && (r === p.pin || Q.passes(p, r)) : Q.passes(p, r) && Q.inLens(p, r) && (!p.hits || p.hits[r]))
      rows.push({it: it, i: i, st: R && R.node ? (R.hop && R.hop[r]) || (R.far[r] ? '2+' : 1) : ''});
  });
  if (R && R.node) rows.sort(function (a, b) { return parseInt(a.st, 10) - parseInt(b.st, 10) || a.i - b.i; });
  return {rows: rows, R: R};
}
function edgeRow(p, x) {
  var it = x.it, gap = it.ty === 'gap', mod = it.kind === 'moderation', d = gap ? it.status : it.dir;
  return [p.k, it.id, it.kind || 'gap', it.sl, mod ? 'effect of ' + it.tl : it.tl, it.src, mod ? it.te : it.tgt, x.st,
    x.st && x.st !== 1 ? FAR : '', d, gap ? GAPL : L(Q.DIR, d) + (it.dm ? ' (' + it.dm + ')' : ''),
    gap ? '' : it.cert, gap ? '' : L(Q.CERT, it.cert), it.rat || '', num(it.studies), num(it.claims), counts(it.sd),
    counts(it.cd), it.sf || '', (it.ids || []).join(';'), (it.docs || []).join(';')];
}
function claimRows(p, rows) {
  var D = p.data, out = [];
  rows.forEach(function (x) {
    (x.it.ids || []).forEach(function (c) {
      var C = D.claims[c], P_ = D.papers[C.doc] || [];
      out.push([x.it.id, c, C.s, C.p, C.o, !!C.n, C.d, C.g, (C.et || []).join('; '), C.c, C.q, P_[0], num(P_[1]), P_[2] || C.doc]);
    });
  });
  return out;
}
function slug(s) { return String(s).replace(/^q1:/, '').replace(/[^A-Za-z0-9_.]+/g, '-').replace(/^[-.]+|-+$/g, '').slice(0, 60); }
// q1-<panel>-<selection or all/visible>[-lens-..][-search-..][-no-<direction>..][-min-..][-no-gaps].<fmt>
function fname(p, R, fmt) {
  var f = p.f, n = ['q1', p.k], t, off = Q.DORD.filter(function (d) { return f.dirs.indexOf(d) < 0; });
  if (R) { t = Q.kindOf(p.pin); if (t !== 'node') n.push(t); n.push(slug(p.pin.slice(t.length + 1))); }
  else {
    n.push(p.lens === 'all' && !p.hits && !off.length && !f.min && f.gaps ? 'all' : 'visible');
    if (p.lens !== 'all') n.push('lens-' + p.lens);
    if (p.hits) n.push('search-' + slug(p.q));
  }
  off.forEach(function (d) { n.push('no-' + d); });
  if (f.min) n.push('min-' + Object.keys(Q.CERT).filter(function (k) { return Q.CERT[k][0] === f.min; })[0]);
  if (!f.gaps) n.push('no-gaps');
  return n.join('-').replace(/-+/g, '-') + '.' + fmt;
}

// ---------- CSV: RFC 4180, CRLF, UTF-8 with BOM ----------
// Formula-injection guard: a text cell that starts with = + - @ (or tab, CR) gets a leading apostrophe.
function cell(v) {
  if (v == null) return '';
  if (typeof v !== 'string') return String(v);
  if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
  return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}
function csv(rows) { return '﻿' + rows.map(function (r) { return r.map(cell).join(','); }).join('\r\n') + '\r\n'; }

// ---------- XLSX: Office Open XML in a STORE (uncompressed) ZIP ----------
var NS = 'http://schemas.openxmlformats.org/', HDR = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
var MAIN = NS + 'spreadsheetml/2006/main', REL = NS + 'officeDocument/2006/relationships', CTP = 'application/vnd.openxmlformats-';
// Escape for XML and drop what XML 1.0 forbids (C0 controls but tab, CR, LF; lone surrogates; U+FFFE, U+FFFF).
// CR becomes &#13; so that XML line-end normalisation does not turn it into LF.
function xe(s) {
  return String(s).replace(/([\uD800-\uDBFF][\uDC00-\uDFFF])|[\x00-\x08\x0B\x0C\x0E-\x1F\uD800-\uDFFF￾￿]/g, '$1')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\r/g, '&#13;');
}
function col(i) { var s = ''; for (i++; i; i = (i - 1) / 26 | 0) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; }
// One worksheet: bold frozen header row, inline strings, numeric and boolean cells, widths from the content.
// A cell can also be {v: value, s: style index}: the index of a fill style from book(sheets, fills).
function sheet(rows) {
  var w = rows[0].map(function () { return 8; }), x = '';
  rows.forEach(function (r, j) {
    x += '<row r="' + (j + 1) + '">';
    r.forEach(function (v, i) {
      var s = j ? '' : ' s="1"';
      if (v && typeof v === 'object') { if (v.s) s = ' s="' + v.s + '"'; v = v.v; }
      if (v == null || v === '') return;
      var a = '<c r="' + col(i) + (j + 1) + '"' + s;
      if (typeof v === 'number' && isFinite(v)) x += a + '><v>' + v + '</v></c>';
      else if (typeof v === 'boolean') x += a + ' t="b"><v>' + (v ? 1 : 0) + '</v></c>';
      else x += a + ' t="inlineStr"><is><t xml:space="preserve">' + xe(String(v).slice(0, 32767)) + '</t></is></c>';
      w[i] = Math.max(w[i], Math.min(60, String(v).length + 2));
    });
    x += '</row>';
  });
  return HDR + '<worksheet xmlns="' + MAIN + '"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" ' +
    'activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/></sheetView></sheetViews><cols>' +
    w.map(function (n, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + n + '" customWidth="1"/>'; }).join('') +
    '</cols><sheetData>' + x + '</sheetData></worksheet>';
}
// fills (optional): [[fill RGB, font RGB], ...] as 6-digit hex. Fill i is cell style 2 + i.
function book(sheets, fills) {
  var ws = '', wr = '', ct = '', f = [];
  fills = fills || [];
  var fo = fills.map(function (c) { return '<font><color rgb="FF' + c[1] + '"/><sz val="11"/><name val="Calibri"/></font>'; }).join('');
  var fi = fills.map(function (c) { return '<fill><patternFill patternType="solid"><fgColor rgb="FF' + c[0] + '"/><bgColor indexed="64"/></patternFill></fill>'; }).join('');
  var xf = fills.map(function (c, i) {
    return '<xf numFmtId="0" fontId="' + (2 + i) + '" fillId="' + (2 + i) + '" borderId="0" xfId="0" applyFont="1" applyFill="1"/>';
  }).join('');
  sheets.forEach(function (s, i) {
    var n = i + 1;
    ws += '<sheet name="' + xe(s[0]) + '" sheetId="' + n + '" r:id="rId' + n + '"/>';
    wr += '<Relationship Id="rId' + n + '" Type="' + REL + '/worksheet" Target="worksheets/sheet' + n + '.xml"/>';
    ct += '<Override PartName="/xl/worksheets/sheet' + n + '.xml" ContentType="' + CTP + 'officedocument.spreadsheetml.worksheet+xml"/>';
    f.push(['xl/worksheets/sheet' + n + '.xml', sheet(s[1])]);
  });
  var R = '<Relationships xmlns="' + NS + 'package/2006/relationships">', k = sheets.length + 1;
  return [
    ['[Content_Types].xml', HDR + '<Types xmlns="' + NS + 'package/2006/content-types"><Default Extension="rels" ContentType="' + CTP +
      'package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="' +
      CTP + 'officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="' + CTP +
      'officedocument.spreadsheetml.styles+xml"/>' + ct + '</Types>'],
    ['_rels/.rels', HDR + R + '<Relationship Id="rId1" Type="' + REL + '/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml', HDR + '<workbook xmlns="' + MAIN + '" xmlns:r="' + REL + '"><bookViews><workbookView/></bookViews><sheets>' + ws + '</sheets></workbook>'],
    ['xl/_rels/workbook.xml.rels', HDR + R + wr + '<Relationship Id="rId' + k + '" Type="' + REL + '/styles" Target="styles.xml"/></Relationships>'],
    ['xl/styles.xml', HDR + '<styleSheet xmlns="' + MAIN + '"><fonts count="' + (2 + fills.length) + '"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/>' +
      '<name val="Calibri"/></font>' + fo + '</fonts><fills count="' + (2 + fills.length) + '"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/>' +
      '</fill>' + fi + '</fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" ' +
      'fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="' + (2 + fills.length) + '"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" ' +
      'fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' + xf + '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/>' +
      '</cellStyles></styleSheet>']
  ].concat(f);
}
var CRC = [];
(function () { for (var n = 0, c, k; n < 256; n++) { for (c = n, k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c; } })();
function crc(b) { for (var c = -1, i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
// Little-endian header: a signature, then [value, bytes] fields.
function le(sig, f) {
  var b = new Uint8Array(4 + f.reduce(function (s, x) { return s + x[1]; }, 0)), v = new DataView(b.buffer), o = 4;
  v.setUint32(0, sig, true);
  f.forEach(function (x) { if (x[1] === 2) v.setUint16(o, x[0], true); else v.setUint32(o, x[0], true); o += x[1]; });
  return b;
}
// Files [[name, text]] -> ZIP parts (Uint8Arrays). Method 0 (STORE), UTF-8 names (flag bit 11), date 1980-01-01.
function zip(files) {
  var out = [], cd = [], off = 0, size = 0;
  files.forEach(function (f) {
    var nm = enc.encode(f[0]), d = enc.encode(f[1]), c = crc(d), z = d.length;
    var h = le(0x04034b50, [[20, 2], [0x800, 2], [0, 2], [0, 2], [33, 2], [c, 4], [z, 4], [z, 4], [nm.length, 2], [0, 2]]);
    var e = le(0x02014b50, [[20, 2], [20, 2], [0x800, 2], [0, 2], [0, 2], [33, 2], [c, 4], [z, 4], [z, 4], [nm.length, 2],
      [0, 2], [0, 2], [0, 2], [0, 2], [0, 4], [off, 4]]);
    out.push(h, nm, d); cd.push(e, nm);
    off += h.length + nm.length + z; size += e.length + nm.length;
  });
  return out.concat(cd, [le(0x06054b50, [[0, 2], [0, 2], [files.length, 2], [files.length, 2], [size, 4], [off, 4], [0, 2]])]);
}

// ---------- download and feedback ----------
function save(blob, name) {
  var u = URL.createObjectURL(blob), a = doc.createElement('a');
  a.href = u; a.download = name; a.hidden = true;
  doc.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 1500);
}
// Button text for about 2 s, and the same news in a polite live region (p.stat belongs to app.js).
function say(p, btn, txt, msg) {
  var lv = p.xlive;
  if (!lv) { lv = p.xlive = doc.createElement('p'); lv.className = 'vh'; lv.setAttribute('role', 'status'); p.el.appendChild(lv); }
  if (btn._t) clearTimeout(btn._t); else btn._o = btn.textContent;
  btn.textContent = txt;
  lv.textContent = '';
  setTimeout(function () { lv.textContent = msg; }, 80);
  btn._t = setTimeout(function () { btn.textContent = btn._o; btn._t = 0; }, 2000);
}
function pl(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
function run(p, fmt, btn) {
  Q.load(p).then(function () {
    var S = pick(p), rows = S.rows, name = fname(p, S.R, fmt), E = [HEAD], C;
    if (!rows.length) return say(p, btn, 'No rows', 'Nothing to download: the filters hide every row.');
    rows.forEach(function (x) { E.push(edgeRow(p, x)); });
    if (fmt === 'xlsx') {
      C = [CHEAD].concat(claimRows(p, rows));
      save(new Blob(zip(book([['Edges', E], ['Claims', C]])), {type: XT}), name);
    } else save(new Blob([csv(E)], {type: 'text/csv;charset=utf-8'}), name);
    say(p, btn, 'Saved ' + pl(rows.length, 'row'), 'Downloaded ' + name + ': ' + pl(rows.length, 'row') + (C ? ' and ' + pl(C.length - 1, 'claim') : '') + '.');
  }, function () { say(p, btn, 'Failed', 'Could not load the data file. Nothing was downloaded.'); });
}
// The writers are shared with the Q3 gap map (gapmap.js).
window.Q1Export = {run: run, csv: csv, book: book, zip: zip, save: save, say: say};
})();
