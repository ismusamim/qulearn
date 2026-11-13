/* ============ المزامنة مع قاعدة البيانات (Supabase) ============
   - التطبيق يعمل على نسخة محلية من البيانات (db) كما كان، فيعمل بدون إنترنت.
   - كل حفظ يقارن البيانات بآخر نسخة مؤكدة من الخادم ويرسل الفروق فقط.
   - التغييرات التي تحدث بدون إنترنت تبقى محفوظة وتُرسل عند عودة الاتصال.
   - الصلاحيات الحقيقية مطبّقة على الخادم (RLS)، لا في المتصفح. */
(() => {
'use strict';
const DEF = {
  url: 'https://vjmlrajxcfxiooprzfjw.supabase.co',
  key: 'sb_publishable_IM-942KoPf_iH_FvPBnBag_hxJQCKrJ',
  fn: 'dynamic-worker'
};
let CFG = DEF;
try { const o = JSON.parse(localStorage.getItem('qcloud_cfg') || 'null'); if (o && o.url && o.key) CFG = { ...DEF, ...o }; } catch (e) { /* ignore */ }
if (/[?&]local=1/.test(location.search)) CFG = { ...CFG, url: '' };

const LS = {
  get: k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del: k => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
};
const AKEY = 'qcloud_auth';
let auth = LS.get(AKEY);              // { access_token, refresh_token, expires_at, uid, email, member:{role,id} }
let snap = null, pushing = false, again = false, timer = null, lastError = '', lastSync = null;
const listeners = new Set();
const emit = () => listeners.forEach(f => { try { f(); } catch (e) { /* ignore */ } });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = v => typeof v === 'string' && UUID_RE.test(v);
const uuid = () => {
  if (crypto?.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

/* ---------------- الطلبات ---------------- */
class HttpError extends Error { constructor(status, msg, body) { super(msg); this.status = status; this.body = body; } }
async function token() {
  if (!auth) return null;
  if (auth.expires_at && Date.now() / 1000 > auth.expires_at - 60) await refresh();
  return auth?.access_token || null;
}
async function refresh() {
  const r = await fetch(`${CFG.url}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST', headers: { apikey: CFG.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: auth.refresh_token })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { if (r.status === 400 || r.status === 401) { auth = null; LS.del(AKEY); emit(); } throw new HttpError(r.status, j.error_description || j.msg || 'انتهت الجلسة'); }
  storeAuth(j);
}
function storeAuth(j) {
  auth = { ...(auth || {}), access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 3600), uid: j.user?.id || auth?.uid, email: j.user?.email || auth?.email };
  LS.set(AKEY, auth);
}
async function req(path, { method = 'GET', body, headers = {}, anon = false, retry = true } = {}) {
  const h = { apikey: CFG.key, ...headers };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  if (!anon) { const t = await token(); if (t) h.Authorization = 'Bearer ' + t; }
  const r = await fetch(CFG.url + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  if (r.status === 401 && !anon && retry && auth) { await refresh(); return req(path, { method, body, headers, anon, retry: false }); }
  const txt = await r.text();
  let j = null; try { j = txt ? JSON.parse(txt) : null; } catch (e) { j = txt; }
  if (!r.ok) throw new HttpError(r.status, (j && (j.message || j.error_description || j.error || j.msg)) || `HTTP ${r.status}`, j);
  return j;
}
const rpc = (fn, args = {}, anon = false) => req(`/rest/v1/rpc/${fn}`, { method: 'POST', body: args, anon });
async function selectAll(table, order = 'id', extra = '', cols = '*') {
  const out = [];
  for (let off = 0; ; off += 1000) {
    const page = await req(`/rest/v1/${table}?select=${cols}&order=${order}&limit=1000&offset=${off}${extra}`);
    out.push(...(page || []));
    if (!page || page.length < 1000) break;
  }
  return out;
}

/* ---------------- الدخول ---------------- */
async function signIn(email, password) {
  const r = await fetch(`${CFG.url}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: CFG.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new HttpError(r.status, /invalid/i.test(j.error_description || j.msg || '') ? 'كلمة المرور غير صحيحة' : (j.error_description || j.msg || 'تعذّر الدخول'));
  auth = null; storeAuth(j); resetSync();
  snap = LS.get(snapKey());
  emit();
  return auth;
}
async function signOut() {
  try { if (auth) await req('/auth/v1/logout', { method: 'POST', retry: false }); } catch (e) { /* ignore */ }
  auth = null; snap = null; LS.del(AKEY); resetSync(); emit();
}
const lookup = q => rpc('login_lookup', { q }, true);
const setMember = m => { if (auth) { if (auth.member?.id !== m?.id) raw = null; auth.member = m; LS.set(AKEY, auth); } };
/* بدء مزامنة جديدة من الصفر (حساب آخر أو خروج): لا تُخلط بيانات جلستين */
function resetSync() { raw = null; since = null; lastFull = 0; photoCache.clear(); photoSent.clear(); }

/* ---------------- الوظيفة السحابية لإدارة الحسابات ---------------- */
async function fn(body) {
  const t = await token();
  const r = await fetch(`${CFG.url}/functions/v1/${CFG.fn}`, {
    method: 'POST', headers: { apikey: CFG.key, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new HttpError(r.status, j.error || j.message || `HTTP ${r.status}`, j);
  return j;
}
async function provision(items, onProgress) {
  const res = [];
  for (let i = 0; i < items.length; i += 40) {
    const part = await fn({ action: 'provision', items: items.slice(i, i + 40) });
    res.push(...(part.results || []));
    onProgress?.(Math.min(i + 40, items.length), items.length);
  }
  return res;
}

/* ---------------- التحويل بين بيانات التطبيق وجداول الخادم ---------------- */
const nz = v => (v === '' || v === undefined ? null : v);
const num = v => (v === '' || v === undefined || v === null || isNaN(+v) ? null : +v);
const ROLE_COLL = { admin: 'admins', supervisor: 'supervisors', teacher: 'teachers', student: 'students', accountant: 'accountants' };

function memberRow(m, role) {
  return {
    id: m.id, role, name: m.name || '', phone: m.phone || '',
    halaqa_id: role === 'student' ? nz(m.halaqaId) : null,
    cat: role === 'student' ? (m.cat === 'adult' ? 'adult' : 'child') : null,
    info: role === 'teacher' ? { personal: m.personal || {}, tech: m.tech || {} } : (m.info || {}),
    extra: m.extra || {}
  };
}
/* كل مجموعة: [اسم المجموعة، الجدول، المفتاح، الصفوف] بترتيب يحترم العلاقات بين الجداول */
function groups(db) {
  const P = db.payroll || {};
  const g = [];
  const add = (name, table, pk, rows, conflict) => g.push({ name, table, pk, rows, conflict });
  /* priv_*: إعدادات خاصة بالمدير (مثل فئات الاشتراكات وخصوماتها) لا يقرؤها غيره على الخادم */
  add('settings', 'settings', ['key'], ['org', 'theme', 'logo', 'block_msgs', 'priv_fees', 'priv_perms'].filter(k => db.settings?.[k] !== undefined).map(k => ({ key: k, value: db.settings[k] ?? null })));
  add('places', 'places', ['id'], (db.places || []).map(p => ({ id: p.id, name: p.name, type: p.type || 'مسجد', address: p.address || '' })));
  add('staff', 'members', ['id'], ['admin', 'supervisor', 'teacher', 'accountant'].flatMap(r => (db[ROLE_COLL[r]] || []).map(m => memberRow(m, r))));
  add('halaqat', 'halaqat', ['id'], (db.halaqat || []).map(h => ({ id: h.id, name: h.name || '', teacher_id: nz(h.teacherId), supervisor_id: nz(h.supervisorId), place_id: nz(h.placeId), time: h.time || null })));
  add('students', 'members', ['id'], (db.students || []).map(m => memberRow(m, 'student')));
  add('member_admin', 'member_admin', ['member_id'], (db.teachers || []).filter(t => t.admin && Object.keys(t.admin).length).map(t => ({ member_id: t.id, data: t.admin })));
  add('attendance', 'attendance', ['id'], (db.attendance || []).map(a => ({ id: a.id, student_id: a.studentId, date: a.date, status: a.status })), 'student_id,date');
  add('records', 'records', ['id'], (db.records || []).map(r => ({ id: r.id, student_id: r.studentId, date: r.date, type: r.type, surah: +r.surah, from_ayah: +r.from, to_ayah: +r.to, grade: r.grade || null, note: r.note || '' })));
  add('news', 'news', ['id'], (db.news || []).map(n => ({ id: n.id, text: n.text, audience: n.audience || 'all', date: n.date })));
  /* اشتراكات الطلاب (للمدير)؛ لا تُرسل إن لم يُنشأ جدولها على الخادم بعد */
  if (Array.isArray(db.fees) && feesOk !== false) add('fees', 'fees', ['id'], db.fees.map(f => ({ id: f.id, student_id: f.studentId, y: +f.y, m: +f.m, amount: num(f.amount) ?? 0, date: f.date || null, by_name: nz(f.by), note: f.note || '' })));
  add('custom_fields', 'custom_fields', ['kind', 'key'], ['students', 'teachers'].flatMap(k => (db.fields?.[k] || []).map(f => ({ kind: k, key: f.key, label: f.label, type: f.type || 'text' }))));
  add('pending', 'pending_columns', ['id'], (db.pending || []).map(p => ({ id: p.id, kind: p.kind, header: p.header, values: p.values || [], date: p.date })));
  if (db.payroll) {
    add('pay_settings', 'pay_settings', ['id'], [{ id: 1, data: P.settings || {} }]);
    add('pay_employees', 'pay_employees', ['id'], (P.employees || []).map(e => ({ id: e.id, code: nz(e.code), name: e.name, role: nz(e.role), sys: nz(e.sys), status: e.status === 'متوقف' ? 'متوقف' : 'نشط', basic: num(e.basic), rate: num(e.rate), incentive: num(e.incentive), transport: num(e.transport), hours: num(e.hours), place: nz(e.place), note: nz(e.note) })));
    /* صف المرتب يُعرَّف بالموظف والشهر: لو أنشأ جهازان الشهر نفسه يُحدَّث الصف الموجود بدل رفضه */
    add('pay_rows', 'pay_rows', ['id'], lastByKey(P.rows || [], r => r.y + '|' + r.m + '|' + r.eid).map(r => ({ id: r.id, y: +r.y, m: +r.m, emp_id: r.eid, name: nz(r.name), role: nz(r.role), base: num(r.base), extra: num(r.extra), exc: num(r.exc), abs_p: num(r.absP), abs_n: num(r.absN), mtg_p: num(r.mtgP), mtg_n: num(r.mtgN), d_test: num(r.dTest), d_rec: num(r.dRec), d_books: num(r.dBooks), basic: num(r.basic), rate: num(r.rate), incentive: num(r.incentive), transport: num(r.transport), note: r.note || '' })), 'y,m,emp_id');
    add('pay_closed', 'pay_closed', ['y', 'm'], (P.closed || []).map(k => { const [y, m] = String(k).split('-').map(Number); return { y, m }; }).filter(x => x.y && x.m));
    add('absences', 'absences', ['id'], lastByKey(P.absences || [], a => (a.date ? a.eid + '|' + a.date : a.id)).map(a => ({ id: a.id, y: +a.y, m: +a.m, date: a.date || null, emp_id: a.eid, name: nz(a.name), place: nz(a.place), perm: a.perm || '', reason: nz(a.reason), proof: a.proof || '', note: nz(a.note), by_member: isUuid(a.byMember) ? a.byMember : null, by_name: nz(a.by) })), 'emp_id,date');
  }
  return g;
}
const rowKey = (pk, r) => pk.map(k => r[k]).join('|');
/* آخر نسخة لكل مفتاح طبيعي (يمنع إرسال صفين لنفس الموظف والشهر في دفعة واحدة) */
function lastByKey(list, key) { const m = new Map(); list.forEach(x => m.set(key(x), x)); return [...m.values()]; }
function snapshotOf(db) {
  const s = {};
  for (const gr of groups(db)) { const m = {}; gr.rows.forEach(r => { m[rowKey(gr.pk, r)] = JSON.stringify(r); }); s[gr.name] = m; }
  return s;
}

/* المعرّفات القديمة (غير UUID) تُستبدل بمعرّفات جديدة مع تحديث كل الإشارات إليها */
/* معرّف ثابت للمعرّفات القديمة: نفس المعرّف القديم يعطي دائمًا نفس الرمز، فاستيراد الملف نفسه مرة ثانية يحدّث السجلات بدل تكرارها */
function stableUuid(s) {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  const str = 'qulearn:' + s;
  for (let i = 0, k; i < str.length; i++) {
    k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067); h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213); h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067); h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213); h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4; h2 ^= h1; h3 ^= h1; h4 ^= h1;
  const x = [h1, h2, h3, h4].map(v => (v >>> 0).toString(16).padStart(8, '0')).join('');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-5${x.slice(13, 16)}-${(8 | (parseInt(x[16], 16) & 3)).toString(16)}${x.slice(17, 20)}-${x.slice(20, 32)}`;
}
function ensureUuids(db) {
  const map = new Map(), fix = o => { if (o && !isUuid(o.id)) { const n = o.id ? stableUuid(o.id) : uuid(); map.set(o.id, n); o.id = n; } };
  ['admins', 'supervisors', 'teachers', 'students', 'places', 'halaqat', 'attendance', 'records', 'news', 'pending', 'fees'].forEach(k => (db[k] || []).forEach(fix));
  const P = db.payroll;
  if (P) ['employees', 'rows', 'absences'].forEach(k => (P[k] || []).forEach(fix));
  if (!map.size) return false;
  const re = v => (map.has(v) ? map.get(v) : v);
  (db.halaqat || []).forEach(h => { h.teacherId = re(h.teacherId); h.supervisorId = re(h.supervisorId); h.placeId = re(h.placeId); });
  (db.students || []).forEach(s => { s.halaqaId = re(s.halaqaId); });
  (db.attendance || []).forEach(a => { a.studentId = re(a.studentId); });
  (db.records || []).forEach(r => { r.studentId = re(r.studentId); });
  (db.fees || []).forEach(f => { f.studentId = re(f.studentId); });
  (db.pending || []).forEach(p => (p.values || []).forEach(v => { v.mid = re(v.mid); }));
  if (P) { (P.rows || []).forEach(r => { r.eid = re(r.eid); }); (P.absences || []).forEach(a => { a.eid = re(a.eid); a.byMember = re(a.byMember); }); }
  return map;
}

/* ---------------- السحب من الخادم ---------------- */
function emptyDb() {
  return { settings: { org: 'إدارة الحلقات القرآنية' }, admins: [], supervisors: [], teachers: [], accountants: [], students: [], places: [], halaqat: [], attendance: [], records: [], news: [], fields: { students: [], teachers: [] }, pending: [] };
}
/* ---------------- المزامنة بالتغييرات فقط ----------------
   أول جلب في الجلسة (وكل 30 دقيقة) كامل، وما بينهما يُجلب فقط ما تغيّر منذ آخر مرة (عمود sync_ts)
   مع سجل المحذوفات (sync_deleted). الصور لا تُنزَّل مع المزامنة، بل عند الحاجة فقط.
   إن لم يُنفَّذ ملف sync_incremental.sql على الخادم بعد، يعمل التطبيق بالجلب الكامل كما كان. */
const SYNC_TABLES = {
  settings: ['key'], places: ['id'], members: ['id'], member_admin: ['member_id'], halaqat: ['id'], attendance: ['id'],
  records: ['id'], news: ['id'], custom_fields: ['kind', 'key'], pay_settings: ['id'], pay_employees: ['id'],
  pay_rows: ['id'], pay_closed: ['y', 'm'], absences: ['id'], pending_columns: ['id'], fees: ['id']
};
let feesOk = null; // هل جدول الاشتراكات موجود على الخادم؟
const MEMBER_COLS = 'id,user_id,login_email,role,name,phone,halaqa_id,cat,info,extra,has_photo';
const FULL_EVERY = 30 * 60000;
let raw = null, since = null, lastFull = 0, inc = null, scoped = false, lastChanged = true;
const photoCache = new Map();   // معرّف العضو ← الصورة ('' = بلا صورة)
const photoSent = new Map();    // معرّف العضو ← بصمة الصورة كما هي على الخادم (للصور المعروفة فقط)
const hashStr = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return s.length + ':' + h; };
const pkOf = (t, r) => SYNC_TABLES[t].map(k => r[k]).join('|');
function tablesFor(role) {
  /* المحاسب: الطلاب والحلقات والأماكن والاشتراكات والإعلانات فقط */
  if (role === 'accountant') return ['settings', 'places', 'members', 'halaqat', 'news', 'fees'];
  const t = ['settings', 'places', 'members', 'member_admin', 'halaqat', 'attendance', 'records', 'news', 'custom_fields'];
  if (role === 'admin') t.push('pay_settings', 'pay_employees', 'pay_rows', 'pay_closed', 'absences', 'pending_columns', 'fees');
  else if (role === 'supervisor') t.push('absences');
  return t;
}
function notePhoto(r, incremental) {
  if (!inc) { photoCache.set(r.id, r.photo || ''); photoSent.set(r.id, hashStr(r.photo || '')); return; }
  if (!r.has_photo) { photoCache.set(r.id, ''); photoSent.set(r.id, hashStr('')); }
  else if (incremental || photoCache.get(r.id) === '') { photoCache.delete(r.id); photoSent.delete(r.id); }
}
/* غير المدير لا يُنزّل إلا نطاقه: حلقاته وطلابها وأسماء العاملين معه (والمشرف كل الأماكن لنموذج الغياب) */
const inList = a => '(' + (a || []).join(',') + ')';
function scopeFilter(t, chk) {
  if (!chk?.hal) return '';
  if (t === 'members') return '&id=in.' + inList([...new Set([...(chk.ids || []), ...(chk.stu || [])])]);
  if (t === 'halaqat') return '&id=in.' + inList(chk.hal);
  if (t === 'places' && !chk.sup) return '&id=in.' + inList(chk.pl);
  if (t === 'member_admin') return '&member_id=in.' + inList(chk.me);
  return '';
}
const sameSet = (a, b) => { a = a || []; b = b || []; if (a.length !== b.length) return false; const s = new Set(a); return b.every(x => s.has(x)); };
async function fetchTables(tables, filter = '', chk = null) {
  const got = await Promise.all(tables.map(t => {
    const p = selectAll(t, SYNC_TABLES[t].join(','), filter + scopeFilter(t, chk), t === 'members' && inc ? MEMBER_COLS : '*');
    /* جدول الاشتراكات قد لا يكون أُنشئ بعد: لا يعطّل ذلك بقية المزامنة */
    return t === 'fees' ? p.then(r => { feesOk = true; return r; }, () => { feesOk = false; return []; }) : p;
  }));
  return Object.fromEntries(tables.map((t, i) => [t, got[i]]));
}
const backMinute = ts => new Date(new Date(ts).getTime() - 60000).toISOString();
async function pull() {
  const role = auth?.member?.role, tables = tablesFor(role);
  if (inc === null) {
    try { await rpc('sync_check', { since: new Date().toISOString() }); inc = true; scoped = true; }
    catch (e) { scoped = false; try { await rpc('sync_now'); inc = true; } catch (e2) { inc = false; } }
  }
  /* سؤال واحد صغير للخادم: هل تغيّر شيء يخص هذا المستخدم؟ إن لم يتغير شيء لا تحدث مزامنة أصلًا */
  const chk = scoped ? await rpc('sync_check', { since: since || new Date().toISOString() }) : null;
  let mode = 'full';
  if (inc && raw && raw.role === role && since) {
    if (!scoped) mode = Date.now() - lastFull < FULL_EVERY ? 'inc' : 'full';
    else if (chk.hal && (!sameSet(chk.hal, raw.hal) || !sameSet(chk.stu, raw.stu))) mode = 'full'; // تغيّر نطاقه: حلقة جديدة أو طالب انتقل
    else if (!chk.tables.length) mode = 'none';
    else mode = role === 'admin' && Date.now() - lastFull >= FULL_EVERY ? 'full' : 'inc';
  }
  if (mode === 'none') { lastChanged = false; since = backMinute(chk.now); }
  else if (mode === 'inc') {
    const now = scoped ? chk.now : await rpc('sync_now'), f = '&sync_ts=gt.' + encodeURIComponent(since);
    const want = scoped ? tables.filter(t => chk.tables.includes(t)) : tables;
    const tombF = '&at=gt.' + encodeURIComponent(since) + (chk?.hal ? `&or=(tbl.in.(settings,news,custom_fields${chk.sup ? ',places,absences' : ''}),scope.ov.${encodeURIComponent('{' + [...(chk.ids || []), ...(chk.stu || []), ...chk.hal, ...(chk.pl || [])].join(',') + '}')})` : '');
    const [got, tomb] = await Promise.all([fetchTables(want, f, chk), !scoped || chk.tables.includes('deleted') ? selectAll('sync_deleted', 'rev', tombF) : []]);
    lastChanged = false;
    for (const t of want) for (const r of got[t]) { raw[t].set(pkOf(t, r), r); lastChanged = true; if (t === 'members') notePhoto(r, true); }
    for (const d of tomb) { const m = raw[d.tbl]; if (m && m.delete(SYNC_TABLES[d.tbl].map(c => d.pk[c]).join('|'))) lastChanged = true; }
    since = backMinute(now);
  } else {
    const now = scoped ? chk.now : inc ? await rpc('sync_now') : null;
    const got = await fetchTables(tables, '', chk);
    raw = { role, hal: chk?.hal, stu: chk?.stu };
    for (const t of tables) { raw[t] = new Map(got[t].map(r => [pkOf(t, r), r])); if (t === 'members') got[t].forEach(r => notePhoto(r, false)); }
    since = now ? backMinute(now) : null;
    lastFull = Date.now(); lastChanged = true;
  }
  const rows = t => (raw[t] ? [...raw[t].values()] : []);
  const [settings, places, members, madm, halaqat, attendance, records, news, fields] = ['settings', 'places', 'members', 'member_admin', 'halaqat', 'attendance', 'records', 'news', 'custom_fields'].map(rows);
  const db = emptyDb();
  settings.forEach(s => { db.settings[s.key] = s.value; });
  db.places = places.map(p => ({ id: p.id, name: p.name, type: p.type, address: p.address || '' }));
  const adm = new Map(madm.map(a => [a.member_id, a.data]));
  members.forEach(m => {
    const base = { id: m.id, name: m.name, phone: m.phone || '', userId: m.user_id || null, hasLogin: !!m.login_email, extra: m.extra || {} };
    if (m.role === 'teacher') db.teachers.push({ ...base, personal: m.info?.personal || {}, tech: m.info?.tech || {}, admin: adm.get(m.id) || {} });
    else if (m.role === 'student') db.students.push({ ...base, halaqaId: m.halaqa_id || '', cat: m.cat || 'child', info: m.info || {}, hasPhoto: inc ? !!m.has_photo : !!m.photo, photo: photoCache.get(m.id) });
    else db[ROLE_COLL[m.role]].push(base);
  });
  db.halaqat = halaqat.map(h => ({ id: h.id, name: h.name || '', teacherId: h.teacher_id || '', supervisorId: h.supervisor_id || '', placeId: h.place_id || '', time: h.time || undefined }));
  db.attendance = attendance.map(a => ({ id: a.id, studentId: a.student_id, date: a.date, status: a.status }));
  db.records = records.map(r => ({ id: r.id, studentId: r.student_id, date: r.date, type: r.type, surah: r.surah, from: r.from_ayah, to: r.to_ayah, grade: r.grade || '', note: r.note || '' }));
  db.news = news.map(n => ({ id: n.id, text: n.text, audience: n.audience, date: n.date, author: n.author || '', authorId: n.author_id || '' }));
  fields.forEach(f => { (db.fields[f.kind] = db.fields[f.kind] || []).push({ key: f.key, label: f.label, type: f.type }); });
  if (role === 'admin') {
    const [ps, emps, prow, closed, abs, pend] = ['pay_settings', 'pay_employees', 'pay_rows', 'pay_closed', 'absences', 'pending_columns'].map(rows);
    db.pending = pend.map(p => ({ id: p.id, kind: p.kind, header: p.header, values: p.values || [], date: p.date }));
    db.fees = feeRows(rows('fees'));
    db.payroll = {
      settings: ps[0]?.data || {},
      employees: emps.map(e => ({ id: e.id, code: e.code || '', name: e.name, role: e.role || '', sys: e.sys || '', status: e.status, basic: e.basic, rate: e.rate, incentive: e.incentive, transport: e.transport, hours: e.hours, place: e.place || '', note: e.note || '' })),
      rows: prow.map(r => ({ id: r.id, y: r.y, m: r.m, eid: r.emp_id, name: r.name || '', role: r.role || '', base: r.base, extra: r.extra, exc: r.exc, absP: r.abs_p, absN: r.abs_n, mtgP: r.mtg_p, mtgN: r.mtg_n, dTest: r.d_test, dRec: r.d_rec, dBooks: r.d_books, basic: r.basic, rate: r.rate, incentive: r.incentive, transport: r.transport, note: r.note || '' })),
      closed: closed.map(c => c.y + '-' + c.m),
      absences: abs.map(absFromRow)
    };
  } else if (role === 'accountant') {
    db.fees = feeRows(rows('fees'));
    /* أسماء المعلمين والمشرفين لتسمية الحلقات فقط: تُجلب عند الجلب الكامل أو تغيّر الأعضاء */
    if (mode === 'full' || !raw.staffNames || !scoped || chk.tables.includes('members')) {
      try { raw.staffNames = (await rpc('staff_names')) || []; lastChanged = true; } catch (e) { raw.staffNames = raw.staffNames || []; }
    }
    raw.staffNames.forEach(m => { const c = db[ROLE_COLL[m.role]]; if (c && !c.some(x => x.id === m.id)) c.push({ id: m.id, name: m.name, phone: '', extra: {} }); });
  } else if (role === 'supervisor') {
    /* قائمة العاملين وشهر المرتبات الحالي: تُجلب عند الجلب الكامل أو إن تغيّرت فقط */
    if (mode === 'full' || !raw.extras || !scoped || chk.tables.includes('staff')) { raw.extras = await Promise.all([rpc('staff_list'), rpc('current_pay_month').catch(() => null)]); lastChanged = true; }
    const abs = rows('absences'), [staff, cur] = raw.extras;
    const c = Array.isArray(cur) ? cur[0] : cur;
    db.payroll = { settings: {}, employees: (staff || []).map(e => ({ id: e.id, code: e.code || '', name: e.name, place: e.place || '', status: e.status })), rows: [], closed: [], absences: abs.map(absFromRow), curMonth: c && c.y ? { y: c.y, m: c.m } : null, readOnly: true };
  }
  /* صلاحيات المستخدم (غير المدير) كما يحسبها الخادم: تُجلب عند الجلب الكامل أو تغيّر الإعدادات فقط */
  if (role !== 'admin') {
    if (mode === 'full' || !raw.perms || !scoped || chk.tables.includes('settings')) {
      let p = raw.perms || [];
      try { p = (await rpc('my_perms')) || []; } catch (e) { /* قبل تنفيذ perms.sql: بلا صلاحيات إضافية */ }
      if (JSON.stringify(p) !== JSON.stringify(raw.perms)) lastChanged = true;
      raw.perms = p;
    }
    db.myPerms = raw.perms;
  }
  if (mode !== 'none' || !snap) { snap = snapshotOf(db); saveLocal(db); }
  lastSync = new Date(); lastError = ''; emit();
  return db;
}
const feeRows = list => list.map(f => ({ id: f.id, studentId: f.student_id, y: f.y, m: f.m, amount: +f.amount, date: f.date || '', by: f.by_name || '', byMember: f.by_member || '', note: f.note || '' }));
const absFromRow = a => ({ id: a.id, y: a.y, m: a.m, date: a.date || '', eid: a.emp_id, name: a.name || '', place: a.place || '', perm: a.perm || '', reason: a.reason || '', proof: a.proof || '', note: a.note || '', by: a.by_name || '', byMember: a.by_member || '', ts: a.created_at });

/* ---------------- الإرسال: الفروق فقط ---------------- */
const ALLOWED = {
  admin: null, // الكل
  teacher: ['attendance', 'records'],
  supervisor: ['attendance', 'records', 'absences'],
  accountant: ['students', 'fees'],
  student: []
};
/* مقارنة لا تتأثر بترتيب الحقول: قاعدة البيانات تعيد ترتيب حقول JSON (مثل إعدادات المرتبات)،
   فلولا هذا لظنّ التطبيق أنها تغيّرت وأعاد إرسالها مع كل مزامنة. تُستخدم فقط حين يختلف النص الظاهر. */
const canon = v => (Array.isArray(v) ? '[' + v.map(canon).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}' : JSON.stringify(v === undefined ? null : v));
const sameRow = (prevJ, r) => { try { return canon(JSON.parse(prevJ)) === canon(JSON.parse(JSON.stringify(r))); } catch (e) { return false; } };
function diff(db) {
  const role = auth?.member?.role, allow = ALLOWED[role];
  const out = [];
  for (const gr of groups(db)) {
    if (allow && !allow.includes(gr.name)) continue;
    const prev = snap?.[gr.name] || {}, cur = {};
    const up = [];
    gr.rows.forEach(r => { const k = rowKey(gr.pk, r), j = JSON.stringify(r); cur[k] = j; if (prev[k] !== j && !(prev[k] && sameRow(prev[k], r))) up.push(r); });
    const del = Object.keys(prev).filter(k => !(k in cur));
    if (up.length || del.length) out.push({ ...gr, up, del, cur });
  }
  return out;
}
const pendingCount = db => (auth && snap && db ? diff(db).reduce((a, g) => a + g.up.length + g.del.length, 0) : 0);
function enc(v) { return '"' + String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'; }
async function doDelete(gr, keys) {
  for (let i = 0; i < keys.length; i += 100) {
    const part = keys.slice(i, i + 100);
    if (gr.pk.length === 1) await req(`/rest/v1/${gr.table}?${gr.pk[0]}=in.(${part.map(enc).join(',')})`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    else {
      const cond = part.map(k => { const vs = k.split('|'); return 'and(' + gr.pk.map((p, j) => `${p}.eq.${enc(vs[j])}`).join(',') + ')'; }).join(',');
      await req(`/rest/v1/${gr.table}?or=(${encodeURIComponent(cond)})`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    }
  }
}
async function push(db) {
  if (!auth || !snap) return;
  if (pushing) { again = true; return; }
  pushing = true; emit();
  try {
    const role = auth.member?.role;
    const ds = diff(db);
    for (const gr of ds) {
      /* صف يعرفه الخادم يُحدَّث بمعرّفه (ولو تغيّر صاحبه بالدمج)، والصف الجديد بمفتاحه الطبيعي (الموظف والشهر) */
      const prev = snap[gr.name] || {}, pk = gr.pk.join(',');
      const parts = [[gr.up.filter(r => rowKey(gr.pk, r) in prev), pk], [gr.up.filter(r => !(rowKey(gr.pk, r) in prev)), gr.conflict || pk]];
      for (const [list, conflict] of parts) for (let i = 0; i < list.length; i += 500) {
        await req(`/rest/v1/${gr.table}?on_conflict=${conflict}`, { method: 'POST', body: list.slice(i, i + 500), headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } });
      }
      gr.up.forEach(r => { snap[gr.name] = snap[gr.name] || {}; snap[gr.name][rowKey(gr.pk, r)] = JSON.stringify(r); });
    }
    /* الصور تُرسل وحدها وفقط إن تغيّرت فعلًا؛ وصورة لم تُحمَّل بعد لا تُمسح أبدًا */
    if (role === 'admin') for (const m of db.students || []) {
      if (m.photo === undefined) continue;
      const cur = m.photo || '', hv = hashStr(cur), known = photoSent.get(m.id);
      if (known === hv || (!cur && known === undefined)) continue;
      await req(`/rest/v1/members?id=eq.${m.id}`, { method: 'PATCH', body: { photo: cur || null }, headers: { Prefer: 'return=minimal' } });
      photoSent.set(m.id, hv); photoCache.set(m.id, cur);
    }
    for (const gr of ds.slice().reverse()) {
      if (gr.del.length) await doDelete(gr, gr.del);
      gr.del.forEach(k => { delete snap[gr.name][k]; });
    }
    // المعلم يعدّل بياناته الشخصية والفنية عبر دالة مخصّصة (لا يملك تعديل جدول الأعضاء)
    if (role === 'teacher') {
      const me = (db.teachers || []).find(t => t.id === auth.member.id);
      if (me) {
        const r = memberRow(me, 'teacher'), k = r.id, j = JSON.stringify(r);
        if (snap.staff && snap.staff[k] !== j) {
          await rpc('update_my_profile', { member: me.id, personal: me.personal || {}, tech: me.tech || {}, new_phone: me.phone || '' });
          snap.staff[k] = j;
        }
      }
    }
    persist(snapKey(), snap);
    lastSync = new Date(); lastError = '';
  } catch (e) {
    lastError = e.message || String(e);
    if (e instanceof HttpError && e.status >= 400 && e.status < 500 && e.status !== 401) {
      // رفض من الخادم (صلاحية أو قيد): نعيد تحميل الحقيقة من الخادم حتى لا تبقى نسخة متعارضة
      emit(); throw e;
    }
  } finally {
    pushing = false; emit();
    if (again) { again = false; schedule(db, 300); }
  }
}
function schedule(db, ms = 800) { clearTimeout(timer); timer = setTimeout(() => push(db).catch(err => onReject?.(err)), ms); }
let onReject = null;

/* ---------------- النسخة المحلية ---------------- */
const dbKey = () => 'qcloud_db_' + (auth?.uid || 'x');
const snapKey = () => 'qcloud_snap_' + (auth?.uid || 'x');
/* النسخة المحلية في «قاعدة بيانات المتصفح» (IndexedDB): سعتها مئات الميغابايت بدل 5 في التخزين العادي.
   إن لم تتوفر (بعض المتصفحات في الوضع الخاص) يُستخدم التخزين العادي كما كان.
   بعد أول حفظ ناجح تُحذف النسخة القديمة من التخزين العادي حتى لا تبقى نسختان متعارضتان. */
const IDB = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((ok, no) => {
    if (!window.indexedDB) { no(new Error('no indexedDB')); return; }
    const r = indexedDB.open('qulearn', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
  }));
  const tx = (mode, fn) => open().then(d => new Promise((ok, no) => {
    const t = d.transaction('kv', mode), q = fn(t.objectStore('kv'));
    t.oncomplete = () => ok(q.result); t.onerror = t.onabort = () => no(t.error);
  }));
  return { get: k => tx('readonly', s => s.get(k)), set: (k, v) => tx('readwrite', s => s.put(v, k)) };
})();
/* الكتابة بالترتيب، وكل مفتاح يُكتب بأحدث قيمة له (الضغطات المتتالية تُجمع في كتابة واحدة) */
const pendingW = new Map(); let writing = false;
function persist(k, v) { pendingW.set(k, v); if (!writing) flushW(); }
async function flushW() {
  writing = true;
  while (pendingW.size) {
    const [k, v] = pendingW.entries().next().value; pendingW.delete(k);
    try { await IDB.set(k, v); LS.del(k); } catch (e) { LS.set(k, v); }
  }
  writing = false;
}
function saveLocal(db) { persist(dbKey(), db); if (snap) persist(snapKey(), snap); }
/* قراءة فورية (للنسخ القديمة المحفوظة في التخزين العادي فقط) */
function cached() { if (!auth) return null; snap = LS.get(snapKey()); return LS.get(dbKey()); }
/* قراءة النسخة المحفوظة: من قاعدة بيانات المتصفح أولًا، ثم التخزين العادي */
async function loadLocal() {
  if (!auth) return null;
  try { const [d, s] = await Promise.all([IDB.get(dbKey()), IDB.get(snapKey())]); if (d) { snap = s || null; return d; } } catch (e) { /* يكمل بالتخزين العادي */ }
  return cached();
}
/* تكتمل قراءة النسخة المحفوظة قبل أي مزامنة، حتى لا يُستبدل ما سُجّل بدون إنترنت قبل إرساله */
const ready = loadLocal().catch(() => null);
async function publicSettings() {
  const rows = await req('/rest/v1/settings?select=key,value', { anon: true });
  const s = {}; (rows || []).forEach(r => { s[r.key] = r.value; }); return s;
}

window.Cloud = {
  get enabled() { return !!CFG.url; },
  get signedIn() { return !!auth; },
  get auth() { return auth; },
  get busy() { return pushing; },
  get lastError() { return lastError; },
  get lastSync() { return lastSync; },
  cfg: CFG, uuid, isUuid, ensureUuids, emptyDb, snapshotOf,
  signIn, signOut, lookup, setMember, pull, push, schedule, pendingCount, cached, saveLocal, loadLocal, ready, publicSettings,
  provision, fn, rpc, req, selectAll,
  get lastChanged() { return lastChanged; },
  get incremental() { return inc; },
  get feesReady() { return feesOk; },
  photoOf: id => photoCache.get(id),
  /* تنزيل صور أعضاء محددين عند الحاجة (40 صورة في الطلب) */
  async loadPhotos(ids) {
    const need = [...new Set(ids)].filter(id => isUuid(id) && !photoCache.has(id));
    for (let i = 0; i < need.length; i += 40) {
      const part = need.slice(i, i + 40);
      const got = await req(`/rest/v1/members?select=id,photo&id=in.(${part.join(',')})`);
      (got || []).forEach(r => { photoCache.set(r.id, r.photo || ''); photoSent.set(r.id, hashStr(r.photo || '')); });
      part.forEach(id => { if (!photoCache.has(id)) { photoCache.set(id, ''); photoSent.set(id, hashStr('')); } });
    }
  },
  set onReject(f) { onReject = f; },
  on: f => { listeners.add(f); return () => listeners.delete(f); },
  /* لاختبار ربط حساب جديد بالدخول دون المساس بجلسة الإداري */
  async testSignIn(email, password) {
    const r = await fetch(`${CFG.url}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: CFG.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new HttpError(r.status, j.error_description || j.msg || 'تعذّر الدخول');
    return j;
  }
};
})();
