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
    ui.shown = {}; ui.pick = null; session = null; ss.del(SKEY); ss.del('halaqat_tab'); ui.tab = null; ui.sel = new Set();
    if (CLOUD) { const s = db.settings; window.Cloud.signOut(); db = migrate({ ...window.Cloud.emptyDb(), settings: s }); }
    render();
  },
  tab: d => { ui.tab = d.v; ui.nav = false; saveTab(); render(); window.scrollTo(0, 0); },
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

  msub: d => { ui.msub = d.v; ui.sel = new Set(); saveTab(); render(); },
  delSel: () => delMembersDialog(ui.msub, [...ui.sel]),
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
  delMember: d => delMembersDialog(d.k, [d.id]),
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
  reset: () => wipeAll(),
  wipeAll: () => wipeAll(),
  clsAuto: () => clsAuto(),
  dupOpen: () => dupDialog(true),
  installApp: () => installApp(),
  installClose: () => { document.getElementById('installpop')?.remove(); try { localStorage.setItem('qinstall_dismiss', String(Date.now())); } catch (e) { /* ignore */ } },

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
  if (el.dataset.cls) { classifyEmp(el.dataset.cls, el.value); return; }
  if (el.dataset.sel) { el.checked ? ui.sel.add(el.dataset.sel) : ui.sel.delete(el.dataset.sel); render(); return; }
  if ('selall' in el.dataset) { ui.sel = el.checked ? new Set((db[ui.msub] || []).map(m => m.id)) : new Set(); render(); return; }
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
    const typed = norm(document.getElementById('ufilter').value);
    const all = CLOUD ? ui.cloudGroups || [] : nameGroups();
    const exact = typed && all.find(g => norm(g.name) === typed);
    const m = loginMatches();
    if (exact) { const i = exact.accts.findIndex(a => a.role === 'admin'); ui.pick = { accts: exact.accts, sel: i < 0 ? 0 : i }; }
    else if (m.length === 1 && typed) pickUser(m[0]);
    else { toast('اختر اسمك من القائمة'); return; }
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
  if (session.role === 'admin') setTimeout(dupOnce, 1500);
};
/* كل الأرقام إنجليزية: تحويل الأرقام العربية والفارسية فور كتابتها */
const toEnDigits = s => String(s).replace(/[٠-٩]/g, c => c.charCodeAt(0) - 1632).replace(/[۰-۹]/g, c => c.charCodeAt(0) - 1776);
document.addEventListener('input', e => {
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') && /[٠-٩۰-۹]/.test(t.value || '')) {
    const pos = t.selectionStart; t.value = toEnDigits(t.value); try { t.setSelectionRange(pos, pos); } catch (err) { /* ignore */ }
  }
}, true);
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
    if (session?.role === 'admin') setTimeout(dupOnce, 1500);
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
    if (session?.role === 'admin' && installReady) setTimeout(dupOnce, 400);
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
      <tr><th>آخر مزامنة</th><td dir="ltr" style="text-align:right">${C.lastSync ? esc(C.lastSync.toLocaleString('en-GB')) : '—'}</td></tr>
      <tr><th>تغييرات بانتظار الإرسال</th><td>${n}</td></tr>
      <tr><th>المشروع</th><td dir="ltr" style="text-align:right">${esc(C.cfg.url.replace('https://', ''))}</td></tr>
    </table></div>
    <div class="bar" style="margin-top:.8rem"><button class="btn primary" data-act="cloudSync">مزامنة الآن</button><button class="btn" data-act="cloudTest">اختبار الاتصال</button>
    ${legacy ? `<button class="btn" data-act="cloudUpload">رفع بيانات هذا الجهاز (${legacy} عضو)</button>` : ''}<button class="btn" data-act="cloudMerge">دمج نسخة احتياطية</button><span class="grow"></span><button class="btn danger" data-act="wipeAll">مسح كل البيانات</button></div>
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
/* ============ تصنيف موظفي المرتبات ============
   كل موظف في المرتبات يظهر في «الأعضاء ← غير مصنف» حتى يُحدَّد تصنيفه:
   معلم / مشرف / مدير ← يُنشأ له (أو يُربط بـ) عضو بهذا النوع،
   إداري أو مسمى آخر ← تصنيف فقط بلا حساب دخول (تُحدَّد مهامه لاحقًا).
   التصنيف محفوظ في إعدادات المرتبات (cls: معرّف الموظف ← النوع والعضو المرتبط). */
const CLS_ROLES = { teacher: 'معلم', supervisor: 'مشرف', admin: 'مدير' };
const payEmps = () => db.payroll?.employees || [];
const clsRead = () => db.payroll?.settings?.cls || {};
const clsMap = () => { db.payroll.settings = db.payroll.settings || {}; return (db.payroll.settings.cls = db.payroll.settings.cls || {}); };
/* التصنيف الفعّال: إن حُذف العضو المرتبط يعود الموظف «غير مصنف» */
function clsOf(e) {
  const c = clsRead()[e.id]; if (!c || !c.kind) return null;
  if (CLS_ROLES[c.kind]) return byId(db[COLL[c.kind]] || [], c.memberId) ? c : null;
  return c;
}
const unclassCount = () => payEmps().filter(e => !clsOf(e)).length;
function clsSuggest(e) {
  for (const r of ['teacher', 'supervisor', 'admin']) if ((db[COLL[r]] || []).some(m => norm(m.name) === norm(e.name))) return { kind: r, existing: true };
  const role = e.role || '';
  if (/مشرف/.test(role)) return { kind: 'supervisor' };
  if (/معلم|مساعد/.test(role)) return { kind: 'teacher' };
  if (/إداري|اداري/.test(role)) return { kind: 'إداري' };
  return null;
}
function unclassView(bar) {
  const emps = payEmps();
  if (!emps.length) return `<div class="card">${bar}${empty('لا يوجد موظفون في المرتبات بعد. استوردهم من «المرتبات ← الموظفون» أو «إعدادات المرتبات».')}</div>`;
  const un = emps.filter(e => !clsOf(e)), titled = emps.filter(e => { const c = clsOf(e); return c && !CLS_ROLES[c.kind]; });
  const titles = [...new Set(['إداري', ...Object.values(clsRead()).map(c => c.kind).filter(k => k && !CLS_ROLES[k])])];
  const opts = cur => `<option value="">— اختر التصنيف —</option>${Object.entries(CLS_ROLES).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}${titles.map(t => `<option value="t:${esc(t)}" ${cur === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}<option value="__other">غير ذلك (مسمى جديد)…</option>`;
  const lbl = k => CLS_ROLES[k] || k;
  const sug = un.map(e => [e, clsSuggest(e)]);
  const auto = sug.filter(([e, s]) => s && s.kind !== 'admin' && e.status !== 'متوقف').length;
  const rows = sug.map(([e, s], i) => `<tr><td>${i + 1}</td><td>${esc(e.name)}${e.status === 'متوقف' ? ' <span class="tag">متوقف</span>' : ''}</td><td>${esc(e.role || '—')}</td><td class="muted" style="font-size:.85rem">${s ? (s.existing ? `يوجد ${lbl(s.kind)} بنفس الاسم` : `المقترح: ${esc(lbl(s.kind))}`) : ''}</td><td><select class="mini" data-cls="${esc(e.id)}" aria-label="تصنيف ${esc(e.name)}">${opts('')}</select></td></tr>`).join('');
  const trows = titled.map(e => `<tr><td>${esc(e.name)}</td><td>${esc(e.role || '—')}</td><td><select class="mini" data-cls="${esc(e.id)}">${opts(clsOf(e).kind)}</select></td></tr>`).join('');
  return `<div class="card">${bar}
    <div class="note">موظفو المرتبات يظهرون هنا تلقائيًا. اختر تصنيف كل واحد: <b>معلم</b> أو <b>مشرف</b> يُنشأ له عضو بهذا النوع (أو يُربط بالموجود بنفس الاسم)، و<b>مدير</b> يأخذ صلاحيات كاملة، و<b>إداري</b> أو أي مسمى آخر تصنيف فقط بلا حساب دخول.</div>
    ${un.length ? `<div class="bar"><span class="grow muted">${un.length} موظف بلا تصنيف</span><button class="btn" data-act="dupOpen">الأسماء المتشابهة</button>${auto ? `<button class="btn primary" data-act="clsAuto">تصنيف تلقائي حسب الوظيفة (${auto})</button>` : ''}</div>
    <div class="tbl"><table><tr><th>#</th><th>الاسم</th><th>الوظيفة في المرتبات</th><th></th><th>التصنيف</th></tr>${rows}</table></div>` : empty('كل موظفي المرتبات مصنّفون ✓')}</div>
    ${titled.length ? `<div class="card"><h2>مصنّفون بمسميات أخرى (${titled.length})</h2><div class="tbl"><table><tr><th>الاسم</th><th>الوظيفة في المرتبات</th><th>التصنيف</th></tr>${trows}</table></div></div>` : ''}`;
}
function classifyEmp(id, val, quiet) {
  const e = payEmps().find(x => x.id === id); if (!e || !val) return false;
  if (val === '__other') {
    render();
    openForm('مسمى جديد لـ «' + e.name + '»', [{ name: 't', label: 'المسمى (مثل: محاسب، سكرتير، عامل)', required: true }], v => {
      const t = v.t.trim(); if (CLS_ROLES[Object.keys(CLS_ROLES).find(k => CLS_ROLES[k] === t)]) return 'اختر هذا التصنيف من القائمة مباشرة';
      clsMap()[id] = { kind: t }; toast(`«${e.name}»: ${t}`);
    });
    return false;
  }
  if (val.startsWith('t:')) { clsMap()[id] = { kind: val.slice(2) }; if (!quiet) { save(); render(); toast(`«${e.name}»: ${val.slice(2)}`); } return false; }
  if (!CLS_ROLES[val]) return false;
  const go = () => {
    const coll = COLL[val];
    let m = db[coll].find(x => norm(x.name) === norm(e.name));
    const isNew = !m;
    if (!m) { m = val === 'admin' ? { id: uid(), name: e.name, pin: genPass() } : { id: uid(), name: e.name, phone: '', pin: genPass() }; db[coll].push(m); ui.shown[m.id] = true; }
    clsMap()[id] = { kind: val, memberId: m.id };
    if (!quiet) { save(); render(); toast(`«${e.name}» ${isNew ? 'أُضيف' : 'رُبط'} ${CLS_ROLES[val]}${CLOUD && !m.hasLogin ? ' — أنشئ له حساب الدخول من تبويب «' + { teacher: 'المعلمون', supervisor: 'المشرفون', admin: 'المديرون' }[val] + '»' : ''}`); }
    return isNew;
  };
  if (val === 'admin') { render(); ask(`سيحصل «${e.name}» على صلاحيات المدير الكاملة، بما فيها المرتبات وإدارة الحسابات. متابعة؟`, go); return false; }
  return go();
}
function clsAuto() {
  const list = payEmps().filter(e => !clsOf(e) && e.status !== 'متوقف').map(e => [e, clsSuggest(e)]).filter(([, s]) => s && s.kind !== 'admin');
  if (!list.length) { toast('لا يوجد تصنيف مقترح'); return; }
  const c = k => list.filter(([, s]) => s.kind === k).length;
  ask(`تصنيف ${list.length} موظفًا حسب وظيفتهم في المرتبات: ${c('teacher')} معلم، و${c('supervisor')} مشرف، و${c('إداري')} إداري؟ لن يُصنَّف أحد «مدير» تلقائيًا، ويبقى الموظفون المتوقفون لتصنّفهم بنفسك.`, () => {
    let n = 0;
    list.forEach(([e, s]) => { if (CLS_ROLES[s.kind]) { if (classifyEmp(e.id, s.kind, true)) n++; } else clsMap()[e.id] = { kind: s.kind }; });
    save(); render(); toast(`تم تصنيف ${list.length} موظفًا${n ? ` (${n} عضو جديد)` : ''}${CLOUD && n ? ' — أنشئ حسابات الدخول من تبويبات الأعضاء' : ''}`);
  });
}

/* ============ اقتراح دمج الأسماء المكررة ============
   داخل كل نوع (المعلمون، المشرفون، الطلاب، موظفو المرتبات): الاسم نفسه، أو نفسه بلا مسافات (عبد الله/عبدالله)،
   أو اسم مختصر يطابق الأول والأخير ومحتوى في الأطول (أنس حسانين ← أنس السيد حسانين).
   «تجاهل» يحفظ المجموعة فلا تُقترح ثانية. */
const DUP_KINDS = [['teachers', 'معلم'], ['supervisors', 'مشرف'], ['students', 'طالب'], ['payroll', 'موظف مرتبات']];
const dupIgnored = () => db.settings.dupIgnore || [];
function dupLike(a, b) {
  const x = norm(a), y = norm(b);
  if (x === y || x.replace(/\s/g, '') === y.replace(/\s/g, '')) return true;
  const A = x.split(' '), B = y.split(' '), [s, l] = A.length <= B.length ? [A, B] : [B, A];
  return s.length >= 2 && s.length < l.length && s[0] === l[0] && s[s.length - 1] === l[l.length - 1] && s.every(w => l.includes(w));
}
function dupGroups() {
  const out = [];
  DUP_KINDS.forEach(([k, lbl]) => {
    const list = k === 'payroll' ? payEmps() : (db[k] || []);
    const seen = new Set();
    list.forEach((a, i) => {
      if (seen.has(a.id)) return;
      /* الطلاب بالاسم نفسه في حلقتين مختلفتين غالبًا شخصان مختلفان، فلا يُقترح دمجهم */
      const sameHal = b => k !== 'students' || !a.halaqaId || !b.halaqaId || a.halaqaId === b.halaqaId;
      /* موظفان صُرف لكل منهما مرتب في الشهر نفسه شخصان مختلفان */
      const pm = id => new Set((db.payroll?.rows || []).filter(r => r.eid === id).map(r => r.y * 100 + r.m));
      const noOverlap = b => { if (k !== 'payroll') return true; const x = pm(a.id); return ![...pm(b.id)].some(v => x.has(v)); };
      const g = [a, ...list.slice(i + 1).filter(b => !seen.has(b.id) && sameHal(b) && noOverlap(b) && dupLike(a.name, b.name))];
      if (g.length < 2) return;
      g.forEach(m => seen.add(m.id));
      const key = k + ':' + g.map(m => m.id).sort().join(',');
      if (!dupIgnored().includes(key)) out.push({ k, lbl, key, items: g });
    });
  });
  return out;
}
/* ما يُنقل من العضو المحذوف إلى العضو الباقي */
function dupMerge(k, keep, drop) {
  const re = (o, f) => { if (o[f] === drop.id) o[f] = keep.id; };
  if (k === 'payroll') {
    const P = db.payroll;
    /* غياب المحذوف في يوم مسجّل فيه للباقي يُترك (لا يتكرر اليوم نفسه) */
    const kd = new Set(P.absences.filter(a => a.eid === keep.id && a.date).map(a => a.date));
    P.absences = P.absences.filter(a => !(a.eid === drop.id && a.date && kd.has(a.date)));
    P.rows.forEach(r => re(r, 'eid')); P.absences.forEach(a => re(a, 'eid'));
    ['role', 'sys', 'basic', 'rate', 'incentive', 'transport', 'hours', 'place', 'code'].forEach(f => { if ((keep[f] == null || keep[f] === '') && drop[f] != null && drop[f] !== '') keep[f] = drop[f]; });
    if (drop.status === 'نشط') keep.status = 'نشط';
    const c = P.settings?.cls; if (c && c[drop.id] && !c[keep.id]) c[keep.id] = c[drop.id]; if (c) delete c[drop.id];
    P.employees = P.employees.filter(e => e.id !== drop.id);
    return;
  }
  if (k === 'teachers') db.halaqat.forEach(h => re(h, 'teacherId'));
  if (k === 'supervisors') db.halaqat.forEach(h => re(h, 'supervisorId'));
  if (k === 'students') {
    /* حضور المحذوف في يوم مسجّل فيه حضور للباقي يُترك، ثم يُنقل الباقي */
    const kd = new Set(db.attendance.filter(a => a.studentId === keep.id).map(a => a.date));
    db.attendance = db.attendance.filter(a => !(a.studentId === drop.id && kd.has(a.date)));
    db.attendance.forEach(a => re(a, 'studentId')); db.records.forEach(r => re(r, 'studentId'));
    if (!keep.halaqaId && drop.halaqaId) keep.halaqaId = drop.halaqaId;
    keep.info = { ...(drop.info || {}), ...(keep.info || {}) };
  }
  if (!keep.phone && drop.phone) keep.phone = drop.phone;
  keep.extra = { ...(drop.extra || {}), ...(keep.extra || {}) };
  const c = db.payroll?.settings?.cls; if (c) Object.values(c).forEach(v => { if (v.memberId === drop.id) v.memberId = keep.id; });
  db[k] = db[k].filter(m => m.id !== drop.id);
}
function dupDialog(manual) {
  if (session?.role !== 'admin') return;
  document.getElementById('dupdlg')?.remove();
  const gs = dupGroups();
  if (!gs.length) { if (manual) toast('لا توجد أسماء مكررة'); return; }
  const info = (k, m) => k === 'payroll' ? [m.role, m.status === 'متوقف' ? 'متوقف' : '', P_rows(m.id) + ' شهر'].filter(Boolean).join(' · ')
    : k === 'students' ? hName(m.halaqaId) : [db.halaqat.filter(h => h.teacherId === m.id || h.supervisorId === m.id).length + ' حلقة', m.hasLogin ? 'له حساب دخول' : ''].filter(Boolean).join(' · ');
  const ov = document.createElement('div'); ov.className = 'overlay'; ov.id = 'dupdlg';
  ov.innerHTML = `<div class="modal wide"><h2>أسماء متشابهة (${gs.length})</h2>
    <p class="muted" style="margin-top:0">اختر في كل مجموعة الاسم الذي يبقى، وتُنقل إليه بيانات الباقين (الحلقات والحضور والتسميع والمرتبات) ثم يُحذفون. ألغِ تحديد «دمج» لتتركها هذه المرة، أو «تجاهل» حتى لا تُقترح ثانية.</p>
    ${gs.map((g, gi) => `<div class="dupg" data-g="${gi}"><div class="bar" style="margin:0 0 .4rem"><b class="grow">${esc(g.lbl)}</b>
      <label class="chk" style="margin:0"><input type="checkbox" data-merge checked> دمج</label><label class="chk" style="margin:0"><input type="checkbox" data-ignore> تجاهل</label></div>
      ${g.items.map((m, i) => `<label class="chk dupi"><input type="radio" name="keep${gi}" value="${esc(m.id)}" ${i === 0 ? 'checked' : ''}> <span><b>${esc(m.name)}</b> <small class="muted">${esc(info(g.k, m) || '')}</small></span></label>`).join('')}</div>`).join('')}
    <div class="row"><button type="button" class="btn primary" data-dupok>تنفيذ</button><button type="button" class="btn" data-close>لاحقًا</button></div></div>`;
  document.body.appendChild(ov);
  ov.querySelector('[data-close]').onclick = () => ov.remove();
  ov.addEventListener('change', e => { const b = e.target.closest('.dupg'); if (!b) return; if (e.target.matches('[data-ignore]') && e.target.checked) b.querySelector('[data-merge]').checked = false; if (e.target.matches('[data-merge]') && e.target.checked) b.querySelector('[data-ignore]').checked = false; });
  ov.querySelector('[data-dupok]').onclick = e => withBusy(e.currentTarget, (async () => {
    let merged = 0, ignored = 0; const unlink = [];
    gs.forEach((g, gi) => {
      const box = ov.querySelector(`.dupg[data-g="${gi}"]`);
      if (box.querySelector('[data-ignore]').checked) { db.settings.dupIgnore = [...dupIgnored(), g.key]; ignored++; return; }
      if (!box.querySelector('[data-merge]').checked) return;
      const keepId = box.querySelector(`[name=keep${gi}]:checked`).value, keep = g.items.find(m => m.id === keepId);
      g.items.filter(m => m.id !== keepId).forEach(d => { if (g.k !== 'payroll' && d.hasLogin) unlink.push(d.id); dupMerge(g.k, keep, d); merged++; });
    });
    for (const id of unlink) { try { await window.Cloud.fn({ action: 'remove', member_id: id }); } catch (err) { /* يبقى الحساب يتيمًا بلا ضرر */ } }
    save(); ov.remove(); render();
    toast(`تم: دمج ${merged}${ignored ? ` وتجاهل ${ignored} مجموعة` : ''}`);
  })());
}
const P_rows = id => (db.payroll?.rows || []).filter(r => r.eid === id).length;

/* ============ نافذة تثبيت التطبيق ============
   شعار وتحته زر «تثبيت» بأيقونة تنزيل، تظهر بعد ثانيتين من انتهاء شاشة التحميل حين يتيح المتصفح التثبيت */
let installEvt = null, installReady = false;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; maybeInstallPop(); });
window.addEventListener('appinstalled', () => { installEvt = null; document.getElementById('installpop')?.remove(); });
function maybeInstallPop() {
  if (!installEvt || !installReady || document.getElementById('installpop')) return;
  if (window.matchMedia?.('(display-mode: standalone)').matches) return;
  try { const t = +localStorage.getItem('qinstall_dismiss') || 0; if (Date.now() - t < 7 * 864e5) return; } catch (e) { /* ignore */ }
  const ov = document.createElement('div'); ov.id = 'installpop'; ov.className = 'overlay install';
  ov.innerHTML = `<div class="ipop"><button type="button" class="ipx" data-act="installClose" aria-label="إغلاق">×</button><img src="${logoSrc()}" alt=""><button type="button" class="btn primary ibtn" data-act="installApp">${svg('<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>')}<span>تثبيت</span></button></div>`;
  ov.addEventListener('click', e => { if (e.target === ov) A.installClose(); });
  document.body.appendChild(ov);
}
async function installApp() {
  if (!installEvt) return;
  const ev = installEvt; installEvt = null;
  ev.prompt();
  try { const r = await ev.userChoice; if (r?.outcome !== 'accepted') localStorage.setItem('qinstall_dismiss', String(Date.now())); } catch (e) { /* ignore */ }
  document.getElementById('installpop')?.remove();
}

/* ============ حذف عضو أو عدة أعضاء (بتأكيد كلمة مرور المدير) ============ */
function delMembersDialog(kind, ids) {
  if (session?.role !== 'admin' || !ids.length) return;
  const list = ids.map(id => byId(db[kind] || [], id)).filter(Boolean);
  const skip = kind === 'admins' ? list.filter(a => a.id === session.id) : [];
  let del = list.filter(m => !skip.includes(m));
  if (kind === 'admins' && db.admins.length - del.length < 1) { toast('لا بد أن يبقى مدير واحد على الأقل'); return; }
  if (!del.length) { toast('لا يمكنك حذف حسابك الحالي'); return; }
  const one = KIND_ONE[kind] || 'عضو';
  const ov = document.createElement('div'); ov.className = 'overlay';
  ov.innerHTML = `<div class="modal"><h2>حذف ${del.length === 1 ? '«' + esc(del[0].name) + '»' : del.length + ' ' + one}</h2>
    ${del.length > 1 ? `<div class="note" style="max-height:140px;overflow:auto">${del.map(m => esc(m.name)).join('، ')}</div>` : ''}
    ${skip.length ? '<p class="muted">حسابك الحالي لن يُحذف.</p>' : ''}
    <p class="muted" style="margin-top:0">${kind === 'students' ? 'تُحذف معه سجلات الحضور والتسميع. ' : kind === 'teachers' ? 'تبقى حلقاته بلا معلم. ' : kind === 'supervisors' ? 'تبقى حلقاته بلا مشرف. ' : ''}${CLOUD ? 'ويُحذف حساب الدخول.' : ''}</p>
    <label>كلمة مرورك للتأكيد<input name="pw" type="password" autocomplete="current-password"></label>
    <div class="row"><button type="button" class="btn danger" data-go>حذف</button><button type="button" class="btn" data-close>إلغاء</button></div></div>`;
  document.body.appendChild(ov);
  ov.querySelector('[data-close]').onclick = () => ov.remove();
  setTimeout(() => ov.querySelector('[name=pw]')?.focus(), 50);
  const run = async () => {
    const pw = ov.querySelector('[name=pw]').value;
    if (!pw) { toast('اكتب كلمة المرور'); return; }
    if (CLOUD) { try { await window.Cloud.testSignIn(window.Cloud.auth.email, pw); } catch (e) { toast('كلمة المرور غير صحيحة'); return; } }
    else if (me()?.pin !== pw) { toast('كلمة المرور غير صحيحة'); return; }
    ov.querySelector('[data-close]').disabled = true;
    if (CLOUD) {
      try { await window.Cloud.push(db); } catch (e) { /* يكمل */ }
      const withLogin = del.filter(m => m.hasLogin);
      for (let i = 0; i < withLogin.length; i += 5) {
        await Promise.all(withLogin.slice(i, i + 5).map(m => window.Cloud.fn({ action: 'remove', member_id: m.id }).catch(() => null)));
        if (withLogin.length > 5) toast(`حذف حسابات الدخول: ${Math.min(i + 5, withLogin.length)} من ${withLogin.length}`);
      }
    }
    const gone = new Set(del.map(m => m.id));
    db[kind] = db[kind].filter(m => !gone.has(m.id));
    if (kind === 'teachers') db.halaqat.forEach(h => { if (gone.has(h.teacherId)) h.teacherId = ''; });
    if (kind === 'supervisors') db.halaqat.forEach(h => { if (gone.has(h.supervisorId)) h.supervisorId = ''; });
    if (kind === 'students') { db.records = db.records.filter(r => !gone.has(r.studentId)); db.attendance = db.attendance.filter(a => !gone.has(a.studentId)); }
    gone.forEach(id => ui.sel.delete(id));
    save(); ov.remove(); render(); toast(`تم حذف ${del.length === 1 ? '«' + del[0].name + '»' : del.length + ' ' + one}`);
  };
  const btn = ov.querySelector('[data-go]');
  btn.onclick = () => { if (!btn.classList.contains('loading')) withBusy(btn, run()); };
  ov.querySelector('[name=pw]').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); btn.click(); } });
}

/* ============ عين إظهار كلمة المرور ============ */
const EYE = svg('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>');
const EYE_OFF = svg('<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.6 9.6 0 0 0 4.4-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>');
function eyeify() {
  document.querySelectorAll('input[type=password]:not([data-eye])').forEach(inp => {
    inp.dataset.eye = '1';
    const w = document.createElement('span'); w.className = 'pwwrap';
    inp.parentNode.insertBefore(w, inp); w.appendChild(inp);
    const b = document.createElement('button'); b.type = 'button'; b.className = 'eye'; b.tabIndex = -1;
    b.setAttribute('aria-label', 'إظهار كلمة المرور'); b.innerHTML = EYE; w.appendChild(b);
  });
}
new MutationObserver(() => { eyeify(); addPrintButtons(); }).observe(document.body, { childList: true, subtree: true });
document.addEventListener('click', e => {
  const b = e.target.closest('.eye'); if (!b) return;
  e.preventDefault();
  const inp = b.parentNode.querySelector('input'), show = inp.type === 'password';
  inp.type = show ? 'text' : 'password'; b.innerHTML = show ? EYE_OFF : EYE;
  b.setAttribute('aria-label', show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور');
  inp.focus();
}, true);

/* ============ طباعة جدول أو حفظه PDF مع اختيار الصفوف والأعمدة ============ */
function addPrintButtons() {
  document.querySelectorAll('main .tbl:not([data-pr])').forEach(t => {
    t.dataset.pr = '1';
    if (t.classList.contains('paytbl') || !t.querySelector('table td')) return;
    const b = document.createElement('div'); b.className = 'tblprint noprint';
    b.innerHTML = `<button type="button" class="btn sm" data-print title="طباعة / حفظ PDF">${svg('<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>')}<span>طباعة / PDF</span></button>`;
    t.parentNode.insertBefore(b, t);
  });
}
document.addEventListener('click', e => { const b = e.target.closest('[data-print]'); if (b) printTable(b.parentNode.nextElementSibling?.querySelector('table')); });
function cellText(td) {
  if (!td) return '';
  const c = td.cloneNode(true), live = td.querySelectorAll('input,select,textarea'), cl = c.querySelectorAll('input,select,textarea');
  cl.forEach((x, i) => { const o = live[i]; const v = o.tagName === 'SELECT' ? (o.selectedIndex > 0 || o.value ? o.options[o.selectedIndex]?.text || '' : '') : (o.type === 'checkbox' ? '' : o.value); x.replaceWith(document.createTextNode(v)); });
  c.querySelectorAll('button:not(.lnk),.noprint,.av').forEach(x => x.remove());
  return c.textContent.replace(/\s+/g, ' ').trim();
}
function tableGrid(tbl) {
  const rows = [...tbl.rows], grid = [];
  rows.forEach((tr, ri) => {
    grid[ri] = grid[ri] || []; let c = 0;
    [...tr.cells].forEach(td => {
      while (grid[ri][c]) c++;
      const rs = td.rowSpan || 1, cs = td.colSpan || 1;
      for (let a = 0; a < rs; a++) for (let b = 0; b < cs; b++) { grid[ri + a] = grid[ri + a] || []; grid[ri + a][c + b] = { td, c0: c, cs, first: a === 0 && b === 0 }; }
      c += cs;
    });
  });
  let H = rows.findIndex(tr => [...tr.cells].some(x => x.tagName === 'TD')); if (H < 0) H = rows.length;
  const ncol = Math.max(0, ...grid.map(r => r.length));
  const labels = Array.from({ length: ncol }, (_, j) => [...new Set(grid.slice(0, H).map(r => r[j]?.td).filter(Boolean).map(cellText))].filter(Boolean).join(' – '));
  return { rows, grid, H, ncol, labels };
}
function printTable(tbl) {
  if (!tbl) return;
  const G = tableGrid(tbl), card = tbl.closest('.card');
  const data = G.rows.slice(G.H).map((tr, k) => ({ i: G.H + k, sum: tr.classList.contains('sum'), texts: Array.from({ length: G.ncol }, (_, j) => { const g = G.grid[G.H + k][j]; return g && g.first ? cellText(g.td) : ''; }) }));
  const used = Array.from({ length: G.ncol }, (_, j) => data.some(r => r.texts[j]) && !G.grid[0]?.[j]?.td.classList.contains('noprint'));
  const title0 = (card?.querySelector('h2')?.textContent || document.querySelector('.ttl')?.textContent || '').trim();
  const wide = G.ncol > 7;
  const rowLbl = r => r.texts.filter(Boolean).slice(0, 3).join(' · ') || '—';
  const ov = document.createElement('div'); ov.className = 'overlay';
  ov.innerHTML = `<div class="modal wide prdlg"><h2>طباعة / حفظ PDF</h2>
    <div class="two"><label>العنوان<input name="ttl" value="${esc(title0)}"></label><label>اتجاه الصفحة<select name="ori"><option value="portrait" ${wide ? '' : 'selected'}>طولي</option><option value="landscape" ${wide ? 'selected' : ''}>عرضي</option></select></label></div>
    <div class="lbl-s">الأعمدة</div><div class="chips prcols">${G.labels.map((l, j) => (used[j] || l ? `<label class="chk prchip"><input type="checkbox" data-col="${j}" ${used[j] ? 'checked' : ''}> ${esc(l || 'عمود ' + (j + 1))}</label>` : '')).join('')}</div>
    <div class="bar" style="margin:.4rem 0"><span class="lbl-s grow" style="margin:0">الصفوف <span class="muted" data-cnt></span></span><input type="search" data-rq placeholder="بحث في الصفوف" style="width:auto;max-width:200px"><button type="button" class="btn sm" data-all>الكل</button><button type="button" class="btn sm" data-none>لا شيء</button></div>
    <div class="prrows">${data.map((r, k) => `<label class="chk"><input type="checkbox" data-row="${k}" checked> <span>${esc(rowLbl(r))}</span></label>`).join('')}</div>
    <p class="muted" style="font-size:.82rem;margin:.6rem 0 0">للحفظ PDF اختر «حفظ بتنسيق PDF» في نافذة الطباعة.</p>
    <div class="row"><button type="button" class="btn primary" data-go>طباعة / PDF</button><button type="button" class="btn" data-close>إلغاء</button></div></div>`;
  document.body.appendChild(ov);
  const rowsBoxes = () => [...ov.querySelectorAll('[data-row]')];
  const count = () => { ov.querySelector('[data-cnt]').textContent = `(${rowsBoxes().filter(x => x.checked).length} من ${data.length})`; };
  count();
  ov.addEventListener('change', count);
  ov.querySelector('[data-rq]').addEventListener('input', e => { const q = norm(e.target.value); rowsBoxes().forEach(x => { x.parentNode.hidden = !!q && !norm(x.parentNode.textContent).includes(q); }); });
  ov.querySelector('[data-all]').onclick = () => { rowsBoxes().forEach(x => { if (!x.parentNode.hidden) x.checked = true; }); count(); };
  ov.querySelector('[data-none]').onclick = () => { rowsBoxes().forEach(x => { if (!x.parentNode.hidden) x.checked = false; }); count(); };
  ov.querySelector('[data-close]').onclick = () => ov.remove();
  ov.querySelector('[data-go]').onclick = () => {
    const cols = [...ov.querySelectorAll('[data-col]')].filter(x => x.checked).map(x => +x.dataset.col);
    const pick = rowsBoxes().filter(x => x.checked).map(x => data[+x.dataset.row]);
    if (!cols.length || !pick.length) { toast('اختر عمودًا وصفًا واحدًا على الأقل'); return; }
    const ttl = ov.querySelector('[name=ttl]').value.trim(), ori = ov.querySelector('[name=ori]').value;
    /* صف الإجمالي يُعاد حسابه من الصفوف المختارة فقط */
    const toNum = t => { const x = String(t).replace(/,/g, '').trim(); return x !== '' && !isNaN(+x) ? +x : null; };
    const items = pick.filter(r => !r.sum), partial = items.length !== data.filter(r => !r.sum).length;
    const sumOf = j => items.reduce((a, r) => a + (toNum(r.texts[j]) || 0), 0);
    const body = pick.map(r => {
      let html = '';
      cols.forEach(j => {
        const g = G.grid[r.i][j]; if (!g) { html += '<td></td>'; return; }
        const span = cols.filter(c => c >= g.c0 && c < g.c0 + g.cs);
        if (span[0] !== j) return;
        let t = cellText(g.td);
        if (r.sum && partial && g.cs === 1 && toNum(t) !== null) t = Math.round(sumOf(j)).toLocaleString('en-US');
        html += `<td${span.length > 1 ? ` colspan="${span.length}"` : ''}>${esc(t)}</td>`;
      });
      return `<tr${r.sum ? ' class="sum"' : ''}>${html}</tr>`;
    }).join('');
    let z = document.getElementById('printzone'); if (!z) { z = document.createElement('div'); z.id = 'printzone'; document.body.appendChild(z); }
    z.innerHTML = `<style>@page{size:A4 ${ori};margin:10mm}</style><div class="pz-head"><img src="${logoSrc()}" alt=""><div><b>${esc(db.settings.org || '')}</b>${ttl ? `<h1>${esc(ttl)}</h1>` : ''}</div><small>${today()}</small></div>
      <table><thead><tr>${cols.map(j => `<th>${esc(G.labels[j] || '')}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>`;
    ov.remove();
    document.body.classList.add('printing');
    const done = () => { document.body.classList.remove('printing'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => { window.print(); setTimeout(done, 1500); }, 150);
  };
}

/* ============ التحديث التلقائي عند توفّر نسخة جديدة ============
   يقارن بصمة ملفات التطبيق على الخادم؛ إن تغيّرت (نُشر تحديث) يُعاد التحميل تلقائيًا
   بعد إرسال أي تغييرات معلّقة، ولا يقاطع نافذة مفتوحة أو حقلًا قيد الكتابة. */
const VFILES = ['./index.html', './style.css', './app.js', './app-forms.js', './app-actions.js', './payroll.js', './cloud.js'];
let verBase = null, verBusy = false, updWait = null;
async function verSig() {
  const parts = await Promise.all(VFILES.map(f => fetch(f + '?v=' + Date.now(), { method: 'HEAD', cache: 'no-store' })
    .then(r => (r.ok ? r.headers.get('etag') || r.headers.get('last-modified') || r.headers.get('content-length') || '' : null)).catch(() => null)));
  return parts.some(p => p === null) ? null : parts.join('|');
}
async function checkUpdate() {
  if (verBusy || navigator.onLine === false || !/^https?:/.test(location.protocol)) return;
  verBusy = true;
  try {
    const s = await verSig();
    if (!s) return;
    if (verBase === null) { verBase = s; return; }
    if (s !== verBase) applyUpdate();
  } finally { verBusy = false; }
}
async function applyUpdate() {
  const typing = document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
  if (document.querySelector('.overlay') || typing || window.Cloud?.busy) { clearTimeout(updWait); updWait = setTimeout(applyUpdate, 5000); return; }
  if (CLOUD && session && window.Cloud.pendingCount(db)) { try { await window.Cloud.push(db); } catch (e) { /* يُعاد المحاولة */ updWait = setTimeout(applyUpdate, 5000); return; } }
  try { const reg = await navigator.serviceWorker?.getRegistration(); await reg?.update(); } catch (e) { /* ignore */ }
  location.reload();
}
window.addEventListener('online', () => setTimeout(checkUpdate, 1500));
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkUpdate(); });
setInterval(() => { if (!document.hidden) checkUpdate(); }, 5 * 60000);
setTimeout(checkUpdate, 4000);

/* مسح كل البيانات: يطلب بريد المدير وكلمة مروره (أو اسمه وكلمته في الوضع المحلي) وكتابة «مسح» للتأكيد */
function wipeAll() {
  if (session?.role !== 'admin') { toast('غير مصرح'); return; }
  const ov = document.createElement('div'); ov.className = 'overlay';
  ov.innerHTML = `<div class="modal"><h2>مسح كل البيانات</h2>
    <div class="note" style="color:var(--red);border-color:#e8c4c0">سيُحذف نهائيًا${CLOUD ? ' من قاعدة البيانات' : ''}: المعلمون والمشرفون والطلاب${CLOUD ? ' وحسابات دخولهم' : ''}، والأماكن والحلقات، والحضور والتسميع، والإعلانات، والمرتبات والغياب. تبقى حسابات الإداريين والمظهر. خذ «تصدير نسخة احتياطية» أولًا.</div>
    ${CLOUD ? '<label>بريد المدير<input name="email" type="email" dir="ltr" autocomplete="off"></label>' : '<label>اسم المدير<input name="aname" autocomplete="off"></label>'}
    <label>كلمة مرور المدير<input name="pw" type="password" autocomplete="new-password"></label>
    <label>اكتب كلمة «مسح» للتأكيد<input name="confirm" autocomplete="off"></label>
    <div class="row"><button type="button" class="btn danger" data-wipe>مسح نهائي</button><button type="button" class="btn" data-close>إلغاء</button></div></div>`;
  document.body.appendChild(ov);
  const val = n => (ov.querySelector(`[name=${n}]`)?.value || '').trim();
  ov.querySelector('[data-close]').onclick = () => ov.remove();
  const run = async () => {
    if (val('confirm') !== 'مسح') { toast('اكتب كلمة «مسح» للتأكيد'); return; }
    if (!CLOUD) {
      const a = db.admins.find(x => norm(x.name) === norm(val('aname')) && x.pin === ov.querySelector('[name=pw]').value);
      if (!a) { toast('اسم المدير أو كلمة المرور غير صحيحة'); return; }
      db = seed(); session = null; ss.del(SKEY); save(); ov.remove(); render(); toast('تم مسح كل البيانات');
      return;
    }
    let j;
    try { j = await window.Cloud.testSignIn(val('email'), ov.querySelector('[name=pw]').value); }
    catch (e) { toast('البريد أو كلمة المرور غير صحيحة'); return; }
    if (!db.admins.some(a => a.userId && a.userId === j.user?.id)) { toast('هذا الحساب ليس حساب مدير'); return; }
    ov.querySelector('[data-close]').disabled = true;
    /* حذف حسابات الدخول أولًا (خمسة في المرة) ثم البيانات */
    const withLogin = [...db.supervisors, ...db.teachers, ...db.students].filter(m => m.hasLogin);
    for (let i = 0; i < withLogin.length; i += 5) {
      await Promise.all(withLogin.slice(i, i + 5).map(m => window.Cloud.fn({ action: 'remove', member_id: m.id }).catch(() => null)));
      toast(`حذف حسابات الدخول: ${Math.min(i + 5, withLogin.length)} من ${withLogin.length}`);
    }
    Object.assign(db, { supervisors: [], teachers: [], students: [], places: [], halaqat: [], attendance: [], records: [], news: [], pending: [], fields: { students: [], teachers: [] } });
    if (db.payroll) db.payroll = { settings: db.payroll.settings || {}, employees: [], rows: [], absences: [], closed: [] };
    save();
    try { await window.Cloud.push(db); } catch (e) { toast('تعذّر إكمال المسح: ' + (e.message || e)); return; }
    ov.remove(); render(); toast('تم مسح كل البيانات');
  };
  const btn = ov.querySelector('[data-wipe]');
  btn.onclick = () => { if (!btn.classList.contains('loading')) withBusy(btn, run()); };
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
window.QL = { get db() { return db; }, get session() { return session; }, me, ICONS: TAB_ICONS, printTable: t => printTable(t), placeNames: () => (db.places || []).map(x => x.name), save, render, openForm, openInfo, ask, toast, esc, uid, today, byId, norm, empty };

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
const afterSplash = ms => setTimeout(() => { installReady = true; maybeInstallPop(); if (session?.role === 'admin') dupOnce(); }, ms);
if (splash) {
  if (session) { splash.remove(); afterSplash(2000); }
  else setTimeout(() => { splash.classList.add('hide'); setTimeout(() => splash.remove(), 700); afterSplash(2000); }, 3000);
} else afterSplash(2000);
/* اقتراح الدمج يظهر للمدير مرة واحدة في كل جلسة إن وُجدت أسماء مكررة */
function dupOnce() { if (ui.dupShown || document.querySelector('.overlay')) return; ui.dupShown = true; dupDialog(false); }
