const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema({
  telegramId: Number,
  items: [
    {
      name: String,
      price: Number,
      quantity: Number
    }
  ],
  total: Number,
  status: {
    type: String,
    default: "new"
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Order", OrderSchema);