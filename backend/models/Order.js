const mongoose = require("mongoose");

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
}, {
  timestamps: true
});

module.exports = mongoose.model("Order", orderSchema);