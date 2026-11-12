/* ============ نظام المرتبات ============
   كل الشهور وكل السنوات في جدول حركة واحد (db.payroll.rows)، والكشوف تُعرض باختيار السنة والشهر.
   عناصر الراتب تُحفظ بقيمتها في صف كل شهر، فتعديل بطاقة الموظف لا يغيّر الشهور السابقة. */
(() => {
'use strict';
const DEF = { perm: 20, noperm: 30, mperm: 50, mnoperm: 70, round: 5, lv3: 10, lv6: 21, hours: 26, pin: '' };
const ROLES = ['معلم', 'معلم مجيز', 'مساعد', 'مشرف', 'مشرف دار', 'مشرف عام', 'إداري'];
const SYS = ['(3) أيام', '(6) أيام'];
/* حقول الإدخال الشهرية: [المفتاح، العنوان، المجموعة] */
const IN = [
  ['base', 'أساسية', 'h'], ['extra', 'إضافية', 'h'], ['exc', 'استثنائية', 'h'],
  ['absP', 'بإذن', 'a'], ['absN', 'بدون إذن', 'a'], ['mtgP', 'اجتماع بإذن', 'a'], ['mtgN', 'اجتماع بغير إذن', 'a'],
  ['dTest', 'اختبار التطوير', 'd'], ['dRec', 'التسميع', 'd'], ['dBooks', 'الدفاتر', 'd'],
  ['basic', 'الأساسي', 's'], ['rate', 'سعر ساعة الإضافي', 's'], ['incentive', 'الحافز', 's'], ['transport', 'بدل الانتقال', 's']
];
const GROUPS = [['h', 'الساعات'], ['a', 'الغياب (ساعات / مرات)'], ['d', 'خصومات'], ['s', 'عناصر الراتب']];
const st = { sub: 'month', y: null, m: null, am: 0, unlocked: false };
/* نموذج غياب المعلمين (على غرار نموذج Google): حالته وفلتر القائمة */
const REASONS = ['مرض', 'امتحانات', 'البلد', 'سفر', 'غير محدد'];
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const ab = { y: null, m: null, draft: {} };
const dayName = d => { const x = new Date(String(d) + 'T00:00:00'); return isNaN(x) ? '' : DAYS[x.getDay()]; };
const Q = () => window.QL;
const num = v => +v || 0;
const fmt = v => (v ? Math.round(v).toLocaleString('en-US') : '—');
const key = (y, m) => y + '-' + m;

function P() {
  const db = Q().db;
  if (!db.payroll || typeof db.payroll !== 'object') db.payroll = {};
  const p = db.payroll;
  p.settings = { ...DEF, ...(p.settings || {}) };
  ['employees', 'rows', 'absences', 'closed'].forEach(k => { if (!Array.isArray(p[k])) p[k] = []; });
  return p;
}
/* نفس معادلات ملف الرواتب: الخصم بالساعة وبالمرة، والتقريب لأقرب (5) */
function calc(r) {
  const s = P().settings;
  const ot = num(r.extra) + num(r.exc), total = num(r.base) + ot, actual = total - num(r.absP) - num(r.absN);
  const otAmt = Math.round(ot * num(r.rate));
  const absDed = Math.round(num(r.absP) * s.perm + num(r.absN) * s.noperm) + num(r.mtgP) * s.mperm + num(r.mtgN) * s.mnoperm;
  const ded = absDed + num(r.dTest) + num(r.dRec) + num(r.dBooks);
  const net = Math.round((num(r.basic) + otAmt + num(r.incentive) + num(r.transport) - ded) / (num(s.round) || 1)) * (num(s.round) || 1);
  return { ot, total, actual, otAmt, ded, net };
}
const monthRows = (y, m) => P().rows.filter(r => r.y === y && r.m === m);
const isClosed = (y, m) => P().closed.includes(key(y, m));
const emp = id => P().employees.find(e => e.id === id);
function years() {
  const ys = new Set(P().rows.map(r => r.y));
  const now = new Date().getFullYear(); ys.add(now);
  ys.add(Math.max(...ys) + 1);
  return [...ys].sort((a, b) => b - a);
}
function defaults() {
  if (st.y != null) return;
  const rs = P().rows;
  if (rs.length) { const l = rs.reduce((a, r) => (r.y * 100 + r.m > a.y * 100 + a.m ? r : a)); st.y = l.y; st.m = l.m; }
  else { st.y = new Date().getFullYear(); st.m = 1; }
}
const ySel = () => `<select data-pay="y" aria-label="السنة">${years().map(y => `<option value="${y}" ${y === st.y ? 'selected' : ''}>${y}</option>`).join('')}</select>`;
const mSel = (all) => `<select data-pay="${all ? 'am' : 'm'}" aria-label="الشهر">${all ? `<option value="0" ${!st.am ? 'selected' : ''}>كل الشهور</option>` : ''}${Array.from({ length: 12 }, (_, i) => i + 1).map(m => `<option value="${m}" ${m === (all ? st.am : st.m) ? 'selected' : ''}>شهر (${m})</option>`).join('')}</select>`;

/* ============ الواجهات ============ */
const V = {
  month() {
    const { esc, empty } = Q(), rows = monthRows(st.y, st.m), closed = isClosed(st.y, st.m);
    const tot = rows.reduce((a, r) => a + calc(r).net, 0);
    const bar1 = `<div class="bar">${ySel()}${mSel()}<span class="grow"></span>${rows.length ? `<span class="tag">${rows.length} موظف</span><span class="tag">الإجمالي: <b data-pay-total>${fmt(tot)}</b></span>${closed ? '<span class="tag lock">مغلق</span>' : ''}` : ''}</div>`;
    const bar2 = `<div class="bar">${!rows.length ? '<button class="btn primary" data-act="payCreate">إنشاء الشهر من الموظفين النشطين</button>'
      : closed ? '<button class="btn" data-act="payReopen">إعادة فتح الشهر</button>'
      : '<button class="btn" data-act="payAddRow">+ موظف لهذا الشهر</button><button class="btn primary" data-act="payClose">إغلاق الشهر</button><button class="btn danger" data-act="payDelMonth">حذف الشهر</button>'}${rows.length ? '<button class="btn" data-act="payPrint">طباعة الكشف</button>' : ''}</div>`;
    if (!rows.length) return `<div class="card">${bar1}${bar2}${empty('لا يوجد كشف لهذا الشهر بعد. «إنشاء الشهر» يجهّز صفًا لكل موظف نشط بأسعاره الحالية، وينقل الساعات الإضافية من الشهر السابق.')}</div>`;
    const g1 = GROUPS.map(([g, l]) => `<th colspan="${IN.filter(x => x[2] === g).length}">${l}</th>`).join('');
    const g2 = IN.map(([, l]) => `<th>${l}</th>`).join('');
    const tr = rows.map((r, i) => {
      const c = calc(r);
      return `<tr data-row="${esc(r.id)}"><td>${i + 1}</td><td class="nm">${esc(r.name)}</td><td>${esc(r.role || '')}</td>${IN.map(([f]) => `<td>${closed ? fmt(r[f]) : `<input class="num" type="number" step="any" inputmode="decimal" data-pay="cell" data-r="${esc(r.id)}" data-f="${f}" value="${r[f] ?? ''}">`}</td>`).join('')}<td data-o="actual">${fmt(c.actual)}</td><td data-o="otAmt">${fmt(c.otAmt)}</td><td data-o="ded">${fmt(c.ded)}</td><td data-o="net" class="net">${fmt(c.net)}</td><td class="noprint">${closed ? '' : `<button class="btn sm danger" data-act="payDelRow" data-id="${esc(r.id)}" title="حذف الصف">×</button>`}</td></tr>`;
    }).join('');
    return `<div class="card">${bar1}${bar2}
      <h2 class="print-only">كشف رواتب معلمي القرآن الكريم - شهر (${st.m}) ${st.y}</h2>
      ${closed ? '' : '<div class="note noprint">الخلايا قابلة للتعديل والراتب يُحسب فورًا. الخصومات تُكتب مبالغ موجبة. «إغلاق الشهر» يمنع التعديل ويحفظه في الأرشيف.</div>'}
      <div class="tbl paytbl"><table><tr><th rowspan="2">م</th><th rowspan="2">الاسم</th><th rowspan="2">الوظيفة</th>${g1}<th colspan="4">النتيجة</th><th rowspan="2" class="noprint"></th></tr>
      <tr>${g2}<th>الساعات الفعلية</th><th>مبلغ الإضافي</th><th>إجمالي الخصم</th><th>الراتب</th></tr>${tr}
      <tr class="sum"><td colspan="${3 + IN.length + 3}">الإجمالي</td><td data-pay-total>${fmt(tot)}</td><td class="noprint"></td></tr></table></div></div>`;
  },
  emps() {
    const { esc, empty } = Q(), p = P();
    const rows = p.employees.map(e => `<tr><td>${esc(e.code || '')}</td><td>${esc(e.name)}</td><td>${esc(e.role || '')}</td><td>${esc(e.sys || '—')}</td><td>${e.status === 'متوقف' ? '<span class="tag">متوقف</span>' : 'نشط'}</td><td>${fmt(e.basic)}</td><td>${fmt(e.rate)}</td><td>${fmt(e.incentive)}</td><td>${fmt(e.transport)}</td><td>${fmt(e.hours)}</td><td><button class="btn sm" data-act="payEditEmp" data-id="${esc(e.id)}">تعديل</button><button class="btn sm danger" data-act="payDelEmp" data-id="${esc(e.id)}">حذف</button></td></tr>`).join('');
    return `<div class="card"><div class="bar"><h2 class="grow" style="margin:0">موظفو المرتبات (${p.employees.length})</h2><button class="btn primary" data-act="payAddEmp">+ موظف</button></div>
      <div class="note">هذه هي الأسعار الحالية. تُنسخ إلى الشهر عند إنشائه وتبقى ثابتة فيه، فالزيادة الجديدة لا تغيّر الشهور السابقة.</div>
      <div class="bar"><label class="btn" style="margin:0">استيراد الموظفين من ملف الرواتب (Excel)<input type="file" accept=".xlsx" data-pay="importXlsx" hidden></label><span class="muted" style="font-size:.85rem">الأسماء من شيت «خلاصة»، والتفاصيل (الوظيفة والأساسي وسعر الإضافي والحافز والبدل) من «رواتب»، ونظام العمل من «تقرير».</span></div>
      ${p.employees.length ? `<div class="tbl"><table><tr><th>الكود</th><th>الاسم</th><th>الوظيفة</th><th>نظام العمل</th><th>الحالة</th><th>الأساسي</th><th>سعر الإضافي</th><th>الحافز</th><th>البدل</th><th>الساعات</th><th></th></tr>${rows}</table></div>` : empty('لا يوجد موظفون. أضفهم يدويًا أو استورد بيانات المرتبات من «إعدادات المرتبات».')}</div>`;
  },
  year() {
    const { esc, empty } = Q(), rs = P().rows.filter(r => r.y === st.y);
    const by = new Map();
    rs.forEach(r => { if (!by.has(r.eid)) by.set(r.eid, { name: emp(r.eid)?.name || r.name, code: emp(r.eid)?.code || '', m: {} }); const o = by.get(r.eid); o.m[r.m] = (o.m[r.m] || 0) + calc(r).net; });
    const list = [...by.values()].sort((a, b) => String(a.code).localeCompare(String(b.code)));
    const mt = Array.from({ length: 12 }, (_, i) => list.reduce((a, o) => a + (o.m[i + 1] || 0), 0));
    const head = Array.from({ length: 12 }, (_, i) => `<th><button class="lnk" data-act="payOpenMonth" data-y="${st.y}" data-m="${i + 1}">${i + 1}</button></th>`).join('');
    return `<div class="card"><div class="bar">${ySel()}<span class="grow"></span><span class="tag">إجمالي السنة: <b>${fmt(mt.reduce((a, b) => a + b, 0))}</b></span></div>
      ${list.length ? `<div class="tbl"><table><tr><th>الكود</th><th>الاسم</th>${head}<th>الإجمالي</th></tr>
      ${list.map(o => `<tr><td>${esc(o.code)}</td><td class="nm">${esc(o.name)}</td>${Array.from({ length: 12 }, (_, i) => `<td>${fmt(o.m[i + 1])}</td>`).join('')}<td class="net">${fmt(Object.values(o.m).reduce((a, b) => a + b, 0))}</td></tr>`).join('')}
      <tr class="sum"><td colspan="2">الإجمالي</td>${mt.map(v => `<td>${fmt(v)}</td>`).join('')}<td>${fmt(mt.reduce((a, b) => a + b, 0))}</td></tr></table></div>` : empty('لا توجد رواتب مسجلة في هذه السنة.')}</div>`;
  },
  archive() {
    const { empty } = Q(), rs = P().rows;
    const ys = [...new Set(rs.map(r => r.y))].sort((a, b) => b - a);
    const cell = (y, m) => { const t = monthRows(y, m).reduce((a, r) => a + calc(r).net, 0); return t ? `<button class="lnk" data-act="payOpenMonth" data-y="${y}" data-m="${m}">${fmt(t)}</button>${isClosed(y, m) ? '' : ' <small class="muted">(مفتوح)</small>'}` : '—'; };
    return `<div class="card"><h2>أرشيف السنوات</h2><div class="note">كل السنوات محفوظة في نفس السجل. اضغط على أي مبلغ لفتح كشف ذلك الشهر، أو على السنة لملخصها.</div>
      ${ys.length ? `<div class="tbl"><table><tr><th>السنة</th>${Array.from({ length: 12 }, (_, i) => `<th>شهر ${i + 1}</th>`).join('')}<th>الإجمالي</th><th>أشهر</th></tr>
      ${ys.map(y => { const yr = rs.filter(r => r.y === y); return `<tr><td><button class="lnk" data-act="payOpenYear" data-y="${y}"><b>${y}</b></button></td>${Array.from({ length: 12 }, (_, i) => `<td>${cell(y, i + 1)}</td>`).join('')}<td class="net">${fmt(yr.reduce((a, r) => a + calc(r).net, 0))}</td><td>${new Set(yr.map(r => r.m)).size}</td></tr>`; }).join('')}</table></div>` : empty('لا توجد سنوات مؤرشفة بعد.')}</div>`;
  },
  abs() {
    const { esc, empty } = Q(), p = P(), s = p.settings;
    const list = p.absences.filter(a => a.y === st.y && (!st.am || a.m === st.am)).slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    const yr = p.absences.filter(a => a.y === st.y);
    const ids = new Set([...p.employees.filter(e => e.status !== 'متوقف').map(e => e.id), ...yr.map(a => a.eid)]);
    const bal = [...ids].map(id => { const e = emp(id) || {}; const mine = yr.filter(a => a.eid === id); const b = e.sys === '(6) أيام' ? s.lv6 : e.sys === '(3) أيام' ? s.lv3 : null; const used = mine.filter(a => a.proof === 'رصيد').length; return { e, b, used, rest: b == null ? null : b - used, proven: mine.filter(a => a.proof === 'مثبت').length, n: mine.length }; }).filter(x => x.e.name).sort((a, b) => b.n - a.n);
    return `<div class="card"><div class="bar">${ySel()}${mSel(true)}<span class="grow"></span><button class="btn primary" data-act="tab" data-v="absence">+ تسجيل غياب</button></div>
      ${list.length ? `<div class="tbl" style="max-height:420px;overflow-y:auto"><table><tr><th>التاريخ</th><th>شهر المرتب</th><th>الاسم</th><th>المكان</th><th>الإذن</th><th>السبب</th><th>الإثبات</th><th></th></tr>
      ${list.map(a => `<tr><td>${esc(a.date || '—')}</td><td>${a.m}</td><td>${esc(emp(a.eid)?.name || a.name || '')}</td><td>${esc(a.place || '')}</td><td>${esc(a.perm || '')}</td><td>${esc(a.reason || '')}</td><td>${esc(a.proof || '')}</td><td><button class="btn sm danger" data-act="payDelAbs" data-id="${esc(a.id)}">×</button></td></tr>`).join('')}</table></div>` : empty('لا يوجد غياب مسجل في هذه الفترة.')}</div>
      <div class="card"><h2>رصيد الإجازات — ${st.y}</h2><div class="tbl"><table><tr><th>الاسم</th><th>نظام العمل</th><th>الرصيد</th><th>المخصوم</th><th>المتبقي</th><th>مثبت</th><th>إجمالي الغياب</th></tr>
      ${bal.map(x => `<tr><td class="nm">${esc(x.e.name)}</td><td>${esc(x.e.sys || '—')}</td><td>${x.b ?? '—'}</td><td>${x.used}</td><td class="net">${x.rest ?? '—'}</td><td>${x.proven}</td><td>${x.n}</td></tr>`).join('')}</table></div></div>`;
  },
  set() {
    const s = P().settings, p = P();
    const rows = [['perm', 'خصم ساعة الغياب بإذن'], ['noperm', 'خصم ساعة الغياب بدون إذن'], ['mperm', 'خصم غياب الاجتماع بإذن (للمرة)'], ['mnoperm', 'خصم غياب الاجتماع بغير إذن (للمرة)'], ['round', 'تقريب الراتب لأقرب'], ['lv3', 'رصيد إجازات نظام (3) أيام'], ['lv6', 'رصيد إجازات نظام (6) أيام'], ['hours', 'الساعات الأساسية الافتراضية']];
    return `<div class="card"><div class="bar"><h2 class="grow" style="margin:0">قواعد الحساب</h2><button class="btn primary" data-act="paySet">تعديل</button></div>
      <div class="tbl"><table>${rows.map(([k, l]) => `<tr><th style="width:55%">${l}</th><td>${s[k]}</td></tr>`).join('')}<tr><th>رمز قسم المرتبات</th><td>${s.pin ? 'مفعّل' : 'غير مفعّل'}</td></tr></table></div>
      <div class="note" style="margin-top:1rem">تغيير القواعد يعيد حساب الشهور المفتوحة والمغلقة معًا؛ لذلك لا تغيّرها إلا عند بدء العمل بقاعدة جديدة.</div></div>
      <div class="card"><h2>نقل البيانات</h2><div class="bar">
      <label class="btn" style="margin:0">استيراد بيانات المرتبات (JSON)<input type="file" accept="application/json,.json" data-pay="import" hidden></label>
      <button class="btn" data-act="payExport">تصدير بيانات المرتبات</button></div>
      <p class="muted" style="margin:0">المسجل حاليًا: ${p.employees.length} موظف، ${p.rows.length} صف رواتب، ${p.absences.length} يوم غياب. النسخة الاحتياطية العامة في «الإعدادات» تشمل المرتبات أيضًا.</p></div>`;
  }
};

function view() {
  const p = P();
  if (p.settings.pin && !st.unlocked) {
    return `<div class="card" style="max-width:380px;margin:2rem auto"><h2>قسم المرتبات</h2><p class="muted">هذا القسم محمي برمز خاص.</p><label>الرمز<input type="password" id="paypin" inputmode="numeric" autocomplete="off"></label><button class="btn primary" style="width:100%" data-act="payUnlock">فتح</button></div>`;
  }
  defaults();
  const subs = [['month', 'كشف الشهر'], ['emps', 'الموظفون'], ['year', 'ملخص السنة'], ['archive', 'الأرشيف'], ['abs', 'الغياب والإجازات'], ['set', 'إعدادات المرتبات']];
  return `<div class="card noprint" style="padding:.6rem 1rem"><div class="bar" style="margin:0">${subs.map(([k, l]) => `<button class="btn ${k === st.sub ? 'on' : ''}" data-act="paySub" data-v="${k}">${l}</button>`).join('')}</div></div>${(V[st.sub] || V.month)()}`;
}

/* ============ غياب المعلمين ============ */
/* شهر المرتب الافتراضي: آخر شهر مفتوح في المرتبات، وإلا شهر التاريخ نفسه */
function payMonthFor(date) {
  const p = P();
  if (!p.rows.length && p.curMonth?.y) return { y: p.curMonth.y, m: p.curMonth.m };
  const open = [...new Set(p.rows.map(r => key(r.y, r.m)))].filter(k => !p.closed.includes(k)).map(k => k.split('-').map(Number)).sort((a, b) => (b[0] * 100 + b[1]) - (a[0] * 100 + a[1]))[0];
  if (open) return { y: open[0], m: open[1] };
  const d = new Date(String(date || Q().today()) + 'T00:00:00');
  return { y: d.getFullYear(), m: d.getMonth() + 1 };
}
function absView() {
  const { esc, empty, today } = Q(), p = P(), role = Q().session?.role, isAdmin = role === 'admin';
  const emps = p.employees.filter(e => e.status !== 'متوقف').slice().sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  const dm = payMonthFor(today());
  if (ab.y == null) { ab.y = dm.y; ab.m = dm.m; }
  const D = ab.draft;
  const places = [...new Set([...Q().placeNames(), ...p.employees.map(e => e.place).filter(Boolean), ...p.absences.map(a => a.place).filter(Boolean)])].sort((a, b) => a.localeCompare(b, 'ar'));
  const chip = (name, v, cur) => `<label class="chip-r"><input type="radio" name="${name}" value="${esc(v)}" ${cur === v ? 'checked' : ''}><span>${esc(v)}</span></label>`;
  const form = !emps.length ? `<div class="card">${empty(isAdmin ? 'لا يوجد معلمون في سجل الموظفين. أضفهم من «المرتبات ← الموظفون».' : 'لا يوجد معلمون مسجلون بعد. تواصل مع الإدارة.')}</div>` : `
  <div class="card absform" id="absform"><h2>تسجيل غياب معلم</h2>
    <fieldset class="tfs"><legend>بيانات الغياب</legend>
      <label>اسم المعلم <b class="req">*</b><select name="eid" data-pay="absEmp"><option value="">— اختر —</option>${emps.map(e => `<option value="${esc(e.id)}" ${D.eid === e.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select></label>
      <div class="two"><label>اليوم <b class="req">*</b><input type="date" name="date" value="${esc(D.date || today())}" data-pay="absDate"></label><label>شهر المرتب<select name="pm">${Array.from({ length: 12 }, (_, i) => i + 1).map(m => `<option value="${m}" ${m === (D.pm || dm.m) ? 'selected' : ''}>شهر (${m}) ${D.py || dm.y}</option>`).join('')}</select></label></div>
      <p class="muted daynm" style="margin:-.4rem 0 .7rem;font-size:.85rem">${esc(dayName(D.date || today()))}</p>
      <label>مكان الحلقة <b class="req">*</b><select name="place" data-pay="absPlace"><option value="">— اختر —</option>${places.map(x => `<option ${D.place === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}<option value="__other" ${D.place === '__other' ? 'selected' : ''}>مكان آخر…</option></select></label>
      <label data-other-place ${D.place === '__other' ? '' : 'hidden'}>اكتب المكان<input name="placeOther" value="${esc(D.placeOther || '')}"></label>
    </fieldset>
    <fieldset class="tfs"><legend>الإذن والسبب</legend>
      <div class="lbl-s">الإذن</div><div class="chips">${['بإذن', 'بغير إذن'].map(v => chip('perm', v, D.perm)).join('')}<button type="button" class="btn sm" data-act="absClearPerm">مسح الاختيار</button></div>
      <div class="lbl-s">السبب <b class="req">*</b></div><div class="chips">${[...REASONS, 'أخرى'].map(v => chip('reason', v, D.reason)).join('')}</div>
      <label data-other-reason ${D.reason === 'أخرى' ? '' : 'hidden'}>اكتب السبب<input name="reasonOther" value="${esc(D.reasonOther || '')}"></label>
      <label>ملاحظات <span class="muted">(اختياري)</span><textarea name="note" rows="2">${esc(D.note || '')}</textarea></label>
      ${isAdmin ? `<label>الإثبات <span class="muted">(للإدارة)</span><select name="proof"><option value="">— لاحقًا —</option><option ${D.proof === 'رصيد' ? 'selected' : ''}>رصيد</option><option ${D.proof === 'مثبت' ? 'selected' : ''}>مثبت</option></select></label>` : ''}
    </fieldset>
    <div class="row"><button type="button" class="btn primary" data-act="absSubmit">تسجيل الغياب</button><button type="button" class="btn" data-act="absReset">مسح النموذج</button></div>
  </div>`;
  const list = p.absences.filter(a => a.y === ab.y && a.m === ab.m).slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.ts || '').localeCompare(String(a.ts || '')));
  const myName = Q().me()?.name, myId = Q().session?.id;
  const by = new Map();
  list.forEach(a => { const k = a.eid; if (!by.has(k)) by.set(k, { name: emp(k)?.name || a.name, n: 0, p: 0, np: 0 }); const o = by.get(k); o.n++; if (a.perm === 'بإذن') o.p++; if (a.perm === 'بغير إذن') o.np++; });
  const sum = [...by.values()].sort((a, b) => b.n - a.n);
  const ys = [...new Set([ab.y, ...p.absences.map(a => a.y), new Date().getFullYear()])].sort((a, b) => b - a);
  return `<div class="abs-grid">${form}
  <div class="card"><div class="bar"><h2 class="grow" style="margin:0">سجل الغياب</h2>
    <select data-pay="abY">${ys.map(y => `<option ${y === ab.y ? 'selected' : ''}>${y}</option>`).join('')}</select>
    <select data-pay="abM">${Array.from({ length: 12 }, (_, i) => i + 1).map(m => `<option value="${m}" ${m === ab.m ? 'selected' : ''}>شهر (${m})</option>`).join('')}</select>
    <span class="tag">${list.length} يوم</span></div>
    ${list.length ? `<div class="tbl" style="max-height:520px;overflow-y:auto"><table><tr><th>اليوم</th><th>المعلم</th><th>المكان</th><th>الإذن</th><th>السبب</th>${isAdmin ? '<th>الإثبات</th>' : ''}<th>ملاحظات</th><th></th></tr>
    ${list.map(a => `<tr><td><b>${esc(dayName(a.date))}</b><br><small class="muted" dir="ltr">${esc(a.date || '—')}</small></td><td>${esc(emp(a.eid)?.name || a.name || '')}</td><td>${esc(a.place || '—')}</td><td>${a.perm ? `<span class="tag ${a.perm === 'بإذن' ? 'tag-ok' : 'tag-no'}">${esc(a.perm)}</span>` : '—'}</td><td>${esc(a.reason || '—')}</td>${isAdmin ? `<td><select class="mini" data-pay="absProof" data-id="${esc(a.id)}"><option value="">—</option><option ${a.proof === 'رصيد' ? 'selected' : ''}>رصيد</option><option ${a.proof === 'مثبت' ? 'selected' : ''}>مثبت</option></select></td>` : ''}<td>${esc(a.note || '')}${a.by ? `<br><small class="muted">سجّله: ${esc(a.by)}</small>` : ''}</td><td>${isAdmin || (a.byMember ? a.byMember === myId : a.by && a.by === myName) ? `<button class="btn sm danger" data-act="payDelAbs" data-id="${esc(a.id)}">×</button>` : ''}</td></tr>`).join('')}</table></div>` : empty('لا يوجد غياب مسجل في هذا الشهر.')}
    ${sum.length ? `<h3 class="sc-h">ملخص الشهر</h3><div class="tbl"><table><tr><th>المعلم</th><th>أيام الغياب</th><th>بإذن</th><th>بغير إذن</th></tr>${sum.map(o => `<tr><td>${esc(o.name)}</td><td class="net">${o.n}</td><td>${o.p}</td><td>${o.np}</td></tr>`).join('')}</table></div>` : ''}
  </div></div>`;
}
/* قراءة حقول النموذج إلى المسودة حتى لا تضيع عند إعادة الرسم */
function absRead() {
  const f = document.getElementById('absform'); if (!f) return ab.draft;
  const v = n => (f.querySelector(`[name=${n}]`)?.value ?? '').trim(), r = n => f.querySelector(`[name=${n}]:checked`)?.value || '';
  ab.draft = { eid: v('eid'), date: v('date'), pm: +v('pm') || null, place: v('place'), placeOther: v('placeOther'), perm: r('perm'), reason: r('reason'), reasonOther: v('reasonOther'), note: v('note'), proof: v('proof') };
  return ab.draft;
}

/* ============ الإجراءات ============ */
const empOpts = list => list.map(e => ({ v: e.id, l: (e.code ? e.code + ' — ' : '') + e.name }));
function empForm(e) {
  const { openForm, uid } = Q(), p = P(), isNew = !e;
  e = e || { id: uid(), code: 'م' + String(p.employees.length + 1).padStart(3, '0'), status: 'نشط', hours: p.settings.hours, role: 'معلم' };
  openForm(isNew ? 'موظف جديد' : 'تعديل: ' + e.name, [
    { name: 'code', label: 'الكود', value: e.code }, { name: 'name', label: 'الاسم', value: e.name || '', required: true },
    { name: 'role', label: 'الوظيفة', type: 'select', value: e.role, options: ROLES.map(x => ({ v: x, l: x })) },
    { name: 'sys', label: 'نظام العمل', type: 'select', value: e.sys || '', options: [{ v: '', l: '—' }, ...SYS.map(x => ({ v: x, l: x }))] },
    { name: 'status', label: 'الحالة', type: 'select', value: e.status, options: [{ v: 'نشط', l: 'نشط' }, { v: 'متوقف', l: 'متوقف' }] },
    { name: 'basic', label: 'الأساسي', type: 'number', value: e.basic ?? '' }, { name: 'rate', label: 'سعر ساعة الإضافي', type: 'number', value: e.rate ?? '' },
    { name: 'incentive', label: 'الحافز', type: 'number', value: e.incentive ?? '' }, { name: 'transport', label: 'بدل الانتقال', type: 'number', value: e.transport ?? '' },
    { name: 'hours', label: 'الساعات الأساسية', type: 'number', value: e.hours ?? '' }, { name: 'place', label: 'مكان العمل', value: e.place || '' },
    { name: 'note', label: 'ملاحظات', type: 'textarea', value: e.note || '' }
  ], v => {
    const name = v.name.trim();
    if (p.employees.some(x => x.id !== e.id && Q().norm(x.name) === Q().norm(name))) return 'يوجد موظف بالاسم نفسه';
    Object.assign(e, { code: v.code.trim(), name, role: v.role, sys: v.sys, status: v.status, place: v.place.trim(), note: v.note.trim() });
    ['basic', 'rate', 'incentive', 'transport', 'hours'].forEach(k => { e[k] = v[k] === '' ? null : +v[k]; });
    if (isNew) p.employees.push(e);
  });
}
function rowFrom(e, y, m, prev) {
  const s = P().settings, pr = prev && prev.find(r => r.eid === e.id);
  return { id: Q().uid(), y, m, eid: e.id, name: e.name, role: e.role, base: e.hours ?? s.hours, extra: pr ? pr.extra : null, exc: null, absP: null, absN: null, mtgP: null, mtgN: null, dTest: null, dRec: null, dBooks: null, basic: e.basic || 0, rate: e.rate || 0, incentive: e.incentive || 0, transport: e.transport || 0, note: '' };
}
function prevMonthRows(y, m) {
  const before = P().rows.filter(r => r.y * 100 + r.m < y * 100 + m);
  if (!before.length) return null;
  const l = before.reduce((a, r) => (r.y * 100 + r.m > a.y * 100 + a.m ? r : a));
  return monthRows(l.y, l.m);
}
const act = {
  paySub: d => { st.sub = d.v; Q().render(); },
  payUnlock: () => { const v = document.getElementById('paypin')?.value; if (v === P().settings.pin) { st.unlocked = true; Q().render(); } else Q().toast('الرمز غير صحيح'); },
  payOpenMonth: d => { st.y = +d.y; st.m = +d.m; st.sub = 'month'; Q().render(); },
  payOpenYear: d => { st.y = +d.y; st.sub = 'year'; Q().render(); },
  payCreate: () => {
    const p = P(), act = p.employees.filter(e => e.status !== 'متوقف');
    if (!act.length) { Q().toast('لا يوجد موظفون نشطون. أضفهم من «الموظفون»'); return; }
    const prev = prevMonthRows(st.y, st.m);
    act.forEach(e => p.rows.push(rowFrom(e, st.y, st.m, prev)));
    Q().save(); Q().render(); Q().toast(`تم إنشاء شهر (${st.m}) ${st.y} لـ ${act.length} موظف`);
  },
  payAddRow: () => {
    const p = P(), have = new Set(monthRows(st.y, st.m).map(r => r.eid)), list = p.employees.filter(e => !have.has(e.id));
    if (!list.length) { Q().toast('كل الموظفين موجودون في هذا الشهر'); return; }
    Q().openForm('إضافة موظف لشهر (' + st.m + ')', [{ name: 'eid', label: 'الموظف', type: 'select', options: empOpts(list) }], v => { p.rows.push(rowFrom(emp(v.eid), st.y, st.m, prevMonthRows(st.y, st.m))); });
  },
  payDelRow: d => Q().ask('حذف هذا الصف من الشهر؟', () => { const p = P(); p.rows = p.rows.filter(r => r.id !== d.id); Q().save(); Q().render(); }),
  payClose: () => Q().ask(`إغلاق شهر (${st.m}) ${st.y}؟ لن يمكن تعديله إلا بإعادة فتحه.`, () => { const p = P(), k = key(st.y, st.m); if (!p.closed.includes(k)) p.closed.push(k); Q().save(); Q().render(); }),
  payReopen: () => Q().ask('إعادة فتح الشهر للتعديل؟', () => { const p = P(); p.closed = p.closed.filter(k => k !== key(st.y, st.m)); Q().save(); Q().render(); }),
  payDelMonth: () => Q().ask(`حذف كشف شهر (${st.m}) ${st.y} بالكامل؟`, () => { const p = P(); p.rows = p.rows.filter(r => !(r.y === st.y && r.m === st.m)); Q().save(); Q().render(); }),
  payPrint: () => window.print(),
  payAddEmp: () => empForm(null),
  payEditEmp: d => empForm(emp(d.id)),
  payDelEmp: d => {
    const p = P();
    if (p.rows.some(r => r.eid === d.id)) { Q().toast('له رواتب مسجلة؛ اجعل حالته «متوقف» بدل الحذف'); return; }
    Q().ask('حذف الموظف؟', () => { p.employees = p.employees.filter(e => e.id !== d.id); Q().save(); Q().render(); });
  },
  payAddAbs: () => {
    const { openForm, uid, today } = Q(), p = P();
    openForm('تسجيل غياب', [
      { name: 'eid', label: 'الموظف', type: 'select', options: empOpts(p.employees.filter(e => e.status !== 'متوقف')) },
      { name: 'date', label: 'اليوم', type: 'date', value: today(), required: true },
      { name: 'm', label: 'شهر المرتب', type: 'select', value: st.am || st.m, options: Array.from({ length: 12 }, (_, i) => ({ v: i + 1, l: 'شهر (' + (i + 1) + ')' })) },
      { name: 'place', label: 'مكان الحلقة' },
      { name: 'perm', label: 'الإذن', type: 'select', options: [{ v: 'بإذن', l: 'بإذن' }, { v: 'بغير إذن', l: 'بغير إذن' }] },
      { name: 'reason', label: 'السبب' },
      { name: 'proof', label: 'الإثبات', type: 'select', options: [{ v: 'رصيد', l: 'رصيد (يُخصم من الإجازات)' }, { v: 'مثبت', l: 'مثبت' }] },
      { name: 'note', label: 'ملاحظات', type: 'textarea' }
    ], v => { const e = emp(v.eid); if (!e) return 'اختر الموظف'; p.absences.push({ id: uid(), y: st.y, m: +v.m, date: v.date, eid: e.id, name: e.name, place: v.place.trim(), perm: v.perm, reason: v.reason.trim(), proof: v.proof, note: v.note.trim() }); });
  },
  absSubmit: () => {
    const D = absRead(), p = P(), { toast, uid, today } = Q();
    const e = emp(D.eid);
    if (!e) { toast('اختر اسم المعلم'); return; }
    if (!D.date) { toast('حدّد اليوم'); return; }
    const place = D.place === '__other' ? D.placeOther : D.place;
    if (!place) { toast('اختر مكان الحلقة'); return; }
    const reason = D.reason === 'أخرى' ? D.reasonOther : D.reason;
    if (!reason) { toast(D.reason === 'أخرى' ? 'اكتب السبب' : 'اختر السبب'); return; }
    if (p.absences.some(a => a.eid === e.id && a.date === D.date)) { toast('غياب هذا المعلم في هذا اليوم مسجّل بالفعل'); return; }
    const pmY = payMonthFor(today()).y;
    p.absences.push({ id: uid(), y: pmY, m: D.pm || payMonthFor(D.date).m, date: D.date, eid: e.id, name: e.name, place, perm: D.perm, reason, proof: Q().session?.role === 'admin' ? D.proof : '', note: D.note, ts: new Date().toISOString(), by: Q().me()?.name || '', byMember: Q().session?.id || '' });
    ab.draft = { date: D.date, pm: D.pm, place: D.place, placeOther: D.placeOther };
    ab.y = pmY; ab.m = D.pm || ab.m;
    Q().save(); Q().render(); toast('تم تسجيل غياب ' + e.name);
  },
  absReset: () => { ab.draft = {}; Q().render(); },
  absClearPerm: () => { document.querySelectorAll('#absform [name=perm]').forEach(x => { x.checked = false; }); absRead(); },
  payDelAbs: d => Q().ask('حذف سجل الغياب؟', () => { const p = P(); p.absences = p.absences.filter(a => a.id !== d.id); Q().save(); Q().render(); }),
  paySet: () => {
    const s = P().settings, L = { perm: 'خصم ساعة الغياب بإذن', noperm: 'خصم ساعة الغياب بدون إذن', mperm: 'خصم غياب الاجتماع بإذن (للمرة)', mnoperm: 'خصم غياب الاجتماع بغير إذن (للمرة)', round: 'تقريب الراتب لأقرب', lv3: 'رصيد إجازات نظام (3) أيام', lv6: 'رصيد إجازات نظام (6) أيام', hours: 'الساعات الأساسية الافتراضية' };
    Q().openForm('قواعد الحساب', [...Object.entries(L).map(([k, l]) => ({ name: k, label: l, type: 'number', value: s[k], required: true })), { name: 'pin', label: 'رمز قسم المرتبات (اتركه فارغًا لإلغائه)', value: s.pin }],
      v => { Object.keys(L).forEach(k => { s[k] = +v[k]; }); if (!(s.round > 0)) return 'التقريب يجب أن يكون أكبر من صفر'; s.pin = v.pin.trim(); st.unlocked = true; });
  },
  payExport: () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ payroll: P() }, null, 1)], { type: 'application/json' }));
    a.download = `payroll-${Q().today()}.json`; a.click(); URL.revokeObjectURL(a.href);
  }
};

/* ============ الاستيراد من ملف الرواتب (Excel) ============ */
/* يقرأ شيتات بأسمائها مع قيمها المحسوبة ومعادلاتها (سعر الإضافي داخل معادلة كل موظف) */
async function readSheets(buf, names) {
  const get = await unzip(buf);
  const xml = s => new DOMParser().parseFromString(s, 'application/xml');
  const wbx = await get('xl/workbook.xml'); if (!wbx) throw new Error('xlsx');
  const rel = {}; for (const r of xml(await get('xl/_rels/workbook.xml.rels') || '<x/>').getElementsByTagName('Relationship')) rel[r.getAttribute('Id')] = r.getAttribute('Target');
  const shared = [], ssx = await get('xl/sharedStrings.xml');
  if (ssx) for (const si of xml(ssx).getElementsByTagName('si')) shared.push([...si.getElementsByTagName('t')].map(t => t.textContent).join(''));
  const out = {};
  for (const sh of xml(wbx).getElementsByTagName('sheet')) {
    const name = sh.getAttribute('name'); if (!names.includes(name)) continue;
    const t = rel[sh.getAttribute('r:id')] || ''; const path = t.startsWith('/') ? t.slice(1) : 'xl/' + t.replace(/^\.\//, '');
    const sx = await get(path); if (!sx) continue;
    const vals = {}, fs = {}, master = {}, follows = {};
    for (const c of xml(sx).getElementsByTagName('c')) {
      const ref = c.getAttribute('r'), tt = c.getAttribute('t'), ve = c.getElementsByTagName('v')[0];
      let v = ve ? ve.textContent : '';
      if (tt === 's') v = shared[+v] ?? ''; else if (tt === 'inlineStr') v = [...c.getElementsByTagName('t')].map(x => x.textContent).join('');
      vals[ref] = v;
      const fe = c.getElementsByTagName('f')[0]; if (!fe) continue;
      /* المعادلة المشتركة تُكتب مرة واحدة في أول خلية وتتكرر في باقي العمود */
      const si = fe.getAttribute('si');
      if (fe.textContent) { fs[ref] = fe.textContent; if (si != null) master[si] = fe.textContent; }
      else if (si != null) follows[ref] = si;
    }
    for (const [ref, si] of Object.entries(follows)) if (master[si]) fs[ref] = master[si];
    out[name] = { v: ref => String(vals[ref] ?? '').trim(), f: ref => fs[ref] || '' };
  }
  return out;
}
async function importPayrollXlsx(file) {
  const { norm, uid, toast, ask, save, render, esc } = Q(), p = P();
  const S = await readSheets(await file.arrayBuffer(), ['خلاصة', 'رواتب', 'تقرير']);
  const s = S['خلاصة'], r = S['رواتب'], t = S['تقرير'];
  if (!s) { toast('لم أجد شيت «خلاصة» في هذا الملف'); return; }
  const nn = v => (v === '' || v == null || isNaN(+v) ? null : +v);
  const det = new Map(), sys = new Map();
  if (r) for (let i = 3; i <= 500; i++) {
    const n = r.v('A' + i); if (!n) continue;
    const m = r.f('Q' + i).match(/\*\s*([\d.]+)/);
    det.set(norm(n), { role: r.v('B' + i), hours: nn(r.v('C' + i)), basic: nn(r.v('P' + i)), rate: m ? +m[1] : null, incentive: nn(r.v('R' + i)), transport: nn(r.v('S' + i)) });
  }
  if (t) for (let i = 3; i <= 500; i++) { const n = t.v('A' + i), c = t.v('C' + i); if (n && /\((3|6)\)/.test(c)) sys.set(norm(n), c.includes('6') ? '(6) أيام' : '(3) أيام'); }
  const list = [];
  for (let i = 3; i <= 500; i++) {
    const n = s.v('B' + i).replace(/\s+/g, ' ');
    if (!n || isNaN(+s.v('A' + i)) || list.some(x => norm(x.name) === norm(n))) continue;
    const d = det.get(norm(n)) || {};
    list.push({ name: n, role: d.role || '', sys: sys.get(norm(n)) || '', hours: d.hours ?? nn(s.v('C' + i)), basic: d.basic ?? null, rate: d.rate ?? null, incentive: d.incentive ?? nn(s.v('E' + i)), transport: d.transport ?? nn(s.v('F' + i)) });
  }
  if (!list.length) { toast('لم أجد أسماء في شيت «خلاصة»'); return; }
  const isNew = x => !p.employees.some(e => norm(e.name) === norm(x.name));
  const nNew = list.filter(isNew).length, nUpd = list.length - nNew;
  const missing = p.employees.filter(e => !list.some(x => norm(x.name) === norm(e.name)));
  ask(`استيراد ${list.length} موظفًا من شيت «خلاصة»: ${nNew} جديد، و${nUpd} موجود ستُحدَّث بياناته.${missing.length ? ` (${missing.length} موظف في التطبيق ليس في الشيت ولن يُمَس.)` : ''}`, () => {
    let code = p.employees.length;
    list.forEach(x => {
      const e = p.employees.find(y => norm(y.name) === norm(x.name));
      const vals = Object.fromEntries(Object.entries(x).filter(([k, v]) => v !== null && v !== '' && k !== 'name'));
      if (e) Object.assign(e, vals);
      else p.employees.push({ id: uid(), code: 'م' + String(++code).padStart(3, '0'), name: x.name, status: 'نشط', place: '', note: '', role: 'معلم', ...vals });
    });
    save(); render(); toast(`تم: ${nNew} جديد و${nUpd} محدَّث`);
  });
}

/* ============ أحداث الإدخال ============ */
function refreshRow(r) {
  const tr = document.querySelector(`tr[data-row="${CSS.escape(r.id)}"]`); if (!tr) return;
  const c = calc(r);
  ['actual', 'otAmt', 'ded', 'net'].forEach(k => { const td = tr.querySelector(`[data-o="${k}"]`); if (td) td.textContent = fmt(c[k]); });
  const tot = monthRows(r.y, r.m).reduce((a, x) => a + calc(x).net, 0);
  document.querySelectorAll('[data-pay-total]').forEach(el => { el.textContent = fmt(tot); });
}
function onInput(e) {
  const el = e.target;
  if (el.dataset.pay !== 'cell') return;
  const r = P().rows.find(x => x.id === el.dataset.r); if (!r || isClosed(r.y, r.m)) return;
  r[el.dataset.f] = el.value === '' ? null : +el.value;
  refreshRow(r);
}
function onChange(e) {
  const el = e.target, k = el.dataset.pay;
  if (k === 'cell') { onInput(e); Q().save(); return; }
  if (k === 'y') { st.y = +el.value; Q().render(); return; }
  if (k === 'm') { st.m = +el.value; Q().render(); return; }
  if (k === 'am') { st.am = +el.value; Q().render(); return; }
  if (k === 'abY') { absRead(); ab.y = +el.value; Q().render(); return; }
  if (k === 'abM') { absRead(); ab.m = +el.value; Q().render(); return; }
  if (k === 'absProof') { const a = P().absences.find(x => x.id === el.dataset.id); if (a) { a.proof = el.value; Q().save(); Q().toast('تم حفظ الإثبات'); } return; }
  if (k === 'absEmp') { absRead(); const e = emp(el.value), f = document.getElementById('absform'); if (e?.place && f) { const s = f.querySelector('[name=place]'); if ([...s.options].some(o => o.value === e.place)) { s.value = e.place; absRead(); } } return; }
  if (k === 'absPlace') { absRead(); const f = document.getElementById('absform'); f.querySelector('[data-other-place]').hidden = el.value !== '__other'; return; }
  if (k === 'absDate') { absRead(); const f = document.getElementById('absform'); f.querySelector('.daynm').textContent = dayName(el.value); return; }
  if (k === 'importXlsx') {
    const f = el.files[0]; el.value = ''; if (!f) return;
    const lb = el.closest('label'); lb?.classList.add('loading');
    importPayrollXlsx(f).catch(() => Q().toast('تعذّرت قراءة الملف — تأكد أنه ملف xlsx')).finally(() => lb?.classList.remove('loading'));
    return;
  }
  if (k === 'import') {
    const f = el.files[0]; el.value = ''; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const j = JSON.parse(rd.result), d = j.payroll || j;
        if (!Array.isArray(d.employees) || !Array.isArray(d.rows)) throw new Error('bad');
        /* غياب مكرر لنفس الموظف في نفس اليوم: يُكتفى بالأول (قاعدة البيانات لا تقبل التكرار) */
        const seenAbs = new Set(), dups = [];
        d.absences = (d.absences || []).filter(a => { if (!a.date) return true; const k2 = a.eid + '|' + a.date; if (seenAbs.has(k2)) { dups.push(a); return false; } seenAbs.add(k2); return true; });
        const dupNote = dups.length ? ` (تم تجاهل ${dups.length} غياب مكرر لنفس الموظف في نفس اليوم: ${dups.map(a => `${a.name || ''} ${a.date}`).join('، ')})` : '';
        Q().ask(`استيراد ${d.employees.length} موظف و${d.rows.length} صف رواتب و${d.absences.length} يوم غياب؟ ستُستبدل بيانات المرتبات الحالية.${dupNote}`, () => {
          Q().db.payroll = d; P(); st.y = null; st.sub = 'month'; Q().save(); Q().render(); Q().toast('تم استيراد بيانات المرتبات');
        });
      } catch (err) { Q().toast('ملف غير صالح'); }
    };
    rd.readAsText(f);
  }
}
/* إظهار خانة «أخرى» للسبب فور اختياره */
document.addEventListener('change', e => {
  if (e.target.name === 'reason' && e.target.closest('#absform')) { absRead(); document.querySelector('#absform [data-other-reason]').hidden = e.target.value !== 'أخرى'; }
  else if (e.target.name === 'perm' && e.target.closest('#absform')) absRead();
});
window.Payroll = { view, absView, act, onInput, onChange, calc };
})();
