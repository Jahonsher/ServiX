/**
 * ServiX AI Service — DINAMIK DATA COLLECTOR
 * 
 * MongoDB dan restaurantId bo'yicha BARCHA collectionlarni avtomatik skanerlaydi.
 * Yangi collection qo'shilsa ham — AI avtomatik ko'radi.
 * Hech qanday hardcode yo'q.
 */

var config = require("../config");
var logger = require("../utils/logger");
var mongoose = require("mongoose");
var Admin = require("../models/Admin");

var ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
var AI_MODEL = "claude-haiku-4-5-20251001";

function calcCost(inp, out) {
  return (inp * 1.0 + out * 5.0) / 1000000;
}

var BLOCKED = [
  /siyosat|prezident|saylov/i, /din\b|islom|namoz/i,
  /parol|token|secret|api.?key/i, /o'ldir|zarar|qurol/i,
];
function isBlocked(t) {
  for (var i = 0; i < BLOCKED.length; i++) {
    if (BLOCKED[i].test(t)) return true;
  }
  return false;
}

/**
 * DINAMIK DATA COLLECTOR
 * 
 * 1. MongoDB dagi BARCHA collectionlarni ro'yxatini oladi
 * 2. Har bir collectionda restaurantId bo'yicha qidiradi
 * 3. Topilgan BARCHA datani AI ga beradi
 * 
 * Natija: AI shu biznesning HAMMA ma'lumotlarini ko'radi
 */
async function collectAllData(rId) {
  logger.info("[AI] Dinamik data yigish: " + rId);
  var db = mongoose.connection.db;
  var result = {};

  // Maxfiy fieldlar — AI ga ko'rsatmaslik kerak
  var HIDE_FIELDS = { password: 0, faceDescriptor: 0, photo: 0, botToken: 0 };

  try {
    // 1. Barcha collectionlarni olish
    var collections = await db.listCollections().toArray();
    var colNames = collections.map(function (c) { return c.name; });

    logger.info("[AI] Collections topildi: " + colNames.join(", "));

    // 2. Har bir collectiondan restaurantId bo'yicha data olish
    for (var i = 0; i < colNames.length; i++) {
      var colName = colNames[i];

      // System collectionlarni o'tkazib yuborish
      if (colName.startsWith("system.")) continue;

      try {
        var col = db.collection(colName);

        // restaurantId bo'yicha qidirish
        var docs = await col.find(
          { restaurantId: rId },
          { projection: HIDE_FIELDS }
        ).sort({ createdAt: -1 }).limit(500).toArray();

        if (docs.length > 0) {
          result[colName] = {
            jami: docs.length,
            malumotlar: docs,
          };
          logger.info("[AI]   " + colName + ": " + docs.length + " ta");
        }
      } catch (e) {
        // Ba'zi collectionlarda restaurantId yo'q bo'lishi mumkin — muammo emas
        logger.debug("[AI]   " + colName + ": " + e.message);
      }
    }

    // 3. Admin ma'lumotlarini qo'shish (restaurantId bo'yicha)
    try {
      var adminDoc = await db.collection("admins").findOne(
        { restaurantId: rId, role: "admin" },
        { projection: HIDE_FIELDS }
      );
      if (adminDoc) {
        result._biznes_nomi = adminDoc.restaurantName || rId;
        result._biznes_info = {
          nomi: adminDoc.restaurantName,
          telefon: adminDoc.phone || "-",
          manzil: adminDoc.address || "-",
          ish_vaqti: (adminDoc.workStart || 10) + ":00 — " + (adminDoc.workEnd || 23) + ":00",
        };
      }
    } catch (e) {
      logger.error("[AI] admin info err: " + e.message);
    }

    // 4. Qo'shimcha hisoblashlar — AI uchun tayyor raqamlar
    result._hisoblashlar = buildCalculations(result);
    result._sana = new Date().toLocaleDateString("uz-UZ", { year: "numeric", month: "long", day: "numeric", weekday: "long" });

  } catch (e) {
    logger.error("[AI] collectAllData error: " + e.message);
  }

  var totalDocs = 0;
  for (var key in result) {
    if (result[key] && result[key].jami) totalDocs += result[key].jami;
  }
  logger.info("[AI] Jami: " + totalDocs + " ta hujjat, " + Object.keys(result).length + " ta collection");

  return result;
}

/**
 * Tayyor hisoblashlar — AI tezroq javob berishi uchun
 */
function buildCalculations(data) {
  var calc = {};
  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Buyurtmalar hisoblash
  if (data.orders && data.orders.malumotlar) {
    var orders = data.orders.malumotlar;

    // Bugungi
    var todayOrders = orders.filter(function (o) { return new Date(o.createdAt) >= today; });
    calc.bugun_buyurtmalar = todayOrders.length;
    calc.bugun_daromad = todayOrders.reduce(function (s, o) { return s + (o.total || 0); }, 0);

    // Oylik
    var monthOrders = orders.filter(function (o) { return new Date(o.createdAt) >= monthStart; });
    calc.oylik_buyurtmalar = monthOrders.length;
    calc.oylik_daromad = monthOrders.reduce(function (s, o) { return s + (o.total || 0); }, 0);

    // Ortacha chek
    calc.ortacha_chek = monthOrders.length > 0 ? Math.round(calc.oylik_daromad / monthOrders.length) : 0;

    // Top mahsulotlar (oylik)
    var itemMap = {};
    monthOrders.forEach(function (o) {
      (o.items || []).forEach(function (item) {
        var k = item.name || "?";
        if (!itemMap[k]) itemMap[k] = { soni: 0, summa: 0 };
        itemMap[k].soni += item.quantity || 1;
        itemMap[k].summa += (item.price || 0) * (item.quantity || 1);
      });
    });
    var topList = [];
    for (var k in itemMap) {
      topList.push({ nom: k, soni: itemMap[k].soni, summa: itemMap[k].summa });
    }
    topList.sort(function (a, b) { return b.soni - a.soni; });
    calc.top_mahsulotlar = topList;

    // Kunlik breakdown (shu oy)
    var kunlik = [];
    var kunSoni = now.getDate();
    for (var d = 0; d < kunSoni; d++) {
      var kun = new Date(monthStart);
      kun.setDate(kun.getDate() + d);
      var kunEnd = new Date(kun);
      kunEnd.setDate(kunEnd.getDate() + 1);
      var kOrders = monthOrders.filter(function (o) { return new Date(o.createdAt) >= kun && new Date(o.createdAt) < kunEnd; });
      var kItems = {};
      kOrders.forEach(function (o) {
        (o.items || []).forEach(function (item) {
          var n = item.name || "?";
          if (!kItems[n]) kItems[n] = { soni: 0, summa: 0 };
          kItems[n].soni += item.quantity || 1;
          kItems[n].summa += (item.price || 0) * (item.quantity || 1);
        });
      });
      var kItemsList = [];
      for (var ki in kItems) { kItemsList.push({ nom: ki, soni: kItems[ki].soni, summa: kItems[ki].summa }); }
      kItemsList.sort(function (a, b) { return b.soni - a.soni; });
      kunlik.push({
        sana: kun.getDate() + "-" + kun.toLocaleDateString("uz-UZ", { month: "short" }),
        buyurtmalar: kOrders.length,
        daromad: kOrders.reduce(function (s, o) { return s + (o.total || 0); }, 0),
        mahsulotlar: kItemsList,
      });
    }
    calc.kunlik_hisobot = kunlik;

    // Oylar statistikasi (6 oy)
    var oylar = [];
    for (var oi = 0; oi < 6; oi++) {
      var oyB = new Date(now.getFullYear(), now.getMonth() - oi, 1);
      var oyE = new Date(now.getFullYear(), now.getMonth() - oi + 1, 1);
      var oyN = oyB.toLocaleDateString("uz-UZ", { month: "long", year: "numeric" });
      var oyO = orders.filter(function (o) { return new Date(o.createdAt) >= oyB && new Date(o.createdAt) < oyE; });
      var oyD = oyO.reduce(function (s, o) { return s + (o.total || 0); }, 0);
      if (oyO.length > 0) {
        oylar.push({ oy: oyN, buyurtmalar: oyO.length, daromad: oyD });
      }
    }
    calc.oylar_statistikasi = oylar;
  }

  // Xodimlar hisoblash
  if (data.employees && data.employees.malumotlar) {
    calc.xodimlar_soni = data.employees.jami;
    calc.jami_maosh = data.employees.malumotlar.reduce(function (s, e) { return s + (e.salary || 0); }, 0);
  }

  // Menyu
  if (data.products && data.products.malumotlar) {
    calc.menyu_soni = data.products.jami;
  }

  return calc;
}

// ===== SYSTEM PROMPT =====
function buildPrompt(name) {
  var sana = new Date().toLocaleDateString("uz-UZ", { year: "numeric", month: "long", day: "numeric" });
  return 'Sen "' + name + '" biznesining professional buxgalteri va tahlilchisisan. Noming ServiX AI.\n\n' +

    'SENGA SHU BIZNESNING MONGODB DAGI BARCHA MALUMOTLARI BERILGAN.\n' +
    'Har bir collection alohida: orders, products, categories, employees, attendances, inventories, users, branches va boshqalar.\n' +
    'Har bir collection ichida "jami" (soni) va "malumotlar" (array) bor.\n' +
    '_hisoblashlar ichida tayyor raqamlar bor: bugun, oylik, kunlik, top mahsulotlar, oylar statistikasi.\n\n' +

    'AQLLI TUSHUNISH:\n' +
    'Foydalanuvchi qisqa yoki notogri yozishi mumkin. FIKRLAB nima demoqchiligini tushun:\n' +
    '- "5 aprel product" = 5-aprelda qaysi mahsulotlar sotilgan (_hisoblashlar.kunlik_hisobot dan)\n' +
    '- "mart hisoboti" = mart oyi statistikasi (_hisoblashlar.oylar_statistikasi dan)\n' +
    '- "kechagi sotuv" = kecha qancha buyurtma va daromad\n' +
    '- "menyu nechta" = menyuda nechta taom bor (products collectiondan)\n' +
    '- "ishchi kechikish" = kechikkan xodimlar (attendances dan)\n' +
    '- "ombor holat" = kam/tugagan mahsulotlar (inventories dan)\n' +
    '- Tushunarsiz bolsa — eng yaqin manoda javob ber, "tushunmadim" dema.\n\n' +

    'JAVOB FORMATI:\n' +
    '1. Faqat soralganni javob ber, ortiqcha qushma.\n' +
    '2. Har javob oxirida 1-2 qator 💡 MASLAHAT yoki ⚠️ OGOHLANTIRISH ber.\n' +
    '3. Jadval kerak bolsa — markdown table.\n' +
    '4. Pul: 1,250,000 som.\n' +
    '5. Raqam 0 bolsa — "0 ta buyurtma, 0 som" yoz.\n' +
    '6. Foydalanuvchi tilida javob ber.\n' +
    '7. Siyosat, din, dasturlash haqida gapirma.\n' +
    '8. Javob oxiri: — ServiX AI | ' + sana;
}

// ===== API CALL =====
async function askAI(restaurantId, adminId, adminUsername, question) {
  var startTime = Date.now();

  var admin = await Admin.findOne({ restaurantId: restaurantId, role: "admin" })
    .select("restaurantName businessType modules aiLimit");
  if (!admin) throw new Error("Biznes topilmadi");
  if (!admin.modules || !admin.modules.aiAgent) throw new Error("AI Agent moduli yoqilmagan");
  if (!config.anthropicApiKey) throw new Error("AI xizmati sozlanmagan");

  if (isBlocked(question)) {
    return {
      answer: "Bu savol mening vakolatimdan tashqarida.\n\n— ServiX AI",
      inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0, filtered: true
    };
  }

  var data = await collectAllData(restaurantId);
  var systemPrompt = buildPrompt(admin.restaurantName);
  var userMessage = "BIZNES MALUMOTLARI (MongoDB):\n" + JSON.stringify(data, null, 2) + "\n\nSAVOL: " + question;

  logger.info("[AI] -> Anthropic: " + restaurantId + " | " + question.substring(0, 60));

  var axios = require("axios");
  var response;
  try {
    response = await axios.post(ANTHROPIC_API, {
      model: AI_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }, {
      headers: {
        "x-api-key": config.anthropicApiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      timeout: 60000,
    });
  } catch (err) {
    var ed = err.response ? (err.response.status + " " + JSON.stringify(err.response.data)) : err.message;
    logger.error("[AI] Anthropic error: " + ed);
    throw err;
  }

  var result = response.data;
  var answer = (result.content && result.content[0]) ? result.content[0].text : "Javob olib bolmadi";
  var inp = result.usage ? result.usage.input_tokens : 0;
  var out = result.usage ? result.usage.output_tokens : 0;

  logger.info("[AI] OK: tokens=" + (inp + out) + " cost=$" + calcCost(inp, out).toFixed(5) + " time=" + (Date.now() - startTime) + "ms");

  return {
    answer: answer,
    inputTokens: inp, outputTokens: out, totalTokens: inp + out,
    cost: calcCost(inp, out), model: AI_MODEL,
    responseTime: Date.now() - startTime, filtered: false,
  };
}

async function collectExportData(rId) {
  return await collectAllData(rId);
}

module.exports = {
  askAI: askAI,
  isBlocked: isBlocked,
  collectAllData: collectAllData,
  collectExportData: collectExportData,
  calcCost: calcCost,
  AI_MODEL: AI_MODEL,
};