'use strict';
/* ============ قسم الأعضاء والجداول ============
   - قسم الأعضاء: الفئات في قائمة منسدلة (ومعها «مصنفون بمسميات أخرى»)، وأزرار الشريط أيقونات فقط،
     وعرض كل عمود على قدر أطول نص فيه بلا التفاف، ورؤوس الأعمدة في الوسط، و«متاح» بدل «له حساب دخول».
   - كل جداول التطبيق: تحديد الخلايا بالسحب (أو Shift+نقر)، وتحديد عمود كامل بالنقر على رأسه،
     ثم النسخ (Ctrl+C) واللصق في Word أو Excel كجدول. */
(() => {
  const style = document.createElement('style');
  style.textContent = `
    .memview .tbl table{width:max-content}
    .memview .tbl th,.memview .tbl td{white-space:nowrap}
    .memview .tbl th{text-align:center}
    .msubsel{width:auto;min-width:13rem;font-weight:700}
    .btn.icon-only .cnt{font-size:.72rem;font-weight:700;margin-inline-start:.1rem}
    .btn.icon-only:has(.cnt){width:auto;padding:0 .5rem;gap:.1rem}
    main .tbl td.csel,main .tbl th.csel{background:var(--gold-l) !important;box-shadow:inset 0 0 0 1px var(--gold)}
    main .tbl.cselecting{user-select:none;-webkit-user-select:none}`;
  document.head.appendChild(style);
  setTimeout(() => { try { if (!VFILES.includes('./tables.js')) VFILES.push('./tables.js'); } catch (e) { /* ignore */ } }, 0);

  /* ===== قسم الأعضاء ===== */
  const KINDS = [['teachers', 'المعلمون'], ['students', 'الطلاب'], ['supervisors', 'المشرفون'], ['accountants', 'المحاسبون'], ['admins', 'المديرون']];
  const titledList = () => payEmps().filter(e => { const c = clsOf(e); return c && !CLS_ROLES[c.kind]; });
  function picker(cur) {
    const opts = [['unclassified', 'غير مصنف', unclassCount()], ...KINDS.map(([k, l]) => [k, l, (db[k] || []).length]), ['titled', 'مصنفون بمسميات أخرى', titledList().length]];
    return `<select class="msubsel" data-msubsel aria-label="فئة الأعضاء">${opts.map(([k, l, n]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${l} (${n})</option>`).join('')}</select>`;
  }
  function titledView() {
    const list = titledList().sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    const titles = [...new Set(['إداري', ...list.map(e => clsOf(e).kind)])];
    const opts = cur => `${Object.entries(CLS_ROLES).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}${titles.map(t => `<option value="t:${esc(t)}" ${cur === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}<option value="__other">غير ذلك (مسمى جديد)…</option>`;
    const rows = list.map((e, i) => `<tr><td>${i + 1}</td><td>${esc(e.name)}${e.status === 'متوقف' ? ' <span class="tag">متوقف</span>' : ''}</td><td>${esc(clsOf(e).kind)}</td><td>${esc(e.role || '—')}</td><td>${esc(e.place || '—')}</td>
      <td><select class="mini" data-cls="${esc(e.id)}" aria-label="تصنيف ${esc(e.name)}">${opts(clsOf(e).kind)}</select></td></tr>`).join('');
    return `<div class="card"><div class="bar">${picker('titled')}</div>
      <div class="note">موظفو المرتبات المصنَّفون بمسميات غير «معلم» و«مشرف» و«مدير» (مثل إداري). ليس لهم حساب دخول، ويمكنك تغيير تصنيف أي منهم من عمود «تغيير التصنيف».</div>
      ${list.length ? `<div class="tbl"><table><tr><th>#</th><th>الاسم</th><th>المسمى</th><th>الوظيفة في المرتبات</th><th>المكان</th><th>تغيير التصنيف</th></tr>${rows}</table></div>` : empty('لا يوجد مصنفون بمسميات أخرى.')}</div>`;
  }
  const baseMembers = adminViews.members;
  adminViews.members = () => {
    if (ui.msub === 'titled') return `<div class="memview">${titledView()}</div>`;
    const cur = ['unclassified', ...KINDS.map(k => k[0])].includes(ui.msub) ? ui.msub : 'teachers';
    let h = baseMembers()
      .replace(/<button class="btn[^"]*" data-act="msub"[^>]*>[^<]*<\/button>/g, '')
      .replace('<div class="bar">', '<div class="bar">' + picker(cur));
    /* زر «إرسال بيانات الدخول» (كان يُضاف بجوار أزرار الفئات القديمة) */
    if (CLOUD && cur !== 'unclassified' && KIND_TITLE[cur] && !h.includes('data-act="credsOpen"'))
      h = h.replace('<button class="btn" data-act="dupOpen">', `<button class="btn" data-act="credsOpen" data-k="${cur}">إرسال بيانات الدخول</button><button class="btn" data-act="dupOpen">`);
    /* بطاقة «مصنفون بمسميات أخرى» أسفل «غير مصنف» صار لها اختيار مستقل في القائمة */
    const i = h.indexOf('<div class="card"><h2>مصنّفون بمسميات أخرى');
    if (i > -1) h = h.slice(0, i);
    return `<div class="memview">${h.split('>له حساب دخول<').join('>متاح<')}</div>`;
  };
  document.addEventListener('change', e => {
    if (!('msubsel' in (e.target.dataset || {}))) return;
    ui.msub = e.target.value; ui.sel = new Set(); saveTab(); render();
  });
  /* أزرار شريط الأعضاء أيقونات فقط، والنص يظهر عند الوقوف عليها */
  const ICON = {
    /* فقاعة رسالة بداخلها مفتاح: إرسال بيانات الدخول */
    credsOpen: svg('<path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 20.5l1.5-5A8.5 8.5 0 1 1 21 11.5z"/><circle cx="9" cy="11.5" r="2.2"/><path d="M11.2 11.5H17M15 11.5v2.2"/>'),
    /* ملف وسهم يدخل إليه: استيراد من Excel / Sheets */
    importMembers: svg('<path d="M14 3H7a1 1 0 0 0-1 1v4M6 16v4a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/><path d="M2 12h10M9 9l3 3-3 3"/>'),
    addMember: svg('<circle cx="9" cy="8" r="3.2"/><path d="M3 20v-1a6 6 0 0 1 12 0v1"/><path d="M19 8v6M16 11h6"/>'),
    cloudPwAll: svg('<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>'),
    /* شخصان متطابقان بينهما «=»: الأسماء المتشابهة */
    dupOpen: svg('<circle cx="6" cy="8" r="2.5"/><path d="M2 18.5v-.5a4 4 0 0 1 8 0v.5"/><circle cx="18" cy="8" r="2.5"/><path d="M14 18.5v-.5a4 4 0 0 1 8 0v.5"/><path d="M10.5 10.5h3M10.5 13h3"/>'),
    clsAuto: svg('<path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8z"/><path d="M19 15l.8 1.9 1.9.8-1.9.8L19 20.4l-.8-1.9-1.9-.8 1.9-.8z"/>'),
    delSel: svg('<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13M9 7V4h6v3"/>')
  };
  function iconize() {
    document.querySelectorAll('.memview .bar .btn[data-act]:not(.icon-only)').forEach(b => {
      const ic = ICON[b.dataset.act]; if (!ic) return;
      const t = b.textContent.trim().replace(/^\+\s*/, 'إضافة '), n = (t.match(/\((\d+)\)/) || [])[1];
      b.title = t; b.setAttribute('aria-label', t); b.classList.add('icon-only');
      b.innerHTML = ic + (n ? `<span class="cnt">${n}</span>` : '');
    });
  }
  new MutationObserver(ms => { if (ms.some(m => m.addedNodes.length)) iconize(); }).observe(document.body, { childList: true, subtree: true });

  /* ===== تحديد الخلايا ونسخها كما في Excel ===== */
  let S = null, drag = false;
  const INTER = 'button,input,select,textarea,a,label,.eye,.pwwrap';
  const cellOf = el => { const c = el.closest?.('main .tbl td, main .tbl th'); return c && !el.closest(INTER) ? c : null; };
  const pos = c => [c.parentElement.rowIndex, c.cellIndex];
  const firstData = t => { const i = [...t.rows].findIndex(r => [...r.cells].some(x => x.tagName === 'TD')); return i < 0 ? t.rows.length : i; };
  const range = () => ({ r0: Math.min(S.a[0], S.b[0]), r1: Math.max(S.a[0], S.b[0]), c0: Math.min(S.a[1], S.b[1]), c1: Math.max(S.a[1], S.b[1]) });
  function paint() {
    document.querySelectorAll('main .tbl .csel').forEach(x => x.classList.remove('csel'));
    if (!S || !S.table.isConnected) { S = null; return; }
    const { r0, r1, c0, c1 } = range();
    for (let r = r0; r <= r1; r++) [...(S.table.rows[r]?.cells || [])].forEach((td, c) => { if (c >= c0 && c <= c1) td.classList.add('csel'); });
  }
  const clear = () => { if (S) { S = null; paint(); } };
  document.addEventListener('mousedown', e => {
    if (e.button !== 0 || e.target.closest('.overlay')) return;
    const c = cellOf(e.target);
    if (!c) { if (!e.target.closest(INTER)) clear(); return; }
    const table = c.closest('table'), p = pos(c), fd = firstData(table);
    if (p[0] < fd) {
      /* رأس العمود: تحديد العمود كله (وShift يمدّ التحديد لأعمدة أخرى) */
      const last = table.rows.length - 1;
      if (e.shiftKey && S && S.table === table) S.b = [last, p[1]]; else S = { table, a: [fd, p[1]], b: [last, p[1]] };
      e.preventDefault(); paint(); return;
    }
    if (e.shiftKey && S && S.table === table) S.b = p; else S = { table, a: p, b: p };
    drag = true; c.closest('.tbl').classList.add('cselecting');
    e.preventDefault(); paint();
  });
  document.addEventListener('mouseover', e => {
    if (!drag || !S) return;
    const c = cellOf(e.target);
    if (c && c.closest('table') === S.table && pos(c)[0] >= firstData(S.table)) { S.b = pos(c); paint(); }
  });
  document.addEventListener('mouseup', () => { if (!drag) return; drag = false; document.querySelectorAll('.cselecting').forEach(x => x.classList.remove('cselecting')); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') clear(); });
  const txt = td => {
    const c = td.cloneNode(true), live = td.querySelectorAll('input,select,textarea');
    c.querySelectorAll('input,select,textarea').forEach((x, i) => { const o = live[i]; x.replaceWith(o.type === 'checkbox' ? (o.checked ? '✓' : '') : o.tagName === 'SELECT' ? (o.options[o.selectedIndex]?.text || '') : o.value); });
    c.querySelectorAll('button,svg').forEach(x => x.remove());
    return c.textContent.replace(/\s+/g, ' ').trim();
  };
  document.addEventListener('copy', e => {
    if (!S || !S.table.isConnected) return;
    const a = document.activeElement;
    if (a && /INPUT|TEXTAREA/.test(a.tagName)) return;
    if (String(window.getSelection() || '').trim()) return;
    const { r0, r1, c0, c1 } = range(), fd = firstData(S.table);
    /* رأس الأعمدة يُنسخ معها عند تحديد أعمدة كاملة */
    const from = r0 === fd && r1 === S.table.rows.length - 1 ? 0 : r0;
    const rows = [];
    for (let r = from; r <= r1; r++) rows.push([...(S.table.rows[r]?.cells || [])].filter((td, c) => c >= c0 && c <= c1).map(td => ({ t: txt(td), h: td.tagName === 'TH' })));
    const tsv = rows.map(r => r.map(x => x.t.replace(/\t/g, ' ')).join('\t')).join('\r\n');
    const html = `<meta charset="utf-8"><table dir="rtl" border="1" style="border-collapse:collapse">${rows.map(r => `<tr>${r.map(x => `<${x.h ? 'th' : 'td'}>${esc(x.t)}</${x.h ? 'th' : 'td'}>`).join('')}</tr>`).join('')}</table>`;
    e.clipboardData.setData('text/plain', tsv);
    e.clipboardData.setData('text/html', html);
    e.preventDefault();
    toast(`نُسخ ${r1 - r0 + 1} صف × ${c1 - c0 + 1} عمود — الصقه في Word أو Excel`);
  });
})();
