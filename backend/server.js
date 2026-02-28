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

/* ================= TELEGRAM BOT ================= */

if (!process.env.BOT_TOKEN) {
  console.log("❌ BOT_TOKEN yo‘q");
  process.exit(1);
}

const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: true
});

console.log("🤖 Bot ishga tushdi");

/* ================= MONGODB ================= */

if (!process.env.MONGO_URI) {
  console.log("❌ MONGO_URI yo‘q");
  process.exit(1);
}

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB ulandi"))
  .catch(err => {
    console.log("❌ Mongo error:", err.message);
    process.exit(1);
  });

/* ================= ORDER MODEL ================= */

const orderSchema = new mongoose.Schema({
  telegramId: Number,
  items: [
    {
      name: String,
      price: Number,
      quantity: Number
    }
  ],
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
    console.log("PRODUCT ERROR:", err.message);
    res.status(500).json({ error: "Products error" });
  }
});

/* ================= CREATE ORDER ================= */

app.post("/order", async (req, res) => {
  try {

    console.log("=== ORDER ROUTE TRIGGERED ===");

    const { telegramId, items, user } = req.body;

    if (!telegramId)
      return res.status(400).json({ error: "telegramId yo‘q" });

    if (!items || !items.length)
      return res.status(400).json({ error: "items bo‘sh" });

    const total = items.reduce(
      (sum, i) => sum + (Number(i.price) * Number(i.quantity)),
      0
    );

    const order = await Order.create({
      telegramId: Number(telegramId),
      items,
      total,
      userInfo: user || null
    });

    console.log("✅ Order MongoDB ga saqlandi");

    /* TELEGRAM MESSAGE */

    let message = "🆕 Yangi buyurtma\n\n";

    items.forEach(item => {
      message += `🍽 ${item.name}\n`;
      message += `🔢 ${item.quantity} ta\n`;
      message += `💵 ${item.price} so'm\n\n`;
    });

    message += `💰 Jami: ${total} so'm`;
    message += `\n🆔 User ID: ${telegramId}`;

    console.log("📩 Telegramga yuborilmoqda...");

    const result = await bot.sendMessage(
      Number(process.env.CHEF_ID),
      message
    );

    console.log("📩 Telegramga yuborildi:", result.message_id);

    res.json(order);

  } catch (err) {
    console.log("❌ ORDER ERROR:", err.response?.body || err.message);
    res.status(500).json({ error: "Order server error" });
  }
});

/* ================= USER ORDERS ================= */

app.get("/user/:telegramId", async (req, res) => {
  try {
    const orders = await Order.find({
      telegramId: Number(req.params.telegramId)
    }).sort({ createdAt: -1 });

    res.json(orders);
  } catch (err) {
    console.log("USER FETCH ERROR:", err.message);
    res.status(500).json({ error: "User order error" });
  }
});

/* ================= START ================= */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server ${PORT} portda ishlayapti`);
});