'use strict';
/* ============ المحاسب ============
   أقسامه: الطلاب (إضافة، منقطع/منتظم، نقل بين الحلقات والأماكن)، والاشتراكات (من fees.js)، وملاحظات للإدارة، والإعلانات.
   كل عمل مربوط بصلاحية يملكها المحاسب افتراضيًا، ويمكن للمدير سحبها منه أو منحها لغيره من قسم «الصلاحيات».
   الخادم يتحقق من كل صلاحية، ولا يسمح لغير المدير بتعديل بيانات الطالب الأخرى. */
(() => {
  const P = [
    ['students.add', 'إضافة طالب', 'استمارة طالب جديد'],
    ['students.status', 'حالة الطالب', 'منقطع أو منتظم'],
    ['students.move', 'نقل طالب', 'من حلقة إلى أخرى أو من مكان لآخر'],
    ['fees.collect', 'تحصيل الاشتراكات', 'تسجيل ما يُدفع وحذف ما سجّله بنفسه'],
    ['fees.amount', 'قيمة الاشتراك', 'تحديد فئة الطالب وخصمه ومبلغه وتغييرها'],
    ['notes.send', 'ملاحظات للإدارة', 'تظهر في إعلانات المدير أو المشرفين باسم صاحبها']
  ];
  P.forEach(([key, label, desc]) => Perms.define({ key, label, desc, defaults: ['accountant'] }));
  const can = p => Perms.can(p);
  const st = { q: '', f: '' };

  /* ===== الطلاب ===== */
  const halOf = s => byId(db.halaqat, s.halaqaId);
  function rows() {
    const q = norm(st.q);
    return db.students.filter(s => {
      if (st.f === 'off' && !stOff(s)) return false;
      if (st.f === 'on' && stOff(s)) return false;
      if (!q) return true;
      const h = halOf(s);
      return norm(s.name).includes(q) || (h && (norm(halaqaLabel(h)).includes(q) || norm(placeName(h)).includes(q)));
    }).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }
  function table() {
    const list = rows(), shown = list.slice(0, 300);
    if (!list.length) return empty(st.q || st.f ? 'لا توجد نتائج مطابقة.' : 'لا يوجد طلاب بعد.');
    return `<p class="muted" style="margin:.2rem 0 .6rem">${list.length} طالبًا${list.length > 300 ? ' — يظهر أول 300؛ اكتب للتضييق' : ''}</p>
      <div class="tbl"><table><tr><th>#</th><th>الطالب</th><th>الحلقة</th><th>المكان</th><th>الحالة</th><th class="noprint"></th></tr>
      ${shown.map((s, i) => { const h = halOf(s); return `<tr><td>${i + 1}</td><td>${esc(s.name)}</td><td>${h ? esc(halaqaLabel(h)) : '<span class="muted">—</span>'}</td><td>${h ? esc(placeName(h) || '—') : '<span class="muted">—</span>'}</td>
        <td>${stOff(s) ? `<span class="tag tag-no">منقطع</span>${s.info?.statusDate ? ` <small class="muted">${esc(s.info.statusDate)}</small>` : ''}` : '<span class="tag tag-ok">منتظم</span>'}</td>
        <td class="noprint">${can('students.move') ? `<button type="button" class="btn sm" data-move="${esc(s.id)}">نقل</button>` : ''}${can('students.status') ? `<button type="button" class="btn sm" data-stat="${esc(s.id)}">${stOff(s) ? 'منتظم' : 'منقطع'}</button>` : ''}</td></tr>`; }).join('')}</table></div>`;
  }
  function studentsView() {
    return `<div class="card"><div class="bar"><h2 class="grow" style="margin:0">الطلاب</h2>
        <select data-af style="width:auto"><option value="">الكل</option><option value="on" ${st.f === 'on' ? 'selected' : ''}>المنتظمون</option><option value="off" ${st.f === 'off' ? 'selected' : ''}>المنقطعون</option></select>
        ${can('students.add') ? '<button class="btn primary" data-act="addStudent">+ استمارة طالب</button>' : ''}</div>
      <label style="margin:0 0 .4rem">بحث<input type="search" data-aq value="${esc(st.q)}" placeholder="اسم الطالب أو الحلقة أو المكان" autocomplete="off"></label>
      <div data-ares>${table()}</div></div>`;
  }

  /* ===== ملاحظات للإدارة ===== */
  function notesView() {
    const mine = (db.news || []).filter(n => n.authorId && n.authorId === session.id).slice().reverse();
    return `<div class="card"><h2>ملاحظة جديدة</h2>
        ${can('notes.send') ? `<label>إلى<select data-nto><option value="admin">المدير</option><option value="supervisor">المشرفين</option></select></label>
        <label>الملاحظة<textarea data-ntext rows="4" placeholder="اكتب ملاحظتك بخصوص العمل"></textarea></label>
        <div class="row"><button type="button" class="btn primary" data-nsend>إرسال</button></div>
        <p class="muted" style="font-size:.85rem;margin:.4rem 0 0">تظهر في إعلانات من أرسلتها إليه، موقّعة باسمك: «${esc(ROLE_L[session.role] === 'محاسب' ? 'المحاسب' : ROLE_L[session.role])} ${esc(me()?.name || '')}». تحتاج اتصالًا بالإنترنت.</p>`
        : '<p class="muted">لا تملك صلاحية إرسال الملاحظات.</p>'}</div>
      <div class="card"><h2>ملاحظاتي المرسلة</h2>${mine.length ? mine.map(n => `<div class="news">${esc(n.text)}<br><small>${esc(n.date)} — إلى ${esc(AUD[n.audience] || '')}</small></div>`).join('') : empty('لم ترسل ملاحظات بعد.')}</div>`;
  }

  TAB_ICONS.notes = svg('<path d="M4 5h16v11H8l-4 4z"/><path d="M8 9h8M8 12h5"/>');
  VIEWS.accountant = { students: studentsView, fees: () => window.FeesView(), notes: notesView, news: () => newsView('accountant') };

  /* ===== الإجراءات ===== */
  function move(s) {
    const opts = db.halaqat.map(h => ({ v: h.id, l: `${placeName(h) ? placeName(h) + ' — ' : ''}${halaqaLabel(h)}` })).sort((a, b) => a.l.localeCompare(b.l, 'ar'));
    if (!opts.length) { toast('لا توجد حلقات'); return; }
    openForm('نقل الطالب: ' + s.name, [
      { type: 'note', label: 'الحالية: ' + (halOf(s) ? `${placeName(halOf(s)) || '—'} — ${halaqaLabel(halOf(s))}` : 'بلا حلقة') },
      { name: 'h', label: 'إلى (المكان — الحلقة)', type: 'select', value: s.halaqaId || '', options: opts }
    ], v => {
      if (v.h === s.halaqaId) return 'اختر حلقة مختلفة';
      s.halaqaId = v.h; toast(`نُقل «${s.name}» إلى ${halaqaLabel(byId(db.halaqat, v.h))}`);
    });
  }
  function toggleStatus(s) {
    const off = stOff(s);
    ask(off ? `إعادة «${s.name}» منتظمًا؟` : `تسجيل «${s.name}» منقطعًا؟ لن يُحسب في الاشتراكات المتوقعة.`, () => {
      s.info = { ...(s.info || {}), status: off ? '' : 'منقطع', statusDate: today() };
      save(); render(); toast(off ? 'أصبح منتظمًا' : 'سُجّل منقطعًا');
    });
  }
  async function sendNote(btn) {
    const text = document.querySelector('[data-ntext]')?.value.trim(), aud = document.querySelector('[data-nto]')?.value;
    if (!text || text.length < 2) { toast('اكتب الملاحظة'); return; }
    if (!CLOUD) { db.news.push({ id: uid(), text, audience: aud, date: today(), author: 'المحاسب ' + (me()?.name || ''), authorId: session.id }); save(); render(); toast('أُرسلت'); return; }
    try { await window.Cloud.rpc('send_note', { aud, body: text }); toast('أُرسلت الملاحظة'); document.querySelector('[data-ntext]').value = ''; await cloudRefresh(true); render(); }
    catch (e) { toast(navigator.onLine === false ? 'لا يوجد اتصال بالإنترنت' : 'تعذّر الإرسال: ' + (e.message || e)); }
  }

  const refresh = () => { const r = document.querySelector('[data-ares]'); if (r) r.innerHTML = table(); };
  document.addEventListener('input', e => { if ('aq' in (e.target.dataset || {})) { st.q = e.target.value; refresh(); } });
  document.addEventListener('change', e => { if ('af' in (e.target.dataset || {})) { st.f = e.target.value; refresh(); } });
  document.addEventListener('click', e => {
    const m = e.target.closest('[data-move]'); if (m) { const s = byId(db.students, m.dataset.move); if (s && can('students.move')) move(s); return; }
    const t = e.target.closest('[data-stat]'); if (t) { const s = byId(db.students, t.dataset.stat); if (s && can('students.status')) toggleStatus(s); return; }
    const n = e.target.closest('[data-nsend]'); if (n && !n.classList.contains('loading')) withBusy(n, sendNote(n));
  });
})();
