require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

if (!process.env.BOT_TOKEN) {
  console.error("❌ BOT_TOKEN .env da yo‘q");
  process.exit(1);
}

const bot = new TelegramBot(process.env.BOT_TOKEN);

console.log("🤖 Telegram bot polling ishga tushdi");

/* tiny message listener to keep polling alive */
bot.on("message", msg => {
  console.log("📬 Telegram update:", msg.chat.id, msg.text);
});

/* ================= MONGODB ================= */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB ulandi"))
  .catch(err => {
    console.error("❌ Mongo error:", err.message);
    process.exit(1);
  });

/* ================= ORDER MODEL ================= */
const orderSchema = new mongoose.Schema({
  telegramId: Number,
  items: Array,
  total: Number,
  userInfo: Object
}, { timestamps: true });

const Order = mongoose.model("Order", orderSchema);

/* ================= PRODUCTS ================= */
app.get("/products", (req, res) => {
  try {
    const filePath = path.join(__dirname, "data", "products.json");
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    res.json(data);
  } catch (err) {
    console.error("PRODUCT ERROR:", err.message);
    res.status(500).json({ error: "Products error" });
  }
});

/* ================= CREATE ORDER ================= */
app.post("/order", async (req, res) => {
  try {
    console.log("=== ORDER ROUTE TRIGGERED ===");

    const { telegramId, items, user } = req.body;

    if (!telegramId) return res.status(400).json({ error: "telegramId yo‘q" });
    if (!items || !items.length) return res.status(400).json({ error: "items bo‘sh" });

    const total = items.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0);

    const order = await Order.create({
      telegramId: Number(telegramId),
      items,
      total,
      userInfo: user || null
    });

    // Telegram message
    let message = "🆕 Yangi buyurtma\n\n";
    items.forEach(it => {
      message += `🍽 ${it.name} — ${it.quantity} ta — ${it.price} so'm\n`;
    });
    message += `\n💰 Jami: ${total} so'm`;

    console.log("📩 Telegramga yuborilmoqda...");
    await bot.sendMessage(Number(process.env.CHEF_ID), message);

    console.log("📩 Telegram yuborildi");

    res.json(order);

  } catch (err) {
    console.error("❌ ORDER ERROR", err.response?.body || err.message);
    res.status(500).json({ error: "Order server error" });
  }
});

/* ================= LISTEN ================= */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server ${PORT} portda ishlayapti`);
});