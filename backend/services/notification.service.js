const { Notification, SANotification } = require("../models");
const logger = require("../utils/logger");

/**
 * Restoran admin uchun bildirishnoma yaratish
 */
async function createNotification(restaurantId, type, title, message, icon, targetRole, targetId, data) {
  try {
    await Notification.create({
      restaurantId,
      type,
      title,
      message: message || "",
      icon: icon || "🔔",
      targetRole: targetRole || "admin",
      targetId,
      data,
    });
  } catch (err) {
    logger.error("Notification create error:", err.message);
  }
}

/**
 * Superadmin uchun bildirishnoma yaratish
 */
async function createSANotif(type, title, message, icon, data) {
  try {
    await SANotification.create({
      type,
      title,
      message: message || "",
      icon: icon || "🔔",
      data,
    });
  } catch (err) {
    logger.error("SA Notification error:", err.message);
  }
}

module.exports = {
  createNotification,
  createSANotif,
};