// ✅ FIX 1: API URL to'g'ri sozlandi — localhost va Railway uchun avtomatik
const API =
  window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : "https://e-comerce-bot-main-production.up.railway.app";  // ← Railway URL shu

let products = [];
let cart = [];
let telegramId = null;
let userData = null;

/* ===========================
   TELEGRAM AUTH
=========================== */
if (window.Telegram && Telegram.WebApp) {

  const tg = Telegram.WebApp;
  tg.expand();

  if (tg.initDataUnsafe && tg.initDataUnsafe.user) {

    userData = tg.initDataUnsafe.user;
    telegramId = userData.id;

    fetch(API + "/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData)
    })
    .then(res => res.json())
    .then(data => console.log("AUTH OK:", data))
    .catch(err => console.log("AUTH ERROR:", err));
  }
}

// ✅ FIX 2: Test ID — Telegram WebApp ishlamasa shu ishlatiladi
if (!telegramId) {
  telegramId = 8523270760;
  console.warn("⚠️ Test mode: telegramId =", telegramId);
}

/* ===========================
   LOAD PRODUCTS
=========================== */
function loadProducts() {
  console.log("📦 Products yuklanmoqda:", API + "/products");

  fetch(API + "/products")
    .then(res => {
      if (!res.ok) throw new Error("Server xato: " + res.status);
      return res.json();
    })
    .then(data => {
      console.log("✅ PRODUCTS keldi:", data.length, "ta");
      products = data;
      renderProducts(products);
    })
    .catch(err => {
      console.error("❌ PRODUCT FETCH ERROR:", err);
      // ✅ FIX 3: Xato bo'lsa foydalanuvchiga ko'rsatiladi
      const container = document.getElementById("products");
      if (container) {
        container.innerHTML = `
          <div class="col-span-full text-center text-red-400 py-10">
            ❌ Mahsulotlar yuklanmadi. Server bilan bog'lanishda xato.<br>
            <small>${err.message}</small>
          </div>
        `;
      }
    });
}

/* ===========================
   RENDER PRODUCTS
=========================== */
function renderProducts(list) {

  const container = document.getElementById("products");
  if (!container) return;
  container.innerHTML = "";

  if (!list || list.length === 0) {
    container.innerHTML = `
      <div class="col-span-full text-center text-gray-400 py-10">
        Mahsulotlar topilmadi
      </div>
    `;
    return;
  }

  list.forEach(product => {
    container.innerHTML += `
      <div class="bg-[#1e293b] p-6 rounded-xl shadow-lg">
        <img src="${product.image}" 
             class="w-full h-48 object-cover rounded-lg mb-4"
             onerror="this.src='https://via.placeholder.com/300x200?text=Rasm+yo%27q'">
        <h3 class="text-lg font-bold">${product.name}</h3>
        <p class="text-gray-400 mb-2">${product.category}</p>
        <p class="text-emerald-400 font-semibold mb-4">
          ${Number(product.price).toLocaleString()} so'm
        </p>
        <button onclick="addToCart(${product.id})"
          class="bg-emerald-600 w-full py-2 rounded hover:bg-emerald-700 transition">
          🛒 Savatchaga qo'shish
        </button>
      </div>
    `;
  });
}

/* ===========================
   FILTER
=========================== */
function filterCategory(category) {
  if (category === "all") {
    renderProducts(products);
    return;
  }
  const filtered = products.filter(p => p.category === category);
  renderProducts(filtered);
}

/* ===========================
   CART LOGIC
=========================== */
function addToCart(id) {
  const product = products.find(p => p.id === id);
  if (!product) return;

  const existing = cart.find(p => p.id === id);
  if (existing) {
    existing.quantity++;
  } else {
    cart.push({ ...product, quantity: 1 });
  }

  updateCart();
}

function changeQty(id, delta) {
  const item = cart.find(p => p.id === id);
  if (!item) return;

  item.quantity += delta;
  if (item.quantity <= 0) {
    cart = cart.filter(p => p.id !== id);
  }

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
      <div class="bg-[#1e293b] p-4 rounded-lg flex justify-between items-center">
        <div>
          <h4 class="font-semibold">${item.name}</h4>
          <p class="text-gray-400 text-sm">${Number(item.price).toLocaleString()} so'm</p>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="changeQty(${item.id}, -1)"
            class="bg-gray-700 px-3 py-1 rounded hover:bg-gray-600">−</button>
          <span class="font-bold">${item.quantity}</span>
          <button onclick="changeQty(${item.id}, 1)"
            class="bg-gray-700 px-3 py-1 rounded hover:bg-gray-600">+</button>
        </div>
      </div>
    `;
  });

  const cartCount = document.getElementById("cartCount");
  if (cartCount) {
    cartCount.innerText = cart.reduce((sum, i) => sum + i.quantity, 0);
  }

  const cartTotal = document.getElementById("cartTotal");
  if (cartTotal) {
    cartTotal.innerText = Number(total).toLocaleString();
  }
}

/* ===========================
   PANEL CONTROL
=========================== */
function toggleCart() {
  openPanel("cartPanel");
}

function openUserPanel() {
  openPanel("userPanel");
  loadUserOrders();
}

function openPanel(id) {
  const panel = document.getElementById(id);
  const overlay = document.getElementById("overlay");
  if (panel) panel.classList.remove("translate-x-full");
  if (overlay) overlay.classList.remove("hidden");
}

function closePanels() {
  const cartPanel = document.getElementById("cartPanel");
  const userPanel = document.getElementById("userPanel");
  const overlay = document.getElementById("overlay");
  if (cartPanel) cartPanel.classList.add("translate-x-full");
  if (userPanel) userPanel.classList.add("translate-x-full");
  if (overlay) overlay.classList.add("hidden");
}

/* ===========================
   CHECKOUT
=========================== */
function checkout() {
  if (!cart.length) {
    alert("⚠️ Savatcha bo'sh!");
    return;
  }

  // ✅ FIX 4: Tugma disable qilinadi — ikki marta bosishdan himoya
  const btn = document.getElementById("checkoutBtn");
  if (btn) {
    btn.disabled = true;
    btn.innerText = "⏳ Yuborilmoqda...";
  }

  console.log("📤 Order yuborilmoqda:", { telegramId, items: cart });

  fetch(API + "/order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      telegramId,
      items: cart,
      user: userData
    })
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
    loadUserOrders();
    alert("✅ Buyurtma muvaffaqiyatli yuborildi!");
  })
  .catch(err => {
    console.error("❌ ORDER ERROR:", err);
    alert("❌ Xato yuz berdi: " + err.message);
  })
  .finally(() => {
    if (btn) {
      btn.disabled = false;
      btn.innerText = "✅ Buyurtma berish";
    }
  });
}

/* ===========================
   USER ORDERS
=========================== */
function loadUserOrders() {
  fetch(API + "/user/" + telegramId)
    .then(res => {
      if (!res.ok) throw new Error("Server xato: " + res.status);
      return res.json();
    })
    .then(data => {
      const container = document.getElementById("userOrders");
      if (!container) return;

      container.innerHTML = "";

      if (!data || data.length === 0) {
        container.innerHTML = `
          <div class="text-gray-400 text-center py-6">
            Hali buyurtma yo'q
          </div>
        `;
        return;
      }

      data.forEach(order => {
        const items = order.items
          .map(i => `${i.name} (${i.quantity} ta)`)
          .join(", ");

        const date = new Date(order.createdAt).toLocaleString("uz-UZ");

        container.innerHTML += `
          <div class="bg-[#1e293b] p-4 rounded-lg mb-3">
            <p class="font-semibold mb-1">${items}</p>
            <p class="text-emerald-400 font-bold">
              ${Number(order.total).toLocaleString()} so'm
            </p>
            <p class="text-sm text-yellow-400 mt-1">📌 ${order.status || "Yangi"}</p>
            <p class="text-xs text-gray-500 mt-1">🕐 ${date}</p>
          </div>
        `;
      });
    })
    .catch(err => {
      console.error("USER ORDER ERROR:", err);
    });
}

function scrollToMenu() {
  const menu = document.getElementById("menu");
  if (menu) menu.scrollIntoView({ behavior: "smooth" });
}

// ✅ Sahifa yuklanganda mahsulotlarni olish
loadProducts();