'use strict';
/* ============ الاختبارات ============
   الأنواع: متابعة (المشرف: 2–3 أسئلة وملاحظات تصل للمعلم) — دوري (المعلم أو المشرف: سؤال في الجديد و1–2 في المراجعة)
   — إتقان (المشرف: 4 أسئلة في جزء) — مسابقة (المشرفون والمدير: 2–5 أسئلة حسب مستوى المسابقة).
   التصحيح بالخصم من درجة السؤال: الأخطاء والتنبيهات وأخطاء التجويد، وكل القيم يضبطها المدير من «إعدادات التصحيح».
   الصلاحيات الحقيقية على الخادم (exams.sql): كل نوع لمن يحق له ولطلاب حلقاته فقط. */
(() => {
  const ET = {
    follow: { l: 'متابعة', roles: ['supervisor', 'admin'] },
    periodic: { l: 'دوري', roles: ['teacher', 'supervisor', 'admin'] },
    mastery: { l: 'إتقان', roles: ['supervisor', 'admin'] },
    comp: { l: 'مسابقة', roles: ['supervisor', 'admin'] }
  };
  /* بدايات الأجزاء الثلاثين: [السورة، الآية] */
  const JUZ = [[1, 1], [2, 142], [2, 253], [3, 93], [4, 24], [4, 148], [5, 82], [6, 111], [7, 88], [8, 41], [9, 93], [11, 6], [12, 53], [15, 1], [17, 1],
    [18, 75], [21, 1], [23, 1], [25, 21], [27, 56], [29, 46], [33, 31], [36, 28], [39, 32], [41, 47], [46, 1], [51, 31], [58, 1], [67, 1], [78, 1]];
  const START = []; SURAHS.reduce((a, s, i) => { START[i] = a; return a + s[1]; }, 0);
  const TOTAL = START[113] + SURAHS[113][1];
  const gIdx = (s, a) => START[s - 1] + a - 1;
  const fromG = g => { let s = 0; while (s < 113 && START[s + 1] <= g) s++; return [s + 1, g - START[s] + 1]; };
  const juzRange = j => [gIdx(...JUZ[j - 1]), j < 30 ? gIdx(...JUZ[j]) - 1 : TOTAL - 1];
  const st = { ftype: '' };
  const SEEN = () => 'exam_seen_' + (session?.id || '');
  const seen = () => { try { return new Set(JSON.parse(localStorage.getItem(SEEN()) || '[]')); } catch (e) { return new Set(); } };
  const markSeen = ids => { try { localStorage.setItem(SEEN(), JSON.stringify([...new Set([...seen(), ...ids])].slice(-500))); } catch (e) { /* ignore */ } };

  /* إعدادات التصحيح (يضبطها المدير): درجة السؤال وقيمة كل خصم وحدود التقديرات */
  const DEF = { q: 10, err: 1, warn: 0.5, taj: 0.25, b1: 90, b2: 80, b3: 65, b4: 50 };
  const cfg = () => ({ ...DEF, ...(db.settings.exam_cfg || {}) });
  const r2 = n => Math.round(n * 100) / 100;
  const qScore = (q, c = cfg()) => r2(Math.max(0, c.q - (+q.err || 0) * c.err - (+q.warn || 0) * c.warn - (+q.taj || 0) * c.taj));
  const gradeOf = (pct, c = cfg()) => pct >= c.b1 ? 'ممتاز' : pct >= c.b2 ? 'جيد جدًا' : pct >= c.b3 ? 'جيد' : pct >= c.b4 ? 'مقبول' : 'ضعيف';
  const comps = () => db.settings.exam_comps || [];
  const exams = () => db.exams || (db.exams = []);
  const allowed = () => Object.keys(ET).filter(k => ET[k].roles.includes(session?.role));
  const myStudents = () => session.role === 'admin' ? db.students : db.students.filter(s => myHalaqat().some(h => h.id === s.halaqaId));
  const pos = q => q.surah ? `سورة ${SURAHS[q.surah - 1][0]} (${q.from}${q.to && q.to !== q.from ? '–' + q.to : ''})` : '—';

  /* التبويب */
  TABS.admin.splice(TABS.admin.findIndex(t => t[0] === 'students') + 1, 0, ['exams', 'الاختبارات']);
  TABS.teacher.splice(TABS.teacher.findIndex(t => t[0] === 'mine') + 1, 0, ['exams', 'الاختبارات']);
  TABS.supervisor.splice(TABS.supervisor.findIndex(t => t[0] === 'mine') + 1, 0, ['exams', 'الاختبارات']);
  TAB_ICONS.exams = svg('<path d="M9 4h6l1 2h3v15H5V6h3z"/><path d="M9 4v3h6V4"/><path d="M8.5 13l2 2 4-4"/>');
  setTimeout(() => { try { if (!VFILES.includes('./exams.js')) VFILES.push('./exams.js'); } catch (e) { /* ignore */ } }, 0);

  /* ملاحظات اختبارات المتابعة التي تصل لمعلم الحلقة */
  const notesForMe = () => session?.role !== 'teacher' ? [] : exams().filter(e => e.type === 'follow' && e.note && e.examinerId !== session.id && myStudents().some(s => s.id === e.studentId));

  function view() {
    const role = session.role, types = allowed();
    const list = exams().filter(e => !st.ftype || e.type === st.ftype).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const canDel = e => role === 'admin' || e.examinerId === session.id;
    const rows = list.map((e, i) => `<tr><td>${i + 1}</td><td>${esc(e.date)}</td><td>${esc(sName(e.studentId))}</td><td>${esc(hName(byId(db.students, e.studentId)?.halaqaId || e.halaqaId))}</td>
      <td><span class="tag">${ET[e.type]?.l || e.type}</span>${e.type === 'mastery' && e.juz ? ` جزء ${e.juz}` : ''}${e.type === 'comp' && e.level ? ` ${esc(e.level)}` : ''}</td><td>${esc(e.examinerName || '—')}</td>
      <td>${e.total === '' ? '—' : `${e.total} / ${e.max}`}</td><td>${esc(e.grade || '—')}</td>
      <td><button type="button" class="btn sm" data-exopen="${e.id}">عرض</button>${canDel(e) ? `<button type="button" class="btn sm danger" data-exdel="${e.id}">حذف</button>` : ''}</td></tr>`).join('');
    const N = notesForMe(), S = seen(), fresh = N.filter(e => !S.has(e.id)).length;
    const notes = role === 'teacher' && N.length ? `<div class="card"><h2>ملاحظات المشرف على اختبارات المتابعة${fresh ? ` <span class="tag tag-no">${fresh} جديدة</span>` : ''}</h2>
      ${N.sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 30).map(e => `<div class="news"${S.has(e.id) ? '' : ' style="border-inline-start:4px solid var(--gold)"'}><b>${esc(sName(e.studentId))}</b> — ${esc(e.grade || '')} (${e.total} / ${e.max})<br>${esc(e.note)}<br><small>${esc(e.date)} — ${esc(e.examinerName)}</small></div>`).join('')}</div>` : '';
    if (role === 'teacher' && fresh) setTimeout(() => markSeen(N.map(e => e.id)), 0);
    const c = cfg();
    const admin = role !== 'admin' ? '' : `<div class="card"><div class="bar"><h2 class="grow" style="margin:0">إعدادات التصحيح</h2><button type="button" class="btn" data-excfg>تعديل</button></div>
      <p class="muted" style="margin:0">درجة السؤال <b>${c.q}</b> — يُخصم لكل خطأ <b>${c.err}</b>، ولكل تنبيه <b>${c.warn}</b>، ولكل خطأ تجويد <b>${c.taj}</b>. التقديرات: ممتاز من ${c.b1}%، جيد جدًا من ${c.b2}%، جيد من ${c.b3}%، مقبول من ${c.b4}%، وما دونه ضعيف.</p></div>
      <div class="card"><div class="bar"><h2 class="grow" style="margin:0">المسابقات ومستوياتها</h2><button type="button" class="btn" data-excomp>+ مسابقة</button></div>
      ${comps().length ? comps().map(cp => `<div class="news"><div class="bar" style="margin:0"><b class="grow">${esc(cp.name)}</b><button type="button" class="btn sm" data-exlevel="${cp.id}">+ مستوى</button><button type="button" class="btn sm danger" data-excompdel="${cp.id}">حذف</button></div>
        ${(cp.levels || []).length ? `<div class="tbl"><table><tr><th>المستوى</th><th>الأجزاء</th><th>عدد الأسئلة</th><th></th></tr>${cp.levels.map(lv => `<tr><td>${esc(lv.name)}</td><td>من ${lv.from} إلى ${lv.to}</td><td>${lv.q}</td><td><button type="button" class="btn sm danger" data-exleveldel="${cp.id}|${lv.id}">حذف</button></td></tr>`).join('')}</table></div>` : '<p class="muted" style="margin:.3rem 0 0">لا توجد مستويات بعد.</p>'}</div>`).join('') : empty('لا توجد مسابقات. أضف مسابقة ثم مستوياتها (الأجزاء وعدد الأسئلة من 2 إلى 5).')}</div>`;
    return `${notes}<div class="card"><div class="bar"><h2 class="grow" style="margin:0">الاختبارات (${list.length})</h2>
        <select data-exftype style="width:auto"><option value="">كل الأنواع</option>${Object.entries(ET).map(([k, v]) => `<option value="${k}" ${st.ftype === k ? 'selected' : ''}>${v.l}</option>`).join('')}</select>
        ${types.length ? '<button type="button" class="btn primary" data-exnew>+ اختبار جديد</button>' : ''}</div>
      ${list.length ? `<div class="tbl"><table><tr><th>#</th><th>التاريخ</th><th>الطالب</th><th>الحلقة</th><th>النوع</th><th>المختبِر</th><th>الدرجة</th><th>التقدير</th><th></th></tr>${rows}</table></div>` : empty('لا توجد اختبارات بعد.')}</div>${admin}`;
  }

  /* اقتراح مواضع الأسئلة عشوائيًا من النطاق الصحيح لكل نوع */
  const SPAN = 5;
  const randIn = ranges => {
    const total = ranges.reduce((a, [lo, hi]) => a + (hi - lo + 1), 0); if (!total) return null;
    let k = Math.floor(Math.random() * total);
    for (const [lo, hi] of ranges) { const n = hi - lo + 1; if (k < n) { const [s, a] = fromG(lo + k); return { surah: s, from: a, to: Math.min(a + SPAN - 1, SURAHS[s - 1][1]) }; } k -= n; }
    return null;
  };
  const hifzRanges = sid => recsOf(sid).filter(r => r.type === 'حفظ' && r.surah).map(r => [gIdx(+r.surah, +r.from), gIdx(+r.surah, +r.to)]);
  function suggest(type, sid, n, juz, level) {
    const all = hifzRanges(sid), out = [];
    if (type === 'periodic') {
      const [latest, ...older] = all;
      out.push(randIn(latest ? [latest] : [juzRange(30)]));
      for (let i = 1; i < n; i++) out.push(randIn(older.length ? older : latest ? [latest] : [juzRange(30)]));
    } else if (type === 'mastery') for (let i = 0; i < n; i++) out.push(randIn([juzRange(juz || 30)]));
    else if (type === 'comp') { const lv = level || { from: 30, to: 30 }; const R = []; for (let j = lv.from; j <= lv.to; j++) R.push(juzRange(j)); for (let i = 0; i < n; i++) out.push(randIn(R)); }
    else for (let i = 0; i < n; i++) out.push(randIn(all.length ? all : [juzRange(30)]));
    return out;
  }

  const SURAH_OPTS = SURAHS.map((s, i) => `<option value="${i + 1}">${i + 1}. ${s[0]}</option>`).join('');
  function examForm(ex) {
    const mine = !ex || session.role === 'admin' || ex.examinerId === session.id, types = allowed();
    if (!ex && !types.length) return;
    const e = ex ? JSON.parse(JSON.stringify(ex)) : { id: uid(), type: types[0], date: today(), studentId: '', questions: [], note: '', n: 2, rn: 1, juz: '', comp: '', level: '' };
    if (ex) { e.n = e.type === 'follow' ? e.questions.length : 2; e.rn = e.type === 'periodic' ? Math.max(1, e.questions.length - 1) : 1; }
    const ro = !mine;
    const studs = myStudents().slice().sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="modal wide"><h2>${ex ? (ro ? 'نتيجة اختبار' : 'تعديل اختبار') : 'اختبار جديد'}</h2>
      <div class="two"><label>النوع<select name="type" ${ro || ex ? 'disabled' : ''}>${(ex ? [e.type] : types).map(k => `<option value="${k}" ${k === e.type ? 'selected' : ''}>${ET[k].l}</option>`).join('')}</select></label>
        <label>التاريخ<input type="date" name="date" value="${esc(e.date)}" ${ro ? 'disabled' : ''}></label></div>
      <label>الطالب<select name="sid" ${ro || ex ? 'disabled' : ''}><option value="">— اختر الطالب —</option>${(ex && !studs.some(s => s.id === e.studentId) ? [byId(db.students, e.studentId) || { id: e.studentId, name: sName(e.studentId) }] : []).concat(studs).map(s => `<option value="${s.id}" ${s.id === e.studentId ? 'selected' : ''}>${esc(s.name)} — ${esc(hName(s.halaqaId))}</option>`).join('')}</select></label>
      <div data-exextra class="two"></div>
      ${ro ? '' : '<div class="bar" style="margin:.4rem 0"><button type="button" class="btn" data-exsug>اقتراح أسئلة</button><span class="muted" style="font-size:.85rem">يختار مواضع عشوائية من النطاق المناسب، ويمكنك تعديلها.</span></div>'}
      <div class="tbl"><table data-exq></table></div>
      <p data-extot style="margin:.6rem 0;font-weight:700"></p>
      <label data-exnotel>ملاحظات<textarea name="note" rows="3" ${ro ? 'disabled' : ''}>${esc(e.note || '')}</textarea></label>
      <div class="row">${ro ? '' : '<button type="button" class="btn primary" data-exsave>حفظ</button>'}<button type="button" class="btn" data-close>${ro ? 'إغلاق' : 'إلغاء'}</button></div></div>`;
    document.body.appendChild(ov);
    const $ = q => ov.querySelector(q), val = n => ov.querySelector(`[name="${n}"]`)?.value ?? '';
    const level = () => { const cp = comps().find(x => x.id === e.comp); return cp?.levels?.find(l => l.id === e.level) || null; };
    const count = () => e.type === 'follow' ? +e.n || 2 : e.type === 'periodic' ? 1 + (+e.rn || 1) : e.type === 'mastery' ? 4 : (level()?.q || 2);
    const label = i => e.type === 'periodic' ? (i === 0 ? 'جديد' : 'مراجعة' + (count() > 2 ? ' ' + i : '')) : 'سؤال ' + (i + 1);
    function extra() {
      const dis = ro ? 'disabled' : '';
      const x = e.type === 'follow' ? `<label>عدد الأسئلة<select name="n" ${dis}>${[2, 3].map(n => `<option ${+e.n === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`
        : e.type === 'periodic' ? `<label>أسئلة المراجعة<select name="rn" ${dis}>${[1, 2].map(n => `<option ${+e.rn === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`
        : e.type === 'mastery' ? `<label>الجزء<select name="juz" ${dis}><option value="">— اختر الجزء —</option>${Array.from({ length: 30 }, (_, i) => `<option value="${i + 1}" ${+e.juz === i + 1 ? 'selected' : ''}>الجزء ${i + 1}</option>`).join('')}</select></label>`
        : `<label>المسابقة<select name="comp" ${dis}><option value="">— اختر —</option>${comps().map(c => `<option value="${c.id}" ${c.id === e.comp ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
           <label>المستوى<select name="level" ${dis}><option value="">— اختر —</option>${(comps().find(c => c.id === e.comp)?.levels || []).map(l => `<option value="${l.id}" ${l.id === e.level ? 'selected' : ''}>${esc(l.name)} (${l.q} أسئلة)</option>`).join('')}</select></label>`;
      $('[data-exextra]').innerHTML = x;
      $('[data-exnotel]').firstChild.textContent = e.type === 'follow' ? 'ملاحظات للمعلم (تصله في تبويب «الاختبارات»)' : 'ملاحظات';
    }
    const num = (n, v) => ro ? `<td>${v || 0}</td>` : `<td><input type="number" min="0" step="1" data-q="${n}" value="${esc(v ?? '')}" style="width:4.2rem"></td>`;
    function table() {
      const n = count();
      while (e.questions.length < n) e.questions.push({ surah: '', from: '', to: '', err: '', warn: '', taj: '' });
      e.questions.length = n;
      $('[data-exq]').innerHTML = `<tr><th></th><th>السورة</th><th>من آية</th><th>إلى آية</th><th>أخطاء</th><th>تنبيهات</th><th>تجويد</th><th>الدرجة</th></tr>` + e.questions.map((q, i) => `<tr data-qi="${i}"><td><b>${label(i)}</b></td>
        <td>${ro ? esc(q.surah ? SURAHS[q.surah - 1][0] : '—') : `<select data-q="surah" style="width:auto"><option value="">—</option>${SURAH_OPTS.replace(`value="${q.surah}"`, `value="${q.surah}" selected`)}</select>`}</td>
        ${num('from', q.from)}${num('to', q.to)}${num('err', q.err)}${num('warn', q.warn)}${num('taj', q.taj)}<td data-qs>${qScore(q)}</td></tr>`).join('');
      totals();
    }
    function totals() {
      const c = cfg(), max = e.questions.length * c.q, tot = r2(e.questions.reduce((a, q) => a + qScore(q, c), 0)), pct = max ? tot * 100 / max : 0;
      ov.querySelectorAll('[data-qi]').forEach(tr => { tr.querySelector('[data-qs]').textContent = qScore(e.questions[+tr.dataset.qi], c); });
      $('[data-extot]').textContent = `المجموع: ${tot} من ${max} (${Math.round(pct)}%) — ${gradeOf(pct, c)}`;
      return { max, tot, grade: gradeOf(pct, c) };
    }
    extra(); table();
    ov.addEventListener('change', ev => {
      const t = ev.target, nm = t.name;
      if (t.dataset.q) { const q = e.questions[+t.closest('[data-qi]').dataset.qi]; q[t.dataset.q] = t.value; totals(); return; }
      if (nm === 'type') { e.type = t.value; extra(); table(); }
      else if (nm === 'n') { e.n = +t.value; table(); }
      else if (nm === 'rn') { e.rn = +t.value; table(); }
      else if (nm === 'juz') e.juz = t.value;
      else if (nm === 'comp') { e.comp = t.value; e.level = ''; extra(); table(); }
      else if (nm === 'level') { e.level = t.value; table(); }
    });
    ov.addEventListener('input', ev => { const t = ev.target; if (t.dataset.q && t.tagName === 'INPUT') { e.questions[+t.closest('[data-qi]').dataset.qi][t.dataset.q] = t.value; totals(); } });
    ov.addEventListener('click', ev => {
      if (ev.target.closest('[data-close]')) { ov.remove(); return; }
      if (ev.target.closest('[data-exsug]')) {
        const sid = val('sid') || e.studentId;
        if (!sid && e.type !== 'mastery' && e.type !== 'comp') { toast('اختر الطالب أولًا'); return; }
        if (e.type === 'mastery' && !e.juz) { toast('اختر الجزء أولًا'); return; }
        if (e.type === 'comp' && !level()) { toast('اختر المسابقة والمستوى أولًا'); return; }
        suggest(e.type, sid, count(), +e.juz, level()).forEach((p, i) => { if (p) Object.assign(e.questions[i], p); });
        table(); return;
      }
      if (!ev.target.closest('[data-exsave]')) return;
      const sid = val('sid') || e.studentId;
      if (!sid) { toast('اختر الطالب'); return; }
      if (e.type === 'mastery' && !e.juz) { toast('اختر الجزء'); return; }
      if (e.type === 'comp' && !level()) { toast('اختر المسابقة والمستوى'); return; }
      for (const [i, q] of e.questions.entries()) {
        if (!q.surah || !q.from) { toast(`حدّد موضع «${label(i)}»`); return; }
        const n = SURAHS[q.surah - 1][1], f = +q.from, to = +(q.to || q.from);
        if (f < 1 || f > n || to < f || to > n) { toast(`آيات «${label(i)}» غير صحيحة (سورة ${SURAHS[q.surah - 1][0]} ${n} آية)`); return; }
        if ([q.err, q.warn, q.taj].some(x => x !== '' && x != null && +x < 0)) { toast('عدد الأخطاء لا يكون سالبًا'); return; }
      }
      const T = totals(), stu = byId(db.students, sid);
      const rec = { id: e.id, studentId: sid, halaqaId: stu?.halaqaId || '', type: e.type, date: val('date') || today(), examinerId: ex ? ex.examinerId : session.id, examinerName: ex ? ex.examinerName : (me()?.name || ''),
        juz: e.type === 'mastery' ? +e.juz : '', comp: e.type === 'comp' ? e.comp : '', level: e.type === 'comp' ? (level()?.name || '') : '',
        questions: e.questions.map((q, i) => ({ label: label(i), surah: +q.surah, from: +q.from, to: +(q.to || q.from), err: +q.err || 0, warn: +q.warn || 0, taj: +q.taj || 0, score: qScore(q) })),
        max: T.max, total: T.tot, grade: T.grade, note: val('note').trim() };
      const i = exams().findIndex(x => x.id === rec.id);
      if (i > -1) exams()[i] = rec; else exams().push(rec);
      ov.remove(); save(); render(); toast(`حُفظ الاختبار: ${T.tot} من ${T.max} — ${T.grade}`);
    });
  }

  /* إعدادات التصحيح والمسابقات (للمدير) */
  function cfgForm() {
    const c = cfg();
    openForm('إعدادات التصحيح', [
      { type: 'note', label: 'درجة كل سؤال، وما يُخصم منها لكل خطأ وتنبيه وخطأ تجويد، وحدود التقديرات بالنسبة المئوية. التغيير يسري على الاختبارات الجديدة.' },
      { name: 'q', label: 'درجة السؤال', type: 'number', value: c.q, required: true }, { name: 'err', label: 'خصم الخطأ', type: 'number', value: c.err, required: true },
      { name: 'warn', label: 'خصم التنبيه', type: 'number', value: c.warn, required: true }, { name: 'taj', label: 'خصم خطأ التجويد', type: 'number', value: c.taj, required: true },
      { name: 'b1', label: 'ممتاز من (%)', type: 'number', value: c.b1, required: true }, { name: 'b2', label: 'جيد جدًا من (%)', type: 'number', value: c.b2, required: true },
      { name: 'b3', label: 'جيد من (%)', type: 'number', value: c.b3, required: true }, { name: 'b4', label: 'مقبول من (%)', type: 'number', value: c.b4, required: true }
    ], v => {
      const o = Object.fromEntries(Object.keys(DEF).map(k => [k, +v[k]]));
      if (!(o.q > 0)) return 'درجة السؤال أكبر من صفر';
      if (['err', 'warn', 'taj'].some(k => o[k] < 0)) return 'قيم الخصم لا تكون سالبة';
      if (!(o.b1 > o.b2 && o.b2 > o.b3 && o.b3 > o.b4 && o.b4 >= 0 && o.b1 <= 100)) return 'حدود التقديرات تتناقص: ممتاز ثم جيد جدًا ثم جيد ثم مقبول';
      db.settings.exam_cfg = o;
    });
  }
  const setComps = list => { db.settings.exam_comps = list; save(); render(); };
  function compForm() { openForm('مسابقة جديدة', [{ name: 'name', label: 'اسم المسابقة', required: true }], v => { db.settings.exam_comps = [...comps(), { id: uid(), name: v.name.trim(), levels: [] }]; }); }
  function levelForm(cid) {
    openForm('مستوى جديد', [{ name: 'name', label: 'اسم المستوى (مثال: المستوى الأول — جزء عم)', required: true },
      { name: 'from', label: 'من الجزء', type: 'number', value: 30, required: true }, { name: 'to', label: 'إلى الجزء', type: 'number', value: 30, required: true },
      { name: 'q', label: 'عدد الأسئلة (من 2 إلى 5)', type: 'select', value: 2, options: [2, 3, 4, 5].map(n => ({ v: n, l: n })) }],
    v => {
      const f = +v.from, t = +v.to;
      if (!(f >= 1 && t <= 30 && f <= t)) return 'الأجزاء من 1 إلى 30، و«من» لا تزيد على «إلى»';
      db.settings.exam_comps = comps().map(c => c.id === cid ? { ...c, levels: [...(c.levels || []), { id: uid(), name: v.name.trim(), from: f, to: t, q: +v.q }] } : c);
    });
  }

  /* نتائج الطالب في «تقدمي» */
  const baseMe = studentViews.me;
  studentViews.me = () => {
    const L = exams().filter(e => e.studentId === session.id).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return baseMe() + (L.length ? `<div class="card"><h2>نتائج الاختبارات</h2><div class="tbl"><table><tr><th>التاريخ</th><th>النوع</th><th>الدرجة</th><th>التقدير</th><th>الأسئلة</th></tr>
      ${L.map(e => `<tr><td>${esc(e.date)}</td><td>${ET[e.type]?.l || ''}${e.type === 'mastery' && e.juz ? ' — جزء ' + e.juz : ''}</td><td>${e.total} / ${e.max}</td><td>${esc(e.grade)}</td><td>${(e.questions || []).map(pos).map(esc).join('، ')}</td></tr>`).join('')}</table></div></div>` : '');
  };

  adminViews.exams = view; teacherViews.exams = view; supervisorViews.exams = view;
  /* عدّاد ملاحظات المتابعة الجديدة على تبويب المعلم */
  new MutationObserver(() => {
    const b = document.querySelector('.tabs button[data-v="exams"]'); if (!b || b.querySelector('.count') || session?.role !== 'teacher') return;
    const S = seen(), n = notesForMe().filter(e => !S.has(e.id)).length;
    if (n) b.insertAdjacentHTML('beforeend', `<span class="count">${n}</span>`);
  }).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('change', ev => { if ('exftype' in (ev.target.dataset || {})) { st.ftype = ev.target.value; render(); } });
  document.addEventListener('click', ev => {
    const t = ev.target;
    if (t.closest('[data-exnew]')) examForm(null);
    else if (t.closest('[data-exopen]')) examForm(exams().find(e => e.id === t.closest('[data-exopen]').dataset.exopen));
    else if (t.closest('[data-exdel]')) { const id = t.closest('[data-exdel]').dataset.exdel; ask('حذف هذا الاختبار؟', () => { db.exams = exams().filter(e => e.id !== id); save(); render(); }); }
    else if (t.closest('[data-excfg]')) cfgForm();
    else if (t.closest('[data-excomp]')) compForm();
    else if (t.closest('[data-exlevel]')) levelForm(t.closest('[data-exlevel]').dataset.exlevel);
    else if (t.closest('[data-excompdel]')) { const id = t.closest('[data-excompdel]').dataset.excompdel; ask('حذف المسابقة ومستوياتها؟ (نتائج اختباراتها السابقة تبقى)', () => setComps(comps().filter(c => c.id !== id))); }
    else if (t.closest('[data-exleveldel]')) { const [cid, lid] = t.closest('[data-exleveldel]').dataset.exleveldel.split('|'); setComps(comps().map(c => c.id === cid ? { ...c, levels: c.levels.filter(l => l.id !== lid) } : c)); }
  });
})();
