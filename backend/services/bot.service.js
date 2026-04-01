const TelegramBot = require("node-telegram-bot-api");
const config = require("../config");
const logger = require("../utils/logger");
const User = require("../models/User");
const Order = require("../models/Order");
const Admin = require("../models/Admin");
const { isBotBlocked } = require("../middleware/auth");

// Barcha faol botlar
const bots = {};

/**
 * Botni ishga tushirish
 */
async function startBot(restaurantId, token, webappUrl, chefId) {
  if (!token) return;

  // Eski botni to'xtatish
  if (bots[restaurantId]) {
    try { await bots[restaurantId].deleteWebHook(); } catch (e) { /* */ }
    delete bots[restaurantId];
  }

  try {
    const bot = new TelegramBot(token);
    bots[restaurantId] = bot;

    registerBotHandlers(bot, restaurantId, webappUrl, chefId);

    if (config.domain) {
      // Webhook URL da token o'rniga hash ishlatamiz
      const crypto = require("crypto");
      const whHash = crypto
        .createHmac("sha256", config.jwtSecret)
        .update(restaurantId)
        .digest("hex")
        .slice(0, 16);
      const whPath = `/wh/${restaurantId}/${whHash}`;
      await bot.setWebHook(`https://${config.domain}${whPath}`);
      logger.info(`✅ Bot webhook: ${restaurantId}`);
    } else {
      logger.warn(`⚠️  DOMAIN yo'q — webhook o'rnatilmadi: ${restaurantId}`);
    }

    logger.info(`✅ Bot started: ${restaurantId}`);
  } catch (err) {
    logger.error(`Bot start error: ${restaurantId}`, err.message);
  }
}

/**
 * Botni to'xtatish
 */
async function stopBot(restaurantId) {
  if (bots[restaurantId]) {
    try { await bots[restaurantId].deleteWebHook(); } catch (e) { /* */ }
    delete bots[restaurantId];
    logger.info(`Bot stopped: ${restaurantId}`);
  }
}

/**
 * Bot obyektini olish
 */
function getBot(restaurantId) {
  return bots[restaurantId] || null;
}

/**
 * Barcha faol botlar ro'yxati
 */
function getActiveBots() {
  return Object.keys(bots);
}

/**
 * Webhook update ni qayta ishlash
 */
function processWebhook(restaurantId, update) {
  if (bots[restaurantId]) {
    try {
      bots[restaurantId].processUpdate(update);
    } catch (err) {
      logger.error(`Webhook process error: ${restaurantId}`, err.message);
    }
  }
}

/**
 * Bot handlerlarini ro'yxatdan o'tkazish
 */
function registerBotHandlers(bot, restaurantId, webappUrl, chefId) {
  const menu = {
    keyboard: [
      [{ text: "Buyurtmalarim" }, { text: "Manzil" }],
      [{ text: "Ish vaqti" }, { text: "Boglanish" }],
    ],
    resize_keyboard: true,
  };

  const broadcastSessions = {};

  async function send(id, text, extra) {
    try {
      await bot.sendMessage(id, text, extra || {});
    } catch (err) {
      logger.debug(`send error: ${err.message}`);
    }
  }

  async function checkBlocked(chatId) {
    const bc = await isBotBlocked(restaurantId);
    if (bc.blocked) {
      await send(chatId, "🔒 Restoran vaqtincha ishlamayapti.\n\n" + (bc.reason || ""));
      return true;
    }
    return false;
  }

  // /start
  bot.onText(/\/start/, async (msg) => {
    try {
      if (await checkBlocked(msg.chat.id)) return;
      const tgId = Number(msg.from.id);
      const u = await User.findOneAndUpdate(
        { telegramId: tgId, restaurantId },
        {
          telegramId: tgId,
          restaurantId,
          first_name: msg.from.first_name || "",
          last_name: msg.from.last_name || "",
          username: msg.from.username || "",
        },
        { upsert: true, new: true }
      );

      if (!u.phone) {
        await send(msg.chat.id, `Salom ${msg.from.first_name || ""}! Telefon raqamingizni yuboring:`, {
          reply_markup: {
            keyboard: [[{ text: "📱 Telefon yuborish", request_contact: true }]],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        });
      } else {
        await send(msg.chat.id, `Xush kelibsiz ${msg.from.first_name || ""}! Bo'lim tanlang:`, {
          reply_markup: menu,
        });
      }
    } catch (err) {
      logger.error("start:", err.message);
    }
  });

  // Contact
  bot.on("contact", async (msg) => {
    try {
      const tgId = Number(msg.from.id);
      await User.findOneAndUpdate(
        { telegramId: tgId, restaurantId },
        { phone: msg.contact.phone_number },
        { upsert: true }
      );
      await send(msg.chat.id, "✅ Telefon saqlandi! Bo'lim tanlang:", {
        reply_markup: menu,
      });
    } catch (err) {
      logger.error("contact:", err.message);
    }
  });

  // Buyurtmalarim
  bot.onText(/Buyurtmalarim/, async (msg) => {
    try {
      if (await checkBlocked(msg.chat.id)) return;
      const list = await Order.find({ telegramId: msg.from.id, restaurantId })
        .sort({ createdAt: -1 })
        .limit(5);
      if (!list.length) {
        return send(msg.chat.id, "Buyurtma yo'q.", { reply_markup: menu });
      }
      let t = "Buyurtmalar:\n\n";
      list.forEach((o, i) => {
        t += `${i + 1}. ${new Date(o.createdAt).toLocaleDateString()}\n`;
        t += o.items.map((x) => `${x.name} x${x.quantity}`).join(", ") + "\n";
        t += `${Number(o.total).toLocaleString()} som | ${o.status}\n\n`;
      });
      await send(msg.chat.id, t, { reply_markup: menu });
    } catch (err) {
      logger.debug("buyurtmalarim:", err.message);
    }
  });

  // Manzil
  bot.onText(/Manzil/, async (msg) => {
    try {
      if (await checkBlocked(msg.chat.id)) return;
      const adminInfo = await Admin.findOne({ restaurantId, role: "admin" });
      await send(msg.chat.id, "📍 Manzil:\n" + (adminInfo?.address || "Manzil kiritilmagan"), {
        reply_markup: menu,
      });
    } catch (err) {
      logger.debug("manzil:", err.message);
    }
  });

  // Ish vaqti
  bot.onText(/Ish vaqti/, async (msg) => {
    try {
      if (await checkBlocked(msg.chat.id)) return;
      const adminInfo = await Admin.findOne({ restaurantId, role: "admin" });
      const workStart = adminInfo?.workStart || 10;
      const workEnd = adminInfo?.workEnd || 23;
      const h = (new Date().getUTCHours() + 5) % 24;
      const isOpen = h >= workStart && h < workEnd;
      const workHours = adminInfo?.workHours || `${workStart}:00-${workEnd}:00`;
      await send(
        msg.chat.id,
        `🕐 Ish vaqti:\n${workHours}\n\n${isOpen ? "✅ Hozir OCHIQ" : "❌ Hozir YOPIQ"}`,
        { reply_markup: menu }
      );
    } catch (err) {
      logger.debug("ish vaqti:", err.message);
    }
  });

  // Bog'lanish
  bot.onText(/Boglanish/, async (msg) => {
    try {
      if (await checkBlocked(msg.chat.id)) return;
      const adminInfo = await Admin.findOne({ restaurantId, role: "admin" });
      await send(msg.chat.id, "📞 Bog'lanish:\nTelefon: " + (adminInfo?.phone || ""), {
        reply_markup: menu,
      });
    } catch (err) {
      logger.debug("boglanish:", err.message);
    }
  });

  // Broadcast
  bot.onText(/\/broadcast/, async (msg) => {
    if (msg.chat.id !== chefId) return send(msg.chat.id, "⛔ Faqat admin uchun.");
    broadcastSessions[msg.chat.id] = { step: "text", restaurantId };
    send(msg.chat.id, "📢 Broadcast matnini yozing:\n_(Bekor: /cancel)_", {
      parse_mode: "Markdown",
    });
  });

  bot.onText(/\/cancel/, async (msg) => {
    if (broadcastSessions[msg.chat.id]) {
      delete broadcastSessions[msg.chat.id];
      send(msg.chat.id, "❌ Bekor qilindi.");
    }
  });

  // Broadcast message handler
  bot.on("message", async (msg) => {
    const session = broadcastSessions[msg.chat.id];
    if (!session || session.restaurantId !== restaurantId) return;

    if (session.step === "text") {
      if (!msg.text || msg.text.startsWith("/")) return;
      session.text = msg.text;
      session.step = "photo";
      send(msg.chat.id, "✅ Matn saqlandi. Rasm yuboring yoki /skip yozing.");
      return;
    }

    if (session.step === "photo") {
      if (msg.text === "/skip") session.photoId = null;
      else if (msg.photo) session.photoId = msg.photo[msg.photo.length - 1].file_id;
      else {
        send(msg.chat.id, "Rasm yuboring yoki /skip yozing.");
        return;
      }
      session.step = "confirm";
      send(msg.chat.id, "📋 Yuborilsinmi?\n\n" + session.text, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Ha", callback_data: `bc_confirm_${restaurantId}` },
              { text: "❌ Bekor", callback_data: `bc_cancel_${restaurantId}` },
            ],
          ],
        },
      });
    }
  });

  // Callback queries
  bot.on("callback_query", async (q) => {
    try {
      if (await checkBlocked(q.message.chat.id)) {
        await bot.answerCallbackQuery(q.id);
        return;
      }

      const data = q.data;

      if (data.startsWith("accept_")) {
        const [, orderId, userId] = data.split("_");
        await Order.findByIdAndUpdate(orderId, { status: "Qabul qilindi" });
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [[{ text: "✅ Qabul qilindi", callback_data: "done" }]] },
          { chat_id: q.message.chat.id, message_id: q.message.message_id }
        );
        await send(Number(userId), "✅ Buyurtmangiz qabul qilindi! Tayyorlanmoqda.");

        // 30 sekunddan keyin reyting so'rash
        setTimeout(async () => {
          await send(Number(userId), "Buyurtmangizni baholang:", {
            reply_markup: {
              inline_keyboard: [
                [1, 2, 3, 4, 5].map((n) => ({
                  text: "⭐".repeat(n) + n,
                  callback_data: `rate_${orderId}_${n}`,
                })),
              ],
            },
          });
        }, 30000);
      } else if (data.startsWith("reject_")) {
        const [, orderId, userId] = data.split("_");
        await Order.findByIdAndUpdate(orderId, { status: "Bekor qilindi" });
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [[{ text: "❌ Bekor qilindi", callback_data: "done" }]] },
          { chat_id: q.message.chat.id, message_id: q.message.message_id }
        );
        await send(Number(userId), "❌ Buyurtmangiz bekor qilindi.");
      } else if (data.startsWith("rate_")) {
        const [, orderId, stars] = data.split("_");
        await Order.findByIdAndUpdate(orderId, { rating: Number(stars) });
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [[{ text: `${"⭐".repeat(Number(stars))} Baholandi!`, callback_data: "done" }]] },
          { chat_id: q.message.chat.id, message_id: q.message.message_id }
        );
        await bot.answerCallbackQuery(q.id, { text: "Rahmat!" });
        return;
      } else if (data === `bc_confirm_${restaurantId}`) {
        const session = broadcastSessions[q.message.chat.id];
        if (!session) {
          await bot.answerCallbackQuery(q.id);
          return;
        }
        await bot.answerCallbackQuery(q.id, { text: "Yuborilmoqda..." });
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: q.message.chat.id, message_id: q.message.message_id }
        );

        const users = await User.find({ restaurantId });
        let sent = 0;
        let failed = 0;
        let cachedId = null;

        for (const user of users) {
          try {
            if (session.photoId || cachedId) {
              const m2 = await bot.sendPhoto(Number(user.telegramId), cachedId || session.photoId, {
                caption: session.text || "",
              });
              if (!cachedId && m2.photo) cachedId = m2.photo[m2.photo.length - 1].file_id;
            } else {
              await bot.sendMessage(Number(user.telegramId), session.text, { parse_mode: "HTML" });
            }
            sent++;
            await new Promise((r) => setTimeout(r, 50));
          } catch (e) {
            failed++;
          }
        }

        delete broadcastSessions[q.message.chat.id];
        await send(q.message.chat.id, `✅ Broadcast yakunlandi!\nYuborildi: ${sent}\nXato: ${failed}`);
        return;
      } else if (data === `bc_cancel_${restaurantId}`) {
        delete broadcastSessions[q.message.chat.id];
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: q.message.chat.id, message_id: q.message.message_id }
        );
        await send(q.message.chat.id, "❌ Bekor qilindi.");
        await bot.answerCallbackQuery(q.id);
        return;
      }

      await bot.answerCallbackQuery(q.id);
    } catch (err) {
      logger.error("callback:", err.message);
    }
  });
}

module.exports = {
  startBot,
  stopBot,
  getBot,
  getActiveBots,
  processWebhook,
};