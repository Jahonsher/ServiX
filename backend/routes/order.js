const express = require("express");
const Order = require("../models/Order");


module.exports = function(bot) {

    
  const router = express.Router();

  /* ===========================
     CREATE ORDER
  =========================== */
  router.post("/", async (req, res) => {
    try {

      const { telegramId, items, user } = req.body;

      if (!telegramId)
        return res.status(400).json({ error: "telegramId yo‘q" });

      if (!items || !items.length)
        return res.status(400).json({ error: "items bo‘sh" });

      /* TOTAL */
      const total = items.reduce(
        (sum, i) => sum + (Number(i.price) * Number(i.quantity)),
        0
      );

      /* SAVE TO MONGO */
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

      message += `💰 Jami: ${total} so'm\n\n`;
      message += `🆔 User ID: ${telegramId}`;

      await bot.sendMessage(Number(process.env.CHEF_ID),message);

      console.log("📩 Telegramga yuborildi");

      res.json(order);

    } catch (err) {
      console.log("❌ ORDER ERROR:", err.message);
      res.status(500).json({ error: "Order server error" });
    }
  });

  /* ===========================
     USER ORDERS
  =========================== */
  router.get("/:telegramId", async (req, res) => {
    try {

      const orders = await Order.find({
        telegramId: Number(req.params.telegramId)
      }).sort({ createdAt: -1 });

      res.json(orders);

    } catch (err) {
      console.log("❌ FETCH ERROR:", err.message);
      res.status(500).json({ error: "User order error" });
    }
  });

  return router;
};

console.log("ORDER HIT");
console.log("CHEF_ID:", process.env.CHEF_ID);