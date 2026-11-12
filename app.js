(() => {
'use strict';
const ss={get:k=>{try{return sessionStorage.getItem(k)}catch(e){return null}},set:(k,v)=>{try{sessionStorage.setItem(k,v)}catch(e){}},del:k=>{try{sessionStorage.removeItem(k)}catch(e){}}};

/* ============ ثوابت ============ */
const SURAHS = [["الفاتحة",7],["البقرة",286],["آل عمران",200],["النساء",176],["المائدة",120],["الأنعام",165],["الأعراف",206],["الأنفال",75],["التوبة",129],["يونس",109],["هود",123],["يوسف",111],["الرعد",43],["إبراهيم",52],["الحجر",99],["النحل",128],["الإسراء",111],["الكهف",110],["مريم",98],["طه",135],["الأنبياء",112],["الحج",78],["المؤمنون",118],["النور",64],["الفرقان",77],["الشعراء",227],["النمل",93],["القصص",88],["العنكبوت",69],["الروم",60],["لقمان",34],["السجدة",30],["الأحزاب",73],["سبأ",54],["فاطر",45],["يس",83],["الصافات",182],["ص",88],["الزمر",75],["غافر",85],["فصلت",54],["الشورى",53],["الزخرف",89],["الدخان",59],["الجاثية",37],["الأحقاف",35],["محمد",38],["الفتح",29],["الحجرات",18],["ق",45],["الذاريات",60],["الطور",49],["النجم",62],["القمر",55],["الرحمن",78],["الواقعة",96],["الحديد",29],["المجادلة",22],["الحشر",24],["الممتحنة",13],["الصف",14],["الجمعة",11],["المنافقون",11],["التغابن",18],["الطلاق",12],["التحريم",12],["الملك",30],["القلم",52],["الحاقة",52],["المعارج",44],["نوح",28],["الجن",28],["المزمل",20],["المدثر",56],["القيامة",40],["الإنسان",31],["المرسلات",50],["النبأ",40],["النازعات",46],["عبس",42],["التكوير",29],["الانفطار",19],["المطففين",36],["الانشقاق",25],["البروج",22],["الطارق",17],["الأعلى",19],["الغاشية",26],["الفجر",30],["البلد",20],["الشمس",15],["الليل",21],["الضحى",11],["الشرح",8],["التين",8],["العلق",19],["القدر",5],["البينة",8],["الزلزلة",8],["العاديات",11],["القارعة",11],["التكاثر",8],["العصر",3],["الهمزة",9],["الفيل",5],["قريش",4],["الماعون",7],["الكوثر",3],["الكافرون",6],["النصر",3],["المسد",5],["الإخلاص",4],["الفلق",5],["الناس",6]];
const GRADES = ['ممتاز', 'جيد جدًا', 'جيد', 'مقبول', 'يعاد'];
const TYPES = ['حفظ', 'مراجعة', 'تثبيت'];
const STATUS = { present: 'حاضر', late: 'متأخر', excused: 'معتذر', absent: 'غائب' };
const PRAYERS = ['الفجر', 'الظهر', 'العصر', 'المغرب', 'العشاء'];
const PLACE_TYPES = ['مسجد', 'دار تحفيظ'];
/* استمارة التقديم: خيارات الصغار والكبار */
const CATS = { child: 'صغير', adult: 'كبير' };
const STUDY = ['عام', 'أزهر'], RELS = ['الأب', 'الأم', 'شخص آخر'], MARITAL = ['أعزب', 'متزوج'], QSTAT = ['طالب', 'خريج'];
const LOGO = 'logo.png';
const KEY = 'halaqat_v1';
const SKEY = 'halaqat_session';
const TABS = {
  admin: [['dash', 'الرئيسية'], ['members', 'الأعضاء'], ['pending', 'بيانات معلّقة'], ['teachers', 'المعلمون'], ['halaqat', 'الأماكن والحلقات'], ['absence', 'غياب المعلمين'], ['students', 'الطلاب'], ['news', 'الإعلانات'], ['payroll', 'المرتبات'], ['settings', 'الإعدادات']],
  teacher: [['att', 'الحضور'], ['mine', 'طلابي'], ['profile', 'ملفي'], ['news', 'الإعلانات']],
  supervisor: [['att', 'الحضور'], ['mine', 'الطلاب'], ['absence', 'غياب المعلمين'], ['news', 'الإعلانات']],
  student: [['me', 'تقدمي'], ['hist', 'السجل'], ['news', 'الإعلانات']]
};
/* أنواع الحسابات: كل نوع ومجموعته في قاعدة البيانات */
const ROLES = ['teacher', 'student', 'supervisor', 'admin'];
const ROLE_L = { student: 'طالب', teacher: 'معلم', supervisor: 'مشرف', admin: 'إداري' };
const COLL = { student: 'students', teacher: 'teachers', supervisor: 'supervisors', admin: 'admins' };
const KIND_ONE = { students: 'طالب', teachers: 'معلم', supervisors: 'مشرف', admins: 'إداري' };

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
/* مرادفات إضافية لعناوين أعمدة ملف المعلم عند الاستيراد */
const PROF_SYN = { fullName: ['الاسم الرباعي'], birth: ['الميلاد', 'تاريخ الولادة'], email: ['البريد', 'الايميل', 'email'], address: ['السكن'], emergency: ['الطوارئ'], qual: ['المؤهل'], riwaya: ['رواية'], sanad: ['السند', 'الشيخ المجيز'], memorized: ['الأجزاء', 'عدد الأجزاء', 'المحفوظ'], exp: ['الخبرة'], specialty: ['التخصص'], courses: ['الدورات'], contract: ['التعاقد'], pay: ['المكافأة'] };
const FTYPES = [['text', 'نص'], ['number', 'رقم'], ['date', 'تاريخ'], ['textarea', 'نص طويل']];
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
  const t1 = uid(), h1 = uid(), s1 = uid(), p1 = uid();
  const names = ['عبد الله', 'محمد', 'يوسف'];
  return {
    settings: { org: 'إدارة الحلقات القرآنية' },
    admins: [{ id: uid(), name: 'المدير', pin: '1234' }],
    supervisors: [{ id: s1, name: 'المشرف خالد', phone: '', pin: '0000' }],
    teachers: [{ id: t1, name: 'الشيخ أحمد', phone: '', pin: '0000' }],
    places: [{ id: p1, name: 'المسجد الكبير', type: 'مسجد', address: '' }],
    halaqat: [{ id: h1, teacherId: t1, supervisorId: s1, placeId: p1, time: { mode: 'prayer', fromPrayer: 'العصر', toKind: 'prayer', toPrayer: 'المغرب' } }],
    students: names.map(n => ({ id: uid(), name: n, halaqaId: h1, phone: '', pin: '0000' })),
    attendance: [], records: [], news: [],
    fields: { students: [], teachers: [] }, pending: []
  };
}
/* ترقية البيانات القديمة: الإداري صار حسابًا باسم، وأُضيف المشرفون */
function migrate(d) {
  d.settings = d.settings || { org: 'إدارة الحلقات القرآنية' };
  if (!Array.isArray(d.admins) || !d.admins.length) d.admins = [{ id: uid(), name: 'المدير', pin: d.settings.adminPin || '1234' }];
  if (!Array.isArray(d.supervisors)) d.supervisors = [];
  /* حقول يضيفها الإداري من الاستيراد، وأعمدة مستوردة تنتظر الاعتماد */
  if (!d.fields || typeof d.fields !== 'object') d.fields = {};
  ['students', 'teachers'].forEach(k => { if (!Array.isArray(d.fields[k])) d.fields[k] = []; });
  if (!Array.isArray(d.pending)) d.pending = [];
  /* الأماكن: كانت نصًا داخل الحلقة، فصارت كيانًا مستقلًا (مسجد أو دار تحفيظ) يضم حلقات */
  if (!Array.isArray(d.places)) {
    d.places = [];
    const seen = new Map();
    (d.halaqat || []).forEach(h => {
      const n = String(h.place || '').replace(/\s+/g, ' ').trim(); if (!n) return;
      if (!seen.has(n)) { const pl = { id: uid(), name: n, type: /دار/.test(n) ? 'دار تحفيظ' : 'مسجد', address: '' }; seen.set(n, pl); d.places.push(pl); }
      h.placeId = seen.get(n).id;
    });
  }
  (d.halaqat || []).forEach(h => {
    if (h.time || !h.schedule) return;
    const m = String(h.schedule).match(/بعد\s*(?:صلاة\s*)?(الفجر|الظهر|العصر|المغرب|العشاء)/);
    if (m) h.time = { mode: 'prayer', fromPrayer: m[1], toKind: 'prayer', toPrayer: '' };
  });
  delete d.settings.adminPin;
  return d;
}
function load() {
  try {
    const r = localStorage.getItem(KEY);
    if (r) { const d = migrate(JSON.parse(r)); try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* ignore */ } return d; }
  } catch (e) { /* ignore */ }
  const d = seed();
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
  return d;
}
let db = load();
const validBackup = d => !!d && !!d.settings && ['teachers', 'halaqat', 'students', 'attendance', 'records', 'news'].every(k => Array.isArray(d[k]));
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { toast('تعذّر حفظ البيانات في المتصفح'); } };

/* ============ المظهر: الألوان والشعار ============ */
const THEME0 = { navy: '#13294b', gold: '#b8904f', leaf: '#4e7d45', bg: '#f8f5ee', text: '#1a2333', red: '#b3372f', amber: '#b7791f' };
const THEME_KEYS = [
  ['navy', 'اللون الأساسي', 'الشريط العلوي والأزرار والعناوين'],
  ['gold', 'لون التمييز', 'الإطارات والتبويب النشط والتنبيهات'],
  ['bg', 'لون الخلفية', 'خلفية الصفحات'],
  ['text', 'لون النص', 'الكتابة في كل الصفحات'],
  ['leaf', 'لون «حاضر»', 'زر الحضور عند اختياره'],
  ['amber', 'لون «متأخر / معتذر»', 'أزرار التأخر والاعتذار'],
  ['red', 'لون «غائب» والحذف', 'زر الغياب وأزرار الحذف']
];
const PRESETS = [
  ['ألوان الشعار', THEME0],
  ['أخضر كلاسيكي', { navy: '#0f6b4f', gold: '#b8892b', leaf: '#2f8a4f', bg: '#f6f7f5', text: '#1d2b25' }],
  ['عنابي', { navy: '#6b1d2f', gold: '#c09a5b', bg: '#faf6f2', text: '#2a1a1d' }],
  ['أزرق وفيروزي', { navy: '#1f4e79', gold: '#2a9d8f', leaf: '#3a8d4f', bg: '#f4f8fb', text: '#16263a' }],
  ['رمادي هادئ', { navy: '#2f3a45', gold: '#8a7a5c', bg: '#f5f5f3', text: '#1f2328' }]
];
const hex2rgb = h => { h = String(h).replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); const n = parseInt(h, 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const rgb2hex = a => '#' + a.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const x = hex2rgb(a), y = hex2rgb(b); return rgb2hex(x.map((v, i) => v + (y[i] - v) * t)); };
const lum = h => { const [r, g, b] = hex2rgb(h).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
const logoSrc = () => db.settings.logo || LOGO;
const theme = () => ({ ...THEME0, ...(db.settings.theme || {}) });
function applyTheme() {
  const T = theme(), st = document.documentElement.style, set = (k, v) => st.setProperty('--' + k, v);
  const on = lum(T.navy) > .45 ? '#14181f' : '#ffffff';
  set('navy', T.navy); set('navy-d', mix(T.navy, '#000000', .35)); set('navy-l', mix(T.navy, '#ffffff', .9));
  set('gold', T.gold); set('gold-d', mix(T.gold, '#000000', .3)); set('gold-l', mix(T.gold, '#ffffff', .82));
  set('leaf', T.leaf); set('bg', T.bg); set('text', T.text); set('red', T.red); set('amber', T.amber);
  set('line', mix(T.gold, '#ffffff', .72)); set('muted', mix(T.text, '#ffffff', .4));
  set('on-navy', on); set('tab-text', mix(on, mix(T.navy, '#000000', .35), .25));
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', T.navy);
  document.querySelectorAll('link[rel=icon]').forEach(l => l.setAttribute('href', logoSrc()));
  if (db.settings.logo) document.querySelector('#splash img')?.setAttribute('src', db.settings.logo);
}
/* استخراج لوحة ألوان من صورة الشعار: الأغمق للأساسي، والأبرز المتوسط للتمييز، والأخضر للحضور */
function hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = mx === r ? 60 * (((g - b) / d) % 6) : mx === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  return { h: (h + 360) % 360, s, l };
}
function paletteFrom(img) {
  const n = 128, c = document.createElement('canvas'); c.width = c.height = n;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0, n, n);
  const px = g.getImageData(0, 0, n, n).data, buckets = new Map();
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 200) continue;
    const k = (px[i] >> 4) << 8 | (px[i + 1] >> 4) << 4 | (px[i + 2] >> 4), b = buckets.get(k) || [0, 0, 0, 0];
    b[0] += px[i]; b[1] += px[i + 1]; b[2] += px[i + 2]; b[3]++; buckets.set(k, b);
  }
  const cols = [...buckets.values()].map(([r, g2, b, cnt]) => { r /= cnt; g2 /= cnt; b /= cnt; return { hex: rgb2hex([r, g2, b]), n: cnt, ...hsl(r, g2, b) }; }).sort((a, b) => b.n - a.n);
  const hd = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
  /* الأكثر انتشارًا مع تفضيل الألوان المشبعة على الرمادية */
  const best = (f, w = x => x.n * (.25 + x.s)) => cols.filter(f).sort((a, b) => w(b) - w(a))[0];
  const sat = x => x.n * x.s * x.s;
  const primary = best(x => x.l < .36 && x.s > .12, sat) || best(x => x.l < .42);
  const accent = best(x => x.l >= .3 && x.l <= .65 && x.s > .25 && (!primary || hd(x.h, primary.h) > 30), sat);
  const leaf = best(x => x.h >= 75 && x.h <= 165 && x.s > .14 && x.l > .18 && x.l < .7, sat);
  /* تغميق اللون الفاتح حتى يبقى النص الأبيض فوقه مقروءًا */
  const deep = x => {
    if (x.l <= .42 && x.s >= .35) return x.hex;
    const s2 = Math.max(x.s, .4), l2 = Math.min(x.l, .38), C = (1 - Math.abs(2 * l2 - 1)) * s2, X = C * (1 - Math.abs((x.h / 60) % 2 - 1)), m = l2 - C / 2;
    const [r, g, b] = x.h < 60 ? [C, X, 0] : x.h < 120 ? [X, C, 0] : x.h < 180 ? [0, C, X] : x.h < 240 ? [0, X, C] : x.h < 300 ? [X, 0, C] : [C, 0, X];
    return rgb2hex([r, g, b].map(v => (v + m) * 255));
  };
  const out = {};
  if (primary) out.navy = primary.hex;
  if (accent) { out.gold = accent.hex; out.bg = mix(accent.hex, '#ffffff', .93); }
  if (leaf) out.leaf = deep(leaf);
  if (primary) out.text = mix(primary.hex, '#000000', .3);
  return out;
}

let session = null;
try { session = JSON.parse(ss.get(SKEY) || 'null'); } catch (e) { /* ignore */ }
/* تفضيلات الواجهة لهذا الجهاز: اتساع الشريط الجانبي وطيّه */
const UIKEY = 'halaqat_ui', SIDE_W = 250, SIDE_MIN = 180, SIDE_MAX = 420;
let uiPref = {};
try { uiPref = JSON.parse(localStorage.getItem(UIKEY) || '{}') || {}; } catch (e) { /* ignore */ }
const saveUI = () => { try { localStorage.setItem(UIKEY, JSON.stringify({ sideW: ui.sideW, collapsed: ui.collapsed })); } catch (e) { /* ignore */ } };
const clampW = w => Math.max(SIDE_MIN, Math.min(SIDE_MAX, Math.round(w) || SIDE_W));
const ui = { fcat: '', nav: false, sideW: clampW(uiPref.sideW), collapsed: !!uiPref.collapsed, pick: null, tab: null, hid: '', date: today(), fh: '', psub: 'personal', msub: 'teachers', shown: {} };

/* ============ دوال مساعدة للمجال ============ */
/* الحلقة تُسمّى باسم معلمها؛ وإن كان للمعلم أكثر من حلقة يُضاف اسم المكان للتمييز */
const placeOf = h => h && byId(db.places || [], h.placeId);
const placeName = h => placeOf(h)?.name || h?.place || '';
function halaqaLabel(h) {
  if (!h) return '—';
  const t = byId(db.teachers, h.teacherId);
  if (!t) return h.name || 'حلقة بلا معلم';
  const sib = db.halaqat.filter(x => x.teacherId === h.teacherId);
  if (sib.length < 2) return 'حلقة ' + t.name;
  /* للمعلم أكثر من حلقة: نميّزها بالمكان، ثم بالوقت إن تكررت في المكان نفسه */
  const samePlace = sib.filter(x => x.placeId === h.placeId).length > 1;
  const tag = [placeName(h), samePlace ? (timeText(h) || '#' + (sib.indexOf(h) + 1)) : ''].filter(Boolean).join(' · ');
  return 'حلقة ' + t.name + (tag ? ' — ' + tag : '');
}
const hName = id => halaqaLabel(byId(db.halaqat, id));
const halaqaOpts = () => db.halaqat.map(h => ({ v: h.id, l: halaqaLabel(h) + (placeName(h) ? ' (' + placeName(h) + ')' : '') }));
const fmtTime = t => { if (!t) return ''; const [H, M] = String(t).split(':').map(Number); return `${((H + 11) % 12) + 1}:${String(M || 0).padStart(2, '0')} ${H >= 12 ? 'م' : 'ص'}`; };
/* رقم الهاتف: أرقام فقط، وإعادة الصفر الأول الذي يسقطه Excel من أرقام مصر */
const normPhone = v => { let d = String(v || '').replace(/[٠-٩]/g, c => c.charCodeAt(0) - 1632).replace(/[۰-۹]/g, c => c.charCodeAt(0) - 1776).replace(/\D/g, ''); if (/^1\d{9}$/.test(d)) d = '0' + d; return d; };
function ageOf(st) {
  const I = st?.info || {};
  if (st?.cat === 'adult') return I.birthYear ? new Date().getFullYear() - I.birthYear : '';
  if (!I.birth) return '';
  const b = new Date(I.birth), n = new Date();
  if (isNaN(b)) return '';
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a >= 0 ? a : '';
}
const avatar = (st, size = 34) => st?.photo ? `<img class="av" src="${st.photo}" alt="" style="width:${size}px;height:${size}px">` : `<span class="av av0" style="width:${size}px;height:${size}px">${esc((st?.name || '؟').trim().charAt(0))}</span>`;
function timeText(h) {
  const w = h?.time;
  if (!w) return h?.schedule || '';
  if (w.mode === 'clock') return w.from && w.to ? `من ${fmtTime(w.from)} إلى ${fmtTime(w.to)}` : '';
  const to = w.toKind === 'clock' ? (w.toTime ? ` إلى الساعة ${fmtTime(w.toTime)}` : '') : (w.toPrayer ? ` إلى صلاة ${w.toPrayer}` : '');
  return `من بعد صلاة ${w.fromPrayer}${to}`;
}
const tName = id => byId(db.teachers, id)?.name || '—';
const sName = id => byId(db.students, id)?.name || '—';
const supName = id => byId(db.supervisors, id)?.name || '—';
const myHalaqat = () => db.halaqat.filter(h => (session.role === 'supervisor' ? h.supervisorId : h.teacherId) === session.id);
const accounts = () => ROLES.flatMap(r => db[COLL[r]].map(u => ({ role: r, u })));
const me = () => session && byId(db[COLL[session.role]] || [], session.id);
/* حسابات أخرى بنفس اسم المستخدم الحالي (لتبديل الوضع) */
const sameName = () => { const m = me(); return m ? accounts().filter(a => norm(a.u.name) === norm(m.name) && !(a.role === session.role && a.u.id === m.id)) : []; };
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
const AUD = { all: 'الجميع', teacher: 'المعلمون', supervisor: 'المشرفون', student: 'الطلاب' };
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
  supervisor: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M9 12l2 2 4-4"/><path d="M9 17h6"/></svg>',
  admin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
};
/* أيقونات التبويبات في الشريط الجانبي */
const svg = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const TAB_ICONS = {
  dash: svg('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
  members: svg('<circle cx="9" cy="8" r="3.2"/><path d="M3 20v-1a6 6 0 0 1 12 0v1"/><path d="M16 4.5a3 3 0 0 1 0 6M21 20v-1a5 5 0 0 0-3.5-4.8"/>'),
  pending: svg('<path d="M4 13h4l2 3h4l2-3h4"/><path d="M5.5 5h13L21 13v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z"/>'),
  halaqat: svg('<circle cx="12" cy="12" r="2.6"/><circle cx="12" cy="4.2" r="1.7"/><circle cx="12" cy="19.8" r="1.7"/><circle cx="4.2" cy="12" r="1.7"/><circle cx="19.8" cy="12" r="1.7"/>'),
  news: svg('<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/>'),
  payroll: svg('<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><circle cx="16.5" cy="14.5" r="1.2"/><path d="M6 6l9-3 1.5 3"/>'),
  att: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M9 15l2 2 4-4"/>'),
  profile: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2.3"/><path d="M5.5 16.5a3.5 3.5 0 0 1 7 0M14 10h4M14 14h3"/>'),
  me: svg('<path d="M3 20h18"/><path d="M5 16l4-5 4 3 6-7"/><path d="M15 7h4v4"/>'),
  hist: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  absence: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M10 13.5l4 4M14 13.5l-4 4"/>'),
  menu: svg('<path d="M4 6h16M4 12h16M4 18h16"/>'),
  mosque: svg('<path d="M5 21v-8a7 7 0 0 1 14 0v8"/><path d="M12 3v3"/><path d="M2 21h20"/><path d="M10 21v-4a2 2 0 0 1 4 0v4"/>'),
  house: svg('<path d="M3 11l9-7 9 7"/><path d="M5 10v11h14V10"/><path d="M9 21v-6h6v6"/>'),
  fold: svg('<path d="M9 6l6 6-6 6"/>'),
  unfold: svg('<path d="M15 6l-6 6 6 6"/>'),
  logout: svg('<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 8l-4 4 4 4M6 12h10"/>'),
  swap: svg('<path d="M7 7h12l-3-3M17 17H5l3 3"/>')
};
const tabIcon = k => TAB_ICONS[k] || ({ teachers: ICONS.teacher, students: ICONS.student, mine: ICONS.student, settings: ICONS.gear })[k] || TAB_ICONS.dash;
function loginView() {
  const none = !accounts().length;
  return `<div class="login"><div class="logo-wrap"><img src="${logoSrc()}" alt="شعار إدارة الحلقات القرآنية"><div class="sheen" style="-webkit-mask-image:url(${logoSrc()});mask-image:url(${logoSrc()})"></div></div>
  <div class="card loginform"><div id="login">
    <div class="combo"><label>الاسم<input type="text" id="ufilter" placeholder="اكتب أول حروف اسمك" autocomplete="off"></label><div class="results" id="uresults" hidden></div></div>
    <div class="modes" id="umodes" hidden></div>
    <div class="confirm" id="uinfo" hidden></div>
    <label>كلمة المرور<input name="pin" type="password" inputmode="numeric" autocomplete="off"></label>
    <button type="button" class="btn primary" style="width:100%" data-act="doLogin">دخول</button>
    ${none ? '<p class="muted" style="margin-bottom:0">لا توجد حسابات بعد.</p>' : ''}
  </div></div>
  <p class="muted" style="font-size:.8rem;text-align:center">النسخة التجريبية: «المدير» 1234 — «الشيخ أحمد» و«المشرف خالد» والطلاب 0000 (غيّرها من لوحة الإدارة).</p></div>`;
}

/* ===== بحث الاسم في صفحة الدخول (كل الحسابات في قائمة واحدة) ===== */
const norm = t => String(t || '').replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').toLowerCase().trim();
/* تُجمع الحسابات بالاسم: الاسم الواحد قد يكون له أكثر من وضع (معلم وطالب مثلًا) */
function nameGroups() {
  const m = new Map();
  accounts().forEach(a => { const k = norm(a.u.name); if (!m.has(k)) m.set(k, { key: k, name: a.u.name, accts: [] }); m.get(k).accts.push(a); });
  m.forEach(g => g.accts.sort((x, y) => ROLES.indexOf(x.role) - ROLES.indexOf(y.role)));
  return [...m.values()];
}
function loginMatches() {
  const q = norm(document.getElementById('ufilter')?.value);
  /* لا تظهر القائمة إلا بعد كتابة حرف واحد على الأقل */
  if (!q) return [];
  /* الأسماء التي تبدأ بالحروف المكتوبة أولًا، ثم التي تبدأ بها إحدى كلماتها، ثم الباقي */
  const rank = k => k.startsWith(q) ? 0 : k.split(' ').some(w => w.startsWith(q)) ? 1 : 2;
  return nameGroups().filter(g => g.key.includes(q)).sort((x, y) => rank(x.key) - rank(y.key));
}
function showResults(open = true) {
  const box = document.getElementById('uresults');
  if (!box) return;
  if (!open || !norm(document.getElementById('ufilter')?.value)) { box.hidden = true; return; }
  const list = loginMatches();
  box.innerHTML = list.length
    ? list.map(g => `<button type="button" class="opt" data-pick="${esc(g.key)}">${esc(g.name)}</button>`).join('')
    : '<div class="muted" style="padding:.6rem .8rem">لا توجد نتائج مطابقة</div>';
  box.hidden = false;
}
/* المربعات الخاصة بكل وضع (للقراءة فقط، للتأكد من الهوية) */
function acctInfo(a) {
  const box = (l, v) => `<div class="info"><small>${l}</small><b>${esc(v)}</b></div>`;
  if (a.role === 'student') { const h = byId(db.halaqat, a.u.halaqaId); return box('الحلقة', h ? halaqaLabel(h) : 'غير محدد') + box('المكان', placeName(h) || 'غير محدد'); }
  if (a.role === 'teacher' || a.role === 'supervisor') {
    const hs = db.halaqat.filter(h => (a.role === 'teacher' ? h.teacherId : h.supervisorId) === a.u.id);
    return box(a.role === 'teacher' ? 'حلقاته' : 'الحلقات المسندة', hs.map(halaqaLabel).join('، ') || 'لا توجد بعد') + box('عدد الطلاب', db.students.filter(s => hs.some(h => h.id === s.halaqaId)).length);
  }
  return box('الصلاحيات', 'إدارة كاملة') + box('المؤسسة', db.settings.org);
}
function modeLabel(a, list) {
  if (list.filter(x => x.role === a.role).length < 2) return ROLE_L[a.role];
  const extra = a.role === 'student' ? hName(a.u.halaqaId) : a.role === 'admin' ? '' : db.halaqat.filter(h => (a.role === 'teacher' ? h.teacherId : h.supervisorId) === a.u.id).map(halaqaLabel).join('، ');
  return ROLE_L[a.role] + (extra && extra !== '—' ? ' – ' + extra : '');
}
function renderPick() {
  const p = ui.pick, modes = document.getElementById('umodes'), info = document.getElementById('uinfo');
  if (!modes || !info) return;
  if (!p) { modes.hidden = info.hidden = true; return; }
  const cur = p.accts[p.sel];
  modes.innerHTML = p.accts.map((a, i) => `<button type="button" class="mode ${i === p.sel ? 'on' : ''}" ${p.accts.length > 1 ? `data-act="lmode" data-i="${i}"` : 'tabindex="-1"'} aria-pressed="${i === p.sel}">${ICONS[a.role]}<span>${esc(modeLabel(a, p.accts))}</span></button>`).join('');
  info.innerHTML = acctInfo(cur);
  modes.hidden = info.hidden = false;
}
function pickUser(g) {
  const f = document.getElementById('ufilter');
  f.value = g.name; f.classList.add('picked');
  ui.pick = { accts: g.accts, sel: 0 };
  showResults(false);
  renderPick();
  document.querySelector('#login input[name=pin]')?.focus();
}

/* ============ الهيكل العام ============ */
function render() {
  if (session) {
    if (!me()) { session = null; ss.del(SKEY); }
  }
  if (!session) { $app.innerHTML = loginView(); return; }
  const role = session.role, tabs = TABS[role];
  if (!tabs.some(t => t[0] === ui.tab)) ui.tab = tabs[0][0];
  const who = ROLE_L[role] + ': ' + me().name;
  const sw = sameName().length ? `<button class="btn" data-act="switchMode" title="تبديل الوضع">${TAB_ICONS.swap}<span class="lbl">تبديل الوضع</span></button>` : '';
  const title = tabs.find(t => t[0] === ui.tab)[1];
  $app.innerHTML = `<div class="shell ${ui.nav ? 'open' : ''} ${ui.collapsed ? 'collapsed' : ''}" style="--side-w:${ui.sideW}px">
  <aside class="side">
    <div class="side-resize" role="separator" aria-orientation="vertical" aria-label="تغيير اتساع القائمة" title="اسحب لتغيير الاتساع — نقر مزدوج للاتساع الافتراضي" tabindex="0" aria-valuemin="${SIDE_MIN}" aria-valuemax="${SIDE_MAX}" aria-valuenow="${ui.sideW}"></div>
    <div class="brand"><img class="hlogo" src="${logoSrc()}" alt=""><div><h1>${esc(db.settings.org)}</h1><small>${esc(who)}</small></div></div>
    <nav class="tabs">${tabs.map(([k, l]) => `<button class="${k === ui.tab ? 'on' : ''}" data-act="tab" data-v="${k}" title="${l}"><span class="ti">${tabIcon(k)}</span><span class="tl">${l}</span>${k === 'pending' && db.pending.length ? `<span class="count">${db.pending.length}</span>` : ''}</button>`).join('')}</nav>
    <div class="side-foot">${sw}<button class="btn" data-act="logout" title="خروج">${TAB_ICONS.logout}<span class="lbl">خروج</span></button><button class="btn side-toggle" data-act="sideToggle" title="${ui.collapsed ? 'فرد القائمة' : 'طي القائمة'}" aria-label="${ui.collapsed ? 'فرد القائمة' : 'طي القائمة'}" aria-expanded="${!ui.collapsed}">${TAB_ICONS.fold}</button></div>
  </aside>
  <div class="scrim" data-act="navClose"></div>
  <div class="content">
    <header class="top"><button type="button" class="iconbtn menu" data-act="navToggle" aria-label="القائمة">${TAB_ICONS.menu}</button><h2 class="ttl">${esc(title)}</h2></header>
    <main>${VIEWS[role][ui.tab]()}</main>
  </div></div>`;
}

/* ============ مكونات مشتركة ============ */
function newsView(aud) {
  const list = newsFor(aud);
  return `<div class="card"><h2>الإعلانات</h2>${list.length ? list.map(n => `<div class="news">${esc(n.text)}<br><small>${esc(n.date)}</small></div>`).join('') : empty('لا توجد إعلانات.')}</div>`;
}
function halaqaPicker(list) {
  if (!list.some(h => h.id === ui.hid)) ui.hid = list[0]?.id || '';
  return `<select data-change="hid">${list.map(h => `<option value="${esc(h.id)}" ${h.id === ui.hid ? 'selected' : ''}>${esc(halaqaLabel(h))}</option>`).join('')}</select>`;
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
    const stats = [[db.teachers.length, 'معلم'], [db.supervisors.length, 'مشرف'], [db.places.length, 'مكان'], [db.halaqat.length, 'حلقة'], [db.students.length, 'طالب'], [att.length ? Math.round(ok * 100 / att.length) + '%' : '—', 'حضور اليوم'], [db.records.filter(r => r.date >= wk).length, 'تسجيلات الأسبوع']];
    return `<div class="grid">${stats.map(([n, l]) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`).join('')}</div>${newsView('admin')}`;
  },
  members() {
    const subs = [['teachers', 'المعلمون'], ['students', 'الطلاب'], ['supervisors', 'المشرفون'], ['admins', 'الإداريون']];
    const kind = subs.some(x => x[0] === ui.msub) ? ui.msub : 'teachers';
    const one = KIND_ONE[kind];
    const others = m => accounts().filter(a => norm(a.u.name) === norm(m.name) && a.u.id !== m.id).map(a => ROLE_L[a.role]);
    const rows = db[kind].map((m, i) => { const o = others(m); return `<tr><td>${i + 1}</td><td>${esc(m.name)}${o.length ? ` <span class="tag" title="نفس الاسم له حساب آخر">+ ${esc(o.join('، '))}</span>` : ''}</td>
      <td><code class="pw">${ui.shown[m.id] ? esc(m.pin) : '••••••'}</code> <button class="btn sm" data-act="togglePw" data-id="${m.id}">${ui.shown[m.id] ? 'إخفاء' : 'إظهار'}</button></td>
      <td><button class="btn sm" data-act="copyPw" data-id="${m.id}" data-k="${kind}">نسخ</button><button class="btn sm" data-act="newPw" data-id="${m.id}" data-k="${kind}">كلمة جديدة</button><button class="btn sm" data-act="editName" data-id="${m.id}" data-k="${kind}">الاسم</button><button class="btn sm danger" data-act="delMember" data-id="${m.id}" data-k="${kind}">حذف</button></td></tr>`; }).join('');
    const tip = kind === 'supervisors' ? 'حدّد حلقات كل مشرف من تبويب «الحلقات» ← تعديل ← المشرف.' : 'عند إضافة عضو تُنشأ كلمة المرور تلقائيًا (6 أرقام). سلّمها للعضو ليدخل باسمه وكلمة مروره من صفحة الدخول.';
    return `<div class="card"><div class="bar">${subs.map(([k, l]) => `<button class="btn ${k === kind ? 'on' : ''}" data-act="msub" data-v="${k}">${l} (${db[k].length})</button>`).join('')}<span class="grow"></span>${kind === 'teachers' || kind === 'students' ? `<button class="btn" data-act="importMembers" data-k="${kind}">استيراد من Excel / Sheets</button>` : ''}<button class="btn primary" data-act="addMember" data-k="${kind}">+ ${one}</button></div>
    <div class="note">${tip} إذا تكرر الاسم نفسه في أكثر من نوع، يظهر لصاحبه خيار تبديل الوضع عند الدخول.</div>
    ${db[kind].length ? `<div class="tbl"><table><tr><th>#</th><th>الاسم</th><th>كلمة المرور</th><th></th></tr>${rows}</table></div>` : empty('لا يوجد أعضاء بعد.')}</div>`;
  },
  pending() {
    const kindL = { students: 'الطلاب', teachers: 'المعلمون' };
    const cards = db.pending.map(p => {
      const dest = ['<option value="new">إنشاء حقل جديد بهذا الاسم</option>', ...fieldTargets(p.kind).filter(t => t.id !== 'core:halaqa' && t.id !== 'core:pin').map(t => `<option value="${esc(t.id)}">ربط بالحقل الموجود: ${esc(t.label)}</option>`)].join('');
      const vals = p.values.map((x, i) => { const m = byId(db[p.kind], x.mid); return m ? `<tr><td>${esc(m.name)}</td><td><input data-pv="${i}" value="${esc(x.v)}"></td></tr>` : ''; }).join('');
      return `<div class="card" data-pcard="${esc(p.id)}"><div class="bar"><h2 class="grow" style="margin:0">العمود «${esc(p.header)}»</h2><span class="tag">${kindL[p.kind] || ''} — ${esc(p.date)}</span></div>
      <div class="pform"><label>اسم الحقل<input data-pl value="${esc(p.header)}"></label>
      <label>النوع<select data-pt>${FTYPES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
      <label>الوجهة<select data-pd>${dest}</select></label></div>
      ${vals ? `<div class="tbl pvals"><table><tr><th>العضو</th><th>القيمة (يمكن تعديلها)</th></tr>${vals}</table></div>` : empty('لم يعد أصحاب هذه القيم موجودين.')}
      <div class="row"><button class="btn primary" data-act="approvePending" data-id="${esc(p.id)}">اعتماد</button><button class="btn danger" data-act="dropPending" data-id="${esc(p.id)}">حذف</button></div></div>`;
    }).join('');
    const fl = ['teachers', 'students'].flatMap(k => db.fields[k].map(f => `<tr><td>${esc(f.label)}</td><td>${kindL[k]}</td><td>${esc((FTYPES.find(t => t[0] === f.type) || FTYPES[0])[1])}</td><td><button class="btn sm danger" data-act="delField" data-k="${k}" data-id="${esc(f.key)}">حذف</button></td></tr>`)).join('');
    return `<div class="note">عند استيراد ملف، الأعمدة التي لها نظير في النظام تُستورد مباشرة في مكانها، والأعمدة التي ليس لها نظير تُحفظ هنا. راجع كل عمود: عدّل اسمه ونوعه وقيمه، ثم اعتمد إنشاء حقل جديد له، أو اربطه بحقل موجود.</div>
    ${cards || `<div class="card">${empty('لا توجد بيانات معلّقة.')}</div>`}
    <div class="card"><h2>الحقول المضافة</h2>${fl ? `<div class="tbl"><table><tr><th>الحقل</th><th>لـ</th><th>النوع</th><th></th></tr>${fl}</table></div>` : empty('لم تُضف حقول بعد. تظهر هنا الحقول التي تعتمدها من البيانات المعلّقة.')}</div>`;
  },
  teachers() {
    return `<div class="card"><div class="bar"><h2 class="grow" style="margin:0">المعلمون</h2><button class="btn primary" data-act="addTeacher">+ معلم</button></div>
    ${db.teachers.length ? `<div class="tbl"><table><tr><th>الاسم</th><th>الجوال</th><th>الحلقات</th><th></th></tr>${db.teachers.map(t => `<tr><td>${esc(t.name)}</td><td>${esc(t.phone)}</td><td>${db.halaqat.filter(h => h.teacherId === t.id).length}</td><td><button class="btn sm" data-act="editTeacher" data-id="${t.id}">تعديل</button><button class="btn sm" data-act="editProf" data-id="${t.id}" data-g="personal">شخصية</button><button class="btn sm" data-act="editProf" data-id="${t.id}" data-g="admin">إدارية</button><button class="btn sm" data-act="editProf" data-id="${t.id}" data-g="tech">فنية</button>${db.fields.teachers.length ? `<button class="btn sm" data-act="editExtra" data-k="teachers" data-id="${t.id}">إضافية</button>` : ''}<button class="btn sm danger" data-act="delTeacher" data-id="${t.id}">حذف</button></td></tr>`).join('')}</table></div>` : empty('لا يوجد معلمون.')}</div>`;
  },
  halaqat() {
    const studentsIn = list => db.students.filter(st => list.some(h => h.id === st.halaqaId)).length;
    const table = list => `<div class="tbl"><table><tr><th>الحلقة</th><th>المشرف</th><th>الوقت</th><th>الطلاب</th><th></th></tr>${list.map(h => `<tr><td><b>${esc(halaqaLabel(h))}</b>${h.teacherId ? '' : ' <span class="tag">بلا معلم</span>'}</td><td>${esc(supName(h.supervisorId))}</td><td>${esc(timeText(h) || '—')}</td><td>${db.students.filter(st => st.halaqaId === h.id).length}</td><td><button class="btn sm" data-act="editHalaqa" data-id="${h.id}">تعديل</button><button class="btn sm danger" data-act="delHalaqa" data-id="${h.id}">حذف</button></td></tr>`).join('')}</table></div>`;
    const card = (pl, list) => `<div class="card place"><div class="bar"><span class="pico">${pl ? (pl.type === 'دار تحفيظ' ? TAB_ICONS.house : TAB_ICONS.mosque) : TAB_ICONS.halaqat}</span><h2 class="grow" style="margin:0">${esc(pl ? pl.name : 'حلقات لم يُحدَّد مكانها')} ${pl ? `<span class="tag">${esc(pl.type)}</span>` : ''}</h2><span class="muted">${list.length} حلقة · ${studentsIn(list)} طالب</span>
      ${pl ? `<button class="btn sm primary" data-act="addHalaqa" data-p="${pl.id}">+ حلقة هنا</button><button class="btn sm" data-act="editPlace" data-id="${pl.id}">تعديل المكان</button><button class="btn sm danger" data-act="delPlace" data-id="${pl.id}">حذف</button>` : ''}</div>
      ${pl?.address ? `<p class="muted" style="margin:-.3rem 0 .7rem">${esc(pl.address)}</p>` : ''}
      ${list.length ? table(list) : empty('لا توجد حلقات في هذا المكان بعد.')}</div>`;
    const orphans = db.halaqat.filter(h => !placeOf(h));
    return `<div class="card"><div class="bar" style="margin:0"><h2 class="grow" style="margin:0">الأماكن والحلقات</h2><span class="muted">${db.places.length} مكان · ${db.halaqat.length} حلقة</span><button class="btn" data-act="addPlace">+ مكان</button><button class="btn primary" data-act="addHalaqa">+ حلقة</button></div>
      <p class="muted" style="margin:.6rem 0 0;font-size:.88rem">كل مكان (مسجد أو دار تحفيظ) يضم حلقة أو أكثر، والحلقة تُسمّى باسم معلمها تلقائيًا.</p></div>
      ${db.places.map(pl => card(pl, db.halaqat.filter(h => h.placeId === pl.id))).join('')}
      ${orphans.length ? card(null, orphans) : ''}
      ${!db.places.length && !orphans.length ? `<div class="card">${empty('ابدأ بإضافة مكان، ثم أضف حلقاته.')}</div>` : ''}`;
  },
  students() {
    const list = db.students.filter(st => (!ui.fh || st.halaqaId === ui.fh) && (!ui.fcat || (st.cat || 'child') === ui.fcat));
    return `<div class="card"><div class="bar"><h2 class="grow" style="margin:0">الطلاب <span class="muted" style="font-size:.9rem">(${list.length})</span></h2>
    <select data-change="fcat"><option value="">الصغار والكبار</option>${Object.entries(CATS).map(([k, l]) => `<option value="${k}" ${ui.fcat === k ? 'selected' : ''}>${k === 'child' ? 'الصغار' : 'الكبار'}</option>`).join('')}</select>
    <select data-change="fh"><option value="">كل الحلقات</option>${db.halaqat.map(h => `<option value="${esc(h.id)}" ${h.id === ui.fh ? 'selected' : ''}>${esc(halaqaLabel(h))}</option>`).join('')}</select>
    <button class="btn primary" data-act="addStudent">+ استمارة طالب</button></div>
    ${list.length ? `<div class="tbl"><table><tr><th>الاسم</th><th>الفئة</th><th>السن</th><th>الحلقة</th><th>آخر حفظ</th><th>الحضور</th><th></th></tr>${list.map(st => `<tr><td><span class="who">${avatar(st)}<span>${esc(st.name)}</span></span></td><td><span class="tag ${st.cat === 'adult' ? 'tag-a' : ''}">${CATS[st.cat || 'child']}</span></td><td>${ageOf(st) === '' ? '—' : ageOf(st)}</td><td>${esc(hName(st.halaqaId))}</td><td>${esc(lastHifz(st.id))}</td><td>${attRate(st.id)}</td><td><button class="btn sm primary" data-act="studentCard" data-id="${st.id}">الملف</button><button class="btn sm" data-act="hist" data-id="${st.id}">السجل</button><button class="btn sm" data-act="editStudent" data-id="${st.id}">تعديل</button>${db.fields.students.length ? `<button class="btn sm" data-act="editExtra" data-k="students" data-id="${st.id}">إضافية</button>` : ''}<button class="btn sm danger" data-act="delStudent" data-id="${st.id}">حذف</button></td></tr>`).join('')}</table></div>` : empty('لا يوجد طلاب.')}</div>`;
  },
  news() {
    return `<div class="card"><div class="bar"><h2 class="grow" style="margin:0">الإعلانات</h2><button class="btn primary" data-act="addNews">+ إعلان</button></div>
    ${db.news.length ? db.news.slice().reverse().map(n => `<div class="news">${esc(n.text)}<br><small>${esc(n.date)} — ${AUD[n.audience] || '—'}</small> <button class="btn sm danger" data-act="delNews" data-id="${n.id}">حذف</button></div>`).join('') : empty('لا توجد إعلانات.')}</div>`;
  },
  payroll: () => window.Payroll ? window.Payroll.view() : `<div class="card">${empty('ملف المرتبات payroll.js غير محمّل.')}</div>`,
  settings() {
    const T = theme();
    const sw = THEME_KEYS.map(([k, l, h]) => `<label class="sw"><input type="color" data-color="${k}" value="${T[k]}"><span><b>${l}</b><small>${h}</small></span></label>`).join('');
    const pre = PRESETS.map(([n, c], i) => { const P = { ...THEME0, ...c }; return `<button class="btn preset" data-act="themePreset" data-i="${i}"><i>${[P.navy, P.gold, P.bg].map(x => `<span style="background:${x}"></span>`).join('')}</i>${esc(n)}</button>`; }).join('');
    return `<div class="card"><h2>المظهر</h2>
    <div class="appear">
      <div class="logo-edit"><img class="logo-prev" src="${logoSrc()}" alt="الشعار الحالي">
        <div class="bar"><label class="btn sm primary" style="margin:0">رفع شعار جديد<input type="file" accept="image/*" data-change="logo" hidden></label>${db.settings.logo ? '<button class="btn sm" data-act="logoReset">الشعار الافتراضي</button>' : ''}</div>
        <button class="btn sm" style="width:100%" data-act="themeFromLogo">استخراج الألوان من الشعار</button>
        <p class="muted" style="font-size:.78rem;margin:.5rem 0 0">PNG أو SVG بخلفية شفافة يعطي أفضل نتيجة. يُصغَّر تلقائيًا ويظهر في الشاشة الافتتاحية وصفحة الدخول والشريط العلوي.</p>
      </div>
      <div><div class="swatches">${sw}</div>
        <h3 style="font-size:.95rem;margin:1rem 0 .5rem">أنماط جاهزة</h3><div class="presets">${pre}</div>
        <div class="row" style="margin-top:1rem"><button class="btn danger" data-act="themeReset">استعادة المظهر الافتراضي</button></div>
      </div>
    </div></div>
    <div class="card"><h2>الإعدادات</h2>
    <div class="note">البيانات تُحفظ في متصفح هذا الجهاز فقط (localStorage). خذ نسخة احتياطية بانتظام، ولا تعتمد على الرموز السرية لحماية بيانات حساسة.</div>
    <div class="bar"><button class="btn" data-act="editSettings">اسم المؤسسة</button>
    <button class="btn" data-act="export">تصدير نسخة احتياطية</button>
    <label class="btn" style="margin:0">استيراد نسخة<input type="file" accept="application/json" data-change="import" hidden></label>
    <button class="btn" data-act="pasteBackup">لصق نسخة</button>
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
    ${sts.length ? `<div class="tbl"><table><tr><th>الطالب</th><th>آخر حفظ</th><th>الحضور</th><th></th></tr>${sts.map(s => `<tr><td>${esc(s.name)}</td><td>${esc(lastHifz(s.id))}</td><td>${attRate(s.id)}</td><td><button class="btn sm primary" data-act="rec" data-id="${s.id}">تسجيل تسميع</button><button class="btn sm" data-act="hist" data-id="${s.id}">السجل</button><button class="btn sm" data-act="studentCard" data-id="${s.id}">الملف</button></td></tr>`).join('')}</table></div>` : empty('لا يوجد طلاب في هذه الحلقة.')}</div>`;
  },
  profile() {
    const t = byId(db.teachers, session.id);
    const XF = db.fields.teachers;
    const subs = Object.entries(PROF).map(([k, v]) => [k, v.label]).concat(XF.length ? [['extra', 'بيانات إضافية']] : []);
    const g = PROF[ui.psub] ? ui.psub : 'personal', G = PROF[g], cur = ui.psub === 'extra' && XF.length ? 'extra' : g;
    const bar = `<div class="bar">${subs.map(([k, l]) => `<button class="btn ${k === cur ? 'on' : ''}" data-act="psub" data-v="${k}">${l}</button>`).join('')}</div>`;
    if (cur === 'extra') return `<div class="card">${bar}<div class="tbl"><table>${XF.map(f => `<tr><th style="width:38%">${esc(f.label)}</th><td>${esc((t.extra || {})[f.key] || '—')}</td></tr>`).join('')}</table></div><div class="row"><button class="btn primary" data-act="editExtra" data-k="teachers" data-id="${t.id}">تعديل البيانات الإضافية</button></div></div>`;
    const rows = G.fields.map(f => `<tr><th style="width:38%">${esc(f[1])}</th><td>${esc(pv(t, g, f[0]) || '—')}</td></tr>`).join('');
    const mine = myHalaqat();
    const extra = g === 'admin' ? `<tr><th>الحلقات المسندة</th><td>${esc(mine.map(halaqaLabel).join('، ') || '—')}</td></tr><tr><th>عدد الطلاب</th><td>${db.students.filter(s => mine.some(h => h.id === s.halaqaId)).length}</td></tr>` : '';
    return `<div class="card">${bar}
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
    return `<div class="card"><h2>أهلًا ${esc(s.name)}</h2><p class="muted" style="margin:0">الحلقة: ${esc(hName(s.halaqaId))} — المكان: ${esc(placeName(byId(db.halaqat, s.halaqaId)) || '—')}${timeText(byId(db.halaqat, s.halaqaId)) ? ' — الوقت: ' + esc(timeText(byId(db.halaqat, s.halaqaId))) : ''} — المعلم: ${esc(tName(byId(db.halaqat, s.halaqaId)?.teacherId))}</p></div>
    <div class="grid">${stats.map(([n, l]) => `<div class="stat"><b style="font-size:1.2rem">${esc(n)}</b><span>${l}</span></div>`).join('')}</div>
    ${db.fields.students.some(f => (s.extra || {})[f.key]) ? `<div class="card"><h2>بياناتي</h2><div class="tbl"><table>${db.fields.students.filter(f => (s.extra || {})[f.key]).map(f => `<tr><th style="width:38%">${esc(f.label)}</th><td>${esc(s.extra[f.key])}</td></tr>`).join('')}</table></div></div>` : ''}
    <div class="card"><h2>آخر التسميعات</h2>${recsOf(s.id).slice(0, 5).map(r => `<div class="news">${esc(recLine(r))} — <b>${esc(r.grade)}</b><br><small>${esc(r.date)} ${esc(r.note)}</small></div>`).join('') || empty('لا توجد تسجيلات بعد.')}</div>`;
  },
  hist: () => `<div class="card"><h2>سجل التسميع</h2>${historyTable(session.id)}</div>`,
  news: () => newsView('student')
};
const absenceView = () => window.Payroll ? window.Payroll.absView() : `<div class="card">${empty('ملف payroll.js غير محمّل.')}</div>`;
adminViews.absence = absenceView;
const supervisorViews = { att: teacherViews.att, mine: teacherViews.mine, absence: absenceView, news: () => newsView('supervisor') };
const VIEWS = { admin: adminViews, teacher: teacherViews, supervisor: supervisorViews, student: studentViews };

/* ============ الاستيراد من Excel / CSV / Google Sheets ============ */
const HDR = {
  name: ['الاسم', 'اسم', 'اسم الطالب', 'اسم المعلم', 'name', 'full name'],
  halaqa: ['الحلقة', 'حلقة', 'حلقة المعلم', 'المعلم', 'halaqa', 'group', 'class'],
  phone: ['الجوال', 'جوال', 'رقم الجوال', 'الهاتف', 'هاتف', 'رقم الهاتف', 'phone', 'mobile', 'tel'],
  pin: ['كلمة المرور', 'الرمز', 'الرمز السري', 'pin', 'password']
};
const hkey = s => norm(s).replace(/[\s_\-:.]/g, '');

function decodeText(buf) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
  catch (e) { return new TextDecoder('windows-1256').decode(buf); }
}
function parseCSV(text) {
  text = String(text).replace(/^\uFEFF/, '');
  const first = text.split(/\r?\n/)[0] || '';
  const delim = ['\t', ';', ','].map(d => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; rows.push(row); row = []; }
    else cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

/* قارئ xlsx بلا مكتبات: ملف xlsx هو أرشيف zip من ملفات XML */
async function unzip(buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(buf), dec = new TextDecoder();
  let e = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('zip');
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true);
  const files = {};
  for (let k = 0; k < n; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
    files[dec.decode(u8.subarray(p + 46, p + 46 + nl))] = { method: dv.getUint16(p + 10, true), size: dv.getUint32(p + 20, true), off: dv.getUint32(p + 42, true) };
    p += 46 + nl + el + cl;
  }
  return async name => {
    const f = files[name]; if (!f) return null;
    const start = f.off + 30 + dv.getUint16(f.off + 26, true) + dv.getUint16(f.off + 28, true);
    const data = u8.subarray(start, start + f.size);
    if (f.method === 0) return dec.decode(data);
    const out = await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
    return dec.decode(out);
  };
}
async function parseXLSX(buf) {
  const get = await unzip(buf);
  const xml = s => new DOMParser().parseFromString(s, 'application/xml');
  const wb = await get('xl/workbook.xml');
  if (!wb) throw new Error('xlsx');
  let path = 'xl/worksheets/sheet1.xml';
  try {
    const sh = xml(wb).getElementsByTagName('sheet')[0], rid = sh.getAttribute('r:id');
    for (const r of xml(await get('xl/_rels/workbook.xml.rels')).getElementsByTagName('Relationship')) {
      if (r.getAttribute('Id') === rid) { const t = r.getAttribute('Target'); path = t.startsWith('/') ? t.slice(1) : 'xl/' + t; }
    }
  } catch (e) { /* نكتفي بالمسار الافتراضي */ }
  const shared = [], ssx = await get('xl/sharedStrings.xml');
  if (ssx) for (const si of xml(ssx).getElementsByTagName('si')) shared.push([...si.getElementsByTagName('t')].map(t => t.textContent).join(''));
  const sx = await get(path);
  if (!sx) throw new Error('xlsx');
  const colIdx = ref => [...ref.replace(/\d+/g, '')].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  const rows = [];
  for (const row of xml(sx).getElementsByTagName('row')) {
    const arr = [];
    for (const c of row.getElementsByTagName('c')) {
      const ref = c.getAttribute('r'), col = ref ? colIdx(ref) : arr.length, t = c.getAttribute('t');
      let v = '';
      if (t === 'inlineStr') v = [...c.getElementsByTagName('t')].map(x => x.textContent).join('');
      else { const ve = c.getElementsByTagName('v')[0]; v = ve ? ve.textContent : ''; if (t === 's') v = shared[+v] ?? ''; }
      arr[col] = v;
    }
    rows.push(arr);
  }
  return rows;
}
async function fetchSheet(url) {
  const m = url.match(/\/spreadsheets\/d\/([\w-]+)/);
  if (!m) throw new Error('url');
  const g = url.match(/[#&?]gid=(\d+)/);
  const r = await fetch(`https://docs.google.com/spreadsheets/d/${m[1]}/gviz/tq?tqx=out:csv${g ? '&gid=' + g[1] : ''}`);
  const t = await r.text();
  if (!r.ok || /^\s*</.test(t)) throw new Error('private');
  return parseCSV(t);
}

/* مفاتيح مطابقة اسم الحلقة في الملفات: «حلقة فلان» أو «فلان» (اسم المعلم) أو الاسم القديم */
const halaqaKeys = h => [halaqaLabel(h), h.name, byId(db.teachers, h.teacherId)?.name].filter(Boolean).map(norm);
const halaqaQKeys = v => [norm(v), norm(String(v).replace(/^\s*حلقة\s+/, ''))];

/* الحقول التي يمكن أن تكون «نظيرًا» لعمود في الملف المستورد */
function fieldTargets(kind) {
  const L = [{ id: 'core:phone', label: kind === 'students' ? 'جوال ولي الأمر' : 'الجوال', syn: HDR.phone }, { id: 'core:pin', label: 'كلمة المرور', syn: HDR.pin }];
  if (kind === 'students') L.push({ id: 'core:halaqa', label: 'الحلقة', syn: HDR.halaqa },
    { id: 'info:address', label: 'العنوان', syn: ['السكن'] }, { id: 'info:birth', label: 'تاريخ الميلاد', syn: ['الميلاد'] },
    { id: 'info:study', label: 'الدراسة', syn: ['نوع الدراسة'] }, { id: 'info:grade', label: 'الصف الدراسي', syn: ['الصف'] },
    { id: 'info:whatsapp', label: 'واتساب', syn: ['الواتساب', 'رقم الواتساب', 'whatsapp'] },
    { id: 'info:gName', label: 'اسم ولي الأمر', syn: ['ولي الأمر'] }, { id: 'info:gJob', label: 'وظيفة ولي الأمر', syn: [] },
    { id: 'info:job', label: 'الوظيفة', syn: ['الوظيفة الحالية'] }, { id: 'info:qual', label: 'المؤهل الدراسي', syn: ['المؤهل'] });
  if (kind === 'teachers') Object.entries(PROF).forEach(([g, G]) => G.fields.forEach(f => { if (f[0] !== 'phone') L.push({ id: `prof:${g}:${f[0]}`, label: f[1], syn: [f[1].replace(/\s*\(.*\)\s*/, ''), ...(PROF_SYN[f[0]] || [])] }); }));
  (db.fields[kind] || []).forEach(f => L.push({ id: 'extra:' + f.key, label: f.label, syn: [] }));
  return L;
}
function setField(m, id, v) {
  const [t, a, b] = id.split(':');
  if (t === 'core') { if (a === 'phone') m.phone = normPhone(v) || v; else if (a === 'pin') m.pin = v; }
  else if (t === 'prof') { m[a] = m[a] || {}; m[a][b] = v; }
  else if (t === 'extra') { m.extra = m.extra || {}; m.extra[a] = v; }
  else if (t === 'info') { m.info = m.info || {}; m.info[a] = /phone|whatsapp/i.test(a) ? normPhone(v) : v; }
}

/* تحويل الجدول إلى صفوف أعضاء: الأعمدة التي لها نظير تُربط بحقلها، والباقي يُجمع لتبويب «بيانات معلّقة» */
function importRows(table, kind) {
  const grid = table.map(r => Array.from(r || [], c => String(c ?? '').trim()));
  let hi = -1, nameCol = -1;
  for (let i = 0; i < Math.min(grid.length, 5) && hi < 0; i++) {
    const j = grid[i].findIndex(c => HDR.name.some(x => hkey(x) === hkey(c)));
    if (j >= 0) { hi = i; nameCol = j; }
  }
  if (hi < 0) return { err: 'لم أجد عمود «الاسم» في الصف الأول. استخدم القالب أو أضف عنوانًا للعمود.' };
  const targets = fieldTargets(kind), cols = [], loose = [];
  grid[hi].forEach((h, j) => {
    if (!h || j === nameCol) return;
    const k = hkey(h), t = targets.find(x => [x.label, ...x.syn].some(y => hkey(y) === k));
    if (t && !cols.some(c => c.id === t.id)) cols.push({ j, id: t.id, header: h, label: t.label });
    else if (!t) loose.push({ j, header: h });
  });
  const dg = s => String(s || '').replace(/[٠-٩]/g, c => c.charCodeAt(0) - 1632).replace(/[۰-۹]/g, c => c.charCodeAt(0) - 1776).trim();
  const seen = new Set(db[kind].map(m => norm(m.name))), rows = [];
  for (const r of grid.slice(hi + 1)) {
    const name = (r[nameCol] || '').replace(/\s+/g, ' ');
    if (!name) continue;
    const k = norm(name), dup = seen.has(k); seen.add(k);
    const vals = {};
    cols.forEach(c => { vals[c.id] = c.id === 'core:halaqa' ? (r[c.j] || '') : dg(r[c.j]); });
    rows.push({ name, dup, vals, halaqa: vals['core:halaqa'] || '', loose: loose.map(l => dg(r[l.j])) });
  }
  return rows.length ? { rows, cols, loose } : { err: 'لا توجد صفوف بيانات بعد صف العناوين.' };
}

function openImport(kind) {
  const isS = kind === 'students';
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal wide"><h2>استيراد ${isS ? 'الطلاب' : 'المعلمين'}</h2>
  <div class="note">الصف الأول عناوين الأعمدة: ${isS ? 'الاسم، الحلقة، الجوال، كلمة المرور' : 'الاسم، الجوال، كلمة المرور'}. الاسم وحده مطلوب، وتُنشأ كلمة المرور تلقائيًا إن تُركت فارغة، والأسماء المكررة تُتجاهل. أي عمود آخر ليس له نظير في النظام يُحفظ في «بيانات معلّقة» لاعتماده.</div>
  <div class="bar"><label class="btn" style="margin:0">اختيار ملف Excel أو CSV<input type="file" id="imf" accept=".xlsx,.csv,.tsv,.txt" hidden></label><button type="button" class="btn sm" id="imt">تحميل قالب</button></div>
  <label>أو الصق خلايا منسوخة من Excel أو Google Sheets<textarea id="imp" rows="3"></textarea></label>
  <label>أو رابط Google Sheets (مشارك لكل من لديه الرابط)<input id="imu" type="url" dir="ltr" placeholder="https://docs.google.com/spreadsheets/d/..."></label>
  <div class="bar"><button type="button" class="btn" id="imgo">معاينة</button></div>
  <div id="imprev"></div>
  <div class="row"><button type="button" class="btn primary" id="imok" disabled>استيراد</button><button type="button" class="btn" data-close>إغلاق</button></div></div>`;
  document.body.appendChild(ov);
  const $ = s => ov.querySelector(s);
  let parsed = [], cols = [], loose = [], createH = true;
  $('[data-close]').onclick = () => ov.remove();

  const msg = (t, bad) => {
    $('#imprev').innerHTML = `<div class="note"${bad ? ' style="background:#fdf1f0;border-color:#e8c4c0;color:var(--red)"' : ''}>${esc(t)}</div>`;
    $('#imok').disabled = true;
  };
  function preview() {
    const fresh = parsed.filter(r => !r.dup), dups = parsed.length - fresh.length;
    const known = new Set(db.halaqat.flatMap(halaqaKeys));
    const newH = isS ? new Set(fresh.filter(r => r.halaqa && !halaqaQKeys(r.halaqa).some(k => known.has(k))).map(r => norm(r.halaqa))) : new Set();
    const chip = t => `<span class="chip">${esc(t)}</span>`;
    $('#imprev').innerHTML = `<p style="margin:.2rem 0 .6rem"><b>${fresh.length}</b> جاهز للاستيراد${dups ? ` — ${dups} مكرر سيُتجاهل` : ''}</p>
    ${cols.length ? `<div class="note ok">أعمدة لها نظير وستُستورد في مكانها: ${cols.map(c => chip(c.header === c.label ? c.label : `${c.header} ← ${c.label}`)).join(' ')}</div>` : ''}
    ${loose.length ? `<div class="note">أعمدة ليس لها نظير (${loose.length}): ${loose.map(l => chip(l.header)).join(' ')}<br>ستُحفظ قيمها في تبويب «بيانات معلّقة» لتراجعها وتعدّلها، ثم تعتمد إنشاء حقل لكل منها.</div>` : ''}
    ${newH.size ? `<label style="display:flex;gap:.5rem;align-items:center;color:var(--text)"><input type="checkbox" id="imh" style="width:auto;margin:0" ${createH ? 'checked' : ''}> إنشاء ${newH.size} حلقة غير موجودة تلقائيًا</label>` : ''}
    <div class="tbl"><table><tr><th>الاسم</th>${isS ? '<th>الحلقة</th>' : ''}<th>الجوال</th><th>الحالة</th></tr>${parsed.slice(0, 8).map(r => `<tr><td>${esc(r.name)}</td>${isS ? `<td>${esc(r.halaqa || '—')}</td>` : ''}<td>${esc(r.vals['core:phone'] || '—')}</td><td>${r.dup ? '<span class="tag" style="background:#fbeceb;color:var(--red)">مكرر</span>' : '<span class="tag">جديد</span>'}</td></tr>`).join('')}</table></div>
    ${parsed.length > 8 ? `<p class="muted" style="margin:.4rem 0 0">… و${parsed.length - 8} صفوف أخرى</p>` : ''}`;
    const cb = $('#imh'); if (cb) cb.onchange = () => { createH = cb.checked; };
    $('#imok').disabled = !fresh.length;
  }
  function go(table) {
    const r = importRows(table, kind);
    if (r.err) { msg(r.err, true); return; }
    parsed = r.rows; cols = r.cols; loose = r.loose; preview();
  }

  $('#imf').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    msg('جارٍ قراءة الملف…');
    try {
      const buf = await f.arrayBuffer(), u8 = new Uint8Array(buf);
      if (/\.xls$/i.test(f.name)) throw new Error('xls');
      go(/\.xlsx$/i.test(f.name) || (u8[0] === 0x50 && u8[1] === 0x4b) ? await parseXLSX(buf) : parseCSV(decodeText(buf)));
    } catch (err) {
      msg(err.message === 'xls' ? 'صيغة xls القديمة غير مدعومة. احفظ الملف بصيغة xlsx أو CSV ثم أعد المحاولة.' : 'تعذّرت قراءة الملف. جرّب حفظه بصيغة CSV أو الصق الخلايا مباشرة.', true);
    }
    e.target.value = '';
  };
  $('#imgo').onclick = async () => {
    const u = $('#imu').value.trim(), p = $('#imp').value;
    try {
      if (u) { msg('جارٍ جلب الملف…'); go(await fetchSheet(u)); }
      else if (p.trim()) go(parseCSV(p));
      else msg('اختر ملفًا أو الصق البيانات أو ضع رابط Google Sheets.', true);
    } catch (err) {
      msg(err.message === 'url' ? 'الرابط ليس رابط Google Sheets صالحًا.' : 'تعذّر جلب الملف. تأكد أن مشاركته «أي شخص لديه الرابط»، أو انسخ الخلايا والصقها هنا.', true);
    }
  };
  $('#imu').addEventListener('keydown', e => { if (e.key === 'Enter') $('#imgo').click(); });
  $('#imt').onclick = () => {
    const csv = '\uFEFF' + (isS ? 'الاسم,الحلقة,الجوال,كلمة المرور\nمحمد أحمد,حلقة الفرقان,,\n' : 'الاسم,الجوال,كلمة المرور\nأحمد علي,,\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = isS ? 'قالب-الطلاب.csv' : 'قالب-المعلمين.csv'; a.click(); URL.revokeObjectURL(a.href);
  };
  $('#imok').onclick = () => {
    const hmap = new Map(db.halaqat.flatMap(h => halaqaKeys(h).map(k => [k, h.id])));
    let n = 0, nh = 0, np = 0;
    const made = [];
    parsed.filter(r => !r.dup).forEach(r => {
      let hid = '';
      if (isS && r.halaqa) {
        const k = halaqaQKeys(r.halaqa).find(x => hmap.has(x));
        if (k) hid = hmap.get(k);
        else if (createH) {
          /* حلقة جديدة: إن وُجد معلم بالاسم نفسه رُبطت به فتُسمّى باسمه */
          const t = db.teachers.find(x => halaqaQKeys(r.halaqa).includes(norm(x.name)));
          hid = uid(); db.halaqat.push({ id: hid, name: t ? '' : (/^\s*حلقة/.test(r.halaqa) ? r.halaqa : 'حلقة ' + r.halaqa), teacherId: t ? t.id : '', supervisorId: '', placeId: '' });
          halaqaQKeys(r.halaqa).forEach(x => hmap.set(x, hid)); nh++;
        }
      }
      const id = uid(), given = r.vals['core:pin'], pin = given || genPass();
      const m = isS ? { id, name: r.name, halaqaId: hid, phone: '', pin } : { id, name: r.name, phone: '', pin };
      cols.forEach(c => { if (c.id !== 'core:halaqa' && c.id !== 'core:pin' && r.vals[c.id]) setField(m, c.id, r.vals[c.id]); });
      db[kind].push(m); made.push([id, r]);
      if (!given) ui.shown[id] = true;
      n++;
    });
    loose.forEach((l, i) => {
      const values = made.map(([mid, r]) => ({ mid, v: r.loose[i] })).filter(x => x.v);
      if (values.length) { db.pending.push({ id: uid(), kind, header: l.header, values, date: today() }); np++; }
    });
    ov.remove(); save(); render();
    toast(`تم استيراد ${n} ${isS ? 'طالب' : 'معلم'}${nh ? ` وإنشاء ${nh} حلقة` : ''}${np ? ` — ${np} عمود في «بيانات معلّقة»` : ''}`);
  };
}

/* استمارة الطالب: حقول مشتركة، وحقول خاصة بالصغار (ولي الأمر) أو الكبار */
function studentForm(st) {
  const isNew = !st;
  st = st || { id: uid(), name: '', cat: 'child', halaqaId: ui.fh || '', phone: '', pin: genPass(), info: {} };
  const I = st.info || {}, T = I.test || {};
  let photo = st.photo || '';
  const v = k => esc(I[k] ?? '');
  const sel = (name, list, val, blank) => `<select name="${name}">${blank ? `<option value="">${blank}</option>` : ''}${list.map(o => { const [ov, ol] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(ov)}" ${String(ov) === String(val ?? '') ? 'selected' : ''}>${esc(ol)}</option>`; }).join('')}</select>`;
  const age = st.cat === 'adult' && I.birthYear ? new Date().getFullYear() - I.birthYear : '';
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal wide sform"><h2>${isNew ? 'استمارة تقديم' : 'تعديل بيانات: ' + esc(st.name)}</h2>
    <div class="sf-top">
      <div class="ph"><img data-ph alt="" ${photo ? `src="${photo}"` : 'hidden'}><span data-ph0 class="ph0" ${photo ? 'hidden' : ''}>${TAB_ICONS.profile}</span>
        <div class="ph-btns"><label class="btn sm" style="margin:0">صورة<input type="file" accept="image/*" data-sfphoto hidden></label><button type="button" class="btn sm" data-sfnophoto>إزالة</button></div></div>
      <div class="sf-main">
        <div class="seg"><label><input type="radio" name="cat" value="child" ${st.cat !== 'adult' ? 'checked' : ''}><span>صغير — له ولي أمر</span></label><label><input type="radio" name="cat" value="adult" ${st.cat === 'adult' ? 'checked' : ''}><span>كبير</span></label></div>
        <label><span data-c="child">اسم الطالب</span><span data-c="adult">الاسم</span><input name="name" value="${esc(st.name)}" required></label>
      </div>
    </div>
    <fieldset class="tfs" data-c="child"><legend>خاص بالطالب</legend>
      <div class="two"><label>تاريخ الميلاد<input type="date" name="birth" value="${v('birth')}"></label><label>السن<input data-agec disabled></label></div>
      <div class="two"><label>الدراسة${sel('study', STUDY, I.study, '—')}</label><label>الصف الدراسي (وقت التقديم)<input name="grade" value="${v('grade')}"></label></div>
    </fieldset>
    <fieldset class="tfs" data-c="adult"><legend>بيانات</legend>
      <div class="two"><label>السن (سنة)<input type="number" name="age" min="5" max="110" value="${age}"></label><label>الحالة الاجتماعية${sel('marital', MARITAL, I.marital, '—')}</label></div>
      <div class="two"><label>المؤهل الدراسي<input name="qual" value="${v('qual')}"></label><label>طالب / خريج${sel('qualStatus', QSTAT, I.qualStatus, '—')}</label></div>
      <div class="two"><label>الوظيفة الحالية<input name="job" value="${v('job')}"></label><label>الوقت المتاح للحضور<input name="avail" value="${v('avail')}"></label></div>
    </fieldset>
    <fieldset class="tfs"><legend>العنوان والتواصل</legend>
      <label>العنوان<input name="address" value="${v('address')}"></label>
      <div class="two"><label>رقم الهاتف<input type="tel" dir="ltr" name="sphone" value="${v('phone')}"></label><label>واتساب<input type="tel" dir="ltr" name="whatsapp" value="${v('whatsapp')}" placeholder="إن اختلف عن الهاتف"></label></div>
    </fieldset>
    <fieldset class="tfs" data-c="child"><legend>خاص بولي الأمر</legend>
      <div class="two"><label>اسم ولي الأمر<input name="gName" value="${v('gName')}"></label><label>الوظيفة<input name="gJob" value="${v('gJob')}"></label></div>
      <div class="two"><label>رقم الهاتف<input type="tel" dir="ltr" name="gPhone" value="${v('gPhone')}"></label><label>واتساب<input type="tel" dir="ltr" name="gWhatsapp" value="${v('gWhatsapp')}" placeholder="إن اختلف عن الهاتف"></label></div>
      <div class="two"><label>صلة القرابة${sel('gRel', RELS, I.gRel, '—')}</label><label data-rel>حدّد صلة القرابة<input name="gRelOther" value="${v('gRelOther')}"></label></div>
    </fieldset>
    <fieldset class="tfs"><legend>اختبار تحديد مستوى</legend>
      <div class="three"><label>قراءة${sel('tRead', GRADES, T.read, '—')}</label><label>تجويد${sel('tTaj', GRADES, T.tajweed, '—')}</label><label>حفظ<input name="tHifz" value="${esc(T.hifz || '')}" placeholder="مثال: جزء عم"></label></div>
    </fieldset>
    <fieldset class="tfs"><legend>قرار الإدارة</legend>
      <label><span data-c="child">يلتحق الطالب بحلقة</span><span data-c="adult">يلتحق الأخ بحلقة</span>${sel('halaqaId', halaqaOpts().map(o => [o.v, o.l]), st.halaqaId, '— لم يُحدَّد بعد —')}</label>
      <div class="three"><label>تحرر يوم<input type="date" name="joinDate" value="${v('joinDate') || (isNew ? today() : '')}"></label><label>الاشتراك الشهري (جنيه)<input type="number" min="0" name="fee" value="${v('fee')}"></label><label>كلمة المرور للدخول<input name="pin" value="${esc(st.pin)}" required dir="ltr"></label></div>
      <label class="chk"><input type="checkbox" name="pledge" ${I.pledge ? 'checked' : ''}><span data-c="child">وقّع ولي الأمر على التنبيهات</span><span data-c="adult">وقّع المتقدم على التنبيهات</span></label>
    </fieldset>
    <div class="row"><button type="button" class="btn primary" data-save>حفظ</button><button type="button" class="btn" data-close>إلغاء</button></div></div>`;
  document.body.appendChild(ov);
  const $ = q => ov.querySelector(q), val = n => (ov.querySelector(`[name=${n}]`)?.value ?? '').trim();
  const cat = () => ov.querySelector('[name=cat]:checked').value;
  const sync = () => {
    ov.querySelectorAll('[data-c]').forEach(x => { x.hidden = x.dataset.c !== cat(); });
    $('[data-rel]').hidden = cat() !== 'child' || val('gRel') !== 'شخص آخر';
    const a = ageOf({ cat: 'child', info: { birth: val('birth') } });
    $('[data-agec]').value = a === '' ? '' : a + ' سنة';
  };
  ov.addEventListener('change', sync); ov.addEventListener('input', sync); sync();
  $('[data-sfphoto]').onchange = e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    const url = URL.createObjectURL(f), img = new Image();
    img.onload = () => {
      /* قص مربع من الوسط وتصغير إلى 160 بكسل حتى لا تثقل الصور ذاكرة المتصفح */
      const S = 160, c = document.createElement('canvas'), m = Math.min(img.naturalWidth, img.naturalHeight);
      c.width = c.height = S;
      c.getContext('2d').drawImage(img, (img.naturalWidth - m) / 2, (img.naturalHeight - m) / 2, m, m, 0, 0, S, S);
      let d = c.toDataURL('image/webp', .72); if (!d.startsWith('data:image/webp')) d = c.toDataURL('image/jpeg', .75);
      URL.revokeObjectURL(url); photo = d;
      $('[data-ph]').src = d; $('[data-ph]').hidden = false; $('[data-ph0]').hidden = true;
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast('تعذّرت قراءة الصورة'); };
    img.src = url;
  };
  $('[data-sfnophoto]').onclick = () => { photo = ''; $('[data-ph]').hidden = true; $('[data-ph0]').hidden = false; };
  $('[data-close]').onclick = () => ov.remove();
  $('[data-save]').onclick = () => {
    const name = val('name').replace(/\s+/g, ' ');
    if (!name) { toast('اكتب الاسم'); return; }
    if (!val('pin')) { toast('اكتب كلمة المرور'); return; }
    if (db.students.some(x => x.id !== st.id && norm(x.name) === norm(name))) { toast('يوجد طالب بالاسم نفسه'); return; }
    const c = cat(), ageN = +val('age');
    if (c === 'adult' && val('age') && !(ageN >= 5 && ageN <= 110)) { toast('السن غير صحيح'); return; }
    const info = { address: val('address'), phone: normPhone(val('sphone')), whatsapp: normPhone(val('whatsapp')), joinDate: val('joinDate'), fee: val('fee') === '' ? '' : +val('fee'), pledge: $('[name=pledge]').checked,
      test: { read: val('tRead'), tajweed: val('tTaj'), hifz: val('tHifz') } };
    if (c === 'child') Object.assign(info, { birth: val('birth'), study: val('study'), grade: val('grade'), gName: val('gName'), gJob: val('gJob'), gPhone: normPhone(val('gPhone')), gWhatsapp: normPhone(val('gWhatsapp')), gRel: val('gRel'), gRelOther: val('gRel') === 'شخص آخر' ? val('gRelOther') : '' });
    else Object.assign(info, { birthYear: val('age') ? new Date().getFullYear() - ageN : '', marital: val('marital'), qual: val('qual'), qualStatus: val('qualStatus'), job: val('job'), avail: val('avail') });
    Object.assign(st, { name, cat: c, halaqaId: val('halaqaId'), pin: val('pin'), photo, info: { ...(st.info || {}), ...info } });
    /* رقم التواصل الأساسي: ولي الأمر للصغير، والطالب نفسه للكبير */
    st.phone = c === 'child' ? (info.gPhone || info.phone || st.phone || '') : (info.phone || st.phone || '');
    if (isNew) db.students.push(st);
    ov.remove(); save(); render(); toast(isNew ? 'تم حفظ الاستمارة' : 'تم حفظ التعديلات');
  };
}
/* ملف الطالب: عرض الاستمارة كاملة مع إمكان طباعتها */
function studentCard(st) {
  if (!st) return;
  const I = st.info || {}, T = I.test || {}, child = st.cat !== 'adult', h = byId(db.halaqat, st.halaqaId);
  const row = (l, x) => (x === '' || x == null) ? '' : `<tr><th>${l}</th><td>${esc(x)}</td></tr>`;
  const wa = n => n ? `<a href="https://wa.me/2${esc(n)}" target="_blank" rel="noopener" dir="ltr">${esc(n)}</a>` : '';
  const telRow = (l, p, w) => (p || w) ? `<tr><th>${l}</th><td><span dir="ltr">${esc(p || '—')}</span>${w && w !== p ? ` — واتساب ${wa(w)}` : ''}</td></tr>` : '';
  const sec = (t, rows) => rows.trim() ? `<h3 class="sc-h">${t}</h3><div class="tbl"><table>${rows}</table></div>` : '';
  const a = ageOf(st);
  const html = `<div class="scard">
    <div class="sc-head">${avatar(st, 96)}<div><h2 style="margin:0">${esc(st.name)}</h2><p class="muted" style="margin:.2rem 0 0"><span class="tag ${child ? '' : 'tag-a'}">${CATS[child ? 'child' : 'adult']}</span> ${a === '' ? '' : a + ' سنة'}</p></div></div>
    ${sec(child ? 'خاص بالطالب' : 'بيانات', child
      ? row('تاريخ الميلاد', I.birth) + row('الدراسة', I.study) + row('الصف الدراسي', I.grade)
      : row('المؤهل الدراسي', [I.qual, I.qualStatus].filter(Boolean).join(' — ')) + row('الحالة الاجتماعية', I.marital) + row('الوظيفة الحالية', I.job) + row('الوقت المتاح للحضور', I.avail))}
    ${sec('العنوان والتواصل', row('العنوان', I.address) + telRow('رقم الهاتف', I.phone, I.whatsapp))}
    ${child ? sec('خاص بولي الأمر', row('اسم ولي الأمر', I.gName) + telRow('رقم الهاتف', I.gPhone, I.gWhatsapp) + row('الوظيفة', I.gJob) + row('صلة القرابة', I.gRel === 'شخص آخر' ? (I.gRelOther || 'شخص آخر') : I.gRel)) : ''}
    ${sec('اختبار تحديد مستوى', row('قراءة', T.read) + row('تجويد', T.tajweed) + row('حفظ', T.hifz))}
    ${sec('قرار الإدارة', row(child ? 'يلتحق الطالب بحلقة' : 'يلتحق الأخ بحلقة', h ? halaqaLabel(h) : '') + row('بدار', placeName(h)) + row('وقت الحلقة', timeText(h)) + row('تحرر يوم', I.joinDate) + row('الاشتراك الشهري', I.fee === '' || I.fee == null ? '' : I.fee + ' جنيه') + row('التوقيع على التنبيهات', I.pledge ? (child ? 'وقّع ولي الأمر' : 'وقّع المتقدم') : 'لم يوقّع بعد'))}
    <div class="row noprint">${session?.role === 'admin' ? `<button class="btn primary" data-act="editStudent" data-id="${st.id}">تعديل</button>` : ''}<button class="btn" data-act="printCard">طباعة</button></div>
  </div>`;
  openInfo('ملف الطالب', html);
}

/* نموذج الحلقة: المكان والمعلم والمشرف، والوقت بالساعة أو بالصلوات */
function halaqaForm(h, presetPlace) {
  const isNew = !h, w = h?.time || { mode: 'prayer', fromPrayer: 'العصر', toKind: 'prayer', toPrayer: 'المغرب' };
  const sel = (name, list, val) => `<select name="${name}">${list.map(o => `<option value="${esc(o.v)}" ${String(o.v) === String(val ?? '') ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select>`;
  const P = PRAYERS.map(x => ({ v: x, l: x }));
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal"><h2>${isNew ? 'حلقة جديدة' : 'تعديل الحلقة'}</h2>
    <label>المكان${sel('placeId', [{ v: '', l: '— اختر المكان —' }, ...db.places.map(p => ({ v: p.id, l: p.name + ' (' + p.type + ')' }))], h?.placeId ?? presetPlace)}</label>
    <label>المعلم — الحلقة تُسمّى باسمه${sel('teacherId', [{ v: '', l: '— بدون —' }, ...opts(db.teachers)], h?.teacherId)}</label>
    <label>المشرف${sel('supervisorId', [{ v: '', l: '— بدون —' }, ...opts(db.supervisors)], h?.supervisorId)}</label>
    <fieldset class="tfs"><legend>وقت الحلقة</legend>
      <div class="seg"><label><input type="radio" name="mode" value="prayer" ${w.mode !== 'clock' ? 'checked' : ''}><span>بالصلوات</span></label><label><input type="radio" name="mode" value="clock" ${w.mode === 'clock' ? 'checked' : ''}><span>بالساعة</span></label></div>
      <div data-m="prayer"><div class="two"><label>من بعد صلاة${sel('fromPrayer', P, w.fromPrayer || 'العصر')}</label><label>إلى${sel('toKind', [{ v: 'prayer', l: 'صلاة' }, { v: 'clock', l: 'الساعة' }], w.toKind || 'prayer')}</label></div>
        <div class="two"><label data-k="prayer">صلاة${sel('toPrayer', [{ v: '', l: '—' }, ...P], w.toPrayer)}</label><label data-k="clock">الساعة<input type="time" name="toTime" value="${esc(w.toTime || '')}"></label></div></div>
      <div data-m="clock" class="two"><label>من الساعة<input type="time" name="from" value="${esc(w.from || '')}"></label><label>إلى الساعة<input type="time" name="to" value="${esc(w.to || '')}"></label></div>
      <p class="tprev"></p>
    </fieldset>
    ${h && !h.teacherId && h.name ? `<label>اسم مؤقت (يُستبدل باسم المعلم عند اختياره)<input name="name" value="${esc(h.name)}"></label>` : ''}
    <div class="row"><button type="button" class="btn primary" data-save>حفظ</button><button type="button" class="btn" data-close>إلغاء</button></div></div>`;
  document.body.appendChild(ov);
  const $ = q => ov.querySelector(q), val = n => ov.querySelector(`[name=${n}]`)?.value;
  const mode = () => ov.querySelector('[name=mode]:checked').value;
  const read = () => mode() === 'clock' ? { mode: 'clock', from: val('from'), to: val('to') } : { mode: 'prayer', fromPrayer: val('fromPrayer'), toKind: val('toKind'), toPrayer: val('toPrayer'), toTime: val('toTime') };
  const sync = () => {
    ov.querySelectorAll('[data-m]').forEach(x => { x.hidden = x.dataset.m !== mode(); });
    ov.querySelectorAll('[data-k]').forEach(x => { x.hidden = x.dataset.k !== val('toKind'); });
    const t = byId(db.teachers, val('teacherId'));
    $('.tprev').innerHTML = `<b>${esc(t ? 'حلقة ' + t.name : 'حلقة بلا معلم')}</b> — ${esc(timeText({ time: read() }) || 'حدّد الوقت')}`;
  };
  ov.addEventListener('change', sync); ov.addEventListener('input', sync); sync();
  $('[data-close]').onclick = () => ov.remove();
  $('[data-save]').onclick = () => {
    const t = read();
    if (!val('placeId')) { toast('اختر المكان'); return; }
    if (t.mode === 'clock') {
      if (!t.from || !t.to) { toast('حدّد ساعة البداية والنهاية'); return; }
      if (t.from >= t.to) { toast('ساعة النهاية يجب أن تكون بعد البداية'); return; }
    } else if (t.toKind === 'prayer') {
      if (!t.toPrayer) { toast('حدّد الصلاة التي تنتهي عندها الحلقة'); return; }
      if (PRAYERS.indexOf(t.toPrayer) <= PRAYERS.indexOf(t.fromPrayer)) { toast('صلاة النهاية يجب أن تكون بعد صلاة البداية'); return; }
    } else if (!t.toTime) { toast('حدّد ساعة انتهاء الحلقة'); return; }
    const o = { placeId: val('placeId'), teacherId: val('teacherId'), supervisorId: val('supervisorId'), time: t };
    if (val('name') !== undefined) o.name = val('name').trim();
    if (isNew) db.halaqat.push({ id: uid(), ...o }); else Object.assign(h, o);
    ov.remove(); save(); render(); toast('تم حفظ الحلقة');
  };
}

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
    if (acc.pin === cur.pin) { go(); return; }
    openForm('كلمة مرور حساب ' + ROLE_L[d.r], [{ name: 'pin', label: 'كلمة المرور', type: 'password', required: true }], v => { if (v.pin !== acc.pin) return 'كلمة المرور غير صحيحة'; go(); });
  },
  logout: () => { ui.shown = {}; ui.pick = null; session = null; ss.del(SKEY); ui.tab = null; render(); },
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
      toast('تم إنشاء الحساب — كلمة المرور: ' + pin);
    });
  },

  addTeacher: () => openForm('معلم جديد', [{ name: 'name', label: 'الاسم', required: true }, { name: 'phone', label: 'الجوال', type: 'tel' }, { name: 'pin', label: 'كلمة المرور', value: genPass(), required: true }],
    v => { db.teachers.push({ id: uid(), name: v.name.trim(), phone: v.phone, pin: v.pin }); }),
  editTeacher: d => { const t = byId(db.teachers, d.id); openForm('تعديل معلم', [{ name: 'name', label: 'الاسم', value: t.name, required: true }, { name: 'phone', label: 'الجوال', value: t.phone, type: 'tel' }, { name: 'pin', label: 'كلمة المرور', value: t.pin, required: true }],
    v => { Object.assign(t, { name: v.name.trim(), phone: v.phone, pin: v.pin }); }); },
  delTeacher: d => ask('حذف المعلم؟ ستبقى حلقاته بدون معلم.', () => { db.teachers = db.teachers.filter(t => t.id !== d.id); db.halaqat.forEach(h => { if (h.teacherId === d.id) h.teacherId = ''; }); save(); render(); }),

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
      ask('حذف الإداري؟', () => { db.admins = db.admins.filter(a => a.id !== d.id); save(); render(); });
      return;
    }
    ask('حذف المشرف؟ ستبقى حلقاته بدون مشرف.', () => { db.supervisors = db.supervisors.filter(x => x.id !== d.id); db.halaqat.forEach(h => { if (h.supervisorId === d.id) h.supervisorId = ''; }); save(); render(); });
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
  delStudent: d => ask('حذف الطالب وكل سجلاته؟', () => { db.students = db.students.filter(s => s.id !== d.id); db.records = db.records.filter(r => r.studentId !== d.id); db.attendance = db.attendance.filter(a => a.studentId !== d.id); save(); render(); }),

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
  if (pk) { const g = nameGroups().find(x => x.key === pk.dataset.pick); if (g) pickUser(g); return; }
  if (e.target.id === 'ufilter') showResults();
  if (!e.target.closest('#ufilter, #uresults')) showResults(false);
  const el = e.target.closest('[data-act]');
  if (el && A[el.dataset.act]) A[el.dataset.act](el.dataset);
  else if (el && window.Payroll?.act[el.dataset.act]) window.Payroll.act[el.dataset.act](el.dataset);
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
  else if (e.target.closest('#login')) A.doLogin();
  else e.target.closest('.modal')?.querySelector('[data-save]')?.click();
});

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
  el.hidden = !off;
  el.textContent = 'بدون إنترنت — التطبيق يعمل وبياناتك محفوظة على هذا الجهاز';
  document.body.classList.toggle('offline', off);
};
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
})();
