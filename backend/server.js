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

const BOT_TOKEN   = process.env.BOT_TOKEN;
const CHEF_ID     = Number(process.env.CHEF_ID);
const MONGO_URI   = process.env.MONGO_URI;
const WEBAPP_URL  = process.env.WEBAPP_URL  || "https://e-comerce-bot.vercel.app";
const PORT        = process.env.PORT        || 5000;
const RAILWAY_URL = process.env.RAILWAY_URL || "";

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

/* ===== KEYBOARD ===== */
const mainMenu = {
  keyboard: [
    [{ text: "Buyurtmalarim" }, { text: "Manzil"    }],
    [{ text: "Ish vaqti"     }, { text: "Boglanish" }]
  ],
  resize_keyboard: true
};

/* ===== SAFE SEND ===== */
async function send(chatId, text, opts) {
  try {
    await bot.sendMessage(chatId, text, opts || {});
  } catch(e) {
    console.error("send error:", e.message);
  }
}

/* ===== /start ===== */
bot.onText(/\/start/, async (msg) => {
  try {
    const chatId    = msg.chat.id;
    const from      = msg.from;
    const firstName = from.first_name || "Mehmon";

    const user = await User.findOneAndUpdate(
      { telegramId: from.id },
      {
        telegramId: from.id,
        first_name: from.first_name || "",
        last_name:  from.last_name  || "",
        username:   from.username   || ""
      },
      { upsert: true, new: true }
    );

    if (!user.phone) {
      await send(chatId, "Salom " + firstName + "! Telefon raqamingizni yuboring:", {
        reply_markup: {
          keyboard: [[{ text: "Telefon yuborish", request_contact: true }]],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      });
    } else {
      await send(chatId, "Xush kelibsiz, " + firstName + "! Bo'lim tanlang:", { reply_markup: mainMenu });
    }
  } catch(e) { console.error("/start error:", e.message); }
});

/* ===== CONTACT ===== */
bot.on("contact", async (msg) => {
  try {
    await User.findOneAndUpdate(
      { telegramId: msg.from.id },
      { phone: msg.contact.phone_number },
      { new: true }
    );
    await send(msg.chat.id, "Telefon saqlandi! Bo'lim tanlang:", { reply_markup: mainMenu });
  } catch(e) { console.error("contact error:", e.message); }
});

/* ===== BUYURTMALARIM ===== */
bot.onText(/Buyurtmalarim/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    const orders = await Order.find({ telegramId: msg.from.id })
      .sort({ createdAt: -1 }).limit(5);

    if (!orders.length) {
      await send(chatId, "Hali buyurtma yoq.", { reply_markup: mainMenu });
      return;
    }

    let text = "Buyurtmalaringiz:\n\n";
    orders.forEach((o, i) => {
      const date  = new Date(o.createdAt).toLocaleDateString("uz-UZ");
      const items = o.items.map(it => it.name + " x" + it.quantity).join(", ");
      const table = o.tableNumber ? " | " + o.tableNumber : "";
      text += (i + 1) + ". " + date + table + "\n";
      text += items + "\n";
      text += Number(o.total).toLocaleString() + " som - " + (o.status || "Yangi") + "\n\n";
    });

    await send(chatId, text, { reply_markup: mainMenu });
  } catch(e) { console.error("buyurtmalar error:", e.message); }
});

/* ===== MANZIL ===== */
bot.onText(/Manzil/, async (msg) => {
  try {
    await send(msg.chat.id,
      "Manzil:\nToshkent sh., Chilonzor tumani\nNavroz kochasi 15-uy\n\nMetro: Chilonzor (5 daqiqa)\nParking mavjud",
      { reply_markup: mainMenu }
    );
  } catch(e) { console.error("manzil error:", e.message); }
});

/* ===== ISH VAQTI ===== */
bot.onText(/Ish vaqti/, async (msg) => {
  try {
    const hour   = (new Date().getUTCHours() + 5) % 24;
    const isOpen = hour >= 10 && hour < 23;
    await send(msg.chat.id,
      "Ish vaqti:\n\nDushanba-Juma: 10:00 - 23:00\nShanba-Yakshanba: 09:00 - 00:00\n\n" +
      (isOpen ? "Hozir OCHIQ" : "Hozir YOPIQ"),
      { reply_markup: mainMenu }
    );
  } catch(e) { console.error("ish vaqti error:", e.message); }
});

/* ===== BOGLANISH ===== */
bot.onText(/Boglanish/, async (msg) => {
  try {
    await send(msg.chat.id,
      "Boglanish:\n\nTelefon: +998 77 008 34 13\nTelegram: @Jahonsher\n\nSavollar uchun togri murojaat qiling!",
      {
        reply_markup: {
          inline_keyboard: [[
            { text: "Telegram @Jahonsher", url: "https://t.me/Jahonsher" }
          ]]
        }
      }
    );
  } catch(e) { console.error("boglanish error:", e.message); }
});

/* ===== CALLBACK (qabul/rad) ===== */
bot.on("callback_query", async (query) => {
  try {
    const parts  = (query.data || "").split("_");
    const action = parts[0];
    const orderId = parts[1];
    const userId  = parts[2];

    if (action !== "accept" && action !== "reject") {
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (action === "accept") {
      await Order.findByIdAndUpdate(orderId, { status: "Qabul qilindi" });
      await bot.editMessageReplyMarkup(
        { inline_keyboard: [[{ text: "Qabul qilindi", callback_data: "done" }]] },
        { chat_id: query.message.chat.id, message_id: query.message.message_id }
      );
      await send(Number(userId), "Buyurtmangiz qabul qilindi! Oshpaz tayyorlashni boshladi.");
    } else {
      await Order.findByIdAndUpdate(orderId, { status: "Bekor qilindi" });
      await bot.editMessageReplyMarkup(
        { inline_keyboard: [[{ text: "Bekor qilindi", callback_data: "done" }]] },
        { chat_id: query.message.chat.id, message_id: query.message.message_id }
      );
      await send(Number(userId), "Buyurtmangiz bekor qilindi. Kechirasiz.");
    }
    await bot.answerCallbackQuery(query.id);
  } catch(e) { console.error("callback error:", e.message); }
});

/* ===== WEBHOOK ===== */
const WEBHOOK_PATH = "/webhook/" + BOT_TOKEN;

app.post(WEBHOOK_PATH, (req, res) => {
  try {
    bot.processUpdate(req.body);
  } catch(e) {
    console.error("processUpdate error:", e.message);
  }
  res.sendStatus(200);
});

/* ===== API ===== */
app.get("/products", (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, "data", "products.json"), "utf-8"));
    res.json(data);
  } catch(e) {
    res.status(500).json({ error: e.message });
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
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/user/:id", async (req, res) => {
  try {
    const user = await User.findOne({ telegramId: Number(req.params.id) });
    res.json(user || {});
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/user/:id/orders", async (req, res) => {
  try {
    const orders = await Order.find({ telegramId: Number(req.params.id) })
      .sort({ createdAt: -1 }).limit(30);
    res.json(orders);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/order", async (req, res) => {
  try {
    const { telegramId, items, user, orderType, tableNumber } = req.body;
    if (!telegramId)    return res.status(400).json({ error: "telegramId yoq" });
    if (!items?.length) return res.status(400).json({ error: "items bosh" });

    const dbUser   = await User.findOne({ telegramId: Number(telegramId) });
    const userInfo = {
      first_name: dbUser?.first_name || user?.first_name || "",
      last_name:  dbUser?.last_name  || user?.last_name  || "",
      username:   dbUser?.username   || user?.username   || "",
      phone:      dbUser?.phone      || user?.phone      || ""
    };

    const total = items.reduce((s, i) => s + Number(i.price) * i.quantity, 0);
    const order = await Order.create({
      telegramId: Number(telegramId),
      items, total, userInfo,
      orderType:   orderType   || "online",
      tableNumber: tableNumber || "Online",
      status: "Yangi"
    });

    const name  = (userInfo.first_name + " " + userInfo.last_name).trim() || "ID:" + telegramId;
    const uname = userInfo.username ? " (@" + userInfo.username + ")" : "";
    const phone = userInfo.phone    ? "\nTel: " + userInfo.phone : "";
    const table = orderType === "dine_in" ? "Stol: " + tableNumber : "Online buyurtma";

    let tgMsg = "Yangi buyurtma!\n\n";
    tgMsg += table + "\n";
    tgMsg += "Mijoz: " + name + uname + phone + "\n\n";
    tgMsg += "Mahsulotlar:\n";
    items.forEach(it => {
      tgMsg += "- " + it.name + " x" + it.quantity + " - " + Number(it.price).toLocaleString() + " som\n";
    });
    tgMsg += "\nJami: " + total.toLocaleString() + " som";

    await send(CHEF_ID, tgMsg, {
      reply_markup: {
        inline_keyboard: [[
          { text: "Qabul qilish", callback_data: "accept_" + order._id + "_" + telegramId },
          { text: "Bekor qilish", callback_data: "reject_"  + order._id + "_" + telegramId }
        ]]
      }
    });

    res.json({ success: true, order });
  } catch(e) {
    console.error("order error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

/* ===== GLOBAL ERROR HANDLER ===== */
process.on("uncaughtException",  e => console.error("uncaughtException:",  e.message));
process.on("unhandledRejection", e => console.error("unhandledRejection:", e));

/* ===== START ===== */
app.listen(PORT, async () => {
  console.log("Server " + PORT + " portda ishlayapti");
  if (RAILWAY_URL) {
    const url = "https://" + RAILWAY_URL + WEBHOOK_PATH;
    try {
      await bot.setWebHook(url);
      console.log("Webhook urnatildi:", url);
    } catch(e) {
      console.error("Webhook error:", e.message);
    }
  } else {
    bot.startPolling();
    console.log("Local polling ishga tushdi");
  }
});