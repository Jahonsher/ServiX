const config = require("../config");
const logger = require("../utils/logger");
const Order = require("../models/Order");
const User = require("../models/User");
const Admin = require("../models/Admin");
const { Employee, Attendance, Inventory, Branch } = require("../models");

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const AI_MODEL = "claude-haiku-4-5-20251001";
const PRICING = { input: 1.0, output: 5.0 };

function calcCost(inp, out) {
  return (inp * PRICING.input + out * PRICING.output) / 1_000_000;
}

const BLOCKED = [
  /siyosat|prezident|saylov/i, /din\b|islom|namoz/i,
  /parol|token|secret|api.?key/i, /o'ldir|zarar|qurol/i,
];
function isBlocked(t) { return BLOCKED.some((p) => p.test(t)); }

// ===== AQLLI DATA COLLECTOR — faqat kerakli datani oladi =====
async function collectData(restaurantId, question) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const q = question.toLowerCase();

  // Qaysi vaqt oraligi kerak
  const need7 = /7\s*kun|hafta|weekly|oxirgi.*kun/i.test(q);
  const need30 = /30\s*kun|oy|oylik|month|mart|aprel|fevral|yanvar|may|iyun|iyul|avg|sent|okt|noy|dek/i.test(q);
  const needToday = /bugun|today|hozir/i.test(q);
  const needKecha = /kecha|yesterday|o'tgan\s*kun/i.test(q);

  // Qaysi data turi kerak
  const needProducts = /mahsulot|product|taom|menyu|sotuv|sotil|top|mashxur|ommabop/i.test(q);
  const needRevenue = /daromad|tushum|revenue|pul|foyda|sotuv|savdo|hisobot|report|moliya|buxgalter/i.test(q);
  const needOrders = /buyurtma|order|zakaz|dona|soni/i.test(q);
  const needEmployees = /ishchi|xodim|hodim|kechik|davomat|maosh|salary|keldi|kelmadi|ishla|shtraf/i.test(q);
  const needInventory = /ombor|mahsulot|stock|zaxira|tugay|kam\s*qol|go'sht|un\b|yog'|ingredient/i.test(q);
  const needAll = /umumiy|barchasi|all|tuliq|to'liq|hisobot|report|buxgalter/i.test(q);

  // Vaqt oralig'ini hisoblash
  let startDate = new Date(today);
  if (need30) { startDate = new Date(now.getFullYear(), now.getMonth(), 1); }
  else if (need7) { startDate.setDate(startDate.getDate() - 7); }
  else if (needKecha) { startDate.setDate(startDate.getDate() - 1); }
  // default: bugun

  const endDate = needKecha ? today : new Date(now.getTime() + 86400000);

  const data = {};
  data._davr = need30 ? "Oylik" : need7 ? "7 kunlik" : needKecha ? "Kechagi" : "Bugungi";
  data._sana = now.toLocaleDateString("uz-UZ", { year: "numeric", month: "long", day: "numeric" });

  // Buyurtmalar (daromad, mahsulot, order uchun kerak)
  if (needProducts || needRevenue || needOrders || needAll) {
    const orders = await Order.find({ restaurantId, createdAt: { $gte: startDate, $lt: endDate } }).lean();
    data.buyurtmalar_soni = orders.length;
    data.jami_daromad = orders.reduce((s, o) => s + (o.total || 0), 0);
    data.online = orders.filter((o) => o.orderType === "online").length;
    data.restoranda = orders.filter((o) => o.orderType === "dine_in").length;

    if (needProducts || needAll) {
      const itemMap = {};
      orders.forEach((o) => (o.items || []).forEach((item) => {
        if (!itemMap[item.name]) itemMap[item.name] = { soni: 0, summa: 0 };
        itemMap[item.name].soni += item.quantity || 1;
        itemMap[item.name].summa += (item.price || 0) * (item.quantity || 1);
      }));
      data.mahsulotlar = Object.entries(itemMap)
        .map(([nom, d]) => ({ nom, ...d }))
        .sort((a, b) => b.soni - a.soni);
    }

    // Kunlik breakdown (7 yoki 30 kunlik uchun)
    if (need7 || need30) {
      const days = need30 ? 30 : 7;
      const trend = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today); d.setDate(d.getDate() - i);
        const dn = new Date(d); dn.setDate(dn.getDate() + 1);
        const dayO = orders.filter((o) => { const ct = new Date(o.createdAt); return ct >= d && ct < dn; });
        if (dayO.length > 0) {
          trend.push({ sana: d.toLocaleDateString("uz-UZ", { day: "numeric", month: "short" }), buyurtmalar: dayO.length, daromad: dayO.reduce((s, o) => s + (o.total || 0), 0) });
        }
      }
      data.kunlik_breakdown = trend;
    }
  }

  if (needEmployees || needAll) {
    const [emps, att] = await Promise.all([
      Employee.find({ restaurantId, active: true }).select("name position salary workStart workEnd role").lean(),
      Attendance.find({ restaurantId, date: today.toISOString().split("T")[0] }).lean(),
    ]);
    data.xodimlar = emps.map((e) => {
      const a = att.find((x) => x.employeeId?.toString() === e._id.toString());
      return { ism: e.name, lavozim: e.position || "—", maosh: e.salary || 0, holat: a ? a.status : "—", kechikish: a?.lateMinutes || 0 };
    });
  }

  if (needInventory || needAll) {
    const inv = await Inventory.find({ restaurantId, active: true }).lean();
    data.ombor = inv.map((i) => ({
      nomi: i.productName, qoldiq: i.currentStock, birlik: i.unit, min: i.minStock,
      holat: i.currentStock <= 0 ? "TUGAGAN" : i.currentStock <= i.minStock ? "KAM" : "OK",
    }));
  }

  return data;
}

// ===== EXPORT uchun to'liq data =====
async function collectExportData(restaurantId, question) {
  const q = question || "oylik to'liq hisobot";
  return await collectData(restaurantId, q);
}

// ===== SYSTEM PROMPT =====
function buildPrompt(name, type) {
  const sana = new Date().toLocaleDateString("uz-UZ", { year: "numeric", month: "long", day: "numeric" });
  return `Sen "${name}" biznesining buxgalteri va tahlilchisisisan. Nominging ServiX AI.

SEN NIMA QILASAN:
- Foydalanuvchi nima so'rasa FAQAT SHUNI javob ber. Ortiqcha ma'lumot QUSHMA.
- "7 kunlik product" desa — faqat 7 kunlik mahsulot statistikasi ber, boshqa hech narsa.
- "oylik daromad" desa — faqat oylik daromad raqami ber.
- "xodimlar hisoboti" desa — faqat xodimlar jadvali ber.
- Sen buxgaltersan — aniq raqamlar, jadvallar, professional hisobot ber.

FORMATLASH:
- Jadvallarni chiroyli formatlash — ustun nomlar, raqamlar tekislangan.
- Pul: 1,250,000 so'm format.
- Foizlar: ↑12% yoki ↓5% ko'rinishda.
- So'ralgan tilda javob ber.
- Ma'lumot yo'q — "Ma'lumot yo'q" de, o'ylab topma.
- Excel so'rasa — "Tayyor! Pastdagi tugmadan yuklab oling" de.

TAQIQ: siyosat, din, dasturlash, boshqa biznes haqida gapirma.
Javob oxiri: — ServiX AI | ${sana}`;
}

// ===== API CALL =====
async function askAI(restaurantId, adminId, adminUsername, question) {
  const startTime = Date.now();
  const admin = await Admin.findOne({ restaurantId, role: "admin" }).select("restaurantName businessType modules aiLimit");
  if (!admin) throw new Error("Biznes topilmadi");
  if (!admin.modules?.aiAgent) throw new Error("AI Agent moduli yoqilmagan");
  if (!config.anthropicApiKey) throw new Error("AI xizmati sozlanmagan");

  if (isBlocked(question)) {
    return { answer: "Bu savol mening vakolatimdan tashqarida.\n\n— ServiX AI", inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0, filtered: true };
  }

  // Faqat kerakli datani olish
  const data = await collectData(restaurantId, question);
  const systemPrompt = buildPrompt(admin.restaurantName, admin.businessType);
  const userMessage = `Ma'lumotlar:\n${JSON.stringify(data, null, 2)}\n\nSavol: ${question}`;

  const axios = require("axios");
  let response;
  try {
    response = await axios.post(ANTHROPIC_API, {
      model: AI_MODEL, max_tokens: 4096, system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }, {
      headers: { "x-api-key": config.anthropicApiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      timeout: 60000,
    });
  } catch (err) {
    logger.error("API:", err.response?.status, JSON.stringify(err.response?.data || err.message));
    throw err;
  }

  const r = response.data;
  const answer = r.content?.[0]?.text || "Javob olib bo'lmadi";
  const inp = r.usage?.input_tokens || 0;
  const out = r.usage?.output_tokens || 0;
  return { answer, inputTokens: inp, outputTokens: out, totalTokens: inp + out, cost: calcCost(inp, out), model: AI_MODEL, responseTime: Date.now() - startTime, filtered: false };
}

module.exports = { askAI, isBlocked, collectData, collectExportData, calcCost, AI_MODEL };