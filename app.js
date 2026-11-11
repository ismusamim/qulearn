(() => {
'use strict';
const ss={get:k=>{try{return sessionStorage.getItem(k)}catch(e){return null}},set:(k,v)=>{try{sessionStorage.setItem(k,v)}catch(e){}},del:k=>{try{sessionStorage.removeItem(k)}catch(e){}}};

/* ============ ثوابت ============ */
const SURAHS = [["الفاتحة",7],["البقرة",286],["آل عمران",200],["النساء",176],["المائدة",120],["الأنعام",165],["الأعراف",206],["الأنفال",75],["التوبة",129],["يونس",109],["هود",123],["يوسف",111],["الرعد",43],["إبراهيم",52],["الحجر",99],["النحل",128],["الإسراء",111],["الكهف",110],["مريم",98],["طه",135],["الأنبياء",112],["الحج",78],["المؤمنون",118],["النور",64],["الفرقان",77],["الشعراء",227],["النمل",93],["القصص",88],["العنكبوت",69],["الروم",60],["لقمان",34],["السجدة",30],["الأحزاب",73],["سبأ",54],["فاطر",45],["يس",83],["الصافات",182],["ص",88],["الزمر",75],["غافر",85],["فصلت",54],["الشورى",53],["الزخرف",89],["الدخان",59],["الجاثية",37],["الأحقاف",35],["محمد",38],["الفتح",29],["الحجرات",18],["ق",45],["الذاريات",60],["الطور",49],["النجم",62],["القمر",55],["الرحمن",78],["الواقعة",96],["الحديد",29],["المجادلة",22],["الحشر",24],["الممتحنة",13],["الصف",14],["الجمعة",11],["المنافقون",11],["التغابن",18],["الطلاق",12],["التحريم",12],["الملك",30],["القلم",52],["الحاقة",52],["المعارج",44],["نوح",28],["الجن",28],["المزمل",20],["المدثر",56],["القيامة",40],["الإنسان",31],["المرسلات",50],["النبأ",40],["النازعات",46],["عبس",42],["التكوير",29],["الانفطار",19],["المطففين",36],["الانشقاق",25],["البروج",22],["الطارق",17],["الأعلى",19],["الغاشية",26],["الفجر",30],["البلد",20],["الشمس",15],["الليل",21],["الضحى",11],["الشرح",8],["التين",8],["العلق",19],["القدر",5],["البينة",8],["الزلزلة",8],["العاديات",11],["القارعة",11],["التكاثر",8],["العصر",3],["الهمزة",9],["الفيل",5],["قريش",4],["الماعون",7],["الكوثر",3],["الكافرون",6],["النصر",3],["المسد",5],["الإخلاص",4],["الفلق",5],["الناس",6]];
const GRADES = ['ممتاز', 'جيد جدًا', 'جيد', 'مقبول', 'يعاد'];
const TYPES = ['حفظ', 'مراجعة', 'تثبيت'];
const STATUS = { present: 'حاضر', late: 'متأخر', excused: 'معتذر', absent: 'غائب' };
const LOGO = 'logo.png';
const KEY = 'halaqat_v1';
const SKEY = 'halaqat_session';
const TABS = {
  admin: [['dash', 'الرئيسية'], ['members', 'الأعضاء'], ['teachers', 'المعلمون'], ['halaqat', 'الحلقات'], ['students', 'الطلاب'], ['news', 'الإعلانات'], ['settings', 'الإعدادات']],
  teacher: [['att', 'الحضور'], ['mine', 'طلابي'], ['profile', 'ملفي'], ['news', 'الإعلانات']],
  student: [['me', 'تقدمي'], ['hist', 'السجل'], ['news', 'الإعلانات']]
};

/* ============ ملف المعلم الداخلي ============ */
// كل حقل: [المفتاح, العنوان, النوع, خيارات]
const PROF = {
  personal: { label: 'بيانات شخصية', title: 'البيانات الشخصية', fields: [
    ['fullName', 'الاسم الكامل'], ['birth', 'تاريخ الميلاد', 'date'], ['phone', 'الجوال', 'tel'],
    ['email', 'البريد الإلكتروني', 'email'], ['address', 'العنوان'], ['emergency', 'جهة اتصال للطوارئ (الاسم والرقم)']
  ] },
  admin: { label: 'بيانات إدارية', title: 'البيانات الإدارية', adminOnly: true, fields: [
    ['empNo', 'الرقم الوظيفي'], ['joinDate', 'تاريخ الالتحاق', 'date'],
    ['contract', 'نوع التعاقد', 'select', ['متطوع', 'متعاقد', 'موظف']],
    ['status', 'الحالة', 'select', ['نشط', 'في إجازة', 'موقوف']],
    ['pay', 'المكافأة الشهرية', 'number'], ['adminNote', 'ملاحظات إدارية', 'textarea']
  ] },
  tech: { label: 'بيانات فنية', title: 'البيانات الفنية', fields: [
    ['qual', 'المؤهل العلمي'],
    ['riwaya', 'الرواية', 'select', ['حفص عن عاصم', 'ورش عن نافع', 'قالون عن نافع', 'غير ذلك']],
    ['ijaza', 'الإجازة', 'select', ['بدون إجازة', 'إجازة في القراءة', 'إجازة في الرواية', 'إجازة بالسند المتصل']],
    ['sanad', 'اسم الشيخ المُجيز / السند'], ['memorized', 'الأجزاء المحفوظة (0–30)', 'number'],
    ['exp', 'سنوات الخبرة في التحفيظ', 'number'], ['specialty', 'التخصصات (تلقين، تجويد، مراجعة…)'],
    ['courses', 'الدورات والشهادات', 'textarea']
  ] }
};
const genPass = () => {
  const a = new Uint32Array(1);
  try { crypto.getRandomValues(a); } catch (e) { a[0] = Math.floor(Math.random() * 4294967296); }
  return String(100000 + a[0] % 900000);
};
const pv = (t, g, k) => k === 'phone' ? (t.phone || '') : ((t[g] || {})[k] || '');

/* ============ أدوات ============ */
const $app = document.getElementById('app');
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const pad = n => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const byId = (arr, id) => arr.find(x => x.id === id);
const empty = t => `<div class="empty">${esc(t)}</div>`;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast.h); toast.h = setTimeout(() => (t.hidden = true), 2600);
}

/* ============ البيانات ============ */
function seed() {
  const t1 = uid(), h1 = uid();
  const names = ['عبد الله', 'محمد', 'يوسف'];
  return {
    settings: { org: 'إدارة الحلقات القرآنية', adminPin: '1234' },
    teachers: [{ id: t1, name: 'الشيخ أحمد', phone: '', pin: '0000' }],
    halaqat: [{ id: h1, name: 'حلقة الفرقان', teacherId: t1, schedule: 'بعد صلاة العصر' }],
    students: names.map(n => ({ id: uid(), name: n, halaqaId: h1, phone: '', pin: '0000' })),
    attendance: [], records: [], news: []
  };
}
function load() {
  try { const r = localStorage.getItem(KEY); if (r) return JSON.parse(r); } catch (e) { /* ignore */ }
  const d = seed();
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
  return d;
}
let db = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { toast('تعذّر حفظ البيانات في المتصفح'); } };

let session = null;
try { session = JSON.parse(ss.get(SKEY) || 'null'); } catch (e) { /* ignore */ }
const ui = { loginRole: null, tab: null, hid: '', date: today(), fh: '', psub: 'personal', msub: 'teachers', shown: {} };

/* ============ دوال مساعدة للمجال ============ */
const hName = id => byId(db.halaqat, id)?.name || '—';
const tName = id => byId(db.teachers, id)?.name || '—';
const sName = id => byId(db.students, id)?.name || '—';
const myHalaqat = () => db.halaqat.filter(h => h.teacherId === session.id);
const recsOf = sid => db.records.filter(r => r.studentId === sid).slice().reverse().sort((a, b) => b.date.localeCompare(a.date));
const recLine = r => `${r.type} — سورة ${SURAHS[r.surah - 1][0]} (${r.from}–${r.to})`;
function lastHifz(sid) {
  const r = recsOf(sid).find(x => x.type === 'حفظ');
  return r ? `سورة ${SURAHS[r.surah - 1][0]} – آية ${r.to}` : '—';
}
function attRate(sid) {
  const a = db.attendance.filter(x => x.studentId === sid);
  if (!a.length) return '—';
  const ok = a.filter(x => x.status === 'present' || x.status === 'late').length;
  return Math.round(ok * 100 / a.length) + '%';
}
const hifzAyat = sid => db.records.filter(r => r.studentId === sid && r.type === 'حفظ').reduce((s, r) => s + (r.to - r.from + 1), 0);
const newsFor = aud => db.news.filter(n => n.audience === 'all' || n.audience === aud).slice().reverse();
const opts = (arr, v = 'id', l = 'name') => arr.map(x => ({ v: x[v], l: x[l] }));

/* ============ النماذج (نوافذ) ============ */
function fieldHtml(f) {
  if (f.type === 'note') return `<p class="note">${esc(f.label)}</p>`;
  const v = f.value ?? '';
  let input;
  if (f.type === 'select') {
    input = `<select name="${f.name}">${f.options.map(o => `<option value="${esc(o.v)}" ${String(o.v) === String(v) ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select>`;
  } else if (f.type === 'textarea') {
    input = `<textarea name="${f.name}" rows="3">${esc(v)}</textarea>`;
  } else {
    input = `<input name="${f.name}" type="${f.type || 'text'}" value="${esc(v)}" ${f.required ? 'required' : ''} ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''}>`;
  }
  return `<label>${esc(f.label)}${input}</label>`;
}
function openForm(title, fields, onSave) {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal"><h2>${esc(title)}</h2>${fields.map(fieldHtml).join('')}<div class="row"><button type="button" class="btn primary" data-save>حفظ</button><button type="button" class="btn" data-close>إلغاء</button></div></div>`;
  document.body.appendChild(ov);
  ov.querySelector('[data-close]').onclick = () => ov.remove();
  ov.querySelector('[data-save]').onclick = () => {
    const vals = {};
    ov.querySelectorAll('[name]').forEach(x => { vals[x.name] = x.value; });
    if ([...ov.querySelectorAll('[required]')].some(x => !x.value.trim())) { toast('أكمل الحقول المطلوبة'); return; }
    const err = onSave(vals);
    if (err) { toast(err); return; }
    ov.remove(); save(); render();
  };
}
function ask(msg, yes) {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal"><h2>${esc(msg)}</h2><div class="row"><button type="button" class="btn danger" data-yes>تأكيد</button><button type="button" class="btn" data-close>إلغاء</button></div></div>`;
  document.body.appendChild(ov);
  ov.querySelector('[data-close]').onclick = () => ov.remove();
  ov.querySelector('[data-yes]').onclick = () => { ov.remove(); yes(); };
}
function openInfo(title, html) {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal wide"><h2>${esc(title)}</h2>${html}<div class="row"><button class="btn" data-close>إغلاق</button></div></div>`;
  document.body.appendChild(ov);
  ov.querySelector('[data-close]').onclick = () => ov.remove();
}

/* ============ تسجيل الدخول ============ */
const ICONS = {
  student: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5"/><path d="M22 9v6"/></svg>',
  teacher: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="8.5" cy="7.5" r="3"/><path d="M2.5 20v-1.2a6 6 0 0 1 12 0V20"/><rect x="13.5" y="4" width="8" height="6" rx="1"/><path d="M17.5 10v3m-2 0h4"/></svg>',
  admin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>'
};
function loginView() {
  const r = ui.loginRole;
  const roles = [['student', 'طالب'], ['teacher', 'معلم'], ['admin', 'إداري']];
  const pick = list => list.length
    ? `<div class="combo"><label>${r === 'teacher' ? 'المعلم' : 'الطالب'}<input type="text" id="ufilter" placeholder="اكتب بعض حروف الاسم أو اختره من القائمة" autocomplete="off"></label><input type="hidden" name="uid" id="uid" value=""><div class="results" id="uresults" hidden></div></div>`
    : `<p class="muted">لا يوجد ${r === 'teacher' ? 'معلمون' : 'طلاب'} بعد. ادخل كإداري لإضافتهم.</p>`;
  const who = r === 'teacher' ? pick(db.teachers) : r === 'student' ? pick(db.students) : '';
  const form = r
    ? `<div class="card loginform"><div id="login">${who}<label>كلمة المرور<input name="pin" type="password" inputmode="numeric" autocomplete="off"></label><button type="button" class="btn primary" style="width:100%" data-act="doLogin">دخول</button></div></div>`
    : '<p class="muted" style="text-align:center">اختر نوع الدخول للمتابعة</p>';
  return `<div class="login"><div class="logo-wrap"><img src="${LOGO}" alt="شعار إدارة الحلقات القرآنية"><div class="sheen" style="-webkit-mask-image:url(${LOGO});mask-image:url(${LOGO})"></div></div>
  <div class="tiles">${roles.map(([k, l]) => `<button type="button" class="tile ${k === r ? 'on' : ''}" data-act="role" data-v="${k}">${ICONS[k]}<span>${l}</span></button>`).join('')}</div>
  ${form}<p class="muted" style="font-size:.8rem;text-align:center">النسخة التجريبية: إداري 1234 — معلم وطالب 0000 (غيّرها من لوحة الإدارة).</p></div>`;
}

/* ===== بحث الاسم في صفحة الدخول ===== */
const norm = t => String(t || '').replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase().trim();
const loginUsers = () => ui.loginRole === 'teacher' ? db.teachers : ui.loginRole === 'student' ? db.students : [];
function loginMatches() {
  const q = norm(document.getElementById('ufilter')?.value);
  return loginUsers().filter(u => !q || norm(u.name).includes(q));
}
function showResults(open = true) {
  const box = document.getElementById('uresults');
  if (!box) return;
  if (!open) { box.hidden = true; return; }
  const list = loginMatches();
  box.innerHTML = list.length
    ? list.map(u => `<button type="button" class="opt" data-pick="${esc(u.id)}">${esc(u.name)}</button>`).join('')
    : '<div class="muted" style="padding:.6rem .8rem">لا توجد نتائج مطابقة</div>';
  box.hidden = false;
}
function pickUser(u) {
  const f = document.getElementById('ufilter');
  f.value = u.name; f.classList.add('picked');
  document.getElementById('uid').value = u.id;
  showResults(false);
  document.querySelector('#login input[name=pin]')?.focus();
}

/* ============ الهيكل العام ============ */
function render() {
  if (session) {
    const ok = session.role === 'admin' || (session.role === 'teacher' && byId(db.teachers, session.id)) || (session.role === 'student' && byId(db.students, session.id));
    if (!ok) { session = null; ss.del(SKEY); }
  }
  if (!session) { $app.innerHTML = loginView(); return; }
  const role = session.role, tabs = TABS[role];
  if (!tabs.some(t => t[0] === ui.tab)) ui.tab = tabs[0][0];
  const who = role === 'admin' ? 'لوحة الإدارة' : role === 'teacher' ? 'المعلم: ' + tName(session.id) : 'الطالب: ' + sName(session.id);
  $app.innerHTML = `<header class="top"><div class="brand"><img class="hlogo" src="${LOGO}" alt=""><div><h1>${esc(db.settings.org)}</h1><small>${esc(who)}</small></div></div><button class="btn" data-act="logout">خروج</button></header>
  <nav class="tabs">${tabs.map(([k, l]) => `<button class="${k === ui.tab ? 'on' : ''}" data-act="tab" data-v="${k}">${l}</button>`).join('')}</nav>
  <main>${VIEWS[role][ui.tab]()}</main>`;
}

/* ============ مكونات مشتركة ============ */
function newsView(aud) {
  const list = newsFor(aud);
  return `<div class="card"><h2>الإعلانات</h2>${list.length ? list.map(n => `<div class="news">${esc(n.text)}<br><small>${esc(n.date)}</small></div>`).join('') : empty('لا توجد إعلانات.')}</div>`;
}
function halaqaPicker(list) {
  if (!list.some(h => h.id === ui.hid)) ui.hid = list[0]?.id || '';
  return `<select data-change="hid">${list.map(h => `<option value="${esc(h.id)}" ${h.id === ui.hid ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}</select>`;
}
function historyTable(sid) {
  const rs = recsOf(sid);
  if (!rs.length) return empty('لا توجد تسجيلات بعد.');
  return `<div class="tbl"><table><tr><th>التاريخ</th><th>النوع</th><th>الموضع</th><th>التقدير</th><th>ملاحظة</th></tr>${rs.map(r => `<tr><td>${esc(r.date)}</td><td><span class="tag">${esc(r.type)}</span></td><td>سورة ${esc(SURAHS[r.surah - 1][0])} (${r.from}–${r.to})</td><td>${esc(r.grade)}</td><td>${esc(r.note)}</td></tr>`).join('')}</table></div>`;
}

/* ============ قسم الإداريات ============ */
const adminViews = {
  dash() {
    const t = today(), att = db.attendance.filter(a => a.date === t);
    const ok = att.filter(a => a.status === 'present' || a.status === 'late').length;
    const week = new Date(Date.now() - 7 * 864e5), wk = `${week.getFullYear()}-${pad(week.getMonth() + 1)}-${pad(week.getDate())}`;
    const stats = [[db.teachers.length, 'معلم'], [db.halaqat.length, 'حلقة'], [db.students.length, 'طالب'], [att.length ? Math.round(ok * 100 / att.length) + '%' : '—', 'حضور اليوم'], [db.records.filter(r => r.date >= wk).length, 'تسجيلات الأسبوع']];
    return `<div class="grid">${stats.map(([n, l]) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`).join('')}</div>${newsView('admin')}`;
  },
  members() {
    const kind = ui.msub === 'students' ? 'students' : 'teachers';
    const one = kind === 'students' ? 'طالب' : 'معلم';
    const subs = [['teachers', 'المعلمون'], ['students', 'الطلاب']];
    const rows = db[kind].map((m, i) => `<tr><td>${i + 1}</td><td>${esc(m.name)}</td>
      <td><code class="pw">${ui.shown[m.id] ? esc(m.pin) : '••••••'}</code> <button class="btn sm" data-act="togglePw" data-id="${m.id}">${ui.shown[m.id] ? 'إخفاء' : 'إظهار'}</button></td>
      <td><button class="btn sm" data-act="copyPw" data-id="${m.id}" data-k="${kind}">نسخ</button><button class="btn sm" data-act="newPw" data-id="${m.id}" data-k="${kind}">كلمة جديدة</button><button class="btn sm" data-act="editName" data-id="${m.id}" data-k="${kind}">الاسم</button><button class="btn sm danger" data-act="${kind === 'students' ? 'delStudent' : 'delTeacher'}" data-id="${m.id}">حذف</button></td></tr>`).join('');
    return `<div class="card"><div class="bar">${subs.map(([k, l]) => `<button class="btn ${k === kind ? 'on' : ''}" data-act="msub" data-v="${k}">${l} (${db[k].length})</button>`).join('')}<span class="grow"></span><button class="btn primary" data-act="addMember" data-k="${kind}">+ ${one}</button></div>
    <div class="note">عند إضافة عضو تُنشأ كلمة المرور تلقائيًا (6 أرقام). سلّمها للعضو ليدخل بها من صفحة الدخول.</div>
    ${db[kind].length ? `<div class="tbl"><table><tr><th>#</th><th>الاسم</th><th>كلمة المرور</th><th></th></tr>${rows}</table></div>` : empty('لا يوجد أعضاء بعد.')}</div>`;
  },
  teachers() {
    return `<div class="card"><div class="bar"><h2 class="grow" style="margin:0">المعلمون</h2><button class="btn primary" data-act="addTeacher">+ معلم</button></div>
    ${db.teachers.length ? `<div class="tbl"><table><tr><th>الاسم</th><th>الجوال</th><th>الحلقات</th><th></th></tr>${db.teachers.map(t => `<tr><td>${esc(t.name)}</td><td>${esc(t.phone)}</td><td>${db.halaqat.filter(h => h.teacherId === t.id).length}</td><td><button class="btn sm" data-act="editTeacher" data-id="${t.id}">تعديل</button><button class="btn sm" data-act="editProf" data-id="${t.id}" data-g="personal">شخصية</button><button class="btn sm" data-act="editProf" data-id="${t.id}" data-g="admin">إدارية</button><button class="btn sm" data-act="editProf" data-id="${t.id}" data-g="tech">فنية</button><button class="btn sm danger" data-act="delTeacher" data-id="${t.id}">حذف</button></td></tr>`).join('')}</table></div>` : empty('لا يوجد معلمون.')}</div>`;
  },
  halaqat() {
    return `<div class="card"><div class="bar"><h2 class="grow" style="margin:0">الحلقات</h2><button class="btn primary" data-act="addHalaqa">+ حلقة</button></div>
    ${db.halaqat.length ? `<div class="tbl"><table><tr><th>الحلقة</th><th>المعلم</th><th>الموعد</th><th>الطلاب</th><th></th></tr>${db.halaqat.map(h => `<tr><td>${esc(h.name)}</td><td>${esc(tName(h.teacherId))}</td><td>${esc(h.schedule)}</td><td>${db.students.filter(s => s.halaqaId === h.id).length}</td><td><button class="btn sm" data-act="editHalaqa" data-id="${h.id}">تعديل</button><button class="btn sm danger" data-act="delHalaqa" data-id="${h.id}">حذف</button></td></tr>`).join('')}</table></div>` : empty('لا توجد حلقات.')}</div>`;
  },
  students() {
    const list = db.students.filter(s => !ui.fh || s.halaqaId === ui.fh);
    return `<div class="card"><div class="bar"><h2 class="grow" style="margin:0">الطلاب</h2>
    <select data-change="fh"><option value="">كل الحلقات</option>${db.halaqat.map(h => `<option value="${esc(h.id)}" ${h.id === ui.fh ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}</select>
    <button class="btn primary" data-act="addStudent">+ طالب</button></div>
    ${list.length ? `<div class="tbl"><table><tr><th>الاسم</th><th>الحلقة</th><th>آخر حفظ</th><th>الحضور</th><th></th></tr>${list.map(s => `<tr><td>${esc(s.name)}</td><td>${esc(hName(s.halaqaId))}</td><td>${esc(lastHifz(s.id))}</td><td>${attRate(s.id)}</td><td><button class="btn sm" data-act="hist" data-id="${s.id}">السجل</button><button class="btn sm" data-act="editStudent" data-id="${s.id}">تعديل</button><button class="btn sm danger" data-act="delStudent" data-id="${s.id}">حذف</button></td></tr>`).join('')}</table></div>` : empty('لا يوجد طلاب.')}</div>`;
  },
  news() {
    return `<div class="card"><div class="bar"><h2 class="grow" style="margin:0">الإعلانات</h2><button class="btn primary" data-act="addNews">+ إعلان</button></div>
    ${db.news.length ? db.news.slice().reverse().map(n => `<div class="news">${esc(n.text)}<br><small>${esc(n.date)} — ${n.audience === 'all' ? 'الجميع' : n.audience === 'teacher' ? 'المعلمون' : 'الطلاب'}</small> <button class="btn sm danger" data-act="delNews" data-id="${n.id}">حذف</button></div>`).join('') : empty('لا توجد إعلانات.')}</div>`;
  },
  settings() {
    return `<div class="card"><h2>الإعدادات</h2>
    <div class="note">البيانات تُحفظ في متصفح هذا الجهاز فقط (localStorage). خذ نسخة احتياطية بانتظام، ولا تعتمد على الرموز السرية لحماية بيانات حساسة.</div>
    <div class="bar"><button class="btn" data-act="editSettings">اسم المؤسسة والرمز السري</button>
    <button class="btn" data-act="export">تصدير نسخة احتياطية</button>
    <label class="btn" style="margin:0">استيراد نسخة<input type="file" accept="application/json" data-change="import" hidden></label>
    <button class="btn danger" data-act="reset">مسح كل البيانات</button></div></div>`;
  }
};

/* ============ قسم المعلم ============ */
const teacherViews = {
  att() {
    const hs = myHalaqat();
    if (!hs.length) return `<div class="card">${empty('لم تُسنَد إليك حلقة بعد. تواصل مع الإدارة.')}</div>`;
    const picker = halaqaPicker(hs);
    const sts = db.students.filter(s => s.halaqaId === ui.hid);
    const rows = sts.map(s => {
      const cur = db.attendance.find(a => a.studentId === s.id && a.date === ui.date)?.status;
      return `<tr><td>${esc(s.name)}</td><td>${Object.entries(STATUS).map(([k, l]) => `<button class="btn sm ${cur === k ? 'on ' + k : ''}" data-act="att" data-sid="${s.id}" data-st="${k}">${l}</button>`).join(' ')}</td></tr>`;
    }).join('');
    return `<div class="card"><div class="bar">${picker}<input type="date" value="${ui.date}" data-change="date"></div>
    ${sts.length ? `<div class="tbl"><table><tr><th>الطالب</th><th>الحالة</th></tr>${rows}</table></div>` : empty('لا يوجد طلاب في هذه الحلقة.')}</div>`;
  },
  mine() {
    const hs = myHalaqat();
    if (!hs.length) return `<div class="card">${empty('لم تُسنَد إليك حلقة بعد.')}</div>`;
    const sts = db.students.filter(s => s.halaqaId === ui.hid || (!hs.some(h => h.id === ui.hid) && s.halaqaId === hs[0].id));
    return `<div class="card"><div class="bar">${halaqaPicker(hs)}</div>
    ${sts.length ? `<div class="tbl"><table><tr><th>الطالب</th><th>آخر حفظ</th><th>الحضور</th><th></th></tr>${sts.map(s => `<tr><td>${esc(s.name)}</td><td>${esc(lastHifz(s.id))}</td><td>${attRate(s.id)}</td><td><button class="btn sm primary" data-act="rec" data-id="${s.id}">تسجيل تسميع</button><button class="btn sm" data-act="hist" data-id="${s.id}">السجل</button></td></tr>`).join('')}</table></div>` : empty('لا يوجد طلاب في هذه الحلقة.')}</div>`;
  },
  profile() {
    const t = byId(db.teachers, session.id);
    const g = PROF[ui.psub] ? ui.psub : 'personal', G = PROF[g];
    const rows = G.fields.map(f => `<tr><th style="width:38%">${esc(f[1])}</th><td>${esc(pv(t, g, f[0]) || '—')}</td></tr>`).join('');
    const mine = myHalaqat();
    const extra = g === 'admin' ? `<tr><th>الحلقات المسندة</th><td>${esc(mine.map(h => h.name).join('، ') || '—')}</td></tr><tr><th>عدد الطلاب</th><td>${db.students.filter(s => mine.some(h => h.id === s.halaqaId)).length}</td></tr>` : '';
    return `<div class="card"><div class="bar">${Object.entries(PROF).map(([k, v]) => `<button class="btn ${k === g ? 'on' : ''}" data-act="psub" data-v="${k}">${v.label}</button>`).join('')}</div>
    <div class="tbl"><table>${rows}${extra}</table></div>
    ${G.adminOnly ? '<p class="muted" style="margin-bottom:0">هذه البيانات تُدار من قِبل الإدارة، ويمكنك الاطلاع عليها فقط.</p>' : `<div class="row"><button class="btn primary" data-act="editProf" data-id="${t.id}" data-g="${g}">تعديل ${esc(G.label)}</button></div>`}</div>`;
  },
  news: () => newsView('teacher')
};

/* ============ قسم الطالب ============ */
const studentViews = {
  me() {
    const s = byId(db.students, session.id);
    const stats = [[lastHifz(s.id), 'آخر موضع حفظ'], [hifzAyat(s.id), 'آيات مسجّلة حفظًا'], [attRate(s.id), 'نسبة الحضور'], [recsOf(s.id).length, 'عدد التسميعات']];
    return `<div class="card"><h2>أهلًا ${esc(s.name)}</h2><p class="muted" style="margin:0">الحلقة: ${esc(hName(s.halaqaId))} — المعلم: ${esc(tName(byId(db.halaqat, s.halaqaId)?.teacherId))}</p></div>
    <div class="grid">${stats.map(([n, l]) => `<div class="stat"><b style="font-size:1.2rem">${esc(n)}</b><span>${l}</span></div>`).join('')}</div>
    <div class="card"><h2>آخر التسميعات</h2>${recsOf(s.id).slice(0, 5).map(r => `<div class="news">${esc(recLine(r))} — <b>${esc(r.grade)}</b><br><small>${esc(r.date)} ${esc(r.note)}</small></div>`).join('') || empty('لا توجد تسجيلات بعد.')}</div>`;
  },
  hist: () => `<div class="card"><h2>سجل التسميع</h2>${historyTable(session.id)}</div>`,
  news: () => newsView('student')
};
const VIEWS = { admin: adminViews, teacher: teacherViews, student: studentViews };

/* ============ الإجراءات ============ */
const A = {
  role: d => { ui.loginRole = d.v; render(); document.querySelector('#ufilter, #login input[name=pin]')?.focus(); },
  logout: () => { ui.shown = {}; session = null; ss.del(SKEY); ui.tab = null; render(); },
  tab: d => { ui.tab = d.v; render(); },
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
    const k = d.k, one = k === 'students' ? 'طالب' : 'معلم';
    openForm('إضافة ' + one, [{ name: 'name', label: 'الاسم', required: true }, { type: 'note', label: 'ستُنشأ كلمة المرور تلقائيًا.' }], v => {
      const id = uid(), pin = genPass();
      db[k].push(k === 'students' ? { id, name: v.name.trim(), halaqaId: '', phone: '', pin } : { id, name: v.name.trim(), phone: '', pin });
      ui.shown[id] = true;
      toast('تم إنشاء الحساب — كلمة المرور: ' + pin);
    });
  },

  addTeacher: () => openForm('معلم جديد', [{ name: 'name', label: 'الاسم', required: true }, { name: 'phone', label: 'الجوال', type: 'tel' }, { name: 'pin', label: 'كلمة المرور', value: genPass(), required: true }],
    v => { db.teachers.push({ id: uid(), name: v.name.trim(), phone: v.phone, pin: v.pin }); }),
  editTeacher: d => { const t = byId(db.teachers, d.id); openForm('تعديل معلم', [{ name: 'name', label: 'الاسم', value: t.name, required: true }, { name: 'phone', label: 'الجوال', value: t.phone, type: 'tel' }, { name: 'pin', label: 'كلمة المرور', value: t.pin, required: true }],
    v => { Object.assign(t, { name: v.name.trim(), phone: v.phone, pin: v.pin }); }); },
  delTeacher: d => ask('حذف المعلم؟ ستبقى حلقاته بدون معلم.', () => { db.teachers = db.teachers.filter(t => t.id !== d.id); db.halaqat.forEach(h => { if (h.teacherId === d.id) h.teacherId = ''; }); save(); render(); }),

  addHalaqa: () => openForm('حلقة جديدة', [{ name: 'name', label: 'اسم الحلقة', required: true }, { name: 'teacherId', label: 'المعلم', type: 'select', options: [{ v: '', l: '— بدون —' }, ...opts(db.teachers)] }, { name: 'schedule', label: 'الموعد' }],
    v => { db.halaqat.push({ id: uid(), name: v.name.trim(), teacherId: v.teacherId, schedule: v.schedule }); }),
  editHalaqa: d => { const h = byId(db.halaqat, d.id); openForm('تعديل حلقة', [{ name: 'name', label: 'اسم الحلقة', value: h.name, required: true }, { name: 'teacherId', label: 'المعلم', type: 'select', value: h.teacherId, options: [{ v: '', l: '— بدون —' }, ...opts(db.teachers)] }, { name: 'schedule', label: 'الموعد', value: h.schedule }],
    v => { Object.assign(h, { name: v.name.trim(), teacherId: v.teacherId, schedule: v.schedule }); }); },
  delHalaqa: d => ask('حذف الحلقة؟ سيبقى طلابها بدون حلقة.', () => { db.halaqat = db.halaqat.filter(h => h.id !== d.id); db.students.forEach(s => { if (s.halaqaId === d.id) s.halaqaId = ''; }); save(); render(); }),

  addStudent: () => openForm('طالب جديد', [{ name: 'name', label: 'الاسم', required: true }, { name: 'halaqaId', label: 'الحلقة', type: 'select', value: ui.fh, options: [{ v: '', l: '— بدون —' }, ...opts(db.halaqat)] }, { name: 'phone', label: 'جوال ولي الأمر', type: 'tel' }, { name: 'pin', label: 'كلمة المرور', value: genPass(), required: true }],
    v => { db.students.push({ id: uid(), name: v.name.trim(), halaqaId: v.halaqaId, phone: v.phone, pin: v.pin }); }),
  editStudent: d => { const s = byId(db.students, d.id); openForm('تعديل طالب', [{ name: 'name', label: 'الاسم', value: s.name, required: true }, { name: 'halaqaId', label: 'الحلقة', type: 'select', value: s.halaqaId, options: [{ v: '', l: '— بدون —' }, ...opts(db.halaqat)] }, { name: 'phone', label: 'جوال ولي الأمر', value: s.phone, type: 'tel' }, { name: 'pin', label: 'كلمة المرور', value: s.pin, required: true }],
    v => { Object.assign(s, { name: v.name.trim(), halaqaId: v.halaqaId, phone: v.phone, pin: v.pin }); }); },
  delStudent: d => ask('حذف الطالب وكل سجلاته؟', () => { db.students = db.students.filter(s => s.id !== d.id); db.records = db.records.filter(r => r.studentId !== d.id); db.attendance = db.attendance.filter(a => a.studentId !== d.id); save(); render(); }),

  addNews: () => openForm('إعلان جديد', [{ name: 'text', label: 'النص', type: 'textarea' }, { name: 'audience', label: 'الجمهور', type: 'select', options: [{ v: 'all', l: 'الجميع' }, { v: 'teacher', l: 'المعلمون' }, { v: 'student', l: 'الطلاب' }] }],
    v => { if (!v.text.trim()) return 'اكتب نص الإعلان'; db.news.push({ id: uid(), text: v.text.trim(), audience: v.audience, date: today() }); }),
  delNews: d => { db.news = db.news.filter(n => n.id !== d.id); save(); render(); },

  editSettings: () => openForm('الإعدادات', [{ name: 'org', label: 'اسم المؤسسة', value: db.settings.org, required: true }, { name: 'adminPin', label: 'الرمز السري للإدارة', value: db.settings.adminPin, required: true }],
    v => { db.settings.org = v.org.trim(); db.settings.adminPin = v.adminPin; }),
  export: () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' }));
    a.download = `halaqat-backup-${today()}.json`; a.click(); URL.revokeObjectURL(a.href);
  },
  reset: () => ask('سيتم مسح كل البيانات نهائيًا. متابعة؟', () => { db = seed(); save(); render(); toast('تمت إعادة التهيئة'); }),

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
  if (pk) { const u = byId(loginUsers(), pk.dataset.pick); if (u) pickUser(u); return; }
  if (e.target.id === 'ufilter') showResults();
  if (!e.target.closest('#ufilter, #uresults')) showResults(false);
  const el = e.target.closest('[data-act]');
  if (el && A[el.dataset.act]) A[el.dataset.act](el.dataset);
});
document.addEventListener('change', e => {
  const el = e.target, c = el.dataset.change;
  if (!c) return;
  if (c === 'hid') { ui.hid = el.value; render(); }
  else if (c === 'fh') { ui.fh = el.value; render(); }
  else if (c === 'date') { ui.date = el.value || today(); render(); }
  else if (c === 'import') {
    const f = el.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const d = JSON.parse(rd.result);
        if (!['teachers', 'halaqat', 'students', 'attendance', 'records', 'news'].every(k => Array.isArray(d[k])) || !d.settings) throw new Error('bad');
        ask('سيتم استبدال البيانات الحالية. متابعة؟', () => { db = d; save(); render(); toast('تم الاستيراد'); });
      } catch (err) { toast('ملف غير صالح'); }
    };
    rd.readAsText(f);
  }
});
A.doLogin = () => {
  const v = {};
  document.querySelectorAll('#login [name]').forEach(x => { v[x.name] = x.value; });
  const r = ui.loginRole;
  if (!r) return;
  if ((r === 'teacher' || r === 'student') && !v.uid) {
    const m = loginMatches();
    if (m.length === 1) v.uid = m[0].id; else { toast('اختر اسمك من القائمة'); return; }
  }
  let ok = false;
  if (r === 'admin') ok = v.pin === db.settings.adminPin;
  else { const u = byId(r === 'teacher' ? db.teachers : db.students, v.uid); ok = !!u && u.pin === v.pin; }
  if (!ok) { toast('بيانات الدخول غير صحيحة'); return; }
  session = { role: r, id: r === 'admin' ? 'admin' : v.uid };
  ss.set(SKEY, JSON.stringify(session));
  ui.tab = null; ui.hid = ''; render();
};
document.addEventListener('input', e => {
  if (e.target.id !== 'ufilter') return;
  document.getElementById('uid').value = '';
  e.target.classList.remove('picked');
  showResults();
});
document.addEventListener('focusin', e => { if (e.target.id === 'ufilter') showResults(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { showResults(false); return; }
  if (e.key !== 'Enter' || e.target.tagName !== 'INPUT') return;
  if (e.target.id === 'ufilter') {
    const m = loginMatches();
    if (document.getElementById('uid').value) document.querySelector('#login input[name=pin]')?.focus();
    else if (m.length === 1) pickUser(m[0]);
  }
  else if (e.target.closest('#login')) A.doLogin();
  else e.target.closest('.modal')?.querySelector('[data-save]')?.click();
});

render();
const splash = document.getElementById('splash');
if (splash) {
  if (session) splash.remove();
  else setTimeout(() => { splash.classList.add('hide'); setTimeout(() => splash.remove(), 700); }, 3000);
}
})();
