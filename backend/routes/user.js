const express = require("express");
const router = express.Router();
const Order = require("../models/Order");

router.get("/:telegramId", async (req, res) => {

  const orders = await Order.find({
    telegramId: req.params.telegramId
  }).sort({ createdAt: -1 });

  res.json(orders);
});

module.exports = router;