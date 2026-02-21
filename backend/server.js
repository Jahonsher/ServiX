require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const PORT = process.env.PORT || 5000;

app.post("/order", async (req, res) => {
  const { name, phone, product, price } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ error: "Ma'lumot to'liq emas" });
  }

  const message = `
🛒 YANGI BUYURTMA

👤 Ism: ${name}
📞 Telefon: ${phone}
📦 Mahsulot: ${product}
💰 Narx: ${price}
`;

  try {
    await axios.post(
  `https://api.telegram.org/bot${TOKEN}/sendMessage`,
  {
    chat_id: CHAT_ID,
    text: message,
  }
);

    res.json({ success: true });
  } catch (err) {
  console.log("TELEGRAM ERROR:");
  console.log(err.response?.data);
  console.log(err.message);
  res.status(500).json({ error: "Telegram error" });
}
});

app.listen(PORT, () => {
  console.log(`🚀 Server ${PORT} portda ishlayapti`);
});