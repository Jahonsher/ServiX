const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    telegramId: Number,
    first_name: String,
    last_name: String,
    username: String,
    phone: String,
    restaurantId: { type: String, required: true },
  },
  { timestamps: true }
);

userSchema.index({ telegramId: 1, restaurantId: 1 }, { unique: true });

module.exports = mongoose.model("User", userSchema);