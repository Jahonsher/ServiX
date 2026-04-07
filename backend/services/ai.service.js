const config = require("../config");
const logger = require("../utils/logger");
const Order = require("../models/Order");
const User = require("../models/User");
const Admin = require("../models/Admin");
const Product = require("../models/Product");
const Category = require("../models/Category");
const { Employee, Attendance, Inventory, Branch, Shot } = require("../models");

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

// ===== BARCHA MA'LUMOTLARNI TO'LIQ YIGISH =====
async function collectAllData(restaurantId) {
  logger.info("AI collectAllData boshlandi: " + restaurantId);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const weekStart = new Date(today); weekStart.setDate(weekStart.getDate() - 7);
  const kecha = new Date(today); kecha.setDate(kecha.getDate() - 1);

  // Har bir queryni alohida try/catch bilan — xato bo'lsa logga yozadi, lekin to'xtamaydi
  let todayOrders = [], monthOrders = [], prevMonthOrders = [];
  let allProducts = [], allCategories = [];
  let employees = [], todayAttendance = [], monthAttendance = [];
  let inventory = [], branches = [];
  let totalUsers = 0, admin = null, openShots = [];

  try { todayOrders = await Order.find({ restaurantId, createdAt: { $gte: today } }).lean(); } catch(e) { logger.error("AI DB todayOrders:", e.message); }
  try { monthOrders = await Order.find({ restaurantId, createdAt: { $gte: monthStart } }).lean(); } catch(e) { logger.error("AI DB monthOrders:", e.message); }
  try { prevMonthOrders = await Order.find({ restaurantId, createdAt: { $gte: prevMonthStart, $lt: monthStart } }).lean(); } catch(e) { logger.error("AI DB prevMonth:", e.message); }
  try { allProducts = await Product.find({ restaurantId }).lean(); } catch(e) { logger.error("AI DB products:", e.message); }
  try { allCategories = await Category.find({ restaurantId }).lean(); } catch(e) { logger.error("AI DB categories:", e.message); }
  try { employees = await Employee.find({ restaurantId, active: true }).select("-password -faceDescriptor -photo").lean(); } catch(e) { logger.error("AI DB employees:", e.message); }
  try { todayAttendance = await Attendance.find({ restaurantId, date: today.toISOString().split("T")[0] }).lean(); } catch(e) { logger.error("AI DB todayAtt:", e.message); }
  try { monthAttendance = await Attendance.find({ restaurantId, date: { $regex: "^" + now.toISOString().slice(0, 7) } }).lean(); } catch(e) { logger.error("AI DB monthAtt:", e.message); }
  try { inventory = await Inventory.find({ restaurantId, active: true }).lean(); } catch(e) { logger.error("AI DB inventory:", e.message); }
  try { branches = await Branch.find({ restaurantId, active: true }).lean(); } catch(e) { logger.error("AI DB branches:", e.message); }
  try { totalUsers = await User.countDocuments({ restaurantId }); } catch(e) { logger.error("AI DB users:", e.message); }
  try { admin = await Admin.findOne({ restaurantId, role: "admin" }).select("restaurantName phone address workStart workEnd subscriptionEnd").lean(); } catch(e) { logger.error("AI DB admin:", e.message); }
  try { openShots = await Shot.find({ restaurantId, status: "open" }).lean(); } catch(e) { logger.error("AI DB shots:", e.message); }

  logger.info("AI DATA [" + restaurantId + "]: products=" + allProducts.length + " orders_today=" + todayOrders.length + " orders_month=" + monthOrders.length + " emps=" + employees.length + " inv=" + inventory.length + " users=" + totalUsers + " cats=" + allCategories.length);

  // Hisoblashlar
  const weekOrders = monthOrders.filter(function(o) { return new Date(o.createdAt) >= weekStart; });
  const kechaOrders = monthOrders.filter(function(o) { var d = new Date(o.createdAt); return d >= kecha && d < today; });

  var todayRevenue = todayOrders.reduce(function(s, o) { return s + (o.total || 0); }, 0);
  var monthRevenue = monthOrders.reduce(function(s, o) { return s + (o.total || 0); }, 0);
  var prevMonthRevenue = prevMonthOrders.reduce(function(s, o) { return s + (o.total || 0); }, 0);
  var weekRevenue = weekOrders.reduce(function(s, o) { return s + (o.total || 0); }, 0);
  var kechaRevenue = kechaOrders.reduce(function(s, o) { return s + (o.total || 0); }, 0);

  // O'sish foizi
  var revenueGrowth = prevMonthRevenue > 0 ? Math.round(((monthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100) : 0;
  var ordersGrowth = prevMonthOrders.length > 0 ? Math.round(((monthOrders.length - prevMonthOrders.length) / prevMonthOrders.length) * 100) : 0;

  // Mahsulotlar sotilishi
  var itemMap = {};
  monthOrders.forEach(function(o) {
    (o.items || []).forEach(function(item) {
      var key = item.name || "Nomalum";
      if (!itemMap[key]) itemMap[key] = { soni: 0, summa: 0 };
      itemMap[key].soni += item.quantity || 1;
      itemMap[key].summa += (item.price || 0) * (item.quantity || 1);
    });
  });
  var mahsulotlarStat = Object.entries(itemMap).map(function(e) {
    return { nom: e[0], soni: e[1].soni, summa: e[1].summa };
  }).sort(function(a, b) { return b.soni - a.soni; });

  // Kunlik trend 7 kun
  var kunlikTrend = [];
  for (var i = 6; i >= 0; i--) {
    var d = new Date(today); d.setDate(d.getDate() - i);
    var dn = new Date(d); dn.setDate(dn.getDate() + 1);
    var dayO = monthOrders.filter(function(o) { var ct = new Date(o.createdAt); return ct >= d && ct < dn; });
    kunlikTrend.push({
      sana: d.toLocaleDateString("uz-UZ", { day: "numeric", month: "short" }),
      buyurtmalar: dayO.length,
      daromad: dayO.reduce(function(s, o) { return s + (o.total || 0); }, 0),
    });
  }

  // Xodimlar
  var xodimlar = employees.map(function(e) {
    var bugunAtt = todayAttendance.find(function(a) { return a.employeeId && a.employeeId.toString() === e._id.toString(); });
    var oylikAtt = monthAttendance.filter(function(a) { return a.employeeId && a.employeeId.toString() === e._id.toString(); });
    var kelgan = oylikAtt.filter(function(a) { return a.status === "keldi"; }).length;
    var kechikish = oylikAtt.filter(function(a) { return a.lateMinutes > 0; }).length;
    return {
      ism: e.name, lavozim: e.position || "-", rol: e.role, maosh: e.salary || 0,
      bugun: bugunAtt ? bugunAtt.status : "malumot yoq",
      bugun_kechikish: bugunAtt ? (bugunAtt.lateMinutes || 0) : 0,
      oylik_kelgan: kelgan, oylik_kechikish: kechikish,
    };
  });

  // Ombor
  var ombor = inventory.map(function(item) {
    return {
      nomi: item.productName, qoldiq: item.currentStock, birlik: item.unit,
      min: item.minStock, holat: item.currentStock <= 0 ? "TUGAGAN" : item.currentStock <= item.minStock ? "KAM" : "OK",
    };
  });

  // Menyu — to'liq
  var menyuTaomlar = allProducts.map(function(p) {
    return { nomi: p.name, nomi_ru: p.name_ru || "", narxi: p.price || 0, kategoriya: p.category || "-", faol: p.active !== false };
  });

  var menyuKategoriyalar = allCategories.map(function(c) {
    return { nomi: c.name, nomi_ru: c.name_ru || "", emoji: c.emoji || "" };
  });

  return {
    biznes_nomi: admin ? admin.restaurantName : restaurantId,
    biznes_telefon: admin ? (admin.phone || "-") : "-",
    biznes_manzil: admin ? (admin.address || "-") : "-",
    filiallar: branches.map(function(b) { return b.name; }),

    moliya: {
      bugungi_daromad: todayRevenue,
      kechagi_daromad: kechaRevenue,
      haftalik_daromad: weekRevenue,
      oylik_daromad: monthRevenue,
      otgan_oy_daromad: prevMonthRevenue,
      osish_foiz: revenueGrowth,
      ortacha_chek: monthOrders.length > 0 ? Math.round(monthRevenue / monthOrders.length) : 0,
    },

    buyurtmalar: {
      bugun: todayOrders.length,
      kecha: kechaOrders.length,
      haftalik: weekOrders.length,
      oylik: monthOrders.length,
      otgan_oy: prevMonthOrders.length,
      osish_foiz: ordersGrowth,
      online: monthOrders.filter(function(o) { return o.orderType === "online"; }).length,
      restoranda: monthOrders.filter(function(o) { return o.orderType === "dine_in"; }).length,
      ochiq_shotlar: openShots.length,
    },

    kunlik_trend_7kun: kunlikTrend,
    mahsulot_sotilishi: mahsulotlarStat,

    menyu: {
      jami_taomlar: allProducts.length,
      faol_taomlar: allProducts.filter(function(p) { return p.active !== false; }).length,
      kategoriyalar_soni: allCategories.length,
      taomlar_royxati: menyuTaomlar,
      kategoriyalar_royxati: menyuKategoriyalar,
    },

    xodimlar_royxati: xodimlar,
    xodimlar_soni: employees.length,
    bugun_kelgan: todayAttendance.filter(function(a) { return a.status === "keldi"; }).length,
    jami_maosh: employees.reduce(function(s, e) { return s + (e.salary || 0); }, 0),

    ombor_royxati: ombor,
    ombor_soni: inventory.length,
    ombor_tugagan: ombor.filter(function(o) { return o.holat === "TUGAGAN"; }).length,
    ombor_kam: ombor.filter(function(o) { return o.holat === "KAM"; }).length,

    mijozlar_soni: totalUsers,
    sana: now.toLocaleDateString("uz-UZ", { year: "numeric", month: "long", day: "numeric", weekday: "long" }),
  };
}

// ===== SYSTEM PROMPT =====
function buildPrompt(name, type) {
  var sana = new Date().toLocaleDateString("uz-UZ", { year: "numeric", month: "long", day: "numeric" });
  return 'Sen "' + name + '" biznesining shaxsiy buxgalteri va tahlilchisisisan. Nominging ServiX AI.\n\n' +
    'Senga shu biznesning BARCHA malumotlari beriladi. Buyurtmalar, daromad, menyu, xodimlar, ombor, mijozlar.\n\n' +
    'QOIDALAR:\n' +
    '1. Foydalanuvchi nima sorasa FAQAT SHUNI javob ber. Ortiqcha malumot QUSHMA.\n' +
    '2. Har bir javob oxirida 1-2 qator MASLAHAT ber. Masalan: "Maslahat: Osh eng kop sotilmoqda, narxini oshirish mumkin".\n' +
    '3. Jadval korinishida formatlash — markdown table ishlatish.\n' +
    '4. Pul: 1,250,000 som. Foiz: 12% yoki -5%.\n' +
    '5. Malumot 0 bolsa — "Hozircha malumot yoq" de, oylab topma.\n' +
    '6. Foydalanuvchi tilida javob ber.\n' +
    '7. Siyosat, din, dasturlash haqida GAPLASHMA.\n' +
    '8. Javob oxiri: — ServiX AI | ' + sana;
}

// ===== API CALL =====
async function askAI(restaurantId, adminId, adminUsername, question) {
  var startTime = Date.now();

  var admin = await Admin.findOne({ restaurantId: restaurantId, role: "admin" }).select("restaurantName businessType modules aiLimit");
  if (!admin) throw new Error("Biznes topilmadi");
  if (!admin.modules || !admin.modules.aiAgent) throw new Error("AI Agent moduli yoqilmagan");
  if (!config.anthropicApiKey) throw new Error("AI xizmati sozlanmagan");

  if (isBlocked(question)) {
    return { answer: "Bu savol mening vakolatimdan tashqarida.\n\n— ServiX AI", inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0, filtered: true };
  }

  // BARCHA malumotlarni olish
  var data = await collectAllData(restaurantId);

  var systemPrompt = buildPrompt(admin.restaurantName, admin.businessType);
  var userMessage = "BIZNES MALUMOTLARI:\n" + JSON.stringify(data, null, 2) + "\n\nFOYDALANUVCHI SAVOLI: " + question;

  logger.info("AI sending to Anthropic: restaurantId=" + restaurantId + " question=" + question.substring(0, 50));

  var axios = require("axios");
  var response;
  try {
    response = await axios.post(ANTHROPIC_API, {
      model: AI_MODEL, max_tokens: 4096, system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }, {
      headers: { "x-api-key": config.anthropicApiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      timeout: 60000,
    });
  } catch (err) {
    logger.error("Anthropic API error: " + (err.response ? err.response.status : "no response") + " " + JSON.stringify(err.response ? err.response.data : err.message));
    throw err;
  }

  var r = response.data;
  var answer = (r.content && r.content[0] && r.content[0].text) ? r.content[0].text : "Javob olib bolmadi";
  var inp = (r.usage && r.usage.input_tokens) ? r.usage.input_tokens : 0;
  var out = (r.usage && r.usage.output_tokens) ? r.usage.output_tokens : 0;

  logger.info("AI response OK: tokens=" + (inp + out) + " time=" + (Date.now() - startTime) + "ms");

  return { answer: answer, inputTokens: inp, outputTokens: out, totalTokens: inp + out, cost: calcCost(inp, out), model: AI_MODEL, responseTime: Date.now() - startTime, filtered: false };
}

// Export
async function collectExportData(restaurantId) {
  return await collectAllData(restaurantId);
}

module.exports = { askAI: askAI, isBlocked: isBlocked, collectAllData: collectAllData, collectExportData: collectExportData, calcCost: calcCost, AI_MODEL: AI_MODEL };