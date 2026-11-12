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
      </div>
    </div>
    <fieldset class="tfs" data-c="child"><legend>خاص بالطالب</legend>
      <div class="two"><label>تاريخ الميلاد<input type="date" name="birth" value="${v('birth')}"></label><label>السن<input data-agec disabled></label></div>
      <div class="two"><label>الدراسة${sel('study', STUDY, I.study, '—')}</label><label>الصف الدراسي (وقت التقديم)<input name="grade" value="${v('grade')}"></label></div>
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
    <fieldset class="tfs"><legend>قرار الإدارة</legend>
      <label><span data-c="child">يلتحق الطالب بحلقة</span><span data-c="adult">يلتحق الأخ بحلقة</span>${sel('halaqaId', halaqaOpts().map(o => [o.v, o.l]), st.halaqaId, '— لم يُحدَّد بعد —')}</label>
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
    const c = cat(), ageN = +val('age');
    if (c === 'adult' && val('age') && !(ageN >= 5 && ageN <= 110)) { toast('السن غير صحيح'); return; }
    const info = { address: val('address'), phone: normPhone(val('sphone')), whatsapp: normPhone(val('whatsapp')), joinDate: val('joinDate'), fee: val('fee') === '' ? '' : +val('fee'), pledge: $('[name=pledge]').checked,
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
      ? row('تاريخ الميلاد', I.birth) + row('الدراسة', I.study) + row('الصف الدراسي', I.grade)
      : row('المؤهل الدراسي', [I.qual, I.qualStatus].filter(Boolean).join(' — ')) + row('الحالة الاجتماعية', I.marital) + row('الوظيفة الحالية', I.job) + row('الوقت المتاح للحضور', I.avail))}
    ${sec('العنوان والتواصل', row('العنوان', I.address) + telRow('رقم الهاتف', I.phone, I.whatsapp))}
    ${child ? sec('خاص بولي الأمر', row('اسم ولي الأمر', I.gName) + telRow('رقم الهاتف', I.gPhone, I.gWhatsapp) + row('الوظيفة', I.gJob) + row('صلة القرابة', I.gRel === 'شخص آخر' ? (I.gRelOther || 'شخص آخر') : I.gRel)) : ''}
    ${sec('اختبار تحديد مستوى', row('قراءة', T.read) + row('تجويد', T.tajweed) + row('حفظ', T.hifz))}
    ${sec('قرار الإدارة', row(child ? 'يلتحق الطالب بحلقة' : 'يلتحق الأخ بحلقة', h ? halaqaLabel(h) : '') + row('بدار', placeName(h)) + row('وقت الحلقة', timeText(h)) + row('تحرر يوم', I.joinDate) + row('الاشتراك الشهري', I.fee === '' || I.fee == null ? '' : I.fee + ' جنيه') + row('التوقيع على التنبيهات', I.pledge ? (child ? 'وقّع ولي الأمر' : 'وقّع المتقدم') : 'لم يوقّع بعد'))}
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

