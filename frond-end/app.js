// ✅ API URL
const API =
  window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : "https://e-comerce-bot-main-production.up.railway.app";

let products  = [];
let cart      = [];
let telegramId = null;
let userData   = null;   // Telegram dan kelgan ma'lumot
let userProfile = null;  // DB dan kelgan (telefon ham bor)

/* ===========================
   TELEGRAM AUTH
=========================== */
if (window.Telegram && Telegram.WebApp) {
  const tg = Telegram.WebApp;
  tg.expand();

  if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
    userData   = tg.initDataUnsafe.user;
    telegramId = userData.id;

    // Backend ga auth yuboramiz — user DB ga saqlanadi
    fetch(API + "/auth", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(userData)
    })
    .then(r => r.json())
    .then(data => {
      userProfile = data.user;   // DB dagi user (telefon bilan)
      renderProfile();
      console.log("✅ Auth OK, user:", userProfile);
    })
    .catch(err => console.error("AUTH ERROR:", err));
  }
}

// Test mode
if (!telegramId) {
  telegramId = 8523270760;
  console.warn("⚠️ Test mode, telegramId:", telegramId);

  // Test uchun ham profil yuklaymiz
  fetch(API + "/user/" + telegramId)
    .then(r => r.json())
    .then(data => { userProfile = data; renderProfile(); })
    .catch(() => {});
}

/* ===========================
   PROFIL RENDER
=========================== */
function renderProfile() {
  const nameEl  = document.getElementById("profileName");
  const uNameEl = document.getElementById("profileUsername");
  const phoneEl = document.getElementById("profilePhone");

  if (!userProfile && !userData) return;

  const u = userProfile || userData;

  if (nameEl) {
    const fullName = `${u.first_name || ""} ${u.last_name || ""}`.trim();
    nameEl.innerText = fullName || "Noma'lum";
  }
  if (uNameEl) {
    uNameEl.innerText = u.username ? `@${u.username}` : "Username yo'q";
  }
  if (phoneEl) {
    phoneEl.innerText = u.phone ? `📱 ${u.phone}` : "📱 Telefon yo'q";
  }
}

/* ===========================
   LOAD PRODUCTS
=========================== */
function loadProducts() {
  console.log("📦 Products yuklanmoqda...");
  fetch(API + "/products")
    .then(res => {
      if (!res.ok) throw new Error("Server xato: " + res.status);
      return res.json();
    })
    .then(data => {
      console.log("✅ Products:", data.length, "ta");
      products = data;
      renderProducts(products);
    })
    .catch(err => {
      console.error("❌ PRODUCT ERROR:", err);
      const c = document.getElementById("products");
      if (c) c.innerHTML = `
        <div class="col-span-full text-center text-red-400 py-10">
          ❌ Mahsulotlar yuklanmadi<br><small>${err.message}</small>
        </div>`;
    });
}

/* ===========================
   RENDER PRODUCTS
=========================== */
function renderProducts(list) {
  const container = document.getElementById("products");
  if (!container) return;
  container.innerHTML = "";

  if (!list || !list.length) {
    container.innerHTML = `<div class="col-span-full text-center text-gray-400 py-10">Mahsulotlar topilmadi</div>`;
    return;
  }

  list.forEach(product => {
    container.innerHTML += `
      <div class="bg-[#1e293b] p-6 rounded-xl shadow-lg">
        <img src="${product.image}"
             class="w-full h-48 object-cover rounded-lg mb-4"
             onerror="this.style.display='none'">
        <h3 class="text-lg font-bold">${product.name}</h3>
        <p class="text-gray-400 mb-2">${product.category}</p>
        <p class="text-emerald-400 font-semibold mb-4">${Number(product.price).toLocaleString()} so'm</p>
        <button onclick="addToCart(${product.id})"
          class="bg-emerald-600 w-full py-2 rounded hover:bg-emerald-700 transition">
          🛒 Savatchaga qo'shish
        </button>
      </div>`;
  });
}

/* ===========================
   FILTER
=========================== */
function filterCategory(category) {
  if (category === "all") { renderProducts(products); return; }
  renderProducts(products.filter(p => p.category === category));
}

/* ===========================
   CART
=========================== */
function addToCart(id) {
  const product = products.find(p => p.id === id);
  if (!product) return;
  const existing = cart.find(p => p.id === id);
  if (existing) existing.quantity++;
  else cart.push({ ...product, quantity: 1 });
  updateCart();
}

function changeQty(id, delta) {
  const item = cart.find(p => p.id === id);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) cart = cart.filter(p => p.id !== id);
  updateCart();
}

function updateCart() {
  const container = document.getElementById("cartItems");
  if (!container) return;
  container.innerHTML = "";
  let total = 0;

  cart.forEach(item => {
    total += item.price * item.quantity;
    container.innerHTML += `
      <div class="bg-[#1e293b] p-4 rounded-lg flex justify-between items-center mb-2">
        <div>
          <h4 class="font-semibold">${item.name}</h4>
          <p class="text-gray-400 text-sm">${Number(item.price).toLocaleString()} so'm</p>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="changeQty(${item.id}, -1)" class="bg-gray-700 px-3 py-1 rounded">−</button>
          <span class="font-bold">${item.quantity}</span>
          <button onclick="changeQty(${item.id}, 1)"  class="bg-gray-700 px-3 py-1 rounded">+</button>
        </div>
      </div>`;
  });

  const cartCount = document.getElementById("cartCount");
  if (cartCount) cartCount.innerText = cart.reduce((s, i) => s + i.quantity, 0);

  const cartTotal = document.getElementById("cartTotal");
  if (cartTotal) cartTotal.innerText = Number(total).toLocaleString();
}

/* ===========================
   PANEL CONTROL
=========================== */
function toggleCart() { openPanel("cartPanel"); }

function openUserPanel() {
  openPanel("userPanel");
  renderProfile();
  loadUserOrders();
}

function openPanel(id) {
  document.getElementById(id)?.classList.remove("translate-x-full");
  document.getElementById("overlay")?.classList.remove("hidden");
}

function closePanels() {
  document.getElementById("cartPanel")?.classList.add("translate-x-full");
  document.getElementById("userPanel")?.classList.add("translate-x-full");
  document.getElementById("overlay")?.classList.add("hidden");
}

/* ===========================
   CHECKOUT
=========================== */
function checkout() {
  if (!cart.length) { alert("⚠️ Savatcha bo'sh!"); return; }

  const btn = document.getElementById("checkoutBtn");
  if (btn) { btn.disabled = true; btn.innerText = "⏳ Yuborilmoqda..."; }

  console.log("📤 Order:", { telegramId, items: cart });

  fetch(API + "/order", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ telegramId, items: cart })
  })
  .then(res => {
    if (!res.ok) throw new Error("Server xato: " + res.status);
    return res.json();
  })
  .then(data => {
    console.log("✅ ORDER OK:", data);
    cart = [];
    updateCart();
    closePanels();
    alert("✅ Buyurtma muvaffaqiyatli yuborildi!");
  })
  .catch(err => {
    console.error("❌ ORDER ERROR:", err);
    alert("❌ Xato: " + err.message);
  })
  .finally(() => {
    if (btn) { btn.disabled = false; btn.innerText = "✅ Buyurtma berish"; }
  });
}

/* ===========================
   USER ORDERS
=========================== */
function loadUserOrders() {
  fetch(API + "/user/" + telegramId + "/orders")
    .then(res => res.json())
    .then(data => {
      const container = document.getElementById("userOrders");
      if (!container) return;
      container.innerHTML = "";

      if (!data || !data.length) {
        container.innerHTML = `<div class="text-gray-400 text-center py-6">Hali buyurtma yo'q</div>`;
        return;
      }

      data.forEach(order => {
        const itemsList = order.items.map(i => `${i.name} (${i.quantity})`).join(", ");
        const date      = new Date(order.createdAt).toLocaleString("uz-UZ");
        const phone     = order.userInfo?.phone ? `<p class="text-xs text-gray-400">📱 ${order.userInfo.phone}</p>` : "";

        container.innerHTML += `
          <div class="bg-[#1e293b] p-4 rounded-lg mb-3">
            <p class="font-semibold mb-1">${itemsList}</p>
            <p class="text-emerald-400 font-bold">${Number(order.total).toLocaleString()} so'm</p>
            ${phone}
            <p class="text-sm text-yellow-400 mt-1">📌 ${order.status || "Yangi"}</p>
            <p class="text-xs text-gray-500 mt-1">🕐 ${date}</p>
          </div>`;
      });
    })
    .catch(err => console.error("USER ORDERS ERROR:", err));
}

function scrollToMenu() {
  document.getElementById("menu")?.scrollIntoView({ behavior: "smooth" });
}

loadProducts();