'use strict';
/* ============ الاشتراكات: تحصيل اشتراكات الطلاب (للمدير) ============
   بحث حيّ في ثلاثة مربعات: اسم الطالب، أو بداية اسم الحلقة، أو بداية اسم المكان.
   تظهر النتائج أولًا بأول ومعها الحلقة والمكان والاشتراك الشهري وما دُفع عن الشهر المختار.
   كل دفعة سجلّ مستقل: الطالب، والشهر الذي تُدفع عنه، والمبلغ، والتاريخ، ومن حصّلها. */
(() => {
  const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const t0 = today();
  const st = { y: +t0.slice(0, 4), m: +t0.slice(5, 7), qs: '', qh: '', qp: '' };
  const MAX_ROWS = 300;

  TABS.admin.splice(TABS.admin.findIndex(t => t[0] === 'payroll') + 1, 0, ['fees', 'الاشتراكات']);
  TAB_ICONS.fees = svg('<rect x="2" y="6" width="20" height="13" rx="2"/><circle cx="12" cy="12.5" r="2.6"/><path d="M6 9.5v6M18 9.5v6"/>');
  adminViews.fees = () => view();

  const fees = () => (Array.isArray(db.fees) ? db.fees : (db.fees = []));
  const money = n => (Math.round((+n || 0) * 100) / 100).toLocaleString('en-US');
  const feeOf = s => { const v = s?.info?.fee; return v === '' || v == null || isNaN(+v) || +v <= 0 ? null : +v; };
  const halOf = s => byId(db.halaqat, s.halaqaId);
  const paidFor = (sid, y, m) => fees().filter(f => f.studentId === sid && +f.y === y && +f.m === m).reduce((a, f) => a + (+f.amount || 0), 0);
  /* «بداية الاسم»: يطابق أول الاسم أو أول أي كلمة فيه */
  const starts = (text, q) => norm(text).startsWith(q) || String(text || '').split(/\s+/).some(w => norm(w).startsWith(q));
  const monthOpts = (y, m) => {
    const out = [];
    for (let k = -12; k <= 2; k++) { const d = new Date(st.y, st.m - 1 + k, 1), yy = d.getFullYear(), mm = d.getMonth() + 1; out.push({ v: `${yy}-${mm}`, l: `${MONTHS[mm - 1]} ${yy}`, sel: yy === y && mm === m }); }
    return out;
  };
  const cloudMissing = () => CLOUD && window.Cloud?.feesReady === false;

  function filtered() {
    const qs = norm(st.qs), qh = norm(st.qh), qp = norm(st.qp);
    return db.students.filter(s => {
      if (qs && !norm(s.name).includes(qs)) return false;
      if (!qh && !qp) return true;
      const h = halOf(s); if (!h) return false;
      return (!qh || starts(halaqaLabel(h), qh)) && (!qp || starts(placeName(h), qp));
    }).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }
  function results() {
    const list = filtered();
    let expected = 0, got = 0, paidN = 0, partN = 0, noneN = 0;
    const row = (s, i) => {
      const fee = feeOf(s), paid = paidFor(s.id, st.y, st.m), h = halOf(s);
      const state = fee ? (paid >= fee ? '<span class="tag tag-ok">مسدَّد ✓</span>' : paid > 0 ? `<span class="tag">جزئي: باقٍ ${money(fee - paid)}</span>` : '<span class="tag tag-no">لم يُسدَّد</span>')
        : (paid > 0 ? '<span class="tag tag-ok">مدفوع</span>' : '<span class="muted">بلا اشتراك محدد</span>');
      const any = fees().some(f => f.studentId === s.id);
      return `<tr><td>${i + 1}</td><td>${esc(s.name)}</td><td>${h ? esc(halaqaLabel(h)) : '<span class="muted">—</span>'}</td><td>${h ? esc(placeName(h) || '—') : '<span class="muted">—</span>'}</td>
        <td>${fee ? money(fee) : '—'}</td><td>${paid ? money(paid) : '—'}</td><td>${state}</td>
        <td class="noprint"><button type="button" class="btn sm primary" data-fee-pay="${esc(s.id)}" ${cloudMissing() ? 'disabled' : ''}>تحصيل</button>${any ? `<button type="button" class="btn sm" data-fee-log="${esc(s.id)}">السجل</button>` : ''}</td></tr>`;
    };
    list.forEach(s => {
      const fee = feeOf(s), paid = paidFor(s.id, st.y, st.m); got += paid;
      if (fee) { expected += fee; if (paid >= fee) paidN++; else if (paid > 0) partN++; else noneN++; } else if (paid > 0) paidN++;
    });
    const stat = (v, l) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`;
    return `<div class="grid">${stat(money(got), 'المحصَّل في ' + MONTHS[st.m - 1])}${stat(money(expected), 'المتوقع')}${stat(paidN, 'مسدَّد')}${stat(partN, 'جزئي')}${stat(noneN, 'لم يُسدَّد')}</div>
      ${list.length ? `<div class="tbl"><table><tr><th>#</th><th>الطالب</th><th>الحلقة</th><th>المكان</th><th>الاشتراك</th><th>المدفوع</th><th>الحالة</th><th class="noprint"></th></tr>${list.slice(0, MAX_ROWS).map(row).join('')}</table></div>
        ${list.length > MAX_ROWS ? `<p class="muted">يظهر أول ${MAX_ROWS} من ${list.length} طالبًا؛ اكتب في مربعات البحث للتضييق.</p>` : ''}`
        : empty(st.qs || st.qh || st.qp ? 'لا توجد نتائج مطابقة.' : 'لا يوجد طلاب بعد.')}`;
  }
  function view() {
    const box = (k, l, ph) => `<label style="margin:0">${l}<input type="search" data-fq="${k}" value="${esc(st[k])}" placeholder="${ph}" autocomplete="off"></label>`;
    return `<div class="card"><div class="bar"><h2 class="grow" style="margin:0">تحصيل اشتراكات الطلاب</h2>
        <label style="margin:0">الشهر <select data-fmonth style="width:auto">${monthOpts(st.y, st.m).map(o => `<option value="${o.v}" ${o.sel ? 'selected' : ''}>${o.l}</option>`).join('')}</select></label></div>
      ${cloudMissing() ? '<div class="note" style="color:var(--red)">جدول الاشتراكات غير موجود على الخادم بعد: نفّذ الملف <b>supabase/fees.sql</b> في Supabase ← SQL Editor ثم حدّث الصفحة.</div>' : ''}
      <div class="three">${box('qs', 'اسم الطالب', 'اكتب جزءًا من الاسم')}${box('qh', 'الحلقة', 'بداية اسم الحلقة')}${box('qp', 'المكان', 'بداية اسم المكان')}</div>
      <p class="muted" style="font-size:.85rem;margin:.2rem 0 .8rem">الاشتراك الشهري لكل طالب يُضبط من استمارته (حقل «الاشتراك الشهري»).</p>
      <div data-fres>${results()}</div></div>`;
  }
  /* تحديث النتائج وحدها أثناء الكتابة (يبقى المؤشر في المربع) */
  const refresh = () => { const r = document.querySelector('[data-fres]'); if (r) r.innerHTML = results(); };

  function pay(sid) {
    const s = byId(db.students, sid); if (!s) return;
    const fee = feeOf(s), rest = fee ? Math.max(0, fee - paidFor(sid, st.y, st.m)) : '';
    openForm('تحصيل اشتراك: ' + s.name, [
      { name: 'amount', label: 'المبلغ (جنيه)', type: 'number', min: 0, value: rest || fee || '', required: true },
      { name: 'month', label: 'عن شهر', type: 'select', value: `${st.y}-${st.m}`, options: monthOpts(st.y, st.m).map(o => ({ v: o.v, l: o.l })) },
      { name: 'date', label: 'تاريخ التحصيل', type: 'date', value: today() },
      { name: 'note', label: 'ملاحظة (اختياري)' }
    ], v => {
      const amount = +v.amount;
      if (!(amount > 0)) return 'اكتب مبلغًا صحيحًا';
      const [y, m] = v.month.split('-').map(Number);
      fees().push({ id: uid(), studentId: sid, y, m, amount, date: v.date || today(), by: me()?.name || '', note: (v.note || '').trim() });
      toast(`سُجّل ${money(amount)} جنيه لـ«${s.name}» عن ${MONTHS[m - 1]} ${y}`);
    });
  }
  function log(sid) {
    const s = byId(db.students, sid); if (!s) return;
    const list = fees().filter(f => f.studentId === sid).sort((a, b) => (b.y * 100 + b.m) - (a.y * 100 + a.m) || String(b.date).localeCompare(String(a.date)));
    const total = list.reduce((a, f) => a + (+f.amount || 0), 0);
    openInfo('سجل اشتراكات: ' + s.name, `<div class="tbl"><table><tr><th>عن شهر</th><th>المبلغ</th><th>التاريخ</th><th>حصّلها</th><th>ملاحظة</th><th class="noprint"></th></tr>
      ${list.map(f => `<tr><td>${MONTHS[f.m - 1]} ${f.y}</td><td>${money(f.amount)}</td><td dir="ltr" style="text-align:right">${esc(f.date || '')}</td><td>${esc(f.by || '')}</td><td>${esc(f.note || '')}</td><td class="noprint"><button type="button" class="btn sm danger" data-fee-del="${esc(f.id)}">حذف</button></td></tr>`).join('')}
      <tr class="sum"><td>الإجمالي</td><td>${money(total)}</td><td colspan="4"></td></tr></table></div>`);
  }
  function del(id) {
    const f = fees().find(x => x.id === id); if (!f) return;
    ask(`حذف دفعة ${money(f.amount)} جنيه عن ${MONTHS[f.m - 1]} ${f.y}؟`, () => {
      db.fees = fees().filter(x => x.id !== id);
      document.querySelectorAll('.overlay').forEach(o => o.remove());
      save(); render(); toast('حُذفت الدفعة');
    });
  }

  document.addEventListener('input', e => { const k = e.target.dataset?.fq; if (k) { st[k] = e.target.value; refresh(); } });
  document.addEventListener('change', e => {
    if (!('fmonth' in (e.target.dataset || {}))) return;
    const [y, m] = e.target.value.split('-').map(Number); st.y = y; st.m = m; render();
  });
  document.addEventListener('click', e => {
    const p = e.target.closest('[data-fee-pay]'); if (p) { pay(p.dataset.feePay); return; }
    const l = e.target.closest('[data-fee-log]'); if (l) { log(l.dataset.feeLog); return; }
    const d = e.target.closest('[data-fee-del]'); if (d) del(d.dataset.feeDel);
  });
})();
