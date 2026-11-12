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
  window.FeesView = () => view();
  /* يُضاف هذا الملف لفحص التحديث التلقائي (القائمة تُعرَّف في app-actions.js الذي يُحمَّل بعده) */
  setTimeout(() => { try { if (!VFILES.includes('./fees.js')) VFILES.push('./fees.js'); } catch (e) { /* ignore */ } }, 0);

  const fees = () => (Array.isArray(db.fees) ? db.fees : (db.fees = []));
  const money = n => (Math.round((+n || 0) * 100) / 100).toLocaleString('en-US');
  /* الفئات والخصومات: تُحفظ في الإعدادات بمفتاح خاص لا يقرؤه إلا المدير */
  /* «أيتام» معفى كامل، و«حالات خاصة» تُحدَّد قيمتها لكل طالب على حدة (each) */
  const ORPHAN = { id: 'd_orphan', name: 'أيتام', type: 'pct', value: 100 };
  const DEF_DISCS = [{ id: 'd_tahfeez', name: 'أبناء موظفي التحفيظ', type: 'pct', value: 0 }, { id: 'd_assoc', name: 'أبناء موظفي الجمعية', type: 'pct', value: 0 }, ORPHAN, { id: 'd_special', name: 'حالات خاصة', type: 'pct', value: 0, each: true }];
  const cfg = () => {
    const c = db.settings.priv_fees || {};
    let discs = Array.isArray(c.discs) ? c.discs : DEF_DISCS;
    /* إعدادات حُفظت قبل إضافة «أيتام»: يُضاف، و«حالات خاصة» تصبح لكل طالب على حدة */
    if (Array.isArray(c.discs) && !c.v) {
      discs = discs.map(d => (d.id === 'd_special' ? { ...d, each: true } : d));
      if (!discs.some(d => d.id === ORPHAN.id)) discs = [...discs.filter(d => d.id !== 'd_special'), ORPHAN, ...discs.filter(d => d.id === 'd_special')];
    }
    return { cats: Array.isArray(c.cats) ? c.cats : [], discs };
  };
  const isNum = v => v !== '' && v != null && !isNaN(+v);
  const discTxt = (d, v, t) => ((t || d.type) === 'amt' ? money(v) + ' جنيه' : v + '%');
  const discLabel = d => (d.each ? `${d.name} (يُحدَّد لكل طالب)` : `${d.name} (${discTxt(d, d.value)})`);
  /* المستحق = (المبلغ الخاص للطالب، أو مبلغ فئته، أو الفئة الافتراضية لسنّه) − الخصم */
  function dueOf(s) {
    const I = s?.info || {}, C = cfg();
    let base = null, src = '';
    if (isNum(I.fee) && +I.fee > 0) { base = +I.fee; src = 'مبلغ خاص'; }
    else {
      const c = C.cats.find(x => x.id === I.feeCat) || C.cats.find(x => x.def === (s.cat === 'adult' ? 'adult' : 'child'));
      if (c) { base = +c.amount || 0; src = c.name; }
    }
    if (base == null) return null;
    const d = C.discs.find(x => x.id === I.feeDisc);
    let off = 0, dl = '';
    if (d) {
      const own = isNum(I.feeDiscVal), v = own ? +I.feeDiscVal : (d.each ? 0 : +d.value || 0), t = own ? (I.feeDiscType || d.type) : d.type;
      off = Math.min(base, Math.max(0, t === 'amt' ? v : base * v / 100));
      dl = d.each && !own ? `${d.name} (لم تُحدَّد قيمته)` : `${d.name} (${discTxt(d, v, t)})`;
    }
    return { base, src, off, dl, due: Math.round((base - off) * 100) / 100 };
  }
  const feeOf = s => dueOf(s)?.due ?? null;
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
  /* الأزرار بحسب الصلاحية: المدير كل شيء، والمحاسب (أو من مُنح) بحسب صلاحياته */
  const can = p => (window.Perms ? Perms.can(p) : session?.role === 'admin');
  const isAdmin = () => session?.role === 'admin';

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
    let expected = 0, got = 0, paidN = 0, partN = 0, noneN = 0, freeN = 0, offN = 0;
    const row = (s, i) => {
      const D = dueOf(s), fee = D?.due ?? null, paid = paidFor(s.id, st.y, st.m), h = halOf(s), off = stOff(s);
      const state = off ? `<span class="tag tag-no">منقطع</span>${paid ? ' <small class="muted">دفع ' + money(paid) + '</small>' : ''}` : fee === 0 ? '<span class="tag tag-ok">معفى</span>'
        : fee ? (paid >= fee ? '<span class="tag tag-ok">مسدَّد ✓</span>' : paid > 0 ? `<span class="tag">جزئي: باقٍ ${money(fee - paid)}</span>` : '<span class="tag tag-no">لم يُسدَّد</span>')
        : (paid > 0 ? '<span class="tag tag-ok">مدفوع</span>' : '<span class="muted">بلا اشتراك محدد</span>');
      const catCell = D ? `${esc(D.src)}${D.dl ? `<br><small class="tag">${esc(D.dl)}</small>` : ''}` : '<span class="muted">—</span>';
      const dueCell = D ? (D.off ? `<span title="${money(D.base)} − ${money(D.off)}">${money(D.due)}</span> <small class="muted"><s>${money(D.base)}</s></small>` : money(D.due)) : '—';
      const any = fees().some(f => f.studentId === s.id);
      return `<tr><td>${i + 1}</td><td>${esc(s.name)}</td><td>${h ? esc(halaqaLabel(h)) : '<span class="muted">—</span>'}</td><td>${h ? esc(placeName(h) || '—') : '<span class="muted">—</span>'}</td>
        <td>${catCell}</td><td>${dueCell}</td><td>${paid ? money(paid) : '—'}</td><td>${state}</td>
        <td class="noprint">${can('fees.collect') ? `<button type="button" class="btn sm primary" data-fee-pay="${esc(s.id)}" ${cloudMissing() || fee === 0 ? 'disabled' : ''}>تحصيل</button>` : ''}${any ? `<button type="button" class="btn sm" data-fee-log="${esc(s.id)}">السجل</button>` : ''}${can('fees.amount') ? `<button type="button" class="btn sm" data-fee-assign="${esc(s.id)}">الفئة</button>` : ''}</td></tr>`;
    };
    list.forEach(s => {
      const fee = feeOf(s), paid = paidFor(s.id, st.y, st.m); got += paid;
      if (stOff(s)) offN++;
      else if (fee === 0) freeN++;
      else if (fee) { expected += fee; if (paid >= fee) paidN++; else if (paid > 0) partN++; else noneN++; } else if (paid > 0) paidN++;
    });
    const stat = (v, l) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`;
    return `<div class="grid">${stat(money(got), 'المحصَّل في ' + MONTHS[st.m - 1])}${stat(money(expected), 'المتوقع')}${stat(paidN, 'مسدَّد')}${stat(partN, 'جزئي')}${stat(noneN, 'لم يُسدَّد')}${freeN ? stat(freeN, 'معفى') : ''}${offN ? stat(offN, 'منقطع') : ''}</div>
      ${list.length ? `<div class="tbl"><table><tr><th>#</th><th>الطالب</th><th>الحلقة</th><th>المكان</th><th>الفئة / الخصم</th><th>المستحق</th><th>المدفوع</th><th>الحالة</th><th class="noprint"></th></tr>${list.slice(0, MAX_ROWS).map(row).join('')}</table></div>
        ${list.length > MAX_ROWS ? `<p class="muted">يظهر أول ${MAX_ROWS} من ${list.length} طالبًا؛ اكتب في مربعات البحث للتضييق.</p>` : ''}`
        : empty(st.qs || st.qh || st.qp ? 'لا توجد نتائج مطابقة.' : 'لا يوجد طلاب بعد.')}`;
  }
  function view() {
    const box = (k, l, ph) => `<label style="margin:0">${l}<input type="search" data-fq="${k}" value="${esc(st[k])}" placeholder="${ph}" autocomplete="off"></label>`;
    return `<div class="card"><div class="bar"><h2 class="grow" style="margin:0">تحصيل اشتراكات الطلاب</h2>
        ${isAdmin() ? '<button type="button" class="btn" data-fee-cfg>الفئات والخصومات</button>' : ''}${can('fees.amount') ? '<button type="button" class="btn" data-fee-bulk>تعيين لنتائج البحث</button>' : ''}
        <label style="margin:0">الشهر <select data-fmonth style="width:auto">${monthOpts(st.y, st.m).map(o => `<option value="${o.v}" ${o.sel ? 'selected' : ''}>${o.l}</option>`).join('')}</select></label></div>
      ${cloudMissing() ? '<div class="note" style="color:var(--red)">جدول الاشتراكات غير موجود على الخادم بعد: نفّذ الملف <b>supabase/fees.sql</b> في Supabase ← SQL Editor ثم حدّث الصفحة.</div>' : ''}
      <div class="three">${box('qs', 'اسم الطالب', 'اكتب جزءًا من الاسم')}${box('qh', 'الحلقة', 'بداية اسم الحلقة')}${box('qp', 'المكان', 'بداية اسم المكان')}</div>
      <p class="muted" style="font-size:.85rem;margin:.2rem 0 .8rem">المستحق = مبلغ فئة الطالب (أو الفئة الافتراضية لسنّه، أو مبلغه الخاص من استمارته) مطروحًا منه خصمه إن وُجد.${cfg().cats.length ? '' : ' <b>ابدأ بإضافة الفئات من زر «الفئات والخصومات».</b>'}</p>
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
      fees().push({ id: uid(), studentId: sid, y, m, amount, date: v.date || today(), by: me()?.name || '', byMember: session?.id || '', note: (v.note || '').trim() });
      toast(`سُجّل ${money(amount)} جنيه لـ«${s.name}» عن ${MONTHS[m - 1]} ${y}`);
    });
  }
  function log(sid) {
    const s = byId(db.students, sid); if (!s) return;
    const list = fees().filter(f => f.studentId === sid).sort((a, b) => (b.y * 100 + b.m) - (a.y * 100 + a.m) || String(b.date).localeCompare(String(a.date)));
    const total = list.reduce((a, f) => a + (+f.amount || 0), 0);
    openInfo('سجل اشتراكات: ' + s.name, `<div class="tbl"><table><tr><th>عن شهر</th><th>المبلغ</th><th>التاريخ</th><th>حصّلها</th><th>ملاحظة</th><th class="noprint"></th></tr>
      ${list.map(f => `<tr><td>${MONTHS[f.m - 1]} ${f.y}</td><td>${money(f.amount)}</td><td dir="ltr" style="text-align:right">${esc(f.date || '')}</td><td>${esc(f.by || '')}</td><td>${esc(f.note || '')}</td><td class="noprint">${isAdmin() || (can('fees.collect') && f.byMember === session?.id) ? `<button type="button" class="btn sm danger" data-fee-del="${esc(f.id)}">حذف</button>` : ''}</td></tr>`).join('')}
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

  /* ===== نافذة الفئات والخصومات ===== */
  function cfgDialog() {
    const C = JSON.parse(JSON.stringify(cfg()));
    const ov = document.createElement('div'); ov.className = 'overlay';
    const catRow = (c, i) => `<tr><td><input data-c="name" data-i="${i}" value="${esc(c.name)}" placeholder="مثال: الصغار"></td><td><input type="number" min="0" data-c="amount" data-i="${i}" value="${esc(c.amount ?? '')}" style="width:7rem"></td>
      <td><select data-c="def" data-i="${i}"><option value="">—</option><option value="child" ${c.def === 'child' ? 'selected' : ''}>الصغار</option><option value="adult" ${c.def === 'adult' ? 'selected' : ''}>الكبار</option></select></td><td><button type="button" class="btn sm danger" data-cdel="${i}">حذف</button></td></tr>`;
    const discRow = (d, i) => `<tr><td><input data-d="name" data-i="${i}" value="${esc(d.name)}"></td><td><select data-d="type" data-i="${i}"><option value="pct" ${d.type !== 'amt' ? 'selected' : ''}>نسبة %</option><option value="amt" ${d.type === 'amt' ? 'selected' : ''}>مبلغ ثابت (جنيه)</option></select></td>
      <td><input type="number" min="0" data-d="value" data-i="${i}" value="${d.each ? '' : esc(d.value ?? '')}" style="width:7rem" ${d.each ? 'disabled placeholder="لكل طالب"' : ''}></td>
      <td style="text-align:center"><input type="checkbox" data-each="${i}" ${d.each ? 'checked' : ''} aria-label="تُحدَّد القيمة لكل طالب"></td><td><button type="button" class="btn sm danger" data-ddel="${i}">حذف</button></td></tr>`;
    const used = (k, id) => db.students.filter(x => (x.info || {})[k] === id).length;
    const draw = () => {
      ov.innerHTML = `<div class="modal wide"><h2>الفئات والخصومات</h2>
        <h3 style="font-size:1rem;margin:.4rem 0">فئات الاشتراك (المبلغ الشهري)</h3>
        <p class="muted" style="font-size:.85rem;margin:0 0 .4rem">«الافتراضية لـ» تجعل الفئة تُطبَّق تلقائيًا على كل الصغار أو كل الكبار ما لم تُعيَّن لهم فئة أخرى.</p>
        <div class="tbl"><table><tr><th>اسم الفئة</th><th>المبلغ (جنيه)</th><th>الافتراضية لـ</th><th></th></tr>${C.cats.map(catRow).join('') || '<tr><td colspan="4" class="muted">لا توجد فئات بعد.</td></tr>'}</table></div>
        <div class="row" style="margin:.4rem 0 1rem"><button type="button" class="btn sm" data-cadd>+ فئة</button></div>
        <h3 style="font-size:1rem;margin:.4rem 0">الخصومات</h3>
        <div class="tbl"><table><tr><th>اسم الخصم</th><th>النوع</th><th>القيمة</th><th>لكل طالب</th><th></th></tr>${C.discs.map(discRow).join('') || '<tr><td colspan="5" class="muted">لا توجد خصومات.</td></tr>'}</table></div>
        <p class="muted" style="font-size:.85rem;margin:.3rem 0 0">«لكل طالب»: لا قيمة عامة للخصم، وتُحدَّد قيمته ونوعه لكل طالب من زر «الفئة» (مثل الحالات الخاصة). خصم 100% يجعل الطالب معفى.</p>
        <div class="row" style="margin:.4rem 0 1rem"><button type="button" class="btn sm" data-dadd>+ خصم</button></div>
        <div class="row"><button type="button" class="btn primary" data-save>حفظ</button><button type="button" class="btn" data-close>إلغاء</button></div></div>`;
    };
    const read = () => {
      ov.querySelectorAll('[data-c]').forEach(x => { C.cats[+x.dataset.i][x.dataset.c] = x.dataset.c === 'amount' ? (x.value === '' ? '' : +x.value) : x.value.trim(); });
      ov.querySelectorAll('[data-d]').forEach(x => { C.discs[+x.dataset.i][x.dataset.d] = x.dataset.d === 'value' ? (x.value === '' ? '' : +x.value) : x.value.trim(); });
      ov.querySelectorAll('[data-each]').forEach(x => { const d = C.discs[+x.dataset.each]; d.each = x.checked; if (d.each) d.value = 0; });
    };
    ov.addEventListener('change', e => { if (e.target.matches('[data-each]')) { read(); draw(); } });
    draw(); document.body.appendChild(ov);
    ov.addEventListener('click', e => {
      const t = e.target;
      if (t.matches('[data-close]')) { ov.remove(); return; }
      if (t.matches('[data-cadd]')) { read(); C.cats.push({ id: uid(), name: '', amount: '', def: '' }); draw(); return; }
      if (t.matches('[data-dadd]')) { read(); C.discs.push({ id: uid(), name: '', type: 'pct', value: '' }); draw(); return; }
      if (t.matches('[data-cdel],[data-ddel]')) {
        read();
        const isC = t.matches('[data-cdel]'), i = +(isC ? t.dataset.cdel : t.dataset.ddel), item = (isC ? C.cats : C.discs)[i];
        const n = used(isC ? 'feeCat' : 'feeDisc', item.id);
        if (n && !t.dataset.sure) { t.dataset.sure = '1'; t.textContent = `مستخدم لـ${n} طالب — اضغط للتأكيد`; return; }
        (isC ? C.cats : C.discs).splice(i, 1); draw(); return;
      }
      if (t.matches('[data-save]')) {
        read();
        if (C.cats.some(c => !c.name || !isNum(c.amount) || +c.amount < 0)) { toast('أكمل اسم كل فئة ومبلغها'); return; }
        if (C.discs.some(d => !d.name || (!d.each && (!isNum(d.value) || +d.value < 0)))) { toast('أكمل اسم كل خصم وقيمته'); return; }
        if (C.discs.some(d => d.type !== 'amt' && +d.value > 100)) { toast('نسبة الخصم لا تزيد على 100%'); return; }
        if (['child', 'adult'].some(k => C.cats.filter(c => c.def === k).length > 1)) { toast('فئة افتراضية واحدة فقط للصغار وواحدة للكبار'); return; }
        db.settings.priv_fees = { v: 2, cats: C.cats.map(c => ({ ...c, amount: +c.amount })), discs: C.discs.map(d => ({ ...d, value: d.each ? 0 : +d.value, each: !!d.each })) };
        ov.remove(); save(); render(); toast('حُفظت الفئات والخصومات');
      }
    });
  }
  /* ===== تعيين الفئة والخصم لطالب أو لكل نتائج البحث ===== */
  function assignDialog(list) {
    if (!list.length) { toast('لا يوجد طلاب في النتائج'); return; }
    const C = cfg(), one = list.length === 1, I = one ? (list[0].info || {}) : {};
    const keep = one ? '' : '<option value="__keep">— بلا تغيير —</option>';
    const sel = (cur, opts) => opts.map(([v, l]) => `<option value="${esc(v)}" ${!one ? '' : String(cur ?? '') === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('');
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="modal"><h2>${one ? 'فئة واشتراك: ' + esc(list[0].name) : `تعيين لـ${list.length} طالبًا من نتائج البحث`}</h2>
      <label>الفئة<select name="cat">${keep}${sel(I.feeCat || '', [['', 'حسب الافتراضي لسنّه'], ...C.cats.map(c => [c.id, `${c.name} — ${money(c.amount)} جنيه`])])}</select></label>
      <label>الخصم<select name="disc">${keep}${sel(I.feeDisc || '', [['', 'بلا خصم'], ...C.discs.map(d => [d.id, discLabel(d)])])}</select></label>
      <div class="two"><label>قيمة خصم خاصة بـ${one ? 'هذا الطالب' : 'هؤلاء الطلاب'}<input type="number" min="0" name="dval" value="${one && isNum(I.feeDiscVal) ? esc(I.feeDiscVal) : ''}" placeholder="${one ? 'فارغ = قيمة الخصم العامة' : 'فارغ = بلا تغيير'}"></label>
      <label>نوعها<select name="dtype"><option value="pct" ${I.feeDiscType !== 'amt' ? 'selected' : ''}>نسبة %</option><option value="amt" ${I.feeDiscType === 'amt' ? 'selected' : ''}>مبلغ (جنيه)</option></select></label></div>
      <p class="muted" style="font-size:.82rem;margin:-.3rem 0 .6rem">مطلوبة لـ«حالات خاصة» وكل خصم يُحدَّد لكل طالب؛ واختيارية لغيرها.</p>
      ${one ? `<label>مبلغ خاص يتجاوز الفئة (اختياري)<input type="number" min="0" name="fee" value="${isNum(I.fee) ? esc(I.fee) : ''}" placeholder="فارغ = مبلغ الفئة"></label>` : ''}
      ${!C.cats.length ? '<p class="note">لم تُضف فئات بعد: أضفها من «الفئات والخصومات».</p>' : ''}
      <div class="row"><button type="button" class="btn primary" data-save>حفظ</button><button type="button" class="btn" data-close>إلغاء</button></div></div>`;
    document.body.appendChild(ov);
    ov.querySelector('[data-close]').onclick = () => ov.remove();
    ov.querySelector('[data-save]').onclick = () => {
      const v = n => ov.querySelector(`[name=${n}]`)?.value ?? '';
      const disc = C.discs.find(d => d.id === v('disc')), dval = v('dval'), dtype = v('dtype');
      if (disc?.each && dval === '') { toast(`حدّد قيمة خصم «${disc.name}» ونوعه لـ${one ? 'هذا الطالب' : 'هؤلاء الطلاب'}`); return; }
      if (dval !== '' && (+dval < 0 || (dtype === 'pct' && +dval > 100))) { toast('قيمة الخصم غير صحيحة'); return; }
      list.forEach(s => {
        s.info = s.info || {};
        if (v('cat') !== '__keep') s.info.feeCat = v('cat');
        if (v('disc') !== '__keep') { s.info.feeDisc = v('disc'); if (!v('disc')) s.info.feeDiscVal = ''; }
        if (one || dval !== '') { s.info.feeDiscVal = dval === '' ? '' : +dval; s.info.feeDiscType = dval === '' ? '' : dtype; }
        if (one) s.info.fee = v('fee') === '' ? '' : +v('fee');
      });
      ov.remove(); save(); render(); toast(one ? 'حُفظ' : `عُيّن لـ${list.length} طالبًا`);
    };
  }

  document.addEventListener('input', e => { const k = e.target.dataset?.fq; if (k) { st[k] = e.target.value; refresh(); } });
  document.addEventListener('change', e => {
    if (!('fmonth' in (e.target.dataset || {}))) return;
    const [y, m] = e.target.value.split('-').map(Number); st.y = y; st.m = m; render();
  });
  document.addEventListener('click', e => {
    const p = e.target.closest('[data-fee-pay]'); if (p) { if (can('fees.collect')) pay(p.dataset.feePay); return; }
    const l = e.target.closest('[data-fee-log]'); if (l) { log(l.dataset.feeLog); return; }
    const d = e.target.closest('[data-fee-del]'); if (d) { del(d.dataset.feeDel); return; }
    const g = e.target.closest('[data-fee-assign]'); if (g && can('fees.amount')) { assignDialog([byId(db.students, g.dataset.feeAssign)].filter(Boolean)); return; }
    if (e.target.closest('[data-fee-cfg]')) { if (isAdmin()) cfgDialog(); return; }
    if (e.target.closest('[data-fee-bulk]') && can('fees.amount')) assignDialog(filtered());
  });
})();
