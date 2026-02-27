const express = require("express");
const router = express.Router();
const User = require("../models/User");

router.post("/", async (req, res) => {

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

module.exports = router;