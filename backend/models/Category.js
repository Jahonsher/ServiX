const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    name_ru: String,
    emoji: { type: String, default: "🍽" },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    restaurantId: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Category", categorySchema);