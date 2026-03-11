// ===== CONFIG =====
const _cfg = window.__CONFIG__ || {};
const API  = _cfg.API_URL || (window.location.hostname === 'localhost'
  ? 'http://localhost:5000'
  : 'https://e-comerce-bot-main-production.up.railway.app');

let token = localStorage.getItem('saToken');

// ===== HELPERS =====
function $(id) { return document.getElementById(id); }

function toast(msg, type = 'ok') {
  const box = $('saToasts');
  const el  = document.createElement('div');
  const bg  = type === 'ok' ? 'bg-green-500' : type === 'err' ? 'bg-red-500' : 'bg-blue-500';
  el.className = `${bg} text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-xl`;
  el.style.cssText = 'animation:toastIn .3s ease;min-width:160px';
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => { el.style.opacity='0'; el.style.transition='opacity .3s'; setTimeout(()=>el.remove(),300); }, 3000);
}

function fmtSalary(n) {
  return Number(n||0).toLocaleString('uz-UZ') + ' soʼm';
}

function authHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };
}

async function api(url, opts = {}) {
  try {
    const r = await fetch(API + url, { method: opts.method||'GET', headers: authHeaders(), body: opts.body });
    if (r.status === 401) { logout(); return { error: 'Sessiya tugadi' }; }
    return await r.json();
  } catch(e) { return { error: e.message }; }
}

function closeRestModal()  { $('restModal').classList.add('hidden'); }
function closeBlockModal() { $('blockModal').classList.add('hidden'); }

// ===== AUTH =====
async function doLogin() {
  const username = $('sUsername').value.trim();
  const password = $('sPassword').value;
  const err = $('sErr');
  err.classList.add('hidden');
  if (!username || !password) { err.textContent = 'Login va parol kiriting'; err.classList.remove('hidden'); return; }

  try {
    const d = await fetch(API + '/superadmin/login', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ username, password })
    }).then(r => r.json());

    if (!d.ok) { err.textContent = '❌ ' + (d.error||'Xato'); err.classList.remove('hidden'); return; }

    token = d.token;
    localStorage.setItem('saToken', token);
    startApp();
  } catch(e) {
    err.textContent = '🔌 Server bilan ulanib bolmadi';
    err.classList.remove('hidden');
  }
}

function logout() {
  localStorage.removeItem('saToken');
  token = null;
  $('app').classList.add('hidden');
  $('loginPage').style.display = 'flex';
}

function startApp() {
  $('loginPage').style.display = 'none';
  $('app').classList.remove('hidden');
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    $('saUsername').textContent = '@' + (payload.username || '');
  } catch(e) {}
  showTab('stats');
}

if (token) startApp();

// ===== TABS =====
function showTab(name) {
  ['stats','restaurants'].forEach(t => {
    $('tab-' + t)?.classList.add('hidden');
  });
  $('tab-' + name)?.classList.remove('hidden');

  document.querySelectorAll('[data-tab]').forEach(b => {
    b.classList.toggle('nav-active', b.dataset.tab === name);
    b.classList.toggle('text-gray-400', b.dataset.tab !== name);
  });

  const titles = { stats:'Statistika', restaurants:'Restoranlar' };
  $('pageTitle') && ($('pageTitle').textContent = titles[name]||name);
  $('mobileTitle') && ($('mobileTitle').textContent = titles[name]||name);

  if (name === 'stats')       loadStats();
  if (name === 'restaurants') loadRestaurants();
}

// ===== STATS =====
async function loadStats() {
  const d = await api('/superadmin/stats');
  if (!d || d.error) return;

  $('st-rests').textContent      = d.totalRestaurants;
  $('st-todayOrders').textContent = d.todayOrders;
  $('st-monthRev').textContent   = Number(d.monthRevenue||0).toLocaleString() + ' soʼm';
  $('st-users').textContent      = d.totalUsers;

  const el = $('perRestChart');
  if (!el || !d.perRestaurant?.length) return;
  const max = Math.max(...d.perRestaurant.map(r=>r.count), 1);
  el.innerHTML = d.perRestaurant.map(r => {
    const pct = Math.round(r.count/max*100);
    return `
    <div>
      <div class="flex justify-between text-xs mb-1">
        <span class="font-bold text-white">${r._id}</span>
        <span class="text-gray-400">${r.count} ta · ${Number(r.revenue||0).toLocaleString()} soʼm</span>
      </div>
      <div class="h-2 bg-bg3 rounded-full"><div class="h-full bg-accent rounded-full" style="width:${pct}%"></div></div>
    </div>`;
  }).join('');
}

// ===== RESTAURANTS =====
async function loadRestaurants() {
  const list = await api('/superadmin/restaurants');
  if (!Array.isArray(list)) return;
  const el = $('restList');
  if (!el) return;

  el.innerHTML = list.map(r => `
    <div class="bg-card rounded-2xl p-4 border ${r.blocked ? 'border-red-500/30' : 'border-white/5'}">
      <div class="flex items-start justify-between gap-2 mb-3">
        <div>
          <div class="flex items-center gap-2">
            <p class="font-black text-white text-sm">${r.restaurantName}</p>
            <span class="text-xs px-2 py-0.5 rounded-full ${r.blocked ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}">${r.blocked?'🔒 Bloklangan':'✅ Faol'}</span>
          </div>
          <p class="text-xs text-gray-500 mt-0.5">ID: ${r.restaurantId} · @${r.username}</p>
          ${r.blockReason ? `<p class="text-xs text-red-400 mt-0.5">📌 ${r.blockReason}</p>` : ''}
        </div>
        <div class="text-right shrink-0">
          <p class="text-xs text-gray-500">Bugun: <span class="font-black text-white">${r.todayOrders||0}</span></p>
          <p class="text-xs text-gray-500">Jami: <span class="font-black text-gray-300">${r.totalOrders||0}</span></p>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2 mb-3 text-xs text-gray-500">
        ${r.phone ? `<span>📞 ${r.phone}</span>` : ''}
        ${r.address ? `<span>📍 ${r.address}</span>` : ''}
        ${r.botToken ? `<span>🤖 Bot: ...${r.botToken.slice(-8)}</span>` : '<span class="text-yellow-400">⚠️ Bot token yoq</span>'}
        ${r.webappUrl ? `<a href="${r.webappUrl}" target="_blank" class="text-accent truncate">🌐 WebApp</a>` : ''}
      </div>

      <div class="flex gap-2 flex-wrap">
        <button onclick="openRestModal('${r._id}')" class="press flex-1 py-2 rounded-xl bg-accent/10 text-accent text-xs font-bold border border-accent/20">✏️ Tahrir</button>
        ${r.blocked
          ? `<button onclick="unblockRest('${r._id}')" class="press px-3 py-2 rounded-xl bg-green-500/10 text-green-400 text-xs font-bold border border-green-500/20">🔓 Ochish</button>`
          : `<button onclick="openBlockModal('${r.restaurantId}','${r._id}')" class="press px-3 py-2 rounded-xl bg-red-500/10 text-red-400 text-xs font-bold border border-red-500/20">🔒 Bloklash</button>`}
        <button onclick="deleteRest('${r._id}')" class="press px-3 py-2 rounded-xl bg-red-500/10 text-red-400 text-xs font-bold">🗑</button>
      </div>
    </div>`).join('') || `<div class="text-center py-12 text-gray-500">Restoranlar yo'q</div>`;
}

// ===== RESTAURANT MODAL =====
async function openRestModal(editId) {
  // editId berilsa — mavjud restoranni tahrirlash
  if (editId && editId !== 'undefined') {
    const list = await api('/superadmin/restaurants');
    const r = Array.isArray(list) ? list.find(x => x._id === editId) : null;
    if (r) {
      $('restModalTitle').textContent = 'Tahrirlash: ' + r.restaurantName;
      $('rRestName').value  = r.restaurantName || '';
      $('rRestId').value    = r.restaurantId   || '';
      $('rRestId').disabled = true; // restaurantId o'zgartirib bo'lmaydi
      $('rUsername').value  = r.username   || '';
      $('rPassword').value  = '';
      $('rBotToken').value  = r.botToken   || '';
      $('rChefId').value    = r.chefId     || '';
      $('rPhone').value     = r.phone      || '';
      $('rAddress').value   = r.address    || '';
      $('rWebappUrl').value = r.webappUrl  || '';
      $('rEditId').value    = r._id;
    }
  } else {
    $('restModalTitle').textContent = 'Yangi restoran';
    ['rRestName','rRestId','rUsername','rPassword','rBotToken','rChefId','rPhone','rAddress','rWebappUrl'].forEach(id => { $(id).value = ''; });
    const rIdEl = $('rRestId'); if (rIdEl) rIdEl.disabled = false;
    $('rEditId').value = '';
  }
  $('rErr').classList.add('hidden');
  $('restModal').classList.remove('hidden');
}

async function saveRestaurant() {
  const id      = $('rEditId').value;
  const errEl   = $('rErr');
  errEl.classList.add('hidden');

  const body = {
    restaurantName: $('rRestName').value.trim(),
    restaurantId:   $('rRestId').value.trim().toLowerCase(),
    username:       $('rUsername').value.trim(),
    botToken:       $('rBotToken').value.trim(),
    chefId:         Number($('rChefId').value) || 0,
    phone:          $('rPhone').value.trim(),
    address:        $('rAddress').value.trim(),
    webappUrl:      $('rWebappUrl').value.trim(),
  };
  const password = $('rPassword').value;
  if (password) body.password = password;

  if (!body.restaurantName) { errEl.textContent = 'Restoran nomi kerak'; errEl.classList.remove('hidden'); return; }
  if (!id && !body.restaurantId) { errEl.textContent = 'RestaurantID kerak'; errEl.classList.remove('hidden'); return; }
  if (!id && !body.username) { errEl.textContent = 'Admin login kerak'; errEl.classList.remove('hidden'); return; }
  if (!id && !password) { errEl.textContent = 'Admin parol kerak'; errEl.classList.remove('hidden'); return; }

  const d = id
    ? await api('/superadmin/restaurants/' + id, { method:'PUT',  body: JSON.stringify(body) })
    : await api('/superadmin/restaurants',        { method:'POST', body: JSON.stringify(body) });

  if (d?.error) { errEl.textContent = d.error; errEl.classList.remove('hidden'); return; }

  closeRestModal();
  loadRestaurants();
  toast(id ? 'Yangilandi ✓' : 'Restoran yaratildi ✓');
}

// ===== BLOCK/UNBLOCK =====
function openBlockModal(restaurantId, adminId) {
  $('blockModalTitle').textContent = 'Bloklash';
  $('blockReason').value  = '';
  $('blockRestId').value  = restaurantId;
  $('blockAdminId').value = adminId;
  $('blockModal').classList.remove('hidden');
}

async function confirmBlock() {
  const reason  = $('blockReason').value.trim() || 'Sabab ko\'rsatilmagan';
  const adminId = $('blockAdminId').value;
  const d = await api('/superadmin/restaurants/' + adminId, {
    method: 'PUT', body: JSON.stringify({ active: false, blockReason: reason })
  });
  if (d?.ok) { closeBlockModal(); loadRestaurants(); toast('Bloklandi 🔒'); }
  else toast(d?.error || 'Xato', 'err');
}

async function unblockRest(adminId) {
  const d = await api('/superadmin/restaurants/' + adminId, {
    method: 'PUT', body: JSON.stringify({ active: true, blockReason: '' })
  });
  if (d?.ok) { loadRestaurants(); toast('Blok olib tashlandi 🔓'); }
  else toast(d?.error||'Xato', 'err');
}

async function deleteRest(adminId) {
  if (!confirm('Restoranni o\'chirasizmi? Bu amalni qaytarib bo\'lmaydi!')) return;
  const d = await api('/superadmin/restaurants/' + adminId, { method:'DELETE' });
  if (d?.ok) { loadRestaurants(); toast('O\'chirildi'); }
  else toast(d?.error||'Xato', 'err');
}