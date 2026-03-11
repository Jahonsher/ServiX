// ===== CONFIG =====
const _cfg = window.__CONFIG__ || {};
const API  = _cfg.API_URL || (window.location.hostname === 'localhost'
  ? 'http://localhost:5000'
  : 'https://e-comerce-bot-main-production.up.railway.app');
const RESTAURANT_ID = _cfg.RESTAURANT_ID || 'imperial';

let allProducts  = [];
let cart         = [];
let telegramUser = null;
let userProfile  = null;
let orderType    = null;
let currentCat   = 'all';

// ===== TOAST =====
function toast(msg, type = 'ok') {
  const box  = document.getElementById('toasts');
  const el   = document.createElement('div');
  const bg   = type === 'ok' ? 'bg-green-500' : type === 'err' ? 'bg-red-500' : 'bg-blue-500';
  el.className = `${bg} text-white text-sm font-bold px-4 py-3 rounded-2xl shadow-xl`;
  el.style.cssText = 'animation:toastIn .3s ease;min-width:160px;max-width:260px';
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, 3000);
}

// ===== BLOCKED =====
function showBlocked(reason) {
  document.getElementById('blockedReason').textContent = reason || '';
  document.getElementById('blockedScreen').classList.remove('hidden');
}

// ===== INIT =====
async function init() {
  // Blok tekshiruv
  try {
    const bd = await fetch(API + '/check-block/' + RESTAURANT_ID).then(r => r.json());
    if (bd.blocked) { showBlocked(bd.reason); return; }
  } catch(e) {}

  // Telegram init
  const tg = window.Telegram?.WebApp;
  if (tg && tg.initDataUnsafe?.user) {
    tg.expand();
    tg.setHeaderColor && tg.setHeaderColor('#0d0d0d');
    tg.setBackgroundColor && tg.setBackgroundColor('#0d0d0d');
    telegramUser = tg.initDataUnsafe.user;
    // Auth
    try {
      await fetch(API + '/auth', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ id: telegramUser.id, first_name: telegramUser.first_name||'', last_name: telegramUser.last_name||'', username: telegramUser.username||'', restaurantId: RESTAURANT_ID })
      });
      userProfile = await fetch(API + '/user/' + telegramUser.id + '?restaurantId=' + RESTAURANT_ID).then(r => r.json());
      renderProfileUI();
    } catch(e) {}
  } else {
    document.getElementById('tgWarn').classList.remove('hidden');
    return;
  }

  loadCategories();
  loadProducts();
}

init();

// ===== CATEGORIES =====
async function loadCategories() {
  try {
    const cats = await fetch(API + '/categories?restaurantId=' + RESTAURANT_ID).then(r => r.json());
    const tabs = document.getElementById('catTabs');
    tabs.innerHTML = `<button class="tab-active shrink-0 px-4 py-1.5 rounded-full text-xs font-bold bg-bg3 text-gray-400" onclick="filterCat('all',this)">🍽 Barchasi</button>`;
    cats.forEach(c => {
      const b = document.createElement('button');
      b.className = 'shrink-0 px-4 py-1.5 rounded-full text-xs font-bold bg-bg3 text-gray-400 transition-all';
      b.onclick = () => filterCat(c.name, b);
      b.textContent = (c.emoji || '') + ' ' + c.name;
      tabs.appendChild(b);
    });
  } catch(e) {}
}

// ===== PRODUCTS =====
async function loadProducts() {
  try {
    allProducts = await fetch(API + '/products?restaurantId=' + RESTAURANT_ID).then(r => r.json());
    renderGrid(allProducts);
  } catch(e) {
    document.getElementById('grid').innerHTML = `<div class="col-span-2 text-center py-16 text-gray-500">Xato yuz berdi</div>`;
  }
}

function filterCat(cat, btn) {
  currentCat = cat;
  document.querySelectorAll('#catTabs button').forEach(b => {
    b.classList.remove('tab-active');
    b.classList.add('text-gray-400', 'bg-bg3');
    b.classList.remove('text-white');
  });
  btn.classList.add('tab-active');
  btn.classList.remove('text-gray-400');
  const list = cat === 'all' ? allProducts : allProducts.filter(p => p.category === cat);
  renderGrid(list);
}

function renderGrid(list) {
  const grid = document.getElementById('grid');
  if (!list.length) {
    grid.innerHTML = `<div class="col-span-2 text-center py-16 text-gray-500 text-sm">Mahsulotlar yo'q</div>`;
    return;
  }
  grid.innerHTML = list.map(p => {
    const item = cart.find(c => c.id === p.id);
    const qty  = item ? item.quantity : 0;
    return `
    <div class="fade-in bg-card rounded-2xl overflow-hidden border border-white/5 flex flex-col">
      <div class="relative">
        ${p.image
          ? `<img src="${p.image}" alt="${p.name}" class="w-full h-32 object-cover"/>`
          : `<div class="w-full h-32 bg-bg3 flex items-center justify-center text-5xl">🍽</div>`}
        ${qty > 0 ? `<div class="absolute top-2 right-2 w-6 h-6 bg-accent rounded-full flex items-center justify-center text-white text-xs font-black">${qty}</div>` : ''}
      </div>
      <div class="p-3 flex flex-col flex-1 justify-between">
        <div>
          <p class="font-bold text-white text-xs leading-snug mb-1 line-clamp-2">${p.name}</p>
          <p class="font-black text-accent text-sm">${Number(p.price).toLocaleString()} so'm</p>
        </div>
        <div class="mt-2">
          ${qty === 0
            ? `<button onclick="addItem(${p.id})" class="press w-full py-2 bg-accent rounded-xl text-white text-xs font-black">+ Qo'shish</button>`
            : `<div class="flex items-center justify-between bg-bg3 rounded-xl px-1 py-0.5">
                <button onclick="removeItem(${p.id})" class="press w-8 h-8 flex items-center justify-center text-white font-black text-xl leading-none">−</button>
                <span class="font-black text-white">${qty}</span>
                <button onclick="addItem(${p.id})"    class="press w-8 h-8 flex items-center justify-center text-accent font-black text-xl leading-none">+</button>
               </div>`}
        </div>
      </div>
    </div>`;
  }).join('');
}

// ===== CART =====
function addItem(id) {
  const p = allProducts.find(x => x.id === id);
  if (!p) return;
  const ex = cart.find(x => x.id === id);
  if (ex) ex.quantity++;
  else cart.push({ ...p, quantity: 1 });
  syncCart();
  toast('Savatga qo\'shildi ✓');
}

function removeItem(id) {
  const ex = cart.find(x => x.id === id);
  if (!ex) return;
  ex.quantity--;
  if (ex.quantity <= 0) cart = cart.filter(x => x.id !== id);
  syncCart();
}

function syncCart() {
  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const count = cart.reduce((s, i) => s + i.quantity, 0);
  // Badge
  const badge = document.getElementById('cartBadge');
  if (count > 0) {
    badge.classList.remove('hidden');
    badge.textContent = count;
    badge.classList.add('badge-pulse');
    setTimeout(() => badge.classList.remove('badge-pulse'), 300);
  } else {
    badge.classList.add('hidden');
  }
  document.getElementById('cartTotal').textContent = total.toLocaleString() + ' so\'m';
  renderCartItems();
  // Refresh grid
  const filtered = currentCat === 'all' ? allProducts : allProducts.filter(p => p.category === currentCat);
  renderGrid(filtered);
}

function renderCartItems() {
  const el = document.getElementById('cartItems');
  if (!cart.length) {
    el.innerHTML = `<div class="text-center py-12 text-gray-500 text-sm">Savat bo'sh 🛒</div>`;
    return;
  }
  el.innerHTML = cart.map(i => `
    <div class="flex items-center gap-3 bg-bg3 rounded-2xl p-3">
      ${i.image
        ? `<img src="${i.image}" class="w-12 h-12 rounded-xl object-cover shrink-0"/>`
        : `<div class="w-12 h-12 rounded-xl bg-bg flex items-center justify-center text-2xl shrink-0">🍽</div>`}
      <div class="flex-1 min-w-0">
        <p class="font-bold text-white text-xs truncate">${i.name}</p>
        <p class="text-accent text-xs font-black">${Number(i.price).toLocaleString()} so'm</p>
      </div>
      <div class="flex items-center gap-1.5 shrink-0">
        <button onclick="removeItem(${i.id})" class="press w-7 h-7 bg-bg2 rounded-lg flex items-center justify-center text-white font-bold text-sm">−</button>
        <span class="font-black text-white text-sm w-4 text-center">${i.quantity}</span>
        <button onclick="addItem(${i.id})"    class="press w-7 h-7 bg-accent rounded-lg flex items-center justify-center text-white font-bold text-sm">+</button>
      </div>
    </div>`).join('');
}

function toggleCart() {
  const el = document.getElementById('cartSheet');
  el.classList.toggle('hidden');
  if (!el.classList.contains('hidden')) renderCartItems();
}

// ===== ORDER TYPE =====
function setType(type) {
  orderType = type;
  const on = document.getElementById('btnOnline');
  const di = document.getElementById('btnDine');
  const tw = document.getElementById('tableWrap');
  const activeClass = 'border-accent bg-accent/10 text-accent';
  const inactiveClass = 'border-white/10 bg-bg3 text-gray-400';
  on.className = `press flex-1 py-3 rounded-2xl text-xs font-black border transition-all ${type === 'online'  ? activeClass : inactiveClass}`;
  di.className = `press flex-1 py-3 rounded-2xl text-xs font-black border transition-all ${type === 'dine_in' ? activeClass : inactiveClass}`;
  tw.classList.toggle('hidden', type !== 'dine_in');
}

// ===== PLACE ORDER =====
async function placeOrder(btn) {
  if (!telegramUser) { toast('Telegram orqali kiring', 'err'); return; }
  if (!cart.length)  { toast('Savat bo\'sh', 'err'); return; }
  if (!orderType)    { toast('Buyurtma turini tanlang', 'err'); return; }
  let tableNumber = null;
  if (orderType === 'dine_in') {
    tableNumber = document.getElementById('tableNum').value.trim();
    if (!tableNumber) { toast('Stol raqamini kiriting', 'err'); return; }
  }
  btn.disabled = true;
  btn.textContent = 'Yuborilmoqda...';
  try {
    const body = {
      telegramId: telegramUser.id,
      items: cart,
      user: {
        first_name: userProfile?.first_name || telegramUser.first_name || '',
        last_name:  userProfile?.last_name  || telegramUser.last_name  || '',
        username:   userProfile?.username   || telegramUser.username   || '',
        phone:      userProfile?.phone      || ''
      },
      orderType, tableNumber, restaurantId: RESTAURANT_ID
    };
    const data = await fetch(API + '/order', {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body)
    }).then(r => r.json());
    if (data.blocked) { showBlocked(data.message); return; }
    if (!data.success) { toast(data.error || 'Xato', 'err'); return; }
    cart = []; orderType = null;
    syncCart();
    toggleCart();
    setType(null);
    document.getElementById('tableNum').value = '';
    toast('✅ Buyurtma qabul qilindi!');
  } catch(e) {
    toast('Xato yuz berdi', 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Buyurtma berish →';
  }
}

// ===== PROFILE =====
function renderProfileUI() {
  if (!userProfile) return;
  document.getElementById('pName').textContent  = ((userProfile.first_name || '') + ' ' + (userProfile.last_name || '')).trim() || '—';
  document.getElementById('pPhone').textContent = userProfile.phone || 'Telefon raqam yo\'q';
}
function openProfile()  { document.getElementById('profileSheet').classList.remove('hidden'); }
function closeProfile() { document.getElementById('profileSheet').classList.add('hidden'); }

async function loadOrders() {
  if (!telegramUser) return;
  const el = document.getElementById('ordersList');
  el.innerHTML = `<div class="text-center py-4 text-gray-500 text-xs">Yuklanmoqda...</div>`;
  try {
    const orders = await fetch(API + '/user/' + telegramUser.id + '/orders?restaurantId=' + RESTAURANT_ID).then(r => r.json());
    if (!Array.isArray(orders) || !orders.length) {
      el.innerHTML = `<div class="text-center py-4 text-gray-500 text-xs">Buyurtmalar yo'q</div>`; return;
    }
    el.innerHTML = orders.map(o => {
      const statusColor = o.status === 'Qabul qilindi' ? 'text-green-400 bg-green-500/10' :
                          o.status === 'Bekor qilindi' ? 'text-red-400 bg-red-500/10' : 'text-accent bg-accent/10';
      return `
      <div class="bg-bg3 rounded-2xl p-3">
        <div class="flex justify-between items-center mb-1.5">
          <span class="text-xs text-gray-500">${new Date(o.createdAt).toLocaleDateString('uz-UZ')}</span>
          <span class="text-xs font-bold px-2 py-0.5 rounded-full ${statusColor}">${o.status}</span>
        </div>
        <p class="text-xs text-gray-300 mb-1.5 leading-snug">${o.items.map(x => x.name + ' ×' + x.quantity).join(', ')}</p>
        <p class="font-black text-accent text-sm">${Number(o.total).toLocaleString()} so'm</p>
      </div>`;
    }).join('');
  } catch(e) {
    el.innerHTML = `<div class="text-center py-4 text-red-400 text-xs">Xato yuz berdi</div>`;
  }
}