const mongoose = require("mongoose");
const config = require("./index");
const logger = require("../utils/logger");

async function connectDB() {
  try {
    await mongoose.connect(config.mongoUri);
    logger.info("✅ MongoDB ulandi");

    // Eski noto'g'ri unique indexlarni tozalash
    await cleanupIndexes();
  } catch (err) {
    logger.error("❌ MongoDB ulanish xatosi:", err.message);
    process.exit(1);
  }
}

async function cleanupIndexes() {
  try {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const colNames = collections.map((c) => c.name);

    // Users: telegramId_1 indexni o'chirish (multi-restoran uchun)
    if (colNames.includes("users")) {
      const col = db.collection("users");
      const indexes = await col.indexes();
      for (const idx of indexes) {
        if (idx.name === "telegramId_1") {
          await col.dropIndex("telegramId_1");
          logger.info("✅ Eski telegramId_1 index o'chirildi");
          break;
        }
      }
    }

    // Products: id_1 indexni o'chirish
    if (colNames.includes("products")) {
      const col = db.collection("products");
      const indexes = await col.indexes();
      for (const idx of indexes) {
        if (idx.name === "id_1") {
          await col.dropIndex("id_1");
          logger.info("✅ Eski id_1 index o'chirildi");
          break;
        }
      }
    }
  } catch (err) {
    logger.warn("Index tozalash:", err.message);
  }
}

module.exports = { connectDB };