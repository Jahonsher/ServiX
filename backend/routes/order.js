const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const User = require("../models/User");

router.post("/", async (req, res) => {

  const bot = req.app.get("bot");
  const { telegramId, items } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: "Mahsulotlar yo‘q" });
  }

  // user mavjudligini tekshiramiz
  let user = await User.findOne({ telegramId });
  if (!user) {
    user = await User.create({
      telegramId,
      firstName: "Unknown"
    });
  }

  const total = items.reduce(
    (sum, i) => sum + (i.price * i.quantity),
    0
  );

  const order = await Order.create({
    telegramId,
    items,
    total
  });

  const itemsText = items
    .map(i => `${i.name} - ${i.quantity} ta`)
    .join("\n");

  await bot.sendMessage(
    process.env.CHEF_ID,
    `🆕 Yangi buyurtma

${itemsText}

💰 ${total} so'm`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🍳 Qabul qilish", callback_data: `accept_${order._id}` },
            { text: "✅ Tayyor", callback_data: `ready_${order._id}` },
            { text: "🚚 Yetkazildi", callback_data: `deliver_${order._id}` }
          ]
        ]
      }
    }
  );

  res.json(order);
});

module.exports = router;