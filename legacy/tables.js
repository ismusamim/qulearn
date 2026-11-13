'use strict';
/* ============ قسم الأعضاء والجداول ============
   - قسم الأعضاء: الفئات في قائمة منسدلة (ومعها «مصنفون بمسميات أخرى»)، وأزرار الشريط أيقونات فقط، و«متاح» بدل «له حساب دخول».
   - كل الجداول (عدا كشوف المرتبات): عرض كل عمود على قدر أطول نص فيه بلا التفاف، ورؤوس الأعمدة في الوسط.
   - كل جداول التطبيق: تحديد الخلايا بالسحب (أو Shift+نقر)، وتحديد عمود كامل بالنقر على رأسه،
     ثم النسخ (Ctrl+C) واللصق في Word أو Excel كجدول. */
(() => {
  const style = document.createElement('style');
  style.textContent = `
    /* كل جداول التطبيق (عدا كشوف المرتبات ذات التنسيق الخاص): عرض كل عمود على قدر أطول نص فيه، ورؤوس الأعمدة في الوسط */
    main .tbl:not(.paytbl) table{width:max-content}
    main .tbl:not(.paytbl) th,main .tbl:not(.paytbl) td{white-space:nowrap}
    main .tbl:not(.paytbl) th{text-align:center}
    .msubsel{width:auto;min-width:13rem;font-weight:700}
    .btn.icon-only .cnt{font-size:.72rem;font-weight:700;margin-inline-start:.1rem}
    .btn.icon-only:has(.cnt){width:auto;padding:0 .5rem;gap:.1rem}
    main .tbl td.csel,main .tbl th.csel{background:var(--gold-l) !important;box-shadow:inset 0 0 0 1px var(--gold)}
    main .tbl.cselecting{user-select:none;-webkit-user-select:none}
    /* حدّ خفيف حول كل المستطيلات البيضاء (الخانات والقوائم والأزرار) حتى تظهر على الخلفية الفاتحة */
    select,input,textarea,.btn:not(.primary):not(.danger),.results{border-color:rgba(19,41,75,.2);border-color:color-mix(in srgb,var(--navy) 20%,transparent)}
    select:focus,input:focus,textarea:focus{border-color:var(--gold)}
    /* تكبير وتصغير نص الجداول: كل المقاسات داخل الجدول نسبية لحجم نصه، فتتسع الخلايا وتضيق معه */
    main .tbl table{font-size:calc(.95rem * var(--tz,1))}
    main .tbl th,main .tbl td{padding:.58em .63em}
    main .tbl .btn.sm{font-size:.86em}
    main .tbl .tag{font-size:.84em}
    main .tbl.paytbl th{font-size:.84em;padding:.5em .38em}
    main .tbl.paytbl td{padding:.38em .38em}
    .tblprint{gap:.3rem;align-items:center}
    .tzoom{display:inline-flex;gap:.2rem;margin-inline-end:auto}
    .tblprint .tzoom .btn{width:auto;min-width:34px;padding:0 .45rem;font-weight:700;font-size:.85rem}
    .tblprint .btn.texp{width:auto;padding:0 .5rem 0 .55rem;gap:.25rem;font:700 .8rem Arial,sans-serif}
    .tblprint .btn.texp svg{width:17px;height:17px}`;
  document.head.appendChild(style);
  setTimeout(() => { try { if (!VFILES.includes('./tables.js')) VFILES.push('./tables.js'); } catch (e) { /* ignore */ } }, 0);

  /* ===== قسم الأعضاء ===== */
  const KINDS = [['teachers', 'المعلمون'], ['students', 'الطلاب'], ['supervisors', 'المشرفون'], ['accountants', 'المحاسبون'], ['admins', 'المديرون']];
  const titledList = () => payEmps().filter(e => { const c = clsOf(e); return c && !CLS_ROLES[c.kind]; });
  /* المسميات الأخرى (إداري، سكرتير…) وعدد كل منها، مرتبة بالأكثر */
  const titleCounts = () => { const m = new Map(); titledList().forEach(e => { const k = clsOf(e).kind; m.set(k, (m.get(k) || 0) + 1); }); return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ar')); };
  function picker(cur) {
    const opts = [['unclassified', 'غير مصنف', unclassCount()], ...KINDS.map(([k, l]) => [k, l, (db[k] || []).length])];
    const o = ([k, l, n]) => `<option value="${esc(k)}" ${k === cur ? 'selected' : ''}>${esc(l)} (${n})</option>`;
    const tc = titleCounts();
    return `<select class="msubsel" data-msubsel aria-label="فئة الأعضاء">${opts.map(o).join('')}${tc.length ? `<optgroup label="مسميات أخرى">${tc.length > 1 ? o(['titled', 'كل المسميات الأخرى', tc.reduce((a, x) => a + x[1], 0)]) : ''}${tc.map(([t, n]) => o(['t:' + t, t, n])).join('')}</optgroup>` : ''}</select>`;
  }
  function titledView(only) {
    const list = titledList().filter(e => !only || clsOf(e).kind === only).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    const titles = [...new Set(['إداري', ...list.map(e => clsOf(e).kind)])];
    const opts = cur => `${Object.entries(CLS_ROLES).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}${titles.map(t => `<option value="t:${esc(t)}" ${cur === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}<option value="__other">غير ذلك (مسمى جديد)…</option>`;
    const rows = list.map((e, i) => `<tr><td>${i + 1}</td><td>${esc(e.name)}${e.status === 'متوقف' ? ' <span class="tag">متوقف</span>' : ''}</td><td>${esc(clsOf(e).kind)}</td><td>${esc(e.role || '—')}</td><td>${esc(e.place || '—')}</td>
      <td><select class="mini" data-cls="${esc(e.id)}" aria-label="تصنيف ${esc(e.name)}">${opts(clsOf(e).kind)}</select></td></tr>`).join('');
    return `<div class="card"><div class="bar">${picker(only ? 't:' + only : 'titled')}</div>
      <div class="note">موظفو المرتبات المصنَّفون بمسميات غير «معلم» و«مشرف» و«مدير» (مثل إداري). ليس لهم حساب دخول، ويمكنك تغيير تصنيف أي منهم من عمود «تغيير التصنيف».</div>
      ${list.length ? `<div class="tbl"><table><tr><th>#</th><th>الاسم</th><th>المسمى</th><th>الوظيفة في المرتبات</th><th>المكان</th><th>تغيير التصنيف</th></tr>${rows}</table></div>` : empty('لا يوجد مصنفون بمسميات أخرى.')}</div>`;
  }
  const baseMembers = adminViews.members;
  adminViews.members = () => {
    /* مسمى لم يعد له أحد (أُعيد تصنيف آخر أفراده): الانتقال إلى «كل المسميات الأخرى» أو «غير مصنف» */
    const tc = titleCounts();
    if ((String(ui.msub).startsWith('t:') && !tc.some(([t]) => 't:' + t === ui.msub)) || (ui.msub === 'titled' && tc.length < 2)) {
      ui.msub = tc.length === 1 ? 't:' + tc[0][0] : tc.length ? 'titled' : 'unclassified'; saveTab();
    }
    if (ui.msub === 'titled') return `<div class="memview">${titledView()}</div>`;
    if (String(ui.msub).startsWith('t:')) return `<div class="memview">${titledView(ui.msub.slice(2))}</div>`;
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

  /* ===== تكبير وتصغير نص الجداول (يُحفظ على هذا الجهاز ويسري على كل الجداول) ===== */
  const ZK = 'qtable_zoom', ZMIN = 0.7, ZMAX = 1.8;
  let zoom = 1;
  try { zoom = Math.min(ZMAX, Math.max(ZMIN, +localStorage.getItem(ZK) || 1)); } catch (e) { /* ignore */ }
  const pct = () => Math.round(zoom * 100) + '%';
  function applyZoom() {
    document.documentElement.style.setProperty('--tz', zoom);
    document.querySelectorAll('[data-tzv]').forEach(b => { b.textContent = pct(); });
    /* إعادة حساب مواضع الأعمدة الثابتة (المسلسل والاسم) بعد تغيّر العرض */
    window.dispatchEvent(new Event('resize'));
  }
  const zoomBtns = () => `<span class="tzoom noprint"><button type="button" class="btn sm" data-tz="-1" title="تصغير النص" aria-label="تصغير النص">أ−</button><button type="button" class="btn sm" data-tz="0" data-tzv title="الحجم الأصلي" aria-label="الحجم الأصلي">${pct()}</button><button type="button" class="btn sm" data-tz="1" title="تكبير النص" aria-label="تكبير النص">أ+</button></span>`;
  /* أزرار الحجم توضع بجانب زر الطباعة فوق كل جدول (بعد أن يضعه التطبيق) */
  function addZoom() {
    document.querySelectorAll('main .tbl:not([data-zm])').forEach(t => {
      if (!t.querySelector('table td')) return;
      t.dataset.zm = '1';
      let bar = t.previousElementSibling;
      if (!bar || !bar.classList.contains('tblprint')) { bar = document.createElement('div'); bar.className = 'tblprint noprint'; t.parentNode.insertBefore(bar, t); }
      bar.insertAdjacentHTML('afterbegin', zoomBtns());
      /* أيقونتا Excel وPDF بجانب أيقونة الطباعة */
      const pr = bar.querySelector('[data-print]');
      if (pr) pr.insertAdjacentHTML('beforebegin', expBtns()); else bar.insertAdjacentHTML('beforeend', expBtns());
      /* زر تعديل رؤوس الأعمدة (للمدير) بجانب الطباعة */
      if (session?.role === 'admin') (pr || bar.lastElementChild).insertAdjacentHTML('afterend', `<button type="button" class="btn" data-heads title="تعديل رؤوس الأعمدة" aria-label="تعديل رؤوس الأعمدة">${HEAD_ICON}</button>`);
      applyLabels(t.querySelector('table'));
    });
  }
  new MutationObserver(ms => { if (ms.some(m => m.addedNodes.length)) requestAnimationFrame(addZoom); }).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-tz]'); if (!b) return;
    const d = +b.dataset.tz;
    zoom = d ? Math.min(ZMAX, Math.max(ZMIN, Math.round((zoom + d * 0.1) * 10) / 10)) : 1;
    try { localStorage.setItem(ZK, String(zoom)); } catch (err) { /* ignore */ }
    applyZoom();
  });
  applyZoom();

  /* ===== حفظ الجدول ملف Excel (‎.xlsx‎ حقيقي يُبنى على الجهاز) أو PDF (عبر «حفظ بتنسيق PDF» في نافذة الطباعة) ===== */
  const DOC = '<path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7z"/><path d="M14 3v4h4"/>';
  const expBtn = (k, label, color, title) => `<button type="button" class="btn texp" data-${k} title="${title}" aria-label="${title}" style="color:${color}">${svg(DOC + '<path d="M9 13h6M9 16.5h4"/>')}<b>${label}</b></button>`;
  const expBtns = () => expBtn('xls', 'Excel', '#1d6f42', 'حفظ الجدول ملف Excel') + expBtn('pdf', 'PDF', '#b3372f', 'حفظ الجدول ملف PDF');
  /* بيانات الجدول كما تُعرض: صف العناوين ثم الصفوف، دون أعمدة الأزرار ومربعات التحديد */
  function tableData(tbl) {
    const G = tableGrid(tbl);
    const rows = G.rows.slice(G.H).map((tr, k) => ({ sum: tr.classList.contains('sum'), t: Array.from({ length: G.ncol }, (_, j) => { const g = G.grid[G.H + k][j]; return g && g.first ? cellText(g.td) : ''; }) }));
    const keep = Array.from({ length: G.ncol }, (_, j) => !G.grid[0]?.[j]?.td.classList.contains('noprint') && rows.some(r => r.t[j]));
    const cols = keep.map((k, j) => (k ? j : -1)).filter(j => j > -1);
    return { head: cols.map(j => G.labels[j] || ''), rows: rows.map(r => ({ sum: r.sum, t: cols.map(j => r.t[j]) })) };
  }
  const tableTitle = tbl => ((tbl.closest('.card')?.querySelector('h2')?.textContent || document.querySelector('.ttl')?.textContent || 'جدول').trim());
  /* ضغط ZIP بلا ضغط (store) — يكفي لملف Excel */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zip(files, type) {
    const enc = new TextEncoder(), parts = [], central = []; let off = 0;
    for (const f of files) {
      const name = enc.encode(f.name), d = enc.encode(f.text), crc = crc32(d);
      const h = new DataView(new ArrayBuffer(30));
      [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [12, 0x21, 2], [14, crc, 4], [18, d.length, 4], [22, d.length, 4], [26, name.length, 2]].forEach(([o, v, n]) => (n === 4 ? h.setUint32(o, v, true) : h.setUint16(o, v, true)));
      parts.push(new Uint8Array(h.buffer), name, d);
      const c = new DataView(new ArrayBuffer(46));
      [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [14, 0x21, 2], [16, crc, 4], [20, d.length, 4], [24, d.length, 4], [28, name.length, 2], [42, off, 4]].forEach(([o, v, n]) => (n === 4 ? c.setUint32(o, v, true) : c.setUint16(o, v, true)));
      central.push(new Uint8Array(c.buffer), name);
      off += 30 + name.length + d.length;
    }
    const size = central.reduce((a, x) => a + x.length, 0), e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, size, true); e.setUint32(16, off, true);
    return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type });
  }
  const xesc = v => String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  const colName = i => { let s = ''; for (i++; i; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; };
  function xlsxBlob(title, D) {
    const isNum = t => /^-?\d{1,3}(,\d{3})*(\.\d+)?$|^-?\d+(\.\d+)?$/.test(t) && !/^0\d/.test(t);
    const cell = (t, r, c, st) => (t === '' ? '' : isNum(t) ? `<c r="${colName(c)}${r}" s="${st}"><v>${t.replace(/,/g, '')}</v></c>` : `<c r="${colName(c)}${r}" t="inlineStr" s="${st}"><is><t xml:space="preserve">${xesc(t)}</t></is></c>`);
    const all = [D.head, ...D.rows.map(r => r.t)];
    const widths = D.head.map((_, j) => Math.min(60, Math.max(6, ...all.map(r => String(r[j] || '').length)) * 1.15 + 2));
    const rows = [`<row r="1">${D.head.map((t, j) => cell(t, 1, j, 1)).join('')}</row>`, ...D.rows.map((r, i) => `<row r="${i + 2}">${r.t.map((t, j) => cell(t, i + 2, j, r.sum ? 3 : 2)).join('')}</row>`)].join('');
    const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView rightToLeft="1" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths.map((w, j) => `<col min="${j + 1}" max="${j + 1}" width="${w.toFixed(1)}" customWidth="1"/>`).join('')}</cols><sheetData>${rows}</sheetData></worksheet>`;
    const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE7ECF4"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FFB7C0CF"/></left><right style="thin"><color rgb="FFB7C0CF"/></right><top style="thin"><color rgb="FFB7C0CF"/></top><bottom style="thin"><color rgb="FFB7C0CF"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
    const sheetName = xesc(title.replace(/[\[\]:*?/\\]/g, ' ').slice(0, 31) || 'جدول');
    return zip([
      { name: '[Content_Types].xml', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
      { name: '_rels/.rels', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets></workbook>` },
      { name: 'xl/_rels/workbook.xml.rels', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { name: 'xl/styles.xml', text: styles },
      { name: 'xl/worksheets/sheet1.xml', text: sheet }
    ], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }
  function saveXlsx(tbl) {
    const title = tableTitle(tbl), D = tableData(tbl);
    if (!D.rows.length) { toast('الجدول فارغ'); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(xlsxBlob(title, D));
    a.download = `${title.replace(/[\\/:*?"<>|]/g, ' ').trim() || 'جدول'} ${today()}.xlsx`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast(`حُفظ «${a.download}» — ${D.rows.length} صفًا`);
  }
  /* PDF: نافذة الطباعة نفسها (باختيار الأعمدة والصفوف)، مع إرشاد لاختيار «حفظ بتنسيق PDF» */
  function savePdf(tbl) {
    printTable(tbl);
    const dlg = [...document.querySelectorAll('.prdlg')].pop(); if (!dlg) return;
    dlg.querySelector('h2').textContent = 'حفظ الجدول PDF';
    dlg.querySelector('[data-go]').textContent = 'متابعة إلى الحفظ';
    const n = [...dlg.querySelectorAll('p.muted')].pop();
    if (n) { n.innerHTML = 'بعد الضغط على «متابعة إلى الحفظ» تفتح نافذة الطباعة: اختر في «الوجهة» <b>«حفظ بتنسيق PDF»</b> (Save as PDF) ثم «حفظ».'; n.style.cssText = 'font-size:.88rem;margin:.6rem 0 0;padding:.5rem .7rem;border-radius:8px;background:var(--gold-l);color:var(--text)'; }
  }
  document.addEventListener('click', e => {
    const x = e.target.closest('[data-xls],[data-pdf]'); if (!x) return;
    const tbl = x.closest('.tblprint')?.nextElementSibling?.querySelector('table'); if (!tbl) return;
    if ('xls' in x.dataset) saveXlsx(tbl); else savePdf(tbl);
  });

  /* ===== تعديل رؤوس الأعمدة =====
     الأسماء الجديدة تُحفظ في الإعدادات (col_labels) فيراها كل المستخدمين، ولكل جدول أسماؤه:
     الجدول يُعرف بالقسم وبرؤوسه الأصلية، والاسم الأصلي يُحفظ على الخلية حتى يمكن استعادته. */
  const HEAD_ICON = svg('<path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="M13.5 6.5l3 3"/>');
  const LBL = () => db.settings.col_labels || {};
  const thsOf = tbl => [...tbl.rows].slice(0, firstData(tbl)).flatMap(tr => [...tr.cells]);
  const origOf = th => th.dataset.orig ?? (th.dataset.orig = th.textContent.replace(/\s+/g, ' ').trim());
  const keyOf = tbl => (ui.tab || '') + '::' + thsOf(tbl).map(origOf).join('|');
  function setThText(th, t) {
    const tn = [...th.childNodes].find(n => n.nodeType === 3 && n.textContent.trim());
    if (tn) tn.textContent = t; else if (!th.children.length) th.textContent = t;
  }
  function applyLabels(tbl) {
    if (!tbl) return;
    const m = LBL()[keyOf(tbl)] || {};
    thsOf(tbl).forEach(th => {
      const o = origOf(th); if (!o) return;
      /* تثبيت المسلسل والاسم يتعرّف على أعمدة البداية بنص رأسها («#» أو «م»…)، فيُضاف الاسم الجديد إلى قائمتها */
      try { if (m[o] && LEAD.has(o)) LEAD.add(m[o]); } catch (e) { /* ignore */ }
      setThText(th, m[o] || o);
    });
  }
  function editHeads(tbl) {
    if (session?.role !== 'admin') return;
    const key = keyOf(tbl), cur = LBL()[key] || {};
    const origs = [...new Set(thsOf(tbl).map(origOf).filter(Boolean))];
    if (!origs.length) { toast('لا توجد رؤوس أعمدة في هذا الجدول'); return; }
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="modal"><h2>تعديل رؤوس الأعمدة</h2>
      <p class="muted" style="font-size:.85rem;margin:0 0 .6rem">الأسماء الجديدة تظهر لكل المستخدمين، وفي الطباعة وملفات Excel وPDF. اترك الخانة كما هي أو فارغة لإبقاء الاسم الأصلي.</p>
      <div class="tbl"><table><tr><th>الاسم الأصلي</th><th>الاسم الجديد</th></tr>
      ${origs.map((o, i) => `<tr><td class="muted">${esc(o)}</td><td><input data-hi="${i}" value="${esc(cur[o] || o)}" style="min-width:12rem"></td></tr>`).join('')}</table></div>
      <div class="row"><button type="button" class="btn primary" data-hsave>حفظ</button><button type="button" class="btn" data-hreset>استعادة الأسماء الأصلية</button><button type="button" class="btn" data-close>إلغاء</button></div></div>`;
    document.body.appendChild(ov);
    const put = m => { const all = { ...LBL() }; if (Object.keys(m).length) all[key] = m; else delete all[key]; db.settings.col_labels = all; save(); ov.remove(); render(); };
    ov.addEventListener('click', e => {
      if (e.target.closest('[data-close]')) { ov.remove(); return; }
      if (e.target.closest('[data-hreset]')) { put({}); toast('عادت الأسماء الأصلية'); return; }
      if (e.target.closest('[data-hsave]')) {
        const m = {};
        ov.querySelectorAll('[data-hi]').forEach(x => { const o = origs[+x.dataset.hi], v = x.value.replace(/\s+/g, ' ').trim(); if (v && v !== o) m[o] = v; });
        put(m); toast('حُفظت رؤوس الأعمدة');
      }
    });
    ov.querySelector('[data-hi]')?.focus();
  }
  document.addEventListener('click', e => {
    const h = e.target.closest('[data-heads]'); if (!h) return;
    const tbl = h.closest('.tblprint')?.nextElementSibling?.querySelector('table'); if (tbl) editHeads(tbl);
  });

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
