require("dotenv").config();

const express     = require("express");
const mongoose    = require("mongoose");
const cors        = require("cors");
const TelegramBot = require("node-telegram-bot-api");
const fs          = require("fs");
const path        = require("path");
const jwt         = require("jsonwebtoken");
const bcrypt      = require("bcryptjs");

const app = express();
app.use(cors());
app.use(express.json());

const TOKEN      = process.env.BOT_TOKEN;
const CHEF_ID    = Number(process.env.CHEF_ID);
const MONGO_URI  = process.env.MONGO_URI;
const WEBAPP_URL = process.env.WEBAPP_URL || "https://e-comerce-bot.vercel.app";
const PORT       = process.env.PORT || 5000;
const DOMAIN     = process.env.RAILWAY_URL || "";
const JWT_SECRET = process.env.JWT_SECRET || "imperial_secret_2026";

if (!TOKEN)   { console.error("BOT_TOKEN yoq"); process.exit(1); }
if (!CHEF_ID) { console.error("CHEF_ID yoq");   process.exit(1); }

const bot = new TelegramBot(TOKEN);

mongoose.connect(MONGO_URI)
  .then(() => console.log("MongoDB ulandi"))
  .catch(err => { console.error("Mongo:", err.message); process.exit(1); });

// ===== MODELS =====
const User = mongoose.model("User", new mongoose.Schema({
  telegramId: { type: Number, unique: true },
  first_name: String, last_name: String,
  username: String, phone: String
}, { timestamps: true }));

const Order = mongoose.model("Order", new mongoose.Schema({
  telegramId: Number, items: Array, total: Number,
  userInfo: Object, orderType: String,
  tableNumber: String,
  status: { type: String, default: "Yangi" },
  rating: { type: Number, default: null },
  ratingComment: { type: String, default: "" }
}, { timestamps: true }));

const Product = mongoose.model("Product", new mongoose.Schema({
  id:       { type: Number, unique: true },
  name:     String,
  name_ru:  String,
  price:    Number,
  category: String,
  image:    String,
  active:   { type: Boolean, default: true }
}, { timestamps: true }));

// Admin model — har restoran uchun
const Admin = mongoose.model("Admin", new mongoose.Schema({
  username:     { type: String, unique: true },
  password:     String,
  restaurantName: String,
  telegramId:   Number,
  role:         { type: String, default: "admin" } // "superadmin" | "admin"
}, { timestamps: true }));

// ===== JWT MIDDLEWARE =====
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Token kerak" });
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch(e) {
    res.status(401).json({ error: "Token yaroqsiz" });
  }
}

// ===== PRODUCTS: DB ga sinxronlash =====
async function syncProductsToDB() {
  try {
    const count = await Product.countDocuments();
    if (count === 0) {
      const filePath = path.join(__dirname, "data", "products.json");
      if (fs.existsSync(filePath)) {
        const products = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        await Product.insertMany(products);
        console.log("Products DB ga sinxronlandi:", products.length);
      }
    }
  } catch(e) { console.error("syncProducts:", e.message); }
}

// ===== BOT =====
const menu = {
  keyboard: [
    [{ text: "Buyurtmalarim" }, { text: "Manzil"    }],
    [{ text: "Ish vaqti"     }, { text: "Boglanish" }]
  ],
  resize_keyboard: true
};

async function send(id, text, extra) {
  try { await bot.sendMessage(id, text, extra || {}); }
  catch(e) { console.error("send err:", e.message); }
}

bot.onText(/\/start/, async (msg) => {
  try {
    const u = await User.findOneAndUpdate(
      { telegramId: msg.from.id },
      { telegramId: msg.from.id, first_name: msg.from.first_name || "", last_name: msg.from.last_name || "", username: msg.from.username || "" },
      { upsert: true, new: true }
    );
    if (!u.phone) {
      await send(msg.chat.id, "Salom! Telefon raqamingizni yuboring:", {
        reply_markup: { keyboard: [[{ text: "Telefon yuborish", request_contact: true }]], resize_keyboard: true, one_time_keyboard: true }
      });
    } else {
      await send(msg.chat.id, "Xush kelibsiz " + (msg.from.first_name || "") + "! Bolim tanlang:", { reply_markup: menu });
    }
  } catch(e) { console.error("start:", e.message); }
});

bot.on("contact", async (msg) => {
  try {
    await User.findOneAndUpdate({ telegramId: msg.from.id }, { phone: msg.contact.phone_number });
    await send(msg.chat.id, "Saqlandi! Bolim tanlang:", { reply_markup: menu });
  } catch(e) { console.error("contact:", e.message); }
});

bot.onText(/Buyurtmalarim/, async (msg) => {
  try {
    const list = await Order.find({ telegramId: msg.from.id }).sort({ createdAt: -1 }).limit(5);
    if (!list.length) { await send(msg.chat.id, "Buyurtma yoq.", { reply_markup: menu }); return; }
    let t = "Buyurtmalar:\n\n";
    list.forEach((o, i) => {
      t += (i+1) + ". " + new Date(o.createdAt).toLocaleDateString() + " | " + (o.tableNumber || "") + "\n";
      t += o.items.map(x => x.name + " x" + x.quantity).join(", ") + "\n";
      t += Number(o.total).toLocaleString() + " som | " + o.status + "\n\n";
    });
    await send(msg.chat.id, t, { reply_markup: menu });
  } catch(e) { console.error("orders:", e.message); }
});

bot.onText(/Manzil/, async (msg) => {
  try {
    await send(msg.chat.id, "Manzil:\nToshkent, Chilonzor tumani\nNavroz kochasi 15-uy\nMetro: Chilonzor (5 daqiqa)", { reply_markup: menu });
  } catch(e) { console.error("manzil:", e.message); }
});

bot.onText(/Ish vaqti/, async (msg) => {
  try {
    const h = (new Date().getUTCHours() + 5) % 24;
    await send(msg.chat.id,
      "Ish vaqti:\nDu-Ju: 10:00-23:00\nSh-Ya: 09:00-00:00\n\n" + (h >= 10 && h < 23 ? "Hozir OCHIQ" : "Hozir YOPIQ"),
      { reply_markup: menu }
    );
  } catch(e) { console.error("ish vaqti:", e.message); }
});

bot.onText(/Boglanish/, async (msg) => {
  try {
    await send(msg.chat.id,
      "Boglanish:\n\nTelefon: +998 77 008 34 13\nTelegram: @Jahonsher",
      { reply_markup: { inline_keyboard: [[{ text: "Telegram @Jahonsher", url: "https://t.me/Jahonsher" }]] } }
    );
  } catch(e) { console.error("boglanish:", e.message); }
});

bot.on("callback_query", async (q) => {
  try {
    const parts = q.data.split("_");
    const action = parts[0];

    if (action === "accept") {
      const [, orderId, userId] = parts;
      await Order.findByIdAndUpdate(orderId, { status: "Qabul qilindi" });
      await bot.editMessageReplyMarkup(
        { inline_keyboard: [[{ text: "✅ Qabul qilindi", callback_data: "done" }]] },
        { chat_id: q.message.chat.id, message_id: q.message.message_id }
      );
      await send(Number(userId), "✅ Buyurtmangiz qabul qilindi! Tayyorlanmoqda.");

      // Reyting so'rash — 30 soniya keyin
      setTimeout(async () => {
        await send(Number(userId), "Buyurtmangizni qanday baholaysiz?", {
          reply_markup: { inline_keyboard: [[
            { text: "⭐ 1", callback_data: `rate_${orderId}_1` },
            { text: "⭐⭐ 2", callback_data: `rate_${orderId}_2` },
            { text: "⭐⭐⭐ 3", callback_data: `rate_${orderId}_3` },
            { text: "⭐⭐⭐⭐ 4", callback_data: `rate_${orderId}_4` },
            { text: "⭐⭐⭐⭐⭐ 5", callback_data: `rate_${orderId}_5` },
          ]]}
        });
      }, 30000);

    } else if (action === "reject") {
      const [, orderId, userId] = parts;
      await Order.findByIdAndUpdate(orderId, { status: "Bekor qilindi" });
      await bot.editMessageReplyMarkup(
        { inline_keyboard: [[{ text: "❌ Bekor qilindi", callback_data: "done" }]] },
        { chat_id: q.message.chat.id, message_id: q.message.message_id }
      );
      await send(Number(userId), "❌ Buyurtmangiz bekor qilindi. Kechirasiz.");

    } else if (action === "rate") {
      const [, orderId, stars] = parts;
      await Order.findByIdAndUpdate(orderId, { rating: Number(stars) });
      await bot.editMessageReplyMarkup(
        { inline_keyboard: [[{ text: "⭐".repeat(Number(stars)) + " Baholangdi!", callback_data: "done" }]] },
        { chat_id: q.message.chat.id, message_id: q.message.message_id }
      );
      await bot.answerCallbackQuery(q.id, { text: "Rahmat!" });
      return;
    }

    await bot.answerCallbackQuery(q.id);
  } catch(e) { console.error("callback:", e.message); }
});

// ===== PUBLIC ENDPOINTS =====
app.get("/", (req, res) => res.send("OK"));

const WH = "/wh/" + TOKEN;
app.post(WH, (req, res) => {
  try { bot.processUpdate(req.body); } catch(e) { console.error("processUpdate:", e.message); }
  res.sendStatus(200);
});

// Products — DB dan olish (admin qo'shsa shu yerdan chiqadi)
app.get("/products", async (req, res) => {
  try {
    const products = await Product.find({ active: true }).sort({ id: 1 });
    if (products.length) return res.json(products);
    // DB bo'sh bo'lsa file dan
    res.json(JSON.parse(fs.readFileSync(path.join(__dirname, "data", "products.json"), "utf-8")));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post("/auth", async (req, res) => {
  try {
    const { id, first_name, last_name, username } = req.body;
    const user = await User.findOneAndUpdate(
      { telegramId: id },
      { $set: { telegramId: id, first_name: first_name||"", last_name: last_name||"", username: username||"" } },
      { upsert: true, new: true }
    );
    res.json({ ok: true, user });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get("/user/:id", async (req, res) => {
  try {
    res.json(await User.findOne({ telegramId: Number(req.params.id) }) || {});
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get("/user/:id/orders", async (req, res) => {
  try {
    res.json(await Order.find({ telegramId: Number(req.params.id) }).sort({ createdAt: -1 }).limit(30));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post("/order", async (req, res) => {
  try {
    const { telegramId, items, user, orderType, tableNumber } = req.body;
    if (!telegramId || !items?.length) return res.status(400).json({ error: "malumot yoq" });

    const db = await User.findOne({ telegramId: Number(telegramId) });
    const ui = {
      first_name: db?.first_name || user?.first_name || "",
      last_name:  db?.last_name  || user?.last_name  || "",
      username:   db?.username   || user?.username   || "",
      phone:      db?.phone      || user?.phone      || ""
    };

    const total = items.reduce((s, i) => s + Number(i.price) * i.quantity, 0);
    const order = await Order.create({
      telegramId: Number(telegramId), items, total,
      userInfo: ui, orderType: orderType||"online",
      tableNumber: tableNumber||"Online", status: "Yangi"
    });

    const name  = (ui.first_name + " " + ui.last_name).trim() || "ID:" + telegramId;
    const uname = ui.username ? " (@" + ui.username + ")" : "";
    const phone = ui.phone    ? "\nTel: " + ui.phone : "";
    const table = orderType === "dine_in" ? "Stol: " + tableNumber : "Online";

    let m = "🆕 Yangi buyurtma!\n\n" + table + "\nMijoz: " + name + uname + phone + "\n\nMahsulotlar:\n";
    items.forEach(i => { m += "- " + i.name + " x" + i.quantity + " | " + Number(i.price).toLocaleString() + " som\n"; });
    m += "\nJami: " + total.toLocaleString() + " som";

    await send(CHEF_ID, m, {
      reply_markup: { inline_keyboard: [[
        { text: "✅ Qabul", callback_data: "accept_" + order._id + "_" + telegramId },
        { text: "❌ Rad",   callback_data: "reject_" + order._id + "_" + telegramId }
      ]]}
    });

    res.json({ success: true, order });
  } catch(e) { console.error("order:", e.message); res.status(500).json({ error: e.message }); }
});

// ===== ADMIN AUTH =====
app.post("/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const admin = await Admin.findOne({ username });
    if (!admin) return res.status(401).json({ error: "Foydalanuvchi topilmadi" });
    const ok = await bcrypt.compare(password, admin.password);
    if (!ok) return res.status(401).json({ error: "Parol noto'g'ri" });
    const token = jwt.sign({ id: admin._id, username: admin.username, role: admin.role, restaurantName: admin.restaurantName }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ ok: true, token, admin: { username: admin.username, restaurantName: admin.restaurantName, role: admin.role } });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Birinchi admin yaratish (faqat bir marta ishlatiladi)
app.post("/admin/setup", async (req, res) => {
  try {
    const count = await Admin.countDocuments();
    if (count > 0) return res.status(403).json({ error: "Admin allaqachon mavjud" });
    const { username, password, restaurantName } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const admin = await Admin.create({ username, password: hash, restaurantName: restaurantName || "Imperial Restoran", role: "superadmin" });
    res.json({ ok: true, message: "Superadmin yaratildi", username: admin.username });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Yangi admin qo'shish (faqat superadmin)
app.post("/admin/create", authMiddleware, async (req, res) => {
  try {
    if (req.admin.role !== "superadmin") return res.status(403).json({ error: "Ruxsat yo'q" });
    const { username, password, restaurantName } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const admin = await Admin.create({ username, password: hash, restaurantName, role: "admin" });
    res.json({ ok: true, admin: { username: admin.username, restaurantName: admin.restaurantName } });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ===== ADMIN — PRODUCTS CRUD =====
app.get("/admin/products", authMiddleware, async (req, res) => {
  try {
    res.json(await Product.find().sort({ id: 1 }));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post("/admin/products", authMiddleware, async (req, res) => {
  try {
    const last = await Product.findOne().sort({ id: -1 });
    const newId = last ? last.id + 1 : 1;
    const product = await Product.create({ ...req.body, id: newId });
    res.json({ ok: true, product });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put("/admin/products/:id", authMiddleware, async (req, res) => {
  try {
    const product = await Product.findOneAndUpdate({ id: Number(req.params.id) }, req.body, { new: true });
    res.json({ ok: true, product });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete("/admin/products/:id", authMiddleware, async (req, res) => {
  try {
    await Product.findOneAndDelete({ id: Number(req.params.id) });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ===== ADMIN — ORDERS =====
app.get("/admin/orders", authMiddleware, async (req, res) => {
  try {
    const { status, type, limit = 50, skip = 0 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (type)   filter.orderType = type;
    const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(Number(limit)).skip(Number(skip));
    const total  = await Order.countDocuments(filter);
    res.json({ orders, total });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put("/admin/orders/:id/status", authMiddleware, async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    res.json({ ok: true, order });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ===== ADMIN — STATISTICS =====
app.get("/admin/stats", authMiddleware, async (req, res) => {
  try {
    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const week  = new Date(today); week.setDate(week.getDate() - 6);
    const month = new Date(now.getFullYear(), now.getMonth(), 1);

    // Bugungi
    const todayOrders   = await Order.find({ createdAt: { $gte: today } });
    const todayRevenue  = todayOrders.reduce((s, o) => s + (o.total || 0), 0);
    const todayOnline   = todayOrders.filter(o => o.orderType === "online").length;
    const todayDineIn   = todayOrders.filter(o => o.orderType === "dine_in").length;

    // Oylik
    const monthOrders  = await Order.find({ createdAt: { $gte: month } });
    const monthRevenue = monthOrders.reduce((s, o) => s + (o.total || 0), 0);

    // Haftalik grafik — oxirgi 7 kun
    const weeklyData = [];
    for (let i = 6; i >= 0; i--) {
      const d     = new Date(today); d.setDate(d.getDate() - i);
      const dNext = new Date(d);     dNext.setDate(dNext.getDate() + 1);
      const dayOrders = await Order.find({ createdAt: { $gte: d, $lt: dNext } });
      weeklyData.push({
        date:    d.toLocaleDateString("uz-UZ", { month: "short", day: "numeric" }),
        orders:  dayOrders.length,
        revenue: dayOrders.reduce((s, o) => s + (o.total || 0), 0)
      });
    }

    // Reyting
    const ratedOrders = await Order.find({ rating: { $ne: null } });
    const avgRating   = ratedOrders.length
      ? (ratedOrders.reduce((s, o) => s + o.rating, 0) / ratedOrders.length).toFixed(1)
      : null;

    // Jami foydalanuvchilar
    const totalUsers = await User.countDocuments();

    // Status bo'yicha
    const statusStats = await Order.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    // Ko'p sotilgan mahsulotlar TOP-5
    const topProducts = await Order.aggregate([
      { $unwind: "$items" },
      { $group: {
          _id:      "$items.name",
          total:    { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
          quantity: { $sum: "$items.quantity" },
          count:    { $sum: 1 }
      }},
      { $sort: { quantity: -1 } },
      { $limit: 5 }
    ]);

    res.json({
      today:       { orders: todayOrders.length, revenue: todayRevenue, online: todayOnline, dineIn: todayDineIn },
      month:       { orders: monthOrders.length, revenue: monthRevenue },
      weekly:      weeklyData,
      topProducts,
      rating:      { avg: avgRating, count: ratedOrders.length },
      totalUsers,
      statusStats
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ===== ADMIN — USERS =====
app.get("/admin/users", authMiddleware, async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }).limit(100);
    res.json(users);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

process.on("uncaughtException",  e => console.error("uncaught:", e.message));
process.on("unhandledRejection", e => console.error("unhandled:", e));

app.listen(PORT, async () => {
  console.log("Server " + PORT + " da ishga tushdi");
  await syncProductsToDB();
  if (DOMAIN) {
    try {
      await bot.setWebHook("https://" + DOMAIN + WH);
      console.log("Webhook urnatildi");
    } catch(e) { console.error("webhook err:", e.message); }
  } else {
    console.warn("RAILWAY_URL yoq — webhook urnatilmadi");
  }
});