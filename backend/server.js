require("dotenv").config();

const express     = require("express");
const mongoose    = require("mongoose");
const cors        = require("cors");
const TelegramBot = require("node-telegram-bot-api");
const fs          = require("fs");
const path        = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const BOT_TOKEN  = process.env.BOT_TOKEN;
const CHEF_ID    = Number(process.env.CHEF_ID);
const MONGO_URI  = process.env.MONGO_URI;
const WEBAPP_URL = process.env.WEBAPP_URL || "https://e-comerce-bot.vercel.app";
const PORT       = process.env.PORT || 5000;
const RAILWAY_URL = process.env.RAILWAY_URL;

if (!BOT_TOKEN) { console.error("BOT_TOKEN yoq"); process.exit(1); }
if (!CHEF_ID)   { console.error("CHEF_ID yoq");   process.exit(1); }

const bot = new TelegramBot(BOT_TOKEN, { webHook: false });

/* ===== MONGODB ===== */
mongoose.connect(MONGO_URI)
  .then(() => console.log("MongoDB ulandi"))
  .catch(err => { console.error("Mongo error:", err.message); process.exit(1); });

/* ===== MODELS ===== */
const User = mongoose.model("User", new mongoose.Schema({
  telegramId: { type: Number, unique: true },
  first_name: String,
  last_name:  String,
  username:   String,
  phone:      String
}, { timestamps: true }));

const Order = mongoose.model("Order", new mongoose.Schema({
  telegramId:  Number,
  items:       Array,
  total:       Number,
  userInfo:    Object,
  orderType:   String,
  tableNumber: String,
  status:      { type: String, default: "Yangi" }
}, { timestamps: true }));

/* ===== BOT KEYBOARD ===== */
const mainMenu = {
  keyboard: [
    [{ text: "📋 Buyurtmalarim" }, { text: "📍 Manzil"     }],
    [{ text: "🕐 Ish vaqti"     }, { text: "📞 Boglanish"  }]
  ],
  resize_keyboard: true
};

/* ===== /start ===== */
bot.onText(/\/start/, async (msg) => {
  const chatId    = msg.chat.id;
  const from      = msg.from;
  const firstName = from.first_name || "Mehmon";

  const user = await User.findOneAndUpdate(
    { telegramId: from.id },
    { telegramId: from.id, first_name: from.first_name || "", last_name: from.last_name || "", username: from.username || "" },
    { upsert: true, new: true }
  );

  if (!user.phone) {
    await bot.sendMessage(chatId,
      "Salom " + firstName + "!\n\nDavom etish uchun telefon raqamingizni yuboring:",
      {
        reply_markup: {
          keyboard: [[{ text: "📱 Telefon yuborish", request_contact: true }]],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      }
    );
  } else {
    await bot.sendMessage(chatId,
      "Xush kelibsiz, " + firstName + "!\nQuyidagi tugmalardan birini tanlang:",
      { reply_markup: mainMenu }
    );
  }
});

/* ===== CONTACT ===== */
bot.on("contact", async (msg) => {
  const chatId = msg.chat.id;
  await User.findOneAndUpdate(
    { telegramId: msg.from.id },
    { phone: msg.contact.phone_number },
    { new: true }
  );
  await bot.sendMessage(chatId,
    "Telefon saqlandi! Quyidagi tugmalardan birini tanlang:",
    { reply_markup: mainMenu }
  );
});

/* ===== BUYURTMALARIM ===== */
bot.onText(/Buyurtmalarim/, async (msg) => {
  const chatId = msg.chat.id;
  const orders = await Order.find({ telegramId: msg.from.id }).sort({ createdAt: -1 }).limit(5);

  if (!orders.length) {
    await bot.sendMessage(chatId, "Hali buyurtma yoq.", { reply_markup: mainMenu });
    return;
  }

  let text = "Buyurtmalaringiz:\n\n";
  orders.forEach((o, i) => {
    const date  = new Date(o.createdAt).toLocaleDateString("uz-UZ");
    const items = o.items.map(it => it.name + " x" + it.quantity).join(", ");
    const table = o.tableNumber ? " | " + o.tableNumber : "";
    text += (i+1) + ". " + date + table + "\n";
    text += items + "\n";
    text += Number(o.total).toLocaleString() + " som - " + (o.status || "Yangi") + "\n\n";
  });

  await bot.sendMessage(chatId, text, { reply_markup: mainMenu });
});

/* ===== MANZIL ===== */
bot.onText(/Manzil/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId,
    "Manzil:\nToshkent sh., Chilonzor tumani\nNavroz kochasi 15-uy\n\nMetro: Chilonzor (5 daqiqa)\nParking mavjud",
    { reply_markup: mainMenu }
  );
  await bot.sendLocation(chatId, 41.2995, 69.2401);
});

/* ===== ISH VAQTI ===== */
bot.onText(/Ish vaqti/, async (msg) => {
  const chatId = msg.chat.id;
  const hour   = (new Date().getUTCHours() + 5) % 24;
  const isOpen = hour >= 10 && hour < 23;
  await bot.sendMessage(chatId,
    "Ish vaqti:\n\nDushanba-Juma: 10:00 - 23:00\nShanba-Yakshanba: 09:00 - 00:00\n\n" +
    (isOpen ? "Hozir OCHIQ" : "Hozir YOPIQ"),
    { reply_markup: mainMenu }
  );
});

/* ===== BOGLANISH ===== */
bot.onText(/Boglanish/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId,
    "Boglanish:\n\nTelefon: +998 77 008 34 13\nTelegram: @Jahonsher",
    {
      reply_markup: {
        inline_keyboard: [[
          { text: "Qongiroq qilish", url: "tel:+998770083413" },
          { text: "Telegram", url: "https://t.me/Jahonsher" }
        ]]
      }
    }
  );
  await bot.sendMessage(chatId, "Boshqa bolimlar:", { reply_markup: mainMenu });
});

/* ===== CALLBACK (qabul/rad) ===== */
bot.on("callback_query", async (query) => {
  const [action, orderId, userId] = query.data.split("_");
  if (action !== "accept" && action !== "reject") return;

  try {
    if (action === "accept") {
      await Order.findByIdAndUpdate(orderId, { status: "Qabul qilindi" });
      await bot.editMessageReplyMarkup(
        { inline_keyboard: [[{ text: "Qabul qilindi", callback_data: "done" }]] },
        { chat_id: query.message.chat.id, message_id: query.message.message_id }
      );
      await bot.sendMessage(Number(userId), "Buyurtmangiz qabul qilindi! Oshpaz tayyorlashni boshladi.");
    } else {
      await Order.findByIdAndUpdate(orderId, { status: "Bekor qilindi" });
      await bot.editMessageReplyMarkup(
        { inline_keyboard: [[{ text: "Bekor qilindi", callback_data: "done" }]] },
        { chat_id: query.message.chat.id, message_id: query.message.message_id }
      );
      await bot.sendMessage(Number(userId), "Buyurtmangiz bekor qilindi. Kechirasiz.");
    }
    await bot.answerCallbackQuery(query.id);
  } catch (err) {
    console.error("CALLBACK ERROR:", err.message);
  }
});

/* ===== WEBHOOK ===== */
const WEBHOOK_PATH = "/webhook/" + BOT_TOKEN;

app.post(WEBHOOK_PATH, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

/* ===== API ROUTES ===== */

app.get("/products", (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, "data", "products.json"), "utf-8"));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/auth", async (req, res) => {
  try {
    const { id, first_name, last_name, username } = req.body;
    const user = await User.findOneAndUpdate(
      { telegramId: id },
      { $set: { telegramId: id, first_name: first_name || "", last_name: last_name || "", username: username || "" } },
      { upsert: true, new: true }
    );
    res.json({ ok: true, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/user/:id", async (req, res) => {
  try {
    const user = await User.findOne({ telegramId: Number(req.params.id) });
    res.json(user || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/user/:id/orders", async (req, res) => {
  try {
    const orders = await Order.find({ telegramId: Number(req.params.id) }).sort({ createdAt: -1 }).limit(30);
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/order", async (req, res) => {
  try {
    const { telegramId, items, user, orderType, tableNumber } = req.body;
    if (!telegramId)    return res.status(400).json({ error: "telegramId yoq" });
    if (!items?.length) return res.status(400).json({ error: "items bosh" });

    let dbUser = await User.findOne({ telegramId: Number(telegramId) });
    const userInfo = {
      first_name: dbUser?.first_name || user?.first_name || "",
      last_name:  dbUser?.last_name  || user?.last_name  || "",
      username:   dbUser?.username   || user?.username   || "",
      phone:      dbUser?.phone      || user?.phone      || ""
    };

    const total = items.reduce((s, i) => s + Number(i.price) * i.quantity, 0);
    const order = await Order.create({
      telegramId: Number(telegramId), items, total, userInfo,
      orderType: orderType || "online",
      tableNumber: tableNumber || "Online",
      status: "Yangi"
    });

    const name  = (userInfo.first_name + " " + userInfo.last_name).trim() || "ID:" + telegramId;
    const uname = userInfo.username ? " (@" + userInfo.username + ")" : "";
    const phone = userInfo.phone    ? "\nTel: " + userInfo.phone : "";
    const table = orderType === "dine_in" ? "Stol: " + tableNumber : "Online buyurtma";

    let msg = "Yangi buyurtma!\n\n";
    msg += table + "\n";
    msg += "Mijoz: " + name + uname + phone + "\n\n";
    msg += "Mahsulotlar:\n";
    items.forEach(it => { msg += "- " + it.name + " x" + it.quantity + " - " + Number(it.price).toLocaleString() + " som\n"; });
    msg += "\nJami: " + total.toLocaleString() + " som";

    await bot.sendMessage(CHEF_ID, msg, {
      reply_markup: {
        inline_keyboard: [[
          { text: "Qabul qilish", callback_data: "accept_" + order._id + "_" + telegramId },
          { text: "Bekor qilish", callback_data: "reject_" + order._id + "_" + telegramId }
        ]]
      }
    });

    res.json({ success: true, order });
  } catch (err) {
    console.error("ORDER ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ===== START SERVER ===== */
app.listen(PORT, async () => {
  console.log("Server " + PORT + " portda ishlayapti");
  if (RAILWAY_URL) {
    const url = "https://" + RAILWAY_URL + WEBHOOK_PATH;
    try {
      await bot.setWebHook(url);
      console.log("Webhook urnatildi:", url);
    } catch(err) {
      console.error("Webhook error:", err.message);
    }
  } else {
    bot.startPolling();
    console.log("Local polling ishga tushdi");
  }
});