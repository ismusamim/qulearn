'use strict';
/* ============ توزيع الصلاحيات (للمدير) ============
   - جدول بكل مهام التطبيق: الأساسية لكل فئة، والخاصة بالمدير، والقابلة للتوزيع.
   - الصلاحيات القابلة للتوزيع تُمنح لفئة كاملة أو لشخص بعينه من زر «+ إضافة صلاحية»، واستثناء الفرد يتقدّم على فئته.
   - الإعدادات في db.settings.priv_perms (لا يقرؤها على الخادم إلا المدير)، والتحقق الفعلي على الخادم بالدالة has_perm.
   - كل صلاحية جديدة تُعرَّف بـ Perms.define({ key, label, desc, group, defaults }) ومعها قاعدتها على الخادم.
   - الحسابات الموقوفة: الطالب «منقطع» والمعلم «موقوف» يرى عند الدخول صفحة بيضاء برسالة يحررها المدير من «الإعدادات». */
(() => {
  const DEFS = [];
  const ROLE_COLS = [['teacher', 'المعلمون', 'teachers'], ['supervisor', 'المشرفون', 'supervisors'], ['accountant', 'المحاسبون', 'accountants']];
  /* مهام التطبيق الثابتة: [المجموعة، المهمة، الفئات التي تملكها أساسًا] — وما لا فئة له فهو للمدير فقط */
  const FIXED = [
    ['الحلقات والطلاب', 'تسجيل حضور طلاب حلقاته', ['teacher', 'supervisor']],
    ['الحلقات والطلاب', 'تسجيل التسميع وسجل الطالب', ['teacher', 'supervisor']],
    ['الحلقات والطلاب', 'تعديل استمارة الطالب كاملة وحذفه', []],
    ['الحلقات والطلاب', 'الأماكن والحلقات (إضافة وتعديل وحذف)', []],
    ['المعلمون والعاملون', 'تعديل ملفه الشخصي والفني', ['teacher']],
    ['المعلمون والعاملون', 'تسجيل غياب المعلمين', ['supervisor']],
    ['المعلمون والعاملون', 'بيانات المعلمين الإدارية', []],
    ['المعلمون والعاملون', 'المرتبات وكشوفها', []],
    ['الحسابات والإدارة', 'الأعضاء وحسابات الدخول وكلمات المرور', []],
    ['الحسابات والإدارة', 'الفئات والخصومات', []],
    ['الحسابات والإدارة', 'نشر الإعلانات', []],
    ['الحسابات والإدارة', 'الاستيراد والبيانات المعلّقة', []],
    ['الحسابات والإدارة', 'الصلاحيات والإعدادات والنسخ الاحتياطي', []]
  ];
  const BLOCK_DEF = {
    student: 'عذرًا، حسابك موقوف حاليًا لانقطاعك عن الحلقة.\nللعودة يُرجى التواصل مع إدارة التحفيظ.',
    teacher: 'عذرًا، حسابك موقوف حاليًا.\nيُرجى التواصل مع إدارة التحفيظ.'
  };
  const st = { q: '' };

  TABS.admin.splice(TABS.admin.findIndex(t => t[0] === 'settings'), 0, ['perms', 'الصلاحيات']);
  TAB_ICONS.perms = svg('<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15.5" r="1.4"/>');
  adminViews.perms = () => view();
  setTimeout(() => { try { if (!VFILES.includes('./perms.js')) VFILES.push('./perms.js'); } catch (e) { /* ignore */ } }, 0);

  const cfg = () => { const c = db.settings.priv_perms || {}; return { roles: c.roles || {}, members: c.members || {} }; };
  const setCfg = c => { db.settings.priv_perms = { roles: c.roles, members: c.members }; save(); };
  const staff = () => ROLE_COLS.flatMap(([r, , coll]) => (db[coll] || []).map(m => ({ m, role: r })));
  const roleL = r => ({ teacher: 'معلم', supervisor: 'مشرف', accountant: 'محاسب' })[r] || r;
  /* صلاحية الفئة: اختيار المدير إن وُجد، وإلا الافتراضي المعرَّف مع الصلاحية (مثل صلاحيات المحاسب) */
  const roleHas = (c, r, p) => { const v = (c.roles[r] || {})[p]; return v !== undefined ? !!v : !!DEFS.find(d => d.key === p)?.defaults?.includes(r); };
  const personHas = (c, id, r, p) => { const o = (c.members[id] || {})[p]; return o !== undefined ? !!o : roleHas(c, r, p); };

  /* هل يملك المستخدم الحالي الصلاحية؟ المدير دائمًا؛ وغيره بحسب ما أرسله الخادم */
  function can(p) {
    if (!session) return false;
    if (session.role === 'admin') return true;
    if (!CLOUD) return personHas(cfg(), session.id, session.role, p);
    return (db.myPerms || []).includes(p);
  }

  /* ===== قسم الصلاحيات ===== */
  function view() {
    const c = cfg();
    const yes = '<span class="tag tag-ok" title="أساسية لهذه الفئة">أساسية</span>', no = '<span class="muted">—</span>';
    const groups = [...new Set([...FIXED.map(f => f[0]), ...DEFS.map(d => d.group || 'صلاحيات قابلة للتوزيع')])];
    const rows = groups.map(g => {
      const fixed = FIXED.filter(f => f[0] === g).map(([, label, base]) => `<tr><td>${esc(label)}</td>${ROLE_COLS.map(([r]) => `<td style="text-align:center">${base.includes(r) ? yes : no}</td>`).join('')}<td style="text-align:center">${base.length ? '<small class="muted">ثابتة</small>' : '<span class="tag">للمدير فقط</span>'}</td></tr>`).join('');
      const dist = DEFS.filter(d => (d.group || 'صلاحيات قابلة للتوزيع') === g).map(d => `<tr><td><b>${esc(d.label)}</b>${d.desc ? `<br><small class="muted">${esc(d.desc)}</small>` : ''}</td>${ROLE_COLS.map(([r, l]) => `<td style="text-align:center"><input type="checkbox" data-prole="${r}" data-perm="${esc(d.key)}" ${roleHas(c, r, d.key) ? 'checked' : ''} aria-label="${esc(d.label)} — ${l}"></td>`).join('')}<td style="text-align:center"><small class="muted">قابلة للتوزيع</small></td></tr>`).join('');
      return `<tr class="sum"><td colspan="${ROLE_COLS.length + 2}">${esc(g)}</td></tr>${fixed}${dist}`;
    }).join('');
    const ids = Object.keys(c.members), people = staff();
    const exRows = ids.map(id => {
      const p = people.find(x => x.m.id === id); if (!p) return '';
      const own = Object.entries(c.members[id] || {});
      return `<tr><td><b>${esc(p.m.name)}</b><br><small class="muted">${roleL(p.role)}</small></td>
        <td>${own.length ? own.map(([k, v]) => `<span class="tag ${v ? 'tag-ok' : 'tag-no'}">${v ? '+' : '−'} ${esc(DEFS.find(d => d.key === k)?.label || k)}</span>`).join(' ') : '<span class="muted">حسب فئته</span>'}</td>
        <td><button type="button" class="btn sm" data-pedit="${esc(id)}">تعديل</button><button type="button" class="btn sm danger" data-pclear="${esc(id)}">إلغاء الاستثناء</button></td></tr>`;
    }).join('');
    return `<div class="card"><div class="bar"><h2 class="grow" style="margin:0">مهام التطبيق والصلاحيات</h2><button type="button" class="btn primary" data-padd-open>+ إضافة صلاحية</button></div>
        <p class="muted" style="font-size:.85rem;margin:0 0 .6rem">«أساسية» تملكها الفئة دائمًا، و«للمدير فقط» لا تُمنح لغيره حاليًا، والمربعات صلاحيات قابلة للتوزيع على الفئة كلها. المدير يملك كل المهام دائمًا، والخادم يتحقق من كل صلاحية.</p>
        <div class="tbl"><table><tr><th>المهمة</th>${ROLE_COLS.map(([, l]) => `<th style="text-align:center">${l}</th>`).join('')}<th style="text-align:center">النوع</th></tr>${rows}</table></div></div>
      <div class="card"><h2>صلاحيات خاصة بأفراد</h2>
        <p class="muted" style="font-size:.85rem;margin:0 0 .6rem">تتقدّم على صلاحيات فئة الشخص: «+» ممنوحة له، و«−» مسحوبة منه.</p>
        ${exRows ? `<div class="tbl"><table><tr><th>الشخص</th><th>الصلاحيات الخاصة</th><th></th></tr>${exRows}</table></div>` : '<p class="muted">لا توجد صلاحيات خاصة بأفراد. أضفها من زر «+ إضافة صلاحية».</p>'}</div>`;
  }

  /* ===== نافذة «إضافة صلاحية»: لفئة كاملة أو لشخص بعينه ===== */
  function addDialog(presetId) {
    if (!DEFS.length) { toast('لا توجد صلاحيات قابلة للتوزيع بعد'); return; }
    const people = staff();
    let target = presetId ? { kind: 'person', id: presetId } : { kind: 'role', id: 'teacher' };
    const ov = document.createElement('div'); ov.className = 'overlay';
    const draw = () => {
      const c = cfg(), p = target.kind === 'person' ? people.find(x => x.m.id === target.id) : null;
      const has = k => (target.kind === 'role' ? roleHas(c, target.id, k) : p ? personHas(c, p.m.id, p.role, k) : false);
      const q = norm(st.q), cand = q ? people.filter(x => norm(x.m.name).includes(q)).slice(0, 8) : [];
      ov.innerHTML = `<div class="modal wide"><h2>إضافة صلاحية</h2>
        <div class="bar" style="margin:0 0 .6rem"><button type="button" class="btn ${target.kind === 'role' ? 'on' : ''}" data-tk="role">لفئة كاملة</button><button type="button" class="btn ${target.kind === 'person' ? 'on' : ''}" data-tk="person">لشخص بعينه</button></div>
        ${target.kind === 'role'
          ? `<label>الفئة<select data-trole>${ROLE_COLS.map(([r, l]) => `<option value="${r}" ${target.id === r ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`
          : `<div class="combo"><label>الشخص<input type="search" data-tq value="${esc(p ? p.m.name : st.q)}" placeholder="اكتب اسم معلم أو مشرف أو محاسب" autocomplete="off"></label>
              ${!p && cand.length ? `<div class="results" style="position:static">${cand.map(x => `<button type="button" class="opt" data-tpick="${esc(x.m.id)}">${esc(x.m.name)} <small class="muted">— ${roleL(x.role)}</small></button>`).join('')}</div>` : ''}</div>
             ${p ? `<p class="muted" style="margin:.3rem 0">${esc(p.m.name)} — ${roleL(p.role)} <button type="button" class="btn sm" data-tclear>تغيير</button></p>` : ''}`}
        ${target.kind === 'role' || p ? `<div class="lbl-s" style="margin-top:.6rem">الصلاحيات</div>
          ${DEFS.map(d => `<label class="chk"><input type="checkbox" data-tperm="${esc(d.key)}" ${has(d.key) ? 'checked' : ''}> <span><b>${esc(d.label)}</b>${d.desc ? ` <small class="muted">${esc(d.desc)}</small>` : ''}${p && (c.members[p.m.id] || {})[d.key] === undefined ? ' <small class="muted">(حسب فئته)</small>' : ''}</span></label>`).join('')}` : ''}
        <div class="row"><button type="button" class="btn primary" data-tsave ${target.kind === 'person' && !p ? 'disabled' : ''}>حفظ</button><button type="button" class="btn" data-close>إلغاء</button></div></div>`;
    };
    draw(); document.body.appendChild(ov);
    ov.addEventListener('click', e => {
      const t = e.target;
      if (t.closest('[data-close]')) { ov.remove(); return; }
      const k = t.closest('[data-tk]'); if (k) { target = k.dataset.tk === 'role' ? { kind: 'role', id: 'teacher' } : { kind: 'person', id: '' }; st.q = ''; draw(); return; }
      const pk = t.closest('[data-tpick]'); if (pk) { target.id = pk.dataset.tpick; st.q = ''; draw(); return; }
      if (t.closest('[data-tclear]')) { target.id = ''; draw(); return; }
      if (t.closest('[data-tsave]')) {
        const c = cfg(), boxes = [...ov.querySelectorAll('[data-tperm]')];
        if (target.kind === 'role') {
          c.roles = { ...c.roles, [target.id]: { ...(c.roles[target.id] || {}), ...Object.fromEntries(boxes.map(b => [b.dataset.tperm, b.checked])) } };
        } else {
          const p = people.find(x => x.m.id === target.id); if (!p) return;
          const m = { ...(c.members[p.m.id] || {}) };
          /* يُحفظ للشخص فقط ما يخالف فئته، فإن تغيّرت صلاحية الفئة لاحقًا تبعها في الباقي */
          boxes.forEach(b => { const k2 = b.dataset.tperm; if (b.checked === roleHas(c, p.role, k2)) delete m[k2]; else m[k2] = b.checked; });
          c.members = { ...c.members, [p.m.id]: m };
        }
        setCfg(c); ov.remove(); render(); toast('حُفظت الصلاحيات');
      }
    });
    ov.addEventListener('change', e => { if (e.target.matches('[data-trole]')) { target.id = e.target.value; draw(); } });
    ov.addEventListener('input', e => {
      if (!e.target.matches('[data-tq]')) return;
      st.q = e.target.value; target.id = ''; draw();
      const i = ov.querySelector('[data-tq]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
    });
  }

  document.addEventListener('change', e => {
    const t = e.target, d = t.dataset || {};
    /* يُحفظ الاختيار صريحًا (مسموح أو ممنوع) حتى يمكن سحب صلاحية افتراضية */
    if (d.prole) { const c = cfg(); c.roles = { ...c.roles, [d.prole]: { ...(c.roles[d.prole] || {}), [d.perm]: t.checked } }; setCfg(c); render(); toast('حُفظ'); }
  });
  document.addEventListener('click', e => {
    if (e.target.closest('[data-padd-open]')) { addDialog(); return; }
    const ed = e.target.closest('[data-pedit]'); if (ed) { addDialog(ed.dataset.pedit); return; }
    const x = e.target.closest('[data-pclear]');
    if (x) { const c = cfg(), m = { ...c.members }; delete m[x.dataset.pclear]; c.members = m; setCfg(c); render(); toast('أُلغي الاستثناء'); return; }
    const bs = e.target.closest('[data-bsave]');
    if (bs) {
      const v = k => (document.querySelector(`[data-bmsg="${k}"]`)?.value || '').trim();
      db.settings.block_msgs = { student: v('student'), teacher: v('teacher') }; save(); toast('حُفظت الرسائل');
    }
  });

  /* ===== الحسابات الموقوفة: صفحة بيضاء برسالة بدل التطبيق ===== */
  const blockedRole = () => {
    if (!session) return '';
    const m = me(); if (!m) return '';
    if (session.role === 'student' && stOff(m)) return 'student';
    if (session.role === 'teacher' && (m.admin || {}).status === 'موقوف') return 'teacher';
    return '';
  };
  const msgOf = r => ((db.settings.block_msgs || {})[r] || BLOCK_DEF[r]);
  const baseRender = render;
  render = function () {
    const r = blockedRole();
    if (!r) { baseRender(); return; }
    $app.innerHTML = `<div style="position:fixed;inset:0;background:#fff;display:flex;align-items:center;justify-content:center;padding:1.5rem;z-index:5">
      <div style="max-width:460px;text-align:center"><img src="${logoSrc()}" alt="" style="width:96px;height:96px;object-fit:contain;margin-bottom:1rem">
        <h2 style="margin:0 0 .4rem">${esc(db.settings.org || '')}</h2>
        <p style="white-space:pre-wrap;line-height:1.9;font-size:1.05rem;color:#1a2333">${esc(msgOf(r))}</p>
        <button type="button" class="btn" data-act="logout" style="margin-top:1rem">خروج</button></div></div>`;
  };
  /* بطاقة الرسائل في «الإعدادات» */
  const baseSettings = adminViews.settings;
  adminViews.settings = () => baseSettings() + `<div class="card"><h2>رسائل الحسابات الموقوفة</h2>
    <p class="muted" style="font-size:.85rem;margin:0 0 .6rem">تظهر في صفحة بيضاء بدل التطبيق عند دخول صاحب الحساب الموقوف. الطالب يُوقف بجعله «منقطع»، والمعلم بجعل حالته «موقوف» من «المعلمون ← إدارية».</p>
    <label>رسالة الطالب المنقطع<textarea data-bmsg="student" rows="3">${esc(msgOf('student'))}</textarea></label>
    <label>رسالة المعلم الموقوف<textarea data-bmsg="teacher" rows="3">${esc(msgOf('teacher'))}</textarea></label>
    <div class="row"><button type="button" class="btn primary" data-bsave>حفظ الرسائل</button></div></div>`;

  window.Perms = {
    /* تعريف صلاحية قابلة للتوزيع: { key, label, desc, group, defaults: [الفئات التي تملكها افتراضيًا] } */
    define(def) { if (def?.key && !DEFS.some(x => x.key === def.key)) DEFS.push(def); },
    get list() { return DEFS.slice(); },
    can
  };
})();
