'use strict';
/* الجزء الثاني: الاستيراد من Excel/CSV/Sheets، واستمارة الطالب وملفه، ونموذج الحلقة */
/* ============ الاستيراد من Excel / CSV / Google Sheets ============ */
const HDR = {
  name: ['الاسم', 'اسم', 'اسم الطالب', 'اسم المعلم', 'name', 'full name'],
  halaqa: ['الحلقة', 'حلقة', 'حلقة المعلم', 'المعلم', 'halaqa', 'group', 'class'],
  phone: ['الجوال', 'جوال', 'رقم الجوال', 'الهاتف', 'هاتف', 'رقم الهاتف', 'phone', 'mobile', 'tel'],
  pin: ['كلمة المرور', 'الرمز', 'الرمز السري', 'pin', 'password']
};
const hkey = s => norm(s).replace(/[\s_\-:.]/g, '');

function decodeText(buf) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
  catch (e) { return new TextDecoder('windows-1256').decode(buf); }
}
function parseCSV(text) {
  text = String(text).replace(/^\uFEFF/, '');
  const first = text.split(/\r?\n/)[0] || '';
  const delim = ['\t', ';', ','].map(d => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; rows.push(row); row = []; }
    else cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

/* قارئ xlsx بلا مكتبات: ملف xlsx هو أرشيف zip من ملفات XML */
async function unzip(buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(buf), dec = new TextDecoder();
  let e = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('zip');
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true);
  const files = {};
  for (let k = 0; k < n; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
    files[dec.decode(u8.subarray(p + 46, p + 46 + nl))] = { method: dv.getUint16(p + 10, true), size: dv.getUint32(p + 20, true), off: dv.getUint32(p + 42, true) };
    p += 46 + nl + el + cl;
  }
  return async name => {
    const f = files[name]; if (!f) return null;
    const start = f.off + 30 + dv.getUint16(f.off + 26, true) + dv.getUint16(f.off + 28, true);
    const data = u8.subarray(start, start + f.size);
    if (f.method === 0) return dec.decode(data);
    const out = await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
    return dec.decode(out);
  };
}
async function parseXLSX(buf) {
  const get = await unzip(buf);
  const xml = s => new DOMParser().parseFromString(s, 'application/xml');
  const wb = await get('xl/workbook.xml');
  if (!wb) throw new Error('xlsx');
  let path = 'xl/worksheets/sheet1.xml';
  try {
    const sh = xml(wb).getElementsByTagName('sheet')[0], rid = sh.getAttribute('r:id');
    for (const r of xml(await get('xl/_rels/workbook.xml.rels')).getElementsByTagName('Relationship')) {
      if (r.getAttribute('Id') === rid) { const t = r.getAttribute('Target'); path = t.startsWith('/') ? t.slice(1) : 'xl/' + t; }
    }
  } catch (e) { /* نكتفي بالمسار الافتراضي */ }
  const shared = [], ssx = await get('xl/sharedStrings.xml');
  if (ssx) for (const si of xml(ssx).getElementsByTagName('si')) shared.push([...si.getElementsByTagName('t')].map(t => t.textContent).join(''));
  const sx = await get(path);
  if (!sx) throw new Error('xlsx');
  const colIdx = ref => [...ref.replace(/\d+/g, '')].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  const rows = [];
  for (const row of xml(sx).getElementsByTagName('row')) {
    const arr = [];
    for (const c of row.getElementsByTagName('c')) {
      const ref = c.getAttribute('r'), col = ref ? colIdx(ref) : arr.length, t = c.getAttribute('t');
      let v = '';
      if (t === 'inlineStr') v = [...c.getElementsByTagName('t')].map(x => x.textContent).join('');
      else { const ve = c.getElementsByTagName('v')[0]; v = ve ? ve.textContent : ''; if (t === 's') v = shared[+v] ?? ''; }
      arr[col] = v;
    }
    rows.push(arr);
  }
  return rows;
}
async function fetchSheet(url) {
  const m = url.match(/\/spreadsheets\/d\/([\w-]+)/);
  if (!m) throw new Error('url');
  const g = url.match(/[#&?]gid=(\d+)/);
  const r = await fetch(`https://docs.google.com/spreadsheets/d/${m[1]}/gviz/tq?tqx=out:csv${g ? '&gid=' + g[1] : ''}`);
  const t = await r.text();
  if (!r.ok || /^\s*</.test(t)) throw new Error('private');
  return parseCSV(t);
}

/* مفاتيح مطابقة اسم الحلقة في الملفات: «حلقة فلان» أو «فلان» (اسم المعلم) أو الاسم القديم */
const halaqaKeys = h => [halaqaLabel(h), h.name, byId(db.teachers, h.teacherId)?.name].filter(Boolean).map(norm);
const halaqaQKeys = v => [norm(v), norm(String(v).replace(/^\s*حلقة\s+/, ''))];

/* الحقول التي يمكن أن تكون «نظيرًا» لعمود في الملف المستورد */
function fieldTargets(kind) {
  const L = [{ id: 'core:phone', label: kind === 'students' ? 'جوال ولي الأمر' : 'الجوال', syn: HDR.phone }, { id: 'core:pin', label: 'كلمة المرور', syn: HDR.pin }];
  if (kind === 'students') L.push({ id: 'core:halaqa', label: 'الحلقة', syn: HDR.halaqa },
    { id: 'info:address', label: 'العنوان', syn: ['السكن'] }, { id: 'info:birth', label: 'تاريخ الميلاد', syn: ['الميلاد'] },
    { id: 'info:study', label: 'الدراسة', syn: ['نوع الدراسة'] }, { id: 'info:grade', label: 'الصف الدراسي', syn: ['الصف'] },
    { id: 'info:whatsapp', label: 'واتساب', syn: ['الواتساب', 'رقم الواتساب', 'whatsapp'] },
    { id: 'info:gName', label: 'اسم ولي الأمر', syn: ['ولي الأمر'] }, { id: 'info:gJob', label: 'وظيفة ولي الأمر', syn: [] },
    { id: 'info:job', label: 'الوظيفة', syn: ['الوظيفة الحالية'] }, { id: 'info:qual', label: 'المؤهل الدراسي', syn: ['المؤهل'] });
  if (kind === 'teachers') Object.entries(PROF).forEach(([g, G]) => G.fields.forEach(f => { if (f[0] !== 'phone') L.push({ id: `prof:${g}:${f[0]}`, label: f[1], syn: [f[1].replace(/\s*\(.*\)\s*/, ''), ...(PROF_SYN[f[0]] || [])] }); }));
  (db.fields[kind] || []).forEach(f => L.push({ id: 'extra:' + f.key, label: f.label, syn: [] }));
  return L;
}
function setField(m, id, v) {
  const [t, a, b] = id.split(':');
  if (t === 'core') { if (a === 'phone') m.phone = normPhone(v) || v; else if (a === 'pin') m.pin = v; }
  else if (t === 'prof') { m[a] = m[a] || {}; m[a][b] = v; }
  else if (t === 'extra') { m.extra = m.extra || {}; m.extra[a] = v; }
  else if (t === 'info') { m.info = m.info || {}; m.info[a] = /phone|whatsapp/i.test(a) ? normPhone(v) : v; }
}

/* تحويل الجدول إلى صفوف أعضاء: الأعمدة التي لها نظير تُربط بحقلها، والباقي يُجمع لتبويب «بيانات معلّقة» */
function importRows(table, kind) {
  const grid = table.map(r => Array.from(r || [], c => String(c ?? '').trim()));
  let hi = -1, nameCol = -1;
  for (let i = 0; i < Math.min(grid.length, 5) && hi < 0; i++) {
    const j = grid[i].findIndex(c => HDR.name.some(x => hkey(x) === hkey(c)));
    if (j >= 0) { hi = i; nameCol = j; }
  }
  if (hi < 0) return { err: 'لم أجد عمود «الاسم» في الصف الأول. استخدم القالب أو أضف عنوانًا للعمود.' };
  const targets = fieldTargets(kind), cols = [], loose = [];
  grid[hi].forEach((h, j) => {
    if (!h || j === nameCol) return;
    const k = hkey(h), t = targets.find(x => [x.label, ...x.syn].some(y => hkey(y) === k));
    if (t && !cols.some(c => c.id === t.id)) cols.push({ j, id: t.id, header: h, label: t.label });
    else if (!t) loose.push({ j, header: h });
  });
  const dg = s => String(s || '').replace(/[٠-٩]/g, c => c.charCodeAt(0) - 1632).replace(/[۰-۹]/g, c => c.charCodeAt(0) - 1776).trim();
  const seen = new Set(db[kind].map(m => norm(m.name))), rows = [];
  for (const r of grid.slice(hi + 1)) {
    const name = (r[nameCol] || '').replace(/\s+/g, ' ');
    if (!name) continue;
    const k = norm(name), dup = seen.has(k); seen.add(k);
    const vals = {};
    cols.forEach(c => { vals[c.id] = c.id === 'core:halaqa' ? (r[c.j] || '') : dg(r[c.j]); });
    rows.push({ name, dup, vals, halaqa: vals['core:halaqa'] || '', loose: loose.map(l => dg(r[l.j])) });
  }
  return rows.length ? { rows, cols, loose } : { err: 'لا توجد صفوف بيانات بعد صف العناوين.' };
}

function openImport(kind) {
  const isS = kind === 'students';
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal wide"><h2>استيراد ${isS ? 'الطلاب' : 'المعلمين'}</h2>
  <div class="note">الصف الأول عناوين الأعمدة: ${isS ? 'الاسم، الحلقة، الجوال، كلمة المرور' : 'الاسم، الجوال، كلمة المرور'}. الاسم وحده مطلوب، وتُنشأ كلمة المرور تلقائيًا إن تُركت فارغة، والأسماء المكررة تُتجاهل. أي عمود آخر ليس له نظير في النظام يُحفظ في «بيانات معلّقة» لاعتماده.</div>
  <div class="bar"><label class="btn" style="margin:0">اختيار ملف Excel أو CSV<input type="file" id="imf" accept=".xlsx,.csv,.tsv,.txt" hidden></label><button type="button" class="btn sm" id="imt">تحميل قالب</button></div>
  <label>أو الصق خلايا منسوخة من Excel أو Google Sheets<textarea id="imp" rows="3"></textarea></label>
  <label>أو رابط Google Sheets (مشارك لكل من لديه الرابط)<input id="imu" type="url" dir="ltr" placeholder="https://docs.google.com/spreadsheets/d/..."></label>
  <div class="bar"><button type="button" class="btn" id="imgo">معاينة</button></div>
  <div id="imprev"></div>
  <div class="row"><button type="button" class="btn primary" id="imok" disabled>استيراد</button><button type="button" class="btn" data-close>إغلاق</button></div></div>`;
  document.body.appendChild(ov);
  const $ = s => ov.querySelector(s);
  let parsed = [], cols = [], loose = [], createH = true;
  $('[data-close]').onclick = () => ov.remove();

  const msg = (t, bad) => {
    $('#imprev').innerHTML = `<div class="note"${bad ? ' style="background:#fdf1f0;border-color:#e8c4c0;color:var(--red)"' : ''}>${esc(t)}</div>`;
    $('#imok').disabled = true;
  };
  function preview() {
    const fresh = parsed.filter(r => !r.dup), dups = parsed.length - fresh.length;
    const known = new Set(db.halaqat.flatMap(halaqaKeys));
    const newH = isS ? new Set(fresh.filter(r => r.halaqa && !halaqaQKeys(r.halaqa).some(k => known.has(k))).map(r => norm(r.halaqa))) : new Set();
    const chip = t => `<span class="chip">${esc(t)}</span>`;
    $('#imprev').innerHTML = `<p style="margin:.2rem 0 .6rem"><b>${fresh.length}</b> جاهز للاستيراد${dups ? ` — ${dups} مكرر سيُتجاهل` : ''}</p>
    ${cols.length ? `<div class="note ok">أعمدة لها نظير وستُستورد في مكانها: ${cols.map(c => chip(c.header === c.label ? c.label : `${c.header} ← ${c.label}`)).join(' ')}</div>` : ''}
    ${loose.length ? `<div class="note">أعمدة ليس لها نظير (${loose.length}): ${loose.map(l => chip(l.header)).join(' ')}<br>ستُحفظ قيمها في تبويب «بيانات معلّقة» لتراجعها وتعدّلها، ثم تعتمد إنشاء حقل لكل منها.</div>` : ''}
    ${newH.size ? `<label style="display:flex;gap:.5rem;align-items:center;color:var(--text)"><input type="checkbox" id="imh" style="width:auto;margin:0" ${createH ? 'checked' : ''}> إنشاء ${newH.size} حلقة غير موجودة تلقائيًا</label>` : ''}
    <div class="tbl"><table><tr><th>الاسم</th>${isS ? '<th>الحلقة</th>' : ''}<th>الجوال</th><th>الحالة</th></tr>${parsed.slice(0, 8).map(r => `<tr><td>${esc(r.name)}</td>${isS ? `<td>${esc(r.halaqa || '—')}</td>` : ''}<td>${esc(r.vals['core:phone'] || '—')}</td><td>${r.dup ? '<span class="tag" style="background:#fbeceb;color:var(--red)">مكرر</span>' : '<span class="tag">جديد</span>'}</td></tr>`).join('')}</table></div>
    ${parsed.length > 8 ? `<p class="muted" style="margin:.4rem 0 0">… و${parsed.length - 8} صفوف أخرى</p>` : ''}`;
    const cb = $('#imh'); if (cb) cb.onchange = () => { createH = cb.checked; };
    $('#imok').disabled = !fresh.length;
  }
  function go(table) {
    const r = importRows(table, kind);
    if (r.err) { msg(r.err, true); return; }
    parsed = r.rows; cols = r.cols; loose = r.loose; preview();
  }

  $('#imf').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    msg('جارٍ قراءة الملف…');
    try {
      const buf = await f.arrayBuffer(), u8 = new Uint8Array(buf);
      if (/\.xls$/i.test(f.name)) throw new Error('xls');
      go(/\.xlsx$/i.test(f.name) || (u8[0] === 0x50 && u8[1] === 0x4b) ? await parseXLSX(buf) : parseCSV(decodeText(buf)));
    } catch (err) {
      msg(err.message === 'xls' ? 'صيغة xls القديمة غير مدعومة. احفظ الملف بصيغة xlsx أو CSV ثم أعد المحاولة.' : 'تعذّرت قراءة الملف. جرّب حفظه بصيغة CSV أو الصق الخلايا مباشرة.', true);
    }
    e.target.value = '';
  };
  $('#imgo').onclick = async () => {
    const u = $('#imu').value.trim(), p = $('#imp').value;
    try {
      if (u) { msg('جارٍ جلب الملف…'); go(await fetchSheet(u)); }
      else if (p.trim()) go(parseCSV(p));
      else msg('اختر ملفًا أو الصق البيانات أو ضع رابط Google Sheets.', true);
    } catch (err) {
      msg(err.message === 'url' ? 'الرابط ليس رابط Google Sheets صالحًا.' : 'تعذّر جلب الملف. تأكد أن مشاركته «أي شخص لديه الرابط»، أو انسخ الخلايا والصقها هنا.', true);
    }
  };
  $('#imu').addEventListener('keydown', e => { if (e.key === 'Enter') $('#imgo').click(); });
  $('#imt').onclick = () => {
    const csv = '\uFEFF' + (isS ? 'الاسم,الحلقة,الجوال,كلمة المرور\nمحمد أحمد,حلقة الفرقان,,\n' : 'الاسم,الجوال,كلمة المرور\nأحمد علي,,\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = isS ? 'قالب-الطلاب.csv' : 'قالب-المعلمين.csv'; a.click(); URL.revokeObjectURL(a.href);
  };
  $('#imok').onclick = () => {
    const hmap = new Map(db.halaqat.flatMap(h => halaqaKeys(h).map(k => [k, h.id])));
    let n = 0, nh = 0, np = 0;
    const made = [];
    parsed.filter(r => !r.dup).forEach(r => {
      let hid = '';
      if (isS && r.halaqa) {
        const k = halaqaQKeys(r.halaqa).find(x => hmap.has(x));
        if (k) hid = hmap.get(k);
        else if (createH) {
          /* حلقة جديدة: إن وُجد معلم بالاسم نفسه رُبطت به فتُسمّى باسمه */
          const t = db.teachers.find(x => halaqaQKeys(r.halaqa).includes(norm(x.name)));
          hid = uid(); db.halaqat.push({ id: hid, name: t ? '' : (/^\s*حلقة/.test(r.halaqa) ? r.halaqa : 'حلقة ' + r.halaqa), teacherId: t ? t.id : '', supervisorId: '', placeId: '' });
          halaqaQKeys(r.halaqa).forEach(x => hmap.set(x, hid)); nh++;
        }
      }
      const id = uid(), given = r.vals['core:pin'], pin = given || genPass();
      const m = isS ? { id, name: r.name, halaqaId: hid, phone: '', pin } : { id, name: r.name, phone: '', pin };
      cols.forEach(c => { if (c.id !== 'core:halaqa' && c.id !== 'core:pin' && r.vals[c.id]) setField(m, c.id, r.vals[c.id]); });
      db[kind].push(m); made.push([id, r]);
      if (!given) ui.shown[id] = true;
      n++;
    });
    loose.forEach((l, i) => {
      const values = made.map(([mid, r]) => ({ mid, v: r.loose[i] })).filter(x => x.v);
      if (values.length) { db.pending.push({ id: uid(), kind, header: l.header, values, date: today() }); np++; }
    });
    ov.remove(); save(); render();
    toast(`تم استيراد ${n} ${isS ? 'طالب' : 'معلم'}${nh ? ` وإنشاء ${nh} حلقة` : ''}${np ? ` — ${np} عمود في «بيانات معلّقة»` : ''}`);
  };
}

/* استمارة الطالب: حقول مشتركة، وحقول خاصة بالصغار (ولي الأمر) أو الكبار */
/* الصفوف الدراسية من الروضة إلى الجامعة */
const SCHOOL_GRADES = ['الروضة 1', 'الروضة 2', 'الصف الأول الابتدائي', 'الصف الثاني الابتدائي', 'الصف الثالث الابتدائي', 'الصف الرابع الابتدائي', 'الصف الخامس الابتدائي', 'الصف السادس الابتدائي',
  'الصف الأول الإعدادي', 'الصف الثاني الإعدادي', 'الصف الثالث الإعدادي', 'الصف الأول الثانوي', 'الصف الثاني الثانوي', 'الصف الثالث الثانوي', 'الجامعة'];
const gradeOpts = cur => [...SCHOOL_GRADES, ...(cur && !SCHOOL_GRADES.includes(cur) ? [cur] : [])];
/* الرقم القومي المصري (14 رقمًا): القرن ثم تاريخ الميلاد (سنة/شهر/يوم) ثم كود المحافظة ثم مسلسل ثم رقم تحقق.
   يُرجع تاريخ الميلاد والسن، أو سبب الخطأ */
const NID_GOV = new Set(['01', '02', '03', '04', '11', '12', '13', '14', '15', '16', '17', '18', '19', '21', '22', '23', '24', '25', '26', '27', '28', '29', '31', '32', '33', '34', '35', '88']);
function nidInfo(raw) {
  const n = String(raw || '').replace(/[٠-٩]/g, c => c.charCodeAt(0) - 1632).replace(/\D/g, '');
  if (!n) return { empty: true };
  if (n.length !== 14) return { err: `الرقم القومي 14 رقمًا (كتبت ${n.length})`, partial: n.length < 14 };
  const c = { 2: 1900, 3: 2000 }[n[0]];
  if (!c) return { err: 'الرقم القومي يبدأ بـ 2 أو 3' };
  const y = c + +n.slice(1, 3), m = +n.slice(3, 5), d = +n.slice(5, 7), dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return { err: 'تاريخ الميلاد في الرقم القومي غير صحيح' };
  if (dt > new Date()) return { err: 'تاريخ الميلاد في الرقم القومي بعد اليوم' };
  if (!NID_GOV.has(n.slice(7, 9))) return { err: 'كود المحافظة في الرقم القومي غير صحيح' };
  const birth = `${y}-${pad(m)}-${pad(d)}`;
  return { nid: n, birth, age: ageOf({ cat: 'child', info: { birth } }), male: +n[12] % 2 === 1 };
}
/* قائمة الحلقات (مصفّاة بالمكان إن اختير) وقائمة الأماكن */
const halOptsIn = placeId => db.halaqat.filter(h => !placeId || h.placeId === placeId).map(h => [h.id, halaqaLabel(h)]);
const placeOptsAll = () => db.places.map(p => [p.id, p.name]);
function studentForm(st) {
  const isNew = !st;
  st = st || { id: uid(), name: '', cat: 'child', halaqaId: ui.fh || '', phone: '', pin: genPass(), info: {} };
  const I = st.info || {}, T = I.test || {};
  let photo = st.photo || '';
  const v = k => esc(I[k] ?? '');
  const sel = (name, list, val, blank) => `<select name="${name}">${blank ? `<option value="">${blank}</option>` : ''}${list.map(o => { const [ov, ol] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(ov)}" ${String(ov) === String(val ?? '') ? 'selected' : ''}>${esc(ol)}</option>`; }).join('')}</select>`;
  const age = st.cat === 'adult' && I.birthYear ? new Date().getFullYear() - I.birthYear : '';
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal wide sform"><h2>${isNew ? 'استمارة تقديم' : 'تعديل بيانات: ' + esc(st.name)}</h2>
    <div class="sf-top">
      <div class="ph"><img data-ph alt="" ${photo ? `src="${photo}"` : 'hidden'}><span data-ph0 class="ph0" ${photo ? 'hidden' : ''}>${TAB_ICONS.profile}</span>
        <div class="ph-btns"><label class="btn sm" style="margin:0">صورة<input type="file" accept="image/*" data-sfphoto hidden></label><button type="button" class="btn sm" data-sfnophoto>إزالة</button></div></div>
      <div class="sf-main">
        <div class="seg"><label><input type="radio" name="cat" value="child" ${st.cat !== 'adult' ? 'checked' : ''}><span>صغير — له ولي أمر</span></label><label><input type="radio" name="cat" value="adult" ${st.cat === 'adult' ? 'checked' : ''}><span>كبير</span></label></div>
        <label><span data-c="child">اسم الطالب</span><span data-c="adult">الاسم</span><input name="name" value="${esc(st.name)}" required></label>
        <label>الرقم القومي<input name="nid" dir="ltr" inputmode="numeric" maxlength="14" autocomplete="off" value="${v('nid')}" placeholder="14 رقمًا — يُستخرج منه تاريخ الميلاد والسن"><small data-nidmsg class="muted" style="display:block;margin-top:.2rem"></small></label>
      </div>
    </div>
    <fieldset class="tfs" data-c="child"><legend>خاص بالطالب</legend>
      <div class="two"><label>تاريخ الميلاد<input type="date" name="birth" value="${v('birth')}"></label><label>السن<input data-agec disabled></label></div>
      <div class="two"><label>الدراسة${sel('study', STUDY, I.study, '—')}</label><label>الصف الدراسي (وقت التقديم)${sel('grade', gradeOpts(I.grade), I.grade, '—')}</label></div>
    </fieldset>
    <fieldset class="tfs" data-c="adult"><legend>بيانات</legend>
      <div class="two"><label>السن (سنة)<input type="number" name="age" min="5" max="110" value="${age}"></label><label>الحالة الاجتماعية${sel('marital', MARITAL, I.marital, '—')}</label></div>
      <div class="two"><label>المؤهل الدراسي<input name="qual" value="${v('qual')}"></label><label>طالب / خريج${sel('qualStatus', QSTAT, I.qualStatus, '—')}</label></div>
      <div class="two"><label>الوظيفة الحالية<input name="job" value="${v('job')}"></label><label>الوقت المتاح للحضور<input name="avail" value="${v('avail')}"></label></div>
    </fieldset>
    <fieldset class="tfs"><legend>العنوان والتواصل</legend>
      <label>العنوان<input name="address" value="${v('address')}"></label>
      <div class="two"><label>رقم الهاتف<input type="tel" dir="ltr" name="sphone" value="${v('phone')}"></label><label>واتساب<input type="tel" dir="ltr" name="whatsapp" value="${v('whatsapp')}" placeholder="إن اختلف عن الهاتف"></label></div>
    </fieldset>
    <fieldset class="tfs" data-c="child"><legend>خاص بولي الأمر</legend>
      <div class="two"><label>اسم ولي الأمر<input name="gName" value="${v('gName')}"></label><label>الوظيفة<input name="gJob" value="${v('gJob')}"></label></div>
      <div class="two"><label>رقم الهاتف<input type="tel" dir="ltr" name="gPhone" value="${v('gPhone')}"></label><label>واتساب<input type="tel" dir="ltr" name="gWhatsapp" value="${v('gWhatsapp')}" placeholder="إن اختلف عن الهاتف"></label></div>
      <div class="two"><label>صلة القرابة${sel('gRel', RELS, I.gRel, '—')}</label><label data-rel>حدّد صلة القرابة<input name="gRelOther" value="${v('gRelOther')}"></label></div>
    </fieldset>
    <fieldset class="tfs"><legend>اختبار تحديد مستوى</legend>
      <div class="three"><label>قراءة${sel('tRead', GRADES, T.read, '—')}</label><label>تجويد${sel('tTaj', GRADES, T.tajweed, '—')}</label><label>حفظ<input name="tHifz" value="${esc(T.hifz || '')}" placeholder="مثال: جزء عم"></label></div>
    </fieldset>
    <fieldset class="tfs"><legend>قرار المسؤول</legend>
      <div class="two"><label>ينضم لحلقة${sel('halaqaId', halOptsIn(byId(db.halaqat, st.halaqaId)?.placeId || ''), st.halaqaId, '— لم يُحدَّد بعد —')}</label><label>في${sel('placeId', placeOptsAll(), byId(db.halaqat, st.halaqaId)?.placeId || '', '— كل الأماكن —')}</label></div>
      <div class="three"><label>تحرر يوم<input type="date" name="joinDate" value="${v('joinDate') || (isNew ? today() : '')}"></label><label>الاشتراك الشهري (جنيه)<input type="number" min="0" name="fee" value="${v('fee')}"></label>${CLOUD ? '<span></span>' : `<label>كلمة المرور للدخول<input name="pin" value="${esc(st.pin)}" required dir="ltr"></label>`}</div>
      <label class="chk"><input type="checkbox" name="pledge" ${I.pledge ? 'checked' : ''}><span data-c="child">وقّع ولي الأمر على التنبيهات</span><span data-c="adult">وقّع المتقدم على التنبيهات</span></label>
    </fieldset>
    <div class="row"><button type="button" class="btn primary" data-save>حفظ</button><button type="button" class="btn" data-close>إلغاء</button></div></div>`;
  document.body.appendChild(ov);
  const $ = q => ov.querySelector(q), val = n => (ov.querySelector(`[name=${n}]`)?.value ?? '').trim();
  const cat = () => ov.querySelector('[name=cat]:checked').value;
  const sync = () => {
    ov.querySelectorAll('[data-c]').forEach(x => { x.hidden = x.dataset.c !== cat(); });
    $('[data-rel]').hidden = cat() !== 'child' || val('gRel') !== 'شخص آخر';
    const a = ageOf({ cat: 'child', info: { birth: val('birth') } });
    $('[data-agec]').value = a === '' ? '' : a + ' سنة';
  };
  /* الرقم القومي: عند اكتماله صحيحًا يُملأ تاريخ الميلاد والسن تلقائيًا */
  const nidSync = () => {
    const r = nidInfo(val('nid')), m = $('[data-nidmsg]');
    m.style.color = r.err && !r.partial ? 'var(--red)' : '';
    m.textContent = r.empty ? '' : r.err || `✓ مواليد ${r.birth} — ${r.age} سنة`;
    if (r.birth) { $('[name=birth]').value = r.birth; $('[name=age]').value = r.age; sync(); }
  };
  $('[name=nid]').addEventListener('input', nidSync); nidSync();
  /* اختيار المكان يعرض حلقاته فقط */
  $('[name=placeId]').addEventListener('change', () => {
    const s2 = $('[name=halaqaId]'), cur = s2.value, list = halOptsIn(val('placeId'));
    s2.innerHTML = `<option value="">— لم يُحدَّد بعد —</option>${list.map(([v2, l]) => `<option value="${esc(v2)}" ${v2 === cur ? 'selected' : ''}>${esc(l)}</option>`).join('')}`;
  });
  $('[name=halaqaId]').addEventListener('change', () => { const h = byId(db.halaqat, val('halaqaId')); if (h?.placeId) $('[name=placeId]').value = h.placeId; });
  ov.addEventListener('change', sync); ov.addEventListener('input', sync); sync();
  $('[data-sfphoto]').onchange = e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    const url = URL.createObjectURL(f), img = new Image();
    img.onload = () => {
      /* قص مربع من الوسط وتصغير إلى 160 بكسل حتى لا تثقل الصور ذاكرة المتصفح */
      const S = 160, c = document.createElement('canvas'), m = Math.min(img.naturalWidth, img.naturalHeight);
      c.width = c.height = S;
      c.getContext('2d').drawImage(img, (img.naturalWidth - m) / 2, (img.naturalHeight - m) / 2, m, m, 0, 0, S, S);
      let d = c.toDataURL('image/webp', .72); if (!d.startsWith('data:image/webp')) d = c.toDataURL('image/jpeg', .75);
      URL.revokeObjectURL(url); photo = d;
      $('[data-ph]').src = d; $('[data-ph]').hidden = false; $('[data-ph0]').hidden = true;
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast('تعذّرت قراءة الصورة'); };
    img.src = url;
  };
  $('[data-sfnophoto]').onclick = () => { photo = ''; $('[data-ph]').hidden = true; $('[data-ph0]').hidden = false; };
  $('[data-close]').onclick = () => ov.remove();
  $('[data-save]').onclick = () => {
    const name = val('name').replace(/\s+/g, ' ');
    if (!name) { toast('اكتب الاسم'); return; }
    if (!CLOUD && !val('pin')) { toast('اكتب كلمة المرور'); return; }
    if (db.students.some(x => x.id !== st.id && norm(x.name) === norm(name))) { toast('يوجد طالب بالاسم نفسه'); return; }
    const N = nidInfo(val('nid'));
    if (N.err) { toast(N.err); return; }
    if (N.nid && db.students.some(x => x.id !== st.id && (x.info || {}).nid === N.nid)) { toast('الرقم القومي مسجّل لطالب آخر'); return; }
    const c = cat(), ageN = +val('age');
    if (c === 'adult' && val('age') && !(ageN >= 5 && ageN <= 110)) { toast('السن غير صحيح'); return; }
    const info = { nid: N.nid || '', address: val('address'), phone: normPhone(val('sphone')), whatsapp: normPhone(val('whatsapp')), joinDate: val('joinDate'), fee: val('fee') === '' ? '' : +val('fee'), pledge: $('[name=pledge]').checked,
      test: { read: val('tRead'), tajweed: val('tTaj'), hifz: val('tHifz') } };
    if (c === 'child') Object.assign(info, { birth: val('birth'), study: val('study'), grade: val('grade'), gName: val('gName'), gJob: val('gJob'), gPhone: normPhone(val('gPhone')), gWhatsapp: normPhone(val('gWhatsapp')), gRel: val('gRel'), gRelOther: val('gRel') === 'شخص آخر' ? val('gRelOther') : '' });
    else Object.assign(info, { birthYear: val('age') ? new Date().getFullYear() - ageN : '', marital: val('marital'), qual: val('qual'), qualStatus: val('qualStatus'), job: val('job'), avail: val('avail') });
    Object.assign(st, { name, cat: c, halaqaId: val('halaqaId'), ...(CLOUD ? {} : { pin: val('pin') }), photo, info: { ...(st.info || {}), ...info } });
    /* رقم التواصل الأساسي: ولي الأمر للصغير، والطالب نفسه للكبير */
    st.phone = c === 'child' ? (info.gPhone || info.phone || st.phone || '') : (info.phone || st.phone || '');
    if (isNew) db.students.push(st);
    ov.remove(); save(); render(); toast(isNew ? 'تم حفظ الاستمارة' : 'تم حفظ التعديلات');
  };
}
/* ملف الطالب: عرض الاستمارة كاملة مع إمكان طباعتها */
function studentCard(st) {
  if (!st) return;
  const I = st.info || {}, T = I.test || {}, child = st.cat !== 'adult', h = byId(db.halaqat, st.halaqaId);
  const row = (l, x) => (x === '' || x == null) ? '' : `<tr><th>${l}</th><td>${esc(x)}</td></tr>`;
  const wa = n => n ? `<a href="https://wa.me/2${esc(n)}" target="_blank" rel="noopener" dir="ltr">${esc(n)}</a>` : '';
  const telRow = (l, p, w) => (p || w) ? `<tr><th>${l}</th><td><span dir="ltr">${esc(p || '—')}</span>${w && w !== p ? ` — واتساب ${wa(w)}` : ''}</td></tr>` : '';
  const sec = (t, rows) => rows.trim() ? `<h3 class="sc-h">${t}</h3><div class="tbl"><table>${rows}</table></div>` : '';
  const a = ageOf(st);
  const html = `<div class="scard">
    <div class="sc-head">${avatar(st, 96)}<div><h2 style="margin:0">${esc(st.name)}</h2><p class="muted" style="margin:.2rem 0 0"><span class="tag ${child ? '' : 'tag-a'}">${CATS[child ? 'child' : 'adult']}</span> ${a === '' ? '' : a + ' سنة'}</p></div></div>
    ${sec(child ? 'خاص بالطالب' : 'بيانات', child
      ? row('الرقم القومي', I.nid) + row('تاريخ الميلاد', I.birth) + row('الدراسة', I.study) + row('الصف الدراسي', I.grade)
      : row('الرقم القومي', I.nid) + row('المؤهل الدراسي', [I.qual, I.qualStatus].filter(Boolean).join(' — ')) + row('الحالة الاجتماعية', I.marital) + row('الوظيفة الحالية', I.job) + row('الوقت المتاح للحضور', I.avail))}
    ${sec('العنوان والتواصل', row('العنوان', I.address) + telRow('رقم الهاتف', I.phone, I.whatsapp))}
    ${child ? sec('خاص بولي الأمر', row('اسم ولي الأمر', I.gName) + telRow('رقم الهاتف', I.gPhone, I.gWhatsapp) + row('الوظيفة', I.gJob) + row('صلة القرابة', I.gRel === 'شخص آخر' ? (I.gRelOther || 'شخص آخر') : I.gRel)) : ''}
    ${sec('اختبار تحديد مستوى', row('قراءة', T.read) + row('تجويد', T.tajweed) + row('حفظ', T.hifz))}
    ${sec('قرار المسؤول', row('ينضم لحلقة', h ? halaqaLabel(h) : '') + row('في', placeName(h)) + row('وقت الحلقة', timeText(h)) + row('تحرر يوم', I.joinDate) + row('الاشتراك الشهري', I.fee === '' || I.fee == null ? '' : I.fee + ' جنيه') + row('التوقيع على التنبيهات', I.pledge ? (child ? 'وقّع ولي الأمر' : 'وقّع المتقدم') : 'لم يوقّع بعد'))}
    <div class="row noprint">${session?.role === 'admin' ? `<button class="btn primary" data-act="editStudent" data-id="${st.id}">تعديل</button>` : ''}<button class="btn" data-act="printCard">طباعة</button></div>
  </div>`;
  openInfo('ملف الطالب', html);
}

/* نموذج الحلقة: المكان والمعلم والمشرف، والوقت بالساعة أو بالصلوات */
function halaqaForm(h, presetPlace) {
  const isNew = !h, w = h?.time || { mode: 'prayer', fromPrayer: 'العصر', toKind: 'prayer', toPrayer: 'المغرب' };
  const sel = (name, list, val) => `<select name="${name}">${list.map(o => `<option value="${esc(o.v)}" ${String(o.v) === String(val ?? '') ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select>`;
  const P = PRAYERS.map(x => ({ v: x, l: x }));
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal"><h2>${isNew ? 'حلقة جديدة' : 'تعديل الحلقة'}</h2>
    <label>المكان${sel('placeId', [{ v: '', l: '— اختر المكان —' }, ...db.places.map(p => ({ v: p.id, l: p.name + ' (' + p.type + ')' }))], h?.placeId ?? presetPlace)}</label>
    <label>المعلم — الحلقة تُسمّى باسمه${sel('teacherId', [{ v: '', l: '— بدون —' }, ...opts(db.teachers)], h?.teacherId)}</label>
    <label>المشرف${sel('supervisorId', [{ v: '', l: '— بدون —' }, ...opts(db.supervisors)], h?.supervisorId)}</label>
    <fieldset class="tfs"><legend>وقت الحلقة</legend>
      <div class="seg"><label><input type="radio" name="mode" value="prayer" ${w.mode !== 'clock' ? 'checked' : ''}><span>بالصلوات</span></label><label><input type="radio" name="mode" value="clock" ${w.mode === 'clock' ? 'checked' : ''}><span>بالساعة</span></label></div>
      <div data-m="prayer"><div class="two"><label>من بعد صلاة${sel('fromPrayer', P, w.fromPrayer || 'العصر')}</label><label>إلى${sel('toKind', [{ v: 'prayer', l: 'صلاة' }, { v: 'clock', l: 'الساعة' }], w.toKind || 'prayer')}</label></div>
        <div class="two"><label data-k="prayer">صلاة${sel('toPrayer', [{ v: '', l: '—' }, ...P], w.toPrayer)}</label><label data-k="clock">الساعة<input type="time" name="toTime" value="${esc(w.toTime || '')}"></label></div></div>
      <div data-m="clock" class="two"><label>من الساعة<input type="time" name="from" value="${esc(w.from || '')}"></label><label>إلى الساعة<input type="time" name="to" value="${esc(w.to || '')}"></label></div>
      <p class="tprev"></p>
    </fieldset>
    ${h && !h.teacherId && h.name ? `<label>اسم مؤقت (يُستبدل باسم المعلم عند اختياره)<input name="name" value="${esc(h.name)}"></label>` : ''}
    <div class="row"><button type="button" class="btn primary" data-save>حفظ</button><button type="button" class="btn" data-close>إلغاء</button></div></div>`;
  document.body.appendChild(ov);
  const $ = q => ov.querySelector(q), val = n => ov.querySelector(`[name=${n}]`)?.value;
  const mode = () => ov.querySelector('[name=mode]:checked').value;
  const read = () => mode() === 'clock' ? { mode: 'clock', from: val('from'), to: val('to') } : { mode: 'prayer', fromPrayer: val('fromPrayer'), toKind: val('toKind'), toPrayer: val('toPrayer'), toTime: val('toTime') };
  const sync = () => {
    ov.querySelectorAll('[data-m]').forEach(x => { x.hidden = x.dataset.m !== mode(); });
    ov.querySelectorAll('[data-k]').forEach(x => { x.hidden = x.dataset.k !== val('toKind'); });
    const t = byId(db.teachers, val('teacherId'));
    $('.tprev').innerHTML = `<b>${esc(t ? 'حلقة ' + t.name : 'حلقة بلا معلم')}</b> — ${esc(timeText({ time: read() }) || 'حدّد الوقت')}`;
  };
  ov.addEventListener('change', sync); ov.addEventListener('input', sync); sync();
  $('[data-close]').onclick = () => ov.remove();
  $('[data-save]').onclick = () => {
    const t = read();
    if (!val('placeId')) { toast('اختر المكان'); return; }
    if (t.mode === 'clock') {
      if (!t.from || !t.to) { toast('حدّد ساعة البداية والنهاية'); return; }
      if (t.from >= t.to) { toast('ساعة النهاية يجب أن تكون بعد البداية'); return; }
    } else if (t.toKind === 'prayer') {
      if (!t.toPrayer) { toast('حدّد الصلاة التي تنتهي عندها الحلقة'); return; }
      if (PRAYERS.indexOf(t.toPrayer) <= PRAYERS.indexOf(t.fromPrayer)) { toast('صلاة النهاية يجب أن تكون بعد صلاة البداية'); return; }
    } else if (!t.toTime) { toast('حدّد ساعة انتهاء الحلقة'); return; }
    const o = { placeId: val('placeId'), teacherId: val('teacherId'), supervisorId: val('supervisorId'), time: t };
    if (val('name') !== undefined) o.name = val('name').trim();
    if (isNew) db.halaqat.push({ id: uid(), ...o }); else Object.assign(h, o);
    ov.remove(); save(); render(); toast('تم حفظ الحلقة');
  };
}


/* ============ إضافة طلاب سريعًا: طالب واحد أو عدة طلاب ============
   زر «استمارة طالب» صار أيقونة ورقة بعلامة +، وبجانبه أيقونة «إضافة طالب» تفتح نافذة بقسمين:
   طالب واحد (الاسم، الرقم القومي، الصف، المكان، الحلقة) أو عدة طلاب (المكان والحلقة ثم الأسماء). */
const ADD_ICONS = {
  form: svg('<path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7z"/><path d="M14 3v4h4"/><path d="M12 11v6M9 14h6"/>'),
  quick: svg('<circle cx="9" cy="8" r="3.2"/><path d="M3 20v-1a6 6 0 0 1 12 0v1"/><path d="M19 8v6M16 11h6"/>')
};
function newStudent(name, halaqaId, info) {
  const age = info.birth ? ageOf({ cat: 'child', info: { birth: info.birth } }) : '';
  const cat = age !== '' && age >= 18 ? 'adult' : 'child';
  const extra = cat === 'adult' && info.birth ? { birthYear: +info.birth.slice(0, 4) } : {};
  return { id: uid(), name, cat, halaqaId: halaqaId || '', phone: '', pin: genPass(), info: { joinDate: today(), ...info, ...extra } };
}
function quickAdd() {
  if (!(session?.role === 'admin' || window.Perms?.can('students.add'))) { toast('غير مصرح'); return; }
  const placeSel = n => `<select name="${n}"><option value="">— اختر المكان —</option>${placeOptsAll().map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select>`;
  const halOpts = pid => `<option value="">— اختر الحلقة —</option>${halOptsIn(pid).map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}`;
  const ov = document.createElement('div'); ov.className = 'overlay';
  ov.innerHTML = `<div class="modal wide"><h2>إضافة طلاب</h2>
    <div class="bar" style="margin:0 0 .6rem"><button type="button" class="btn on" data-qm="one">طالب واحد</button><button type="button" class="btn" data-qm="many">عدة طلاب</button></div>
    <div data-qp="one">
      <label>الاسم<input name="qName" autocomplete="off"></label>
      <div class="two"><label>الرقم القومي<input name="qNid" dir="ltr" inputmode="numeric" maxlength="14" autocomplete="off" placeholder="14 رقمًا (اختياري)"><small data-qnidmsg class="muted" style="display:block;margin-top:.2rem"></small></label>
        <label>الصف الدراسي<select name="qGrade"><option value="">—</option>${SCHOOL_GRADES.map(g => `<option>${esc(g)}</option>`).join('')}</select></label></div>
      <div class="two"><label>الحلقة<select name="qHal1">${halOpts('')}</select></label><label>المكان${placeSel('qPlace1')}</label></div>
    </div>
    <div data-qp="many" hidden>
      <div class="two"><label>المكان${placeSel('qPlace2')}</label><label>الحلقة<select name="qHal2">${halOpts('')}</select></label></div>
      <label>أسماء الطلاب (اسم في كل سطر)<textarea name="qNames" rows="8" placeholder="أحمد محمد علي&#10;عبد الله حسن"></textarea></label>
      <small data-qcnt class="muted"></small>
    </div>
    <div class="row"><button type="button" class="btn primary" data-qsave>حفظ</button><button type="button" class="btn" data-close>إلغاء</button></div></div>`;
  document.body.appendChild(ov);
  const $ = q => ov.querySelector(q), val = n => ($(`[name=${n}]`)?.value || '').trim();
  let mode = 'one';
  const names = () => [...new Set(val('qNames').split(/[\n،,]+/).map(x => fixName(x)).filter(Boolean))];
  ov.addEventListener('click', e => {
    const m = e.target.closest('[data-qm]');
    if (m) { mode = m.dataset.qm; ov.querySelectorAll('[data-qm]').forEach(b => b.classList.toggle('on', b === m)); ov.querySelectorAll('[data-qp]').forEach(p => { p.hidden = p.dataset.qp !== mode; }); return; }
    if (e.target.closest('[data-close]')) ov.remove();
  });
  ov.addEventListener('change', e => {
    const n = e.target.name;
    if (n === 'qPlace1' || n === 'qPlace2') { const h = $(`[name=${n === 'qPlace1' ? 'qHal1' : 'qHal2'}]`); h.innerHTML = halOpts(e.target.value); }
    if (n === 'qHal1' || n === 'qHal2') { const h = byId(db.halaqat, e.target.value), p = $(`[name=${n === 'qHal1' ? 'qPlace1' : 'qPlace2'}]`); if (h?.placeId && p.value !== h.placeId) { p.value = h.placeId; } }
  });
  ov.addEventListener('input', e => {
    if (e.target.name === 'qNid') {
      const r = nidInfo(e.target.value), m = $('[data-qnidmsg]');
      m.style.color = r.err && !r.partial ? 'var(--red)' : '';
      m.textContent = r.empty ? '' : r.err || `✓ مواليد ${r.birth} — ${r.age} سنة`;
    }
    if (e.target.name === 'qNames') { const k = names().length; $('[data-qcnt]').textContent = k ? `${k} اسمًا` : ''; }
  });
  const exists = n => db.students.some(x => norm(x.name) === norm(n));
  $('[data-qsave]').onclick = () => {
    if (mode === 'one') {
      const name = fixName(val('qName'));
      if (!name) { toast('اكتب اسم الطالب'); return; }
      if (exists(name)) { toast('يوجد طالب بالاسم نفسه'); return; }
      const N = nidInfo(val('qNid'));
      if (N.err) { toast(N.err); return; }
      if (N.nid && db.students.some(x => (x.info || {}).nid === N.nid)) { toast('الرقم القومي مسجّل لطالب آخر'); return; }
      db.students.push(newStudent(name, val('qHal1'), { nid: N.nid || '', birth: N.birth || '', grade: val('qGrade') }));
      ov.remove(); save(); render(); toast(`أُضيف «${name}»`);
      return;
    }
    if (!val('qPlace2') || !val('qHal2')) { toast('اختر المكان والحلقة'); return; }
    const list = names();
    if (!list.length) { toast('اكتب أسماء الطلاب'); return; }
    const fresh = list.filter(n => !exists(n)), skipped = list.length - fresh.length;
    fresh.forEach(n => db.students.push(newStudent(n, val('qHal2'), {})));
    ov.remove(); save(); render();
    toast(`أُضيف ${fresh.length} طالبًا إلى ${halaqaLabel(byId(db.halaqat, val('qHal2')))}${skipped ? ` — تُرك ${skipped} موجود من قبل` : ''}`);
  };
  setTimeout(() => $('[name=qName]')?.focus(), 50);
}
/* أيقونة «استمارة طالب» وبجانبها «إضافة طالب» حيثما ظهر زر الاستمارة */
new MutationObserver(() => {
  document.querySelectorAll('main [data-act=addStudent]:not([data-qi])').forEach(b => {
    b.dataset.qi = '1'; b.classList.add('icon-only'); b.title = 'استمارة طالب جديد'; b.setAttribute('aria-label', 'استمارة طالب جديد'); b.innerHTML = ADD_ICONS.form;
    b.insertAdjacentHTML('afterend', `<button type="button" class="btn icon-only" data-qadd title="إضافة طالب (واحد أو عدة طلاب)" aria-label="إضافة طالب">${ADD_ICONS.quick}</button>`);
  });
}).observe(document.body, { childList: true, subtree: true });
document.addEventListener('click', e => { if (e.target.closest('[data-qadd]')) quickAdd(); });

/* ============ تعديل بيانات المعلم في نافذة واحدة ============
   الأقسام: شخصية (مع الاسم) وإدارية وفنية (وإضافية إن وُجدت حقول)، وحفظ واحد للكل.
   الحالة: «عامل» = نشط، «متوقف» = موقوف (يرى صفحة الإيقاف ويرفض الخادم ما يسجّله). */
const T_STAT_L = { 'نشط': 'عامل', 'في إجازة': 'في إجازة', 'موقوف': 'متوقف' };
function teacherEditor(t) {
  if (!t || session?.role !== 'admin') return;
  const G = [['personal', 'شخصية'], ['admin', 'إدارية'], ['tech', 'فنية']], XF = db.fields.teachers || [];
  const grid = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:0 .8rem';
  const fld = (g, [k, l, ty, opts]) => fieldHtml({ name: g + '__' + k, label: l, type: ty || 'text', value: pv(t, g, k), options: opts && opts.map(x => ({ v: x, l: k === 'status' ? (T_STAT_L[x] || x) : x })) });
  const tabs = [...G, ...(XF.length ? [['extra', 'إضافية']] : [])];
  const ov = document.createElement('div'); ov.className = 'overlay';
  ov.innerHTML = `<div class="modal wide"><h2>تعديل بيانات: ${esc(t.name)}</h2>
    <div class="bar" style="margin:0 0 .7rem">${tabs.map(([g, l], i) => `<button type="button" class="btn ${i ? '' : 'on'}" data-tg="${g}">${l}</button>`).join('')}</div>
    <div data-tp="personal" style="${grid}"><label>الاسم<input name="tName" value="${esc(t.name)}" required></label>${CLOUD ? '' : `<label>كلمة المرور<input name="tPin" value="${esc(t.pin || '')}" dir="ltr"></label>`}${PROF.personal.fields.map(f => fld('personal', f)).join('')}</div>
    <div data-tp="admin" style="${grid}" hidden>${PROF.admin.fields.map(f => fld('admin', f)).join('')}</div>
    <div data-tp="tech" style="${grid}" hidden>${PROF.tech.fields.map(f => fld('tech', f)).join('')}</div>
    ${XF.length ? `<div data-tp="extra" style="${grid}" hidden>${XF.map(f => fieldHtml({ name: 'x__' + f.key, label: f.label, type: f.type || 'text', value: (t.extra || {})[f.key] || '' })).join('')}</div>` : ''}
    <div class="row"><button type="button" class="btn primary" data-save>حفظ</button><button type="button" class="btn" data-close>إلغاء</button></div></div>`;
  document.body.appendChild(ov);
  const val = n => (ov.querySelector(`[name="${n}"]`)?.value ?? '').trim();
  ov.addEventListener('click', e => {
    const tg = e.target.closest('[data-tg]');
    if (tg) { ov.querySelectorAll('[data-tg]').forEach(b => b.classList.toggle('on', b === tg)); ov.querySelectorAll('[data-tp]').forEach(p => { p.hidden = p.dataset.tp !== tg.dataset.tg; }); return; }
    if (e.target.closest('[data-close]')) { ov.remove(); return; }
    if (!e.target.closest('[data-save]')) return;
    const name = fixName(val('tName'));
    if (!name) { toast('اكتب الاسم'); return; }
    if (db.teachers.some(x => x.id !== t.id && norm(x.name) === norm(name))) { toast('يوجد معلم بالاسم نفسه'); return; }
    const mem = val('tech__memorized');
    if (mem !== '' && (+mem < 0 || +mem > 30)) { toast('الأجزاء المحفوظة من 0 إلى 30'); return; }
    t.name = name;
    if (!CLOUD) t.pin = val('tPin') || t.pin;
    G.forEach(([g]) => { t[g] = { ...(t[g] || {}) }; PROF[g].fields.forEach(([k]) => { const x = val(g + '__' + k); if (k === 'phone') t.phone = x; else t[g][k] = x; }); });
    if (XF.length) { t.extra = { ...(t.extra || {}) }; XF.forEach(f => { t.extra[f.key] = val('x__' + f.key); }); }
    ov.remove(); save(); render(); toast('حُفظت بيانات «' + name + '»');
  });
}
document.addEventListener('click', e => { const b = e.target.closest('[data-tedit]'); if (b) teacherEditor(byId(db.teachers, b.dataset.tedit)); });
/* ============ حالة العمل الموحّدة: «عامل» أو «متوقف» ============
   تسري على المعلم (حالته الإدارية «موقوف» ← صفحة الإيقاف ورفض الخادم) وعلى موظف المرتبات المرتبط به (من التصنيف):
   الإيقاف يُخرجه من كشف الشهر المفتوح (الشهور المغلقة لا تُمس)، والإعادة تُرجعه للشهر المفتوح الأخير بأسعاره.
   الحذف نفسه صار في «الأعضاء» فقط. */
function workLinks({ empId, teacherId }) {
  const emps = db.payroll?.employees || [];
  let e = empId ? emps.find(x => x.id === empId) : null, t = teacherId ? byId(db.teachers, teacherId) : null;
  if (e && !t) { const c = clsOf(e); if (c?.kind === 'teacher') t = byId(db.teachers, c.memberId); }
  if (t && !e) e = emps.find(x => { const c = clsOf(x); return c?.kind === 'teacher' && c.memberId === t.id; }) || null;
  return { e, t };
}
function openMonths() {
  const P = db.payroll; if (!P) return [];
  return [...new Set((P.rows || []).map(r => r.y * 100 + r.m))].filter(k => !(P.closed || []).includes(Math.floor(k / 100) + '-' + (k % 100))).sort((a, b) => a - b);
}
window.setWorkStatus = function ({ empId, teacherId }, stop) {
  const { e, t } = workLinks({ empId, teacherId }), P = db.payroll;
  let removed = 0, added = '';
  if (e && P) {
    e.status = stop ? 'متوقف' : 'نشط';
    if (stop) {
      const open = new Set(openMonths()), before = P.rows.length;
      P.rows = P.rows.filter(r => !(r.eid === e.id && open.has(r.y * 100 + r.m)));
      removed = before - P.rows.length;
    } else {
      const last = openMonths().pop();
      if (last && window.Payroll?.newRow && !P.rows.some(r => r.eid === e.id && r.y * 100 + r.m === last)) {
        P.rows.push(window.Payroll.newRow(e, Math.floor(last / 100), last % 100)); added = `${last % 100}/${Math.floor(last / 100)}`;
      }
    }
  }
  if (t) t.admin = { ...(t.admin || {}), status: stop ? 'موقوف' : 'نشط' };
  save(); render();
  const who = (t || e)?.name || '';
  toast(stop ? `أُوقف «${who}»${removed ? ' وخرج من كشف الشهر المفتوح' : ''}` : `عاد «${who}» عاملًا${added ? ` وأُضيف لكشف شهر ${added}` : ''}`);
};
function askWork(ids, stop) {
  const { e, t } = workLinks(ids), who = (t || e)?.name || '';
  render(); /* يبقى الاختيار السابق ظاهرًا حتى التأكيد */
  const parts = stop ? [t ? 'لن يستطيع تسجيل حضور أو تسميع، ويرى رسالة الإيقاف عند دخوله' : '', e ? 'ويخرج من كشف الشهر المفتوح' : ''].filter(Boolean).join('، ') : '';
  ask(stop ? `إيقاف «${who}»؟ ${parts}. يمكن إعادته من «المعلمون ← المتوقفون».` : `إعادة «${who}» عاملًا؟`, () => window.setWorkStatus(ids, stop));
}
document.addEventListener('change', e => {
  if (session?.role !== 'admin') return;
  const ts = e.target.closest?.('[data-tstat]'); if (ts) { askWork({ teacherId: ts.dataset.tstat }, ts.value === 'off'); return; }
  const ps = e.target.closest?.('[data-pstat]'); if (ps) askWork({ empId: ps.dataset.pstat }, ps.value === 'off');
});
/* قائمة «المتوقفون» في «المعلمون»: المعلمون الموقوفون وموظفو المرتبات المتوقفون (المرتبط يظهر مرة واحدة) */
function stoppedList() {
  const out = [], seen = new Set();
  db.teachers.filter(t => (t.admin || {}).status === 'موقوف').forEach(t => { const { e } = workLinks({ teacherId: t.id }); out.push({ name: t.name, kind: 'معلم', ids: { teacherId: t.id }, pay: !!e }); if (e) seen.add(e.id); });
  (db.payroll?.employees || []).filter(x => x.status === 'متوقف' && !seen.has(x.id)).forEach(x => { const c = clsOf(x); out.push({ name: x.name, kind: c ? ({ teacher: 'معلم', supervisor: 'مشرف', admin: 'مدير' }[c.kind] || c.kind) : (x.role || 'موظف'), ids: { empId: x.id }, pay: true }); });
  return out.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
}
const baseTeachersView = adminViews.teachers;
adminViews.teachers = () => {
  const L = stoppedList();
  return baseTeachersView() + `<div class="card"><h2>المتوقفون (${L.length})</h2>
    ${L.length ? `<div class="tbl"><table><tr><th>#</th><th>الاسم</th><th>الصفة</th><th>في المرتبات</th><th></th></tr>${L.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.name)}</td><td>${esc(x.kind)}</td><td>${x.pay ? 'نعم' : '—'}</td><td><button type="button" class="btn sm primary" data-wback='${esc(JSON.stringify(x.ids))}'>إعادة عامل</button></td></tr>`).join('')}</table></div>` : empty('لا يوجد متوقفون.')}</div>`;
};
document.addEventListener('click', e => { const b = e.target.closest('[data-wback]'); if (b && session?.role === 'admin') askWork(JSON.parse(b.dataset.wback), false); });

/* ============ طلاب الحلقة: الضغط على اسم الحلقة يعرض بياناتها وقائمة طلابها ============ */
function halaqaStudents(h) {
  if (!h) return;
  const list = db.students.filter(s => s.halaqaId === h.id).sort((a, b) => (stOff(a) - stOff(b)) || a.name.localeCompare(b.name, 'ar'));
  const off = list.filter(stOff).length;
  const info = [['المعلم', tName(h.teacherId)], ['المشرف', supName(h.supervisorId)], ['المكان', placeName(h) || '—'], ['الوقت', timeText(h) || '—'],
    ['الطلاب', `${list.length - off} منتظم${off ? ` و${off} منقطع` : ''}`]];
  const rows = list.map((s, i) => `<tr><td>${i + 1}</td><td><span class="who">${avatar(s, 28)}<span>${esc(s.name)}</span></span></td><td>${CATS[s.cat || 'child']}</td><td>${ageOf(s) === '' ? '—' : ageOf(s)}</td>
    <td>${stOff(s) ? '<span class="tag tag-no">منقطع</span>' : '<span class="tag tag-ok">منتظم</span>'}</td><td>${esc(lastHifz(s.id))}</td><td>${attRate(s.id)}</td>
    <td><button type="button" class="btn sm" data-act="studentCard" data-id="${s.id}">الملف</button></td></tr>`).join('');
  openInfo(halaqaLabel(h), `<div class="tbl" style="margin-bottom:.8rem"><table>${info.map(([l, v]) => `<tr><th style="width:30%">${l}</th><td>${esc(v)}</td></tr>`).join('')}</table></div>
    ${list.length ? `<div class="tbl"><table><tr><th>#</th><th>الطالب</th><th>الفئة</th><th>السن</th><th>الحالة</th><th>آخر حفظ</th><th>الحضور</th><th></th></tr>${rows}</table></div>` : empty('لا يوجد طلاب في هذه الحلقة بعد.')}`);
}
document.addEventListener('click', e => { const b = e.target.closest('[data-hstu]'); if (b) halaqaStudents(byId(db.halaqat, b.dataset.hstu)); });
