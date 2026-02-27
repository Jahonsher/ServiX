require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const TelegramBot = require("node-telegram-bot-api");

const User = require("./models/User");
const Order = require("./models/Order");

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB ulandi ✅"))
  .catch(err => console.log(err));

const bot = new TelegramBot(process.env.BOT_TOKEN);

/* PRODUCTS */
app.get("/products", (req, res) => {
  const filePath = path.join(__dirname, "data", "products.json");
  const data = fs.readFileSync(filePath);
  res.json(JSON.parse(data));
});

/* AUTH */
app.post("/auth", async (req, res) => {

  const { id, first_name, username } = req.body;

  let user = await User.findOne({ telegramId: id });

  if (!user) {
    user = await User.create({
      telegramId: id,
      firstName: first_name,
      username
    });
  }

  res.json(user);
});

/* ORDER */
app.post("/order", async (req, res) => {

  const { telegramId, items } = req.body;

  const total = items.reduce(
    (sum, i) => sum + (i.price * i.quantity),
    0
  );

  const order = await Order.create({
    telegramId,
    items,
    total
  });

  const text = items
    .map(i => `${i.name} - ${i.quantity} ta`)
    .join("\n");

  bot.sendMessage(
    process.env.CHEF_ID,
    `🆕 Yangi buyurtma

${text}

💰 ${total} so'm`
  );

  res.json(order);
});

/* USER ORDERS */
app.get("/user/:telegramId", async (req, res) => {

  const orders = await Order.find({
    telegramId: req.params.telegramId
  }).sort({ createdAt: -1 });

  res.json(orders);
});

app.listen(process.env.PORT, () => {
  console.log("Server ishlayapti 🚀");
});