'use strict';
/* الجزء الثالث: الإجراءات، وأحداث الصفحة، وقاعدة البيانات، والتشغيل */
/* ============ الإجراءات ============ */
const A = {
  lmode: d => { if (!ui.pick) return; ui.pick.sel = +d.i; renderPick(); document.querySelector('#login input[name=pin]')?.focus(); },
  switchMode: () => {
    const list = sameName();
    if (!list.length) return;
    openInfo('تبديل الوضع', `<p class="muted">اختر الوضع الذي تريد الانتقال إليه:</p><div class="modes">${list.map(a => `<button type="button" class="mode" data-act="toMode" data-r="${a.role}" data-id="${esc(a.u.id)}">${ICONS[a.role]}<span>${esc(modeLabel(a, list))}</span></button>`).join('')}</div>`);
  },
  toMode: d => {
    document.querySelectorAll('.overlay').forEach(o => o.remove());
    const acc = byId(db[COLL[d.r]] || [], d.id), cur = me();
    if (!acc || !cur) return;
    const go = () => { session = { role: d.r, id: acc.id }; ss.set(SKEY, JSON.stringify(session)); ui.tab = null; ui.hid = ''; ui.shown = {}; render(); toast('أنت الآن في وضع ' + ROLE_L[d.r]); };
    if (CLOUD) { window.Cloud.setMember({ role: d.r, id: acc.id }); go(); cloudRefresh(true); return; }
    if (acc.pin === cur.pin) { go(); return; }
    openForm('كلمة مرور حساب ' + ROLE_L[d.r], [{ name: 'pin', label: 'كلمة المرور', type: 'password', required: true }], v => { if (v.pin !== acc.pin) return 'كلمة المرور غير صحيحة'; go(); });
  },
  logout: () => {
    ui.shown = {}; ui.pick = null; session = null; ss.del(SKEY); ui.tab = null;
    if (CLOUD) { const s = db.settings; window.Cloud.signOut(); db = migrate({ ...window.Cloud.emptyDb(), settings: s }); }
    render();
  },
  tab: d => { ui.tab = d.v; ui.nav = false; render(); window.scrollTo(0, 0); },
  navToggle: () => { ui.nav = !ui.nav; document.querySelector('.shell')?.classList.toggle('open', ui.nav); },
  sideToggle: () => {
    /* تبديل الصنف فقط دون إعادة الرسم، حتى تعمل الحركة الانسيابية */
    ui.collapsed = !ui.collapsed; saveUI();
    document.querySelector('.shell')?.classList.toggle('collapsed', ui.collapsed);
    const t = document.querySelector('.side-toggle'), l = ui.collapsed ? 'فرد القائمة' : 'طي القائمة';
    if (t) { t.title = l; t.setAttribute('aria-label', l); t.setAttribute('aria-expanded', String(!ui.collapsed)); }
  },
  navClose: () => { ui.nav = false; document.querySelector('.shell')?.classList.remove('open'); },
  panel: () => { if (session?.role !== 'admin') return; ui.tab = 'settings'; render(); window.scrollTo(0, 0); },
  hist: d => openInfo('سجل: ' + sName(d.id), historyTable(d.id)),

  psub: d => { ui.psub = d.v; render(); },
  editProf: d => {
    const t = byId(db.teachers, d.id), g = d.g, G = PROF[g];
    if (!t || !G || (session.role === 'teacher' && (session.id !== t.id || G.adminOnly))) { toast('غير مصرح'); return; }
    openForm(G.title, G.fields.map(f => ({ name: f[0], label: f[1], type: f[2] || 'text', value: pv(t, g, f[0]), options: f[3] && f[3].map(x => ({ v: x, l: x })) })), v => {
      if (g === 'tech' && v.memorized !== '' && (+v.memorized < 0 || +v.memorized > 30)) return 'الأجزاء المحفوظة من 0 إلى 30';
      t[g] = t[g] || {};
      G.fields.forEach(f => { const x = (v[f[0]] ?? '').trim(); if (f[0] === 'phone') t.phone = x; else t[g][f[0]] = x; });
    });
  },

  msub: d => { ui.msub = d.v; render(); },
  importMembers: d => { if (session?.role === 'admin') openImport(d.k === 'students' ? 'students' : 'teachers'); },
  togglePw: d => { ui.shown[d.id] = !ui.shown[d.id]; render(); },
  copyPw: d => {
    const m = byId(db[d.k], d.id);
    const fail = () => toast('كلمة المرور: ' + m.pin);
    try { navigator.clipboard.writeText(m.pin).then(() => toast('تم نسخ كلمة المرور'), fail); } catch (e) { fail(); }
  },
  newPw: d => {
    const m = byId(db[d.k], d.id);
    ask('إنشاء كلمة مرور جديدة لـ «' + m.name + '»؟ ستتوقف القديمة عن العمل.', () => { m.pin = genPass(); ui.shown[m.id] = true; save(); render(); });
  },
  editName: d => {
    const m = byId(db[d.k], d.id);
    openForm('تعديل الاسم', [{ name: 'name', label: 'الاسم', value: m.name, required: true }], v => { m.name = v.name.trim(); });
  },
  addMember: d => {
    const k = d.k, one = KIND_ONE[k];
    openForm('إضافة ' + one, [{ name: 'name', label: 'الاسم', required: true }, { type: 'note', label: 'ستُنشأ كلمة المرور تلقائيًا.' }], v => {
      const id = uid(), pin = genPass();
      const name = v.name.trim();
      if (db[k].some(m => norm(m.name) === norm(name))) return `يوجد ${one} بالاسم نفسه`;
      db[k].push(k === 'students' ? { id, name, halaqaId: '', phone: '', pin } : k === 'admins' ? { id, name, pin } : { id, name, phone: '', pin });
      ui.shown[id] = true;
      if (CLOUD) setTimeout(() => cloudMakeLogins([byId(db[k], id)].filter(Boolean)), 0);
      else toast('تم إنشاء الحساب — كلمة المرور: ' + pin);
    });
  },

  addTeacher: () => openForm('معلم جديد', [{ name: 'name', label: 'الاسم', required: true }, { name: 'phone', label: 'الجوال', type: 'tel' }, ...pinField(genPass())],
    v => { db.teachers.push({ id: uid(), name: v.name.trim(), phone: v.phone, pin: v.pin }); }),
  editTeacher: d => { const t = byId(db.teachers, d.id); openForm('تعديل معلم', [{ name: 'name', label: 'الاسم', value: t.name, required: true }, { name: 'phone', label: 'الجوال', value: t.phone, type: 'tel' }, ...pinField(t.pin)],
    v => { Object.assign(t, { name: v.name.trim(), phone: v.phone, pin: v.pin }); }); },
  delTeacher: d => ask('حذف المعلم؟ ستبقى حلقاته بدون معلم.', async () => { await cloudUnlink(d.id); db.teachers = db.teachers.filter(t => t.id !== d.id); db.halaqat.forEach(h => { if (h.teacherId === d.id) h.teacherId = ''; }); save(); render(); }),

  addHalaqa: d => { if (!db.places.length) { toast('أضف مكانًا أولًا'); A.addPlace(); return; } halaqaForm(null, d.p); },
  editHalaqa: d => halaqaForm(byId(db.halaqat, d.id)),
  addPlace: () => openForm('مكان جديد', [{ name: 'name', label: 'اسم المكان', required: true }, { name: 'type', label: 'النوع', type: 'select', options: PLACE_TYPES.map(x => ({ v: x, l: x })) }, { name: 'address', label: 'العنوان (اختياري)' }],
    v => { const n = v.name.trim(); if (db.places.some(x => norm(x.name) === norm(n))) return 'يوجد مكان بالاسم نفسه'; db.places.push({ id: uid(), name: n, type: v.type, address: v.address.trim() }); }),
  editPlace: d => { const pl = byId(db.places, d.id); if (!pl) return; openForm('تعديل المكان', [{ name: 'name', label: 'اسم المكان', value: pl.name, required: true }, { name: 'type', label: 'النوع', type: 'select', value: pl.type, options: PLACE_TYPES.map(x => ({ v: x, l: x })) }, { name: 'address', label: 'العنوان (اختياري)', value: pl.address || '' }],
    v => { Object.assign(pl, { name: v.name.trim(), type: v.type, address: v.address.trim() }); }); },
  delPlace: d => ask('حذف المكان؟ ستبقى حلقاته بلا مكان حتى تنقلها.', () => { db.places = db.places.filter(x => x.id !== d.id); db.halaqat.forEach(h => { if (h.placeId === d.id) h.placeId = ''; }); save(); render(); }),
  delHalaqa: d => ask('حذف الحلقة؟ سيبقى طلابها بدون حلقة.', () => { db.halaqat = db.halaqat.filter(h => h.id !== d.id); db.students.forEach(s => { if (s.halaqaId === d.id) s.halaqaId = ''; }); save(); render(); }),

  addStudent: () => studentForm(null),
  editStudent: d => { document.querySelectorAll('.overlay').forEach(o => o.remove()); studentForm(byId(db.students, d.id)); },
  studentCard: d => studentCard(byId(db.students, d.id)),
  printCard: () => { document.body.classList.add('print-modal'); window.print(); setTimeout(() => document.body.classList.remove('print-modal'), 500); },
  delMember: d => {
    if (d.k === 'teachers') return A.delTeacher(d);
    if (d.k === 'students') return A.delStudent(d);
    if (d.k === 'admins') {
      if (db.admins.length < 2) { toast('لا يمكن حذف آخر إداري'); return; }
      if (session.role === 'admin' && session.id === d.id) { toast('لا يمكنك حذف حسابك الحالي'); return; }
      ask('حذف الإداري؟', async () => { await cloudUnlink(d.id); db.admins = db.admins.filter(a => a.id !== d.id); save(); render(); });
      return;
    }
    ask('حذف المشرف؟ ستبقى حلقاته بدون مشرف.', async () => { await cloudUnlink(d.id); db.supervisors = db.supervisors.filter(x => x.id !== d.id); db.halaqat.forEach(h => { if (h.supervisorId === d.id) h.supervisorId = ''; }); save(); render(); });
  },
  approvePending: d => {
    const p = db.pending.find(x => x.id === d.id), card = document.querySelector(`[data-pcard="${d.id}"]`);
    if (!p || !card) return;
    const label = card.querySelector('[data-pl]').value.trim(), type = card.querySelector('[data-pt]').value, dest = card.querySelector('[data-pd]').value;
    let id = dest;
    if (dest === 'new') {
      if (!label) { toast('اكتب اسم الحقل'); return; }
      if (fieldTargets(p.kind).some(t => hkey(t.label) === hkey(label)) || hkey(label) === hkey('الاسم')) { toast('يوجد حقل بهذا الاسم؛ اختر «ربط بالحقل الموجود» أو غيّر الاسم'); return; }
      const key = 'f_' + uid();
      db.fields[p.kind].push({ key, label, type });
      id = 'extra:' + key;
    }
    let n = 0;
    card.querySelectorAll('[data-pv]').forEach(inp => {
      const x = p.values[+inp.dataset.pv], m = x && byId(db[p.kind], x.mid), v = inp.value.trim();
      if (m && v) { setField(m, id, v); n++; }
    });
    db.pending = db.pending.filter(x => x !== p); save(); render();
    toast(`تم الاعتماد — ${n} قيمة`);
  },
  dropPending: d => ask('حذف بيانات هذا العمود نهائيًا دون اعتمادها؟', () => { db.pending = db.pending.filter(x => x.id !== d.id); save(); render(); }),
  delField: d => ask('حذف هذا الحقل وكل قيمه من الأعضاء؟', () => { db.fields[d.k] = db.fields[d.k].filter(f => f.key !== d.id); db[d.k].forEach(m => { if (m.extra) delete m.extra[d.id]; }); save(); render(); }),
  editExtra: d => {
    const m = byId(db[d.k] || [], d.id), F = (db.fields[d.k] || []);
    if (!m || !F.length) return;
    if (session.role !== 'admin' && !(session.role === 'teacher' && d.k === 'teachers' && session.id === m.id)) { toast('غير مصرح'); return; }
    openForm('بيانات إضافية: ' + m.name, F.map(f => ({ name: f.key, label: f.label, type: f.type || 'text', value: (m.extra || {})[f.key] || '' })), v => {
      m.extra = m.extra || {};
      F.forEach(f => { m.extra[f.key] = (v[f.key] ?? '').trim(); });
    });
  },
  delStudent: d => ask('حذف الطالب وكل سجلاته؟', async () => { await cloudUnlink(d.id); db.students = db.students.filter(s => s.id !== d.id); db.records = db.records.filter(r => r.studentId !== d.id); db.attendance = db.attendance.filter(a => a.studentId !== d.id); save(); render(); }),

  addNews: () => openForm('إعلان جديد', [{ name: 'text', label: 'النص', type: 'textarea' }, { name: 'audience', label: 'الجمهور', type: 'select', options: [{ v: 'all', l: 'الجميع' }, { v: 'teacher', l: 'المعلمون' }, { v: 'supervisor', l: 'المشرفون' }, { v: 'student', l: 'الطلاب' }] }],
    v => { if (!v.text.trim()) return 'اكتب نص الإعلان'; db.news.push({ id: uid(), text: v.text.trim(), audience: v.audience, date: today() }); }),
  delNews: d => { db.news = db.news.filter(n => n.id !== d.id); save(); render(); },

  themePreset: d => { const p = PRESETS[+d.i]; if (!p) return; db.settings.theme = { ...p[1] }; save(); applyTheme(); render(); toast('تم تطبيق نمط «' + p[0] + '»'); },
  themeReset: () => ask('استعادة الألوان والشعار الافتراضيين؟', () => { db.settings.theme = {}; delete db.settings.logo; save(); applyTheme(); render(); }),
  logoReset: () => { delete db.settings.logo; save(); applyTheme(); render(); toast('عاد الشعار الافتراضي'); },
  themeFromLogo: () => {
    const img = new Image();
    img.onload = () => {
      try {
        const p = paletteFrom(img);
        if (!Object.keys(p).length) { toast('لم أجد ألوانًا واضحة في الشعار'); return; }
        db.settings.theme = { ...(db.settings.theme || {}), ...p }; save(); applyTheme(); render(); toast('تم تطبيق ألوان الشعار');
      } catch (e) { toast('تعذّر تحليل ألوان الشعار'); }
    };
    img.onerror = () => toast('تعذّر تحميل الشعار');
    img.src = logoSrc();
  },
  editSettings: () => openForm('الإعدادات', [{ name: 'org', label: 'اسم المؤسسة', value: db.settings.org, required: true }, { type: 'note', label: 'كلمات مرور الإداريين تُدار من تبويب «الأعضاء» ← الإداريون.' }],
    v => { db.settings.org = v.org.trim(); }),
  export: () => {
    const json = JSON.stringify(db);
    try {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      a.download = `halaqat-backup-${today()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (e) { /* بعض البيئات تمنع التنزيل */ }
    /* بديل يعمل في كل مكان: النص كاملًا للنسخ واللصق */
    openInfo('النسخة الاحتياطية', `<p class="muted">إن لم يبدأ التنزيل، انسخ النص كاملًا واحفظه أو أرسله لنفسك، ثم استخدم «لصق نسخة» على الجهاز الآخر. النص يحتوي كلمات المرور والمرتبات فاحفظه بأمان.</p><textarea id="bk" rows="7" readonly dir="ltr" style="font-family:ui-monospace,monospace;font-size:.72rem">${esc(json)}</textarea><div class="row"><button class="btn primary" data-act="copyBackup">نسخ الكل</button><span class="muted" style="align-self:center">${Math.round(json.length / 1024)} ك.ب</span></div>`);
  },
  copyBackup: () => {
    const t = document.getElementById('bk'); if (!t) return;
    t.focus(); t.select();
    const fallback = () => { let ok = false; try { ok = document.execCommand('copy'); } catch (e) { /* ignore */ } toast(ok ? 'تم النسخ' : 'حدّد النص وانسخه يدويًا'); };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(t.value).then(() => toast('تم النسخ'), fallback); else fallback();
  },
  pasteBackup: () => openForm('لصق نسخة احتياطية', [{ type: 'note', label: 'سيتم استبدال كل البيانات الحالية على هذا الجهاز بالنسخة الملصقة.' }, { name: 'json', label: 'الصق نص النسخة الاحتياطية هنا', type: 'textarea', required: true }], v => {
    let d; try { d = JSON.parse(v.json); } catch (e) { return 'النص غير صالح — تأكد من نسخه كاملًا'; }
    if (!validBackup(d)) return 'هذا النص ليس نسخة احتياطية من التطبيق';
    db = migrate(d); session = null; ss.del(SKEY); applyTheme(); toast('تم الاستيراد — ادخل بحسابك');
  }),
  reset: () => ask('سيتم مسح كل البيانات نهائيًا. متابعة؟', () => { db = seed(); session = null; ss.del(SKEY); save(); render(); toast('تمت إعادة التهيئة'); }),

  cloudPw: d => {
    const m = byId(db[d.k] || [], d.id); if (!m) return;
    ask(m.hasLogin ? `إنشاء كلمة مرور جديدة لـ «${m.name}»؟ ستتوقف القديمة عن العمل.` : `إنشاء حساب دخول لـ «${m.name}»؟`, () => cloudMakeLogins([m]));
  },
  cloudPwAll: d => {
    const list = (db[d.k] || []).filter(m => !m.hasLogin);
    if (!list.length) { toast('كل الأعضاء لهم حسابات'); return; }
    ask(`إنشاء حسابات دخول لـ ${list.length} عضو؟ ستظهر كلمات المرور مرة واحدة لتسليمها.`, () => cloudMakeLogins(list));
  },
  cloudSync: () => cloudRefresh(true, true, true),
  cloudTest: () => cloudTest(),
  cloudUpload: () => cloudUploadLocal(),
  cloudMerge: () => openForm('دمج نسخة احتياطية في قاعدة البيانات', [{ type: 'note', label: 'تُضاف بيانات النسخة إلى قاعدة البيانات دون حذف شيء منها. لا تدمج النسخة نفسها مرتين حتى لا تتكرر البيانات.' }, { name: 'json', label: 'الصق نص النسخة الاحتياطية هنا', type: 'textarea', required: true }], v => {
    let d; try { d = JSON.parse(v.json); } catch (e) { return 'النص غير صالح — تأكد من نسخه كاملًا'; }
    if (!validBackup(d)) return 'هذا النص ليس نسخة احتياطية من التطبيق';
    const n = cloudMergeInto(migrateLocalCopy(d), false);
    toast(`سيُرفع ${n} سجلًا إلى قاعدة البيانات`);
  }),
  att: d => {
    const ex = db.attendance.find(a => a.studentId === d.sid && a.date === ui.date);
    if (ex) ex.status = d.st; else db.attendance.push({ id: uid(), studentId: d.sid, date: ui.date, status: d.st });
    save(); render();
  },
  rec: d => {
    const sid = d.id;
    openForm('تسميع: ' + sName(sid), [
      { name: 'date', label: 'التاريخ', type: 'date', value: today(), required: true },
      { name: 'type', label: 'النوع', type: 'select', options: TYPES.map(t => ({ v: t, l: t })) },
      { name: 'surah', label: 'السورة', type: 'select', options: SURAHS.map((s, i) => ({ v: i + 1, l: `${i + 1}. ${s[0]} (${s[1]} آية)` })) },
      { name: 'from', label: 'من آية', type: 'number', value: 1, min: 1, required: true },
      { name: 'to', label: 'إلى آية', type: 'number', value: 1, min: 1, required: true },
      { name: 'grade', label: 'التقدير', type: 'select', options: GRADES.map(g => ({ v: g, l: g })) },
      { name: 'note', label: 'ملاحظة', type: 'textarea' }
    ], v => {
      const surah = +v.surah, from = +v.from, to = +v.to, max = SURAHS[surah - 1][1];
      if (!(from >= 1 && to >= from)) return 'تحقق من أرقام الآيات';
      if (to > max) return `سورة ${SURAHS[surah - 1][0]} عدد آياتها ${max}`;
      db.records.push({ id: uid(), studentId: sid, date: v.date, type: v.type, surah, from, to, grade: v.grade, note: v.note.trim() });
      toast('تم تسجيل التسميع');
    });
  }
};

document.addEventListener('click', e => {
  const pk = e.target.closest('[data-pick]');
  if (pk) { const g = (CLOUD ? ui.cloudGroups || [] : nameGroups()).find(x => x.key === pk.dataset.pick); if (g) pickUser(g); return; }
  if (e.target.id === 'ufilter') showResults();
  if (!e.target.closest('#ufilter, #uresults')) showResults(false);
  const el = e.target.closest('[data-act]');
  if (el && el.classList.contains('loading')) return;
  if (el && A[el.dataset.act]) withBusy(el, A[el.dataset.act](el.dataset));
  else if (el && window.Payroll?.act[el.dataset.act]) withBusy(el, window.Payroll.act[el.dataset.act](el.dataset));
});
document.addEventListener('change', e => {
  const el = e.target, c = el.dataset.change;
  if (el.dataset.pay && window.Payroll) { window.Payroll.onChange(e); return; }
  if (el.dataset.color) { save(); return; }
  if (!c) return;
  if (c === 'logo') {
    const f = el.files[0]; el.value = '';
    if (!f || !/^image\//.test(f.type)) { toast('اختر ملف صورة'); return; }
    const url = URL.createObjectURL(f), img = new Image();
    img.onload = () => {
      const k = Math.min(1, 512 / Math.max(img.naturalWidth || 512, img.naturalHeight || 512)), cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round((img.naturalWidth || 512) * k)); cv.height = Math.max(1, Math.round((img.naturalHeight || 512) * k));
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      let d = cv.toDataURL('image/webp', .9);
      if (!d.startsWith('data:image/webp')) d = cv.toDataURL('image/png');
      URL.revokeObjectURL(url);
      db.settings.logo = d; save(); applyTheme(); render(); toast('تم تحديث الشعار — جرّب «استخراج الألوان من الشعار»');
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast('تعذّرت قراءة الصورة'); };
    img.src = url;
    return;
  }
  if (c === 'hid') { ui.hid = el.value; render(); }
  else if (c === 'fh') { ui.fh = el.value; render(); }
  else if (c === 'fcat') { ui.fcat = el.value; render(); }
  else if (c === 'date') { ui.date = el.value || today(); render(); }
  else if (c === 'import') {
    const f = el.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const d = JSON.parse(rd.result);
        if (!validBackup(d)) throw new Error('bad');
        ask('سيتم استبدال البيانات الحالية. متابعة؟', () => { db = migrate(d); session = null; ss.del(SKEY); applyTheme(); save(); render(); toast('تم الاستيراد'); });
      } catch (err) { toast('ملف غير صالح'); }
    };
    rd.readAsText(f);
  }
});
A.doLogin = () => {
  if (!ui.pick) {
    const m = loginMatches();
    if (m.length === 1 && document.getElementById('ufilter').value.trim()) pickUser(m[0]); else { toast('اختر اسمك من القائمة'); return; }
  }
  const pin = document.querySelector('#login input[name=pin]').value;
  const p = ui.pick, cur = p.accts[p.sel];
  if (CLOUD) return cloudLogin(cur, pin);
  /* الوضع المختار أولًا، وإن لم تطابق كلمته جُرّبت بقية حسابات الاسم نفسه */
  const acc = cur.u.pin === pin ? cur : p.accts.find(a => a.u.pin === pin);
  if (!pin || !acc) { toast('كلمة المرور غير صحيحة'); return; }
  session = { role: acc.role, id: acc.u.id };
  ss.set(SKEY, JSON.stringify(session));
  ui.pick = null; ui.tab = null; ui.hid = ''; render();
};
document.addEventListener('input', e => {
  if (e.target.dataset?.pay && window.Payroll) { window.Payroll.onInput(e); return; }
  const ck = e.target.dataset?.color;
  if (ck) { db.settings.theme = { ...(db.settings.theme || {}), [ck]: e.target.value }; applyTheme(); return; }
  if (e.target.id !== 'ufilter') return;
  ui.pick = null;
  e.target.classList.remove('picked');
  renderPick();
  if (CLOUD) cloudLookup(e.target.value);
  showResults();
});
/* سحب حافة الشريط الجانبي لتغيير اتساعه، والإفلات تحت الحد الأدنى يطويه */
let sideDrag = null;
const setSideW = w => { ui.sideW = clampW(w); const sh = document.querySelector('.shell'); sh?.style.setProperty('--side-w', ui.sideW + 'px'); document.querySelector('.side-resize')?.setAttribute('aria-valuenow', ui.sideW); };
document.addEventListener('pointerdown', e => {
  const h = e.target.closest?.('.side-resize'); if (!h) return;
  e.preventDefault();
  sideDrag = { right: document.querySelector('.side').getBoundingClientRect().right, raw: ui.sideW };
  try { h.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  document.body.classList.add('resizing'); document.querySelector('.shell')?.classList.add('resizing');
});
document.addEventListener('pointermove', e => {
  if (!sideDrag) return;
  sideDrag.raw = sideDrag.right - e.clientX;
  setSideW(sideDrag.raw);
});
const endDrag = () => {
  if (!sideDrag) return;
  const raw = sideDrag.raw; sideDrag = null;
  document.body.classList.remove('resizing'); document.querySelector('.shell')?.classList.remove('resizing');
  if (raw < SIDE_MIN - 40) { ui.collapsed = true; ui.sideW = SIDE_W; saveUI(); render(); return; }
  saveUI();
};
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);
document.addEventListener('dblclick', e => { if (e.target.closest?.('.side-resize')) { setSideW(SIDE_W); saveUI(); } });
document.addEventListener('focusin', e => { if (e.target.id === 'ufilter') showResults(); });
document.addEventListener('keydown', e => {
  if (e.target.classList?.contains('side-resize') && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    e.preventDefault(); setSideW(ui.sideW + (e.key === 'ArrowLeft' ? 10 : -10)); saveUI(); return;
  }
  if (e.key === 'Escape') { showResults(false); return; }
  if (e.key !== 'Enter' || e.target.tagName !== 'INPUT') return;
  if (e.target.id === 'ufilter') {
    const m = loginMatches();
    if (ui.pick) document.querySelector('#login input[name=pin]')?.focus();
    else if (m.length === 1) pickUser(m[0]);
  }
  else if (e.target.closest('#login')) { const b = document.querySelector('[data-act=doLogin]'); if (!b?.classList.contains('loading')) withBusy(b, A.doLogin()); }
  else e.target.closest('.modal')?.querySelector('[data-save]')?.click();
});

/* ============ قاعدة البيانات: الدخول والمزامنة وإدارة الحسابات ============ */
function cloudLookup(q) {
  clearTimeout(ui.lk);
  ui.lookupErr = ''; ui.cloudGroups = [];
  if (norm(q).length < 2) { ui.lookupBusy = false; return; }
  ui.lookupBusy = true;
  ui.lk = setTimeout(async () => {
    const mine = ++ui.lkSeq;
    try {
      const rows = await window.Cloud.lookup(q);
      if (mine !== ui.lkSeq) return;
      const m = new Map();
      (rows || []).forEach(r => { if (!m.has(r.login_email)) m.set(r.login_email, { key: r.login_email, name: r.name, accts: [] }); m.get(r.login_email).accts.push({ role: r.role, u: { id: r.member_id, name: r.name, email: r.login_email } }); });
      m.forEach(g => g.accts.sort((x, y) => ROLES.indexOf(x.role) - ROLES.indexOf(y.role)));
      ui.cloudGroups = [...m.values()];
    } catch (err) { ui.lookupErr = navigator.onLine === false ? 'لا يوجد اتصال بالإنترنت' : 'تعذّر البحث، حاول مرة أخرى'; }
    ui.lookupBusy = false;
    if (document.activeElement?.id === 'ufilter') showResults();
  }, 250);
}
ui.lkSeq = 0;
async function cloudLogin(cur, pin) {
  if (!pin) { toast('اكتب كلمة المرور'); return; }
  try {
    await window.Cloud.signIn(cur.u.email, pin);
    window.Cloud.setMember({ role: cur.role, id: cur.u.id });
    session = { role: cur.role, id: cur.u.id };
    db = migrate(window.Cloud.cached() || window.Cloud.emptyDb());
    ui.pick = null; ui.tab = null; ui.hid = '';
    render();
    await cloudRefresh(true);
  } catch (err) {
    toast(navigator.onLine === false ? 'لا يوجد اتصال بالإنترنت' : (err.message || 'تعذّر الدخول'));
  }
}
/* سحب أحدث البيانات (بعد إرسال التغييرات المحلية)؛ لا يقاطع نموذجًا مفتوحًا أو حقلًا قيد الكتابة */
async function cloudRefresh(force = false, loud = false, wait = false) {
  if (wait) for (let i = 0; ui.refreshing && i < 100; i++) await new Promise(r => setTimeout(r, 100));
  if (!CLOUD || !window.Cloud.signedIn || !session || ui.refreshing) return;
  const typing = document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && document.activeElement.closest('main');
  if (!force && (document.querySelector('.overlay') || typing)) return;
  ui.refreshing = true;
  try {
    try { await window.Cloud.push(db); } catch (e) { /* يعالَج في onReject */ }
    const nd = await window.Cloud.pull();
    db = migrate(nd);
    if (!me()) { toast('لم يعد هذا الحساب موجودًا'); A.logout(); return; }
    applyTheme();
    if (!document.querySelector('.overlay')) { const y = window.scrollY; render(); window.scrollTo(0, y); }
    if (loud) toast('تمت المزامنة');
  } catch (err) {
    if (err?.status === 401 || !window.Cloud.signedIn) { toast('انتهت الجلسة، ادخل مرة أخرى'); A.logout(); }
    else if (loud) toast(navigator.onLine === false ? 'لا يوجد اتصال بالإنترنت' : 'تعذّرت المزامنة: ' + (err.message || err));
  } finally { ui.refreshing = false; window.netPill?.(); }
}
async function cloudUnlink(id) {
  if (!CLOUD) return;
  const m = accounts().find(a => a.u.id === id)?.u;
  if (!m?.hasLogin) return;
  try { await window.Cloud.push(db); await window.Cloud.fn({ action: 'remove', member_id: id }); } catch (e) { toast('تعذّر حذف حساب الدخول: ' + e.message); }
}
/* إنشاء حسابات دخول (أو كلمات جديدة) وعرض كلمات المرور مرة واحدة */
async function cloudMakeLogins(list) {
  if (!list.length) return;
  toast('جارٍ إنشاء الحسابات…');
  try {
    await window.Cloud.push(db);
    let legacy = {}; try { legacy = JSON.parse(localStorage.getItem('qcloud_legacy_pins') || '{}'); } catch (e) { /* ignore */ }
    const items = list.map(m => {
      const old = String(m.pin || legacy[m.id] || '');
      const password = /^\d{6,}$/.test(old) ? old : genPass();
      const twin = accounts().find(a => a.u.id !== m.id && a.u.hasLogin && norm(a.u.name) === norm(m.name));
      return { member_id: m.id, password, share_with: twin?.u.id, name: m.name };
    });
    const res = await window.Cloud.provision(items.map(({ name, ...x }) => x), (n, t) => toast(`تم ${n} من ${t}`));
    const ok = new Map(res.filter(r => r.ok).map(r => [r.member_id, true]));
    list.forEach(m => { if (ok.has(m.id)) { m.hasLogin = true; delete m.pin; delete legacy[m.id]; } });
    try { localStorage.setItem('qcloud_legacy_pins', JSON.stringify(legacy)); } catch (e) { /* ignore */ }
    const rows = items.map(it => `<tr><td>${esc(it.name)}</td><td>${ok.has(it.member_id) ? `<code class="pw">${esc(it.password)}</code>${it.share_with ? ' <small class="muted">(حساب مشترك مع نفس الاسم)</small>' : ''}` : `<span class="tag tag-no">${esc(res.find(r => r.member_id === it.member_id)?.error || 'تعذّر')}</span>`}</td></tr>`).join('');
    openInfo(`كلمات المرور (${ok.size} من ${items.length})`, `<p class="muted">تظهر هذه الكلمات الآن فقط. اطبعها أو انسخها وسلّمها لأصحابها؛ يدخل كل عضو باسمه وكلمة مروره.</p><div class="tbl"><table><tr><th>الاسم</th><th>كلمة المرور</th></tr>${rows}</table></div><div class="row noprint"><button class="btn" data-act="printCard">طباعة</button></div>`);
    Cloud.saveLocal(db);
    setTimeout(() => cloudRefresh(true), 1500);
  } catch (err) { toast('تعذّر إنشاء الحسابات: ' + (err.message || err)); }
}
function cloudCard() {
  const C = window.Cloud, n = C.pendingCount(db), off = navigator.onLine === false;
  const legacy = (() => { try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); return d ? (d.students || []).length + (d.teachers || []).length : 0; } catch (e) { return 0; } })();
  return `<div class="card"><h2>قاعدة البيانات</h2>
    <div class="tbl"><table>
      <tr><th style="width:38%">الحالة</th><td>${off ? '<span class="tag tag-no">بدون إنترنت</span>' : C.lastError ? `<span class="tag tag-no">خطأ: ${esc(C.lastError)}</span>` : '<span class="tag tag-ok">متصل</span>'}</td></tr>
      <tr><th>آخر مزامنة</th><td>${C.lastSync ? esc(C.lastSync.toLocaleString('ar-EG')) : '—'}</td></tr>
      <tr><th>تغييرات بانتظار الإرسال</th><td>${n}</td></tr>
      <tr><th>المشروع</th><td dir="ltr" style="text-align:right">${esc(C.cfg.url.replace('https://', ''))}</td></tr>
    </table></div>
    <div class="bar" style="margin-top:.8rem"><button class="btn primary" data-act="cloudSync">مزامنة الآن</button><button class="btn" data-act="cloudTest">اختبار الاتصال</button>
    ${legacy ? `<button class="btn" data-act="cloudUpload">رفع بيانات هذا الجهاز (${legacy} عضو)</button>` : ''}<button class="btn" data-act="cloudMerge">دمج نسخة احتياطية</button></div>
    <p class="muted" style="font-size:.85rem;margin:0">«رفع بيانات هذا الجهاز» يرفع ما كان محفوظًا في هذا المتصفح قبل الربط بقاعدة البيانات، مرة واحدة.</p></div>`;
}
/* نسخة محلية قديمة (أو احتياطية) ← بيانات قابلة للدمج */
function migrateLocalCopy(d) {
  d = JSON.parse(JSON.stringify(d));
  if (!Array.isArray(d.places)) {
    d.places = []; const seen = new Map();
    (d.halaqat || []).forEach(h => { const n = String(h.place || '').trim(); if (!n) return; if (!seen.has(n)) { const pl = { id: 'p_' + n, name: n, type: /دار/.test(n) ? 'دار تحفيظ' : 'مسجد', address: '' }; seen.set(n, pl); d.places.push(pl); } h.placeId = seen.get(n).id; });
  }
  return d;
}
const DEMO = ['الشيخ أحمد', 'المشرف خالد', 'عبد الله', 'محمد', 'يوسف'];
function cloudMergeInto(src, skipDemo) {
  let n = 0;
  const demo = new Set(skipDemo ? [...(src.teachers || []), ...(src.supervisors || []), ...(src.students || [])].filter(m => DEMO.includes(m.name) && m.pin === '0000').map(m => m.id) : []);
  const add = (k, list) => { db[k] = db[k] || []; const have = new Set(db[k].map(x => x.id)); (list || []).forEach(x => { if (!have.has(x.id) && !demo.has(x.id)) { db[k].push(x); n++; } }); };
  add('supervisors', src.supervisors); add('teachers', src.teachers);
  const halaqat = (src.halaqat || []).filter(h => !(demo.has(h.teacherId) && !(src.students || []).some(s => s.halaqaId === h.id && !demo.has(s.id))));
  const usedPlaces = new Set(halaqat.map(h => h.placeId));
  add('places', (src.places || []).filter(p => usedPlaces.has(p.id) || !skipDemo));
  add('halaqat', halaqat);
  (src.halaqat || []).forEach(h => { if (!halaqat.includes(h)) demo.add(h.id); });
  add('students', (src.students || []).map(s => (demo.has(s.halaqaId) ? { ...s, halaqaId: '' } : s)));
  add('attendance', (src.attendance || []).filter(a => !demo.has(a.studentId)));
  add('records', (src.records || []).filter(r => !demo.has(r.studentId)));
  add('news', src.news); add('pending', src.pending);
  ['students', 'teachers'].forEach(k => { db.fields[k] = db.fields[k] || []; (src.fields?.[k] || []).forEach(f => { if (!db.fields[k].some(x => x.key === f.key)) db.fields[k].push(f); }); });
  if (src.settings?.org && (!db.settings.org || db.settings.org === 'إدارة الحلقات القرآنية')) db.settings.org = src.settings.org;
  if (src.settings?.theme && !db.settings.theme) db.settings.theme = src.settings.theme;
  if (src.settings?.logo && !db.settings.logo) db.settings.logo = src.settings.logo;
  if (src.payroll && !(db.payroll?.rows || []).length && !(db.payroll?.employees || []).length) { db.payroll = src.payroll; n += (src.payroll.rows || []).length + (src.payroll.employees || []).length; }
  save(); render();
  /* كلمات المرور القديمة لا تُرفع للخادم؛ نحفظها محليًا لاستخدامها عند إنشاء حسابات الدخول */
  try {
    const old = JSON.parse(localStorage.getItem('qcloud_legacy_pins') || '{}');
    ['supervisors', 'teachers', 'students'].forEach(k => (db[k] || []).forEach(m => { if (/^\d{6,}$/.test(String(m.pin || ''))) old[m.id] = String(m.pin); }));
    localStorage.setItem('qcloud_legacy_pins', JSON.stringify(old));
  } catch (e) { /* ignore */ }
  return n;
}
function cloudUploadLocal() {
  let d; try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { d = null; }
  if (!d) { toast('لا توجد بيانات محلية قديمة على هذا الجهاز'); return; }
  const ov = document.createElement('div'); ov.className = 'overlay';
  ov.innerHTML = `<div class="modal"><h2>رفع بيانات هذا الجهاز</h2><p class="muted">سيُرفع ${(d.teachers || []).length} معلم و${(d.supervisors || []).length} مشرف و${(d.students || []).length} طالب و${(d.halaqat || []).length} حلقة مع الحضور والتسميع${d.payroll ? ' والمرتبات' : ''}. حسابات الإداريين المحلية لا تُرفع.</p>
    <label class="chk"><input type="checkbox" id="skipdemo" checked> استبعاد بيانات التجربة (الشيخ أحمد، المشرف خالد، الطلاب التجريبيون)</label>
    <div class="row"><button class="btn primary" data-yes>رفع</button><button class="btn" data-close>إلغاء</button></div></div>`;
  document.body.appendChild(ov);
  ov.querySelector('[data-close]').onclick = () => ov.remove();
  ov.querySelector('[data-yes]').onclick = e => {
    const skip = ov.querySelector('#skipdemo').checked;
    ov.querySelector('[data-close]').disabled = true;
    const n = cloudMergeInto(migrateLocalCopy(d), skip);
    withBusy(e.currentTarget, window.Cloud.push(db).then(() => toast(`تم رفع ${n} سجلًا — أنشئ حسابات الدخول من «الأعضاء»`), err => toast('تعذّر الرفع: ' + (err.message || err)))).finally(() => ov.remove());
  };
}
async function cloudTest() {
  const C = window.Cloud, steps = [];
  const show = () => openInfo('اختبار الاتصال', `<div class="tbl"><table>${steps.map(([t, ok, m]) => `<tr><td>${ok === null ? '…' : ok ? '✅' : '❌'}</td><td>${esc(t)}</td><td class="muted">${esc(m || '')}</td></tr>`).join('')}</table></div>`);
  const step = async (t, f) => { steps.push([t, null, '']); const i = steps.length - 1; try { const m = await f(); steps[i] = [t, true, m || '']; return true; } catch (e) { steps[i] = [t, false, e.message || String(e)]; return false; } };
  document.querySelectorAll('.overlay').forEach(o => o.remove());
  const id = C.uuid(), pw = genPass() + 'q';
  let ok = await step('الاتصال بقاعدة البيانات وصلاحية الإداري', async () => { if (!(await C.rpc('is_admin'))) throw new Error('هذا الحساب ليس إداريًا على الخادم'); });
  ok = ok && await step('إنشاء عضو تجريبي', () => C.req('/rest/v1/members', { method: 'POST', body: { id, role: 'student', name: 'اختبار الاتصال ' + Date.now() }, headers: { Prefer: 'return=minimal' } }));
  let email = '';
  ok = ok && await step('إنشاء حساب دخول له (الوظيفة السحابية)', async () => { const r = await C.provision([{ member_id: id, password: pw }]); if (!r[0]?.ok) throw new Error(r[0]?.error || 'فشل'); const m = await C.req(`/rest/v1/members?id=eq.${id}&select=login_email`); email = m[0]?.login_email; });
  ok = ok && await step('الدخول بالحساب التجريبي', async () => { await C.testSignIn(email, pw); });
  await step('حذف الحساب والعضو التجريبي', async () => { await C.fn({ action: 'remove', member_id: id }); await C.req(`/rest/v1/members?id=eq.${id}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }); });
  show(); toast(ok ? 'الاتصال سليم' : 'فشلت خطوة — انظر التفاصيل');
}
if (CLOUD) {
  window.Cloud.onReject = err => { toast('رفض الخادم بعض التغييرات: ' + (err.message || err)); cloudRefresh(true); };
  window.Cloud.on(() => window.netPill?.());
  window.addEventListener('online', () => cloudRefresh());
  window.addEventListener('focus', () => cloudRefresh());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) cloudRefresh(); });
  setInterval(() => { if (!document.hidden) cloudRefresh(); }, 120000);
  /* اسم المؤسسة والشعار في صفحة الدخول قبل تسجيل الدخول */
  window.Cloud.publicSettings().then(s => { try { localStorage.setItem('qcloud_public', JSON.stringify(s)); } catch (e) { /* ignore */ } if (!session) { db.settings = { ...db.settings, ...s }; applyTheme(); if (!document.getElementById('ufilter')?.value) render(); } }).catch(() => {});
  if (session) setTimeout(() => cloudRefresh(true), 50);
}

/* واجهة للوحدات الإضافية (مثل المرتبات) */
window.QL = { get db() { return db; }, get session() { return session; }, me, ICONS: TAB_ICONS, placeNames: () => (db.places || []).map(x => x.name), save, render, openForm, openInfo, ask, toast, esc, uid, today, byId, norm, empty };

/* العمل بدون إنترنت: تسجيل عامل الخدمة، وشارة تظهر عند انقطاع الاتصال */
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { /* بيئة لا تدعمه */ }); });
}
const netPill = () => {
  let el = document.getElementById('netpill');
  if (!el) { el = document.createElement('div'); el.id = 'netpill'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  const off = navigator.onLine === false;
  const pend = CLOUD && session ? window.Cloud.pendingCount(db) : 0;
  el.hidden = !off;
  el.textContent = 'بدون إنترنت — التطبيق يعمل وبياناتك محفوظة على هذا الجهاز' + (pend ? ` (${pend} تغيير بانتظار المزامنة)` : '');
  document.body.classList.toggle('offline', off);
};
window.netPill = netPill;
window.addEventListener('online', () => { netPill(); toast('عاد الاتصال بالإنترنت'); });
window.addEventListener('offline', netPill);
netPill();

applyTheme();
render();
const splash = document.getElementById('splash');
if (splash) {
  if (session) splash.remove();
  else setTimeout(() => { splash.classList.add('hide'); setTimeout(() => splash.remove(), 700); }, 3000);
}
