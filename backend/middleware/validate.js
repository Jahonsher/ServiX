const logger = require("../utils/logger");

/**
 * Oddiy validatsiya middleware yaratuvchi
 * @param {Object} schema - { field: { required, type, min, max, enum, pattern } }
 */
function validate(schema) {
  return (req, res, next) => {
    const errors = [];
    const body = req.body;

    for (const [field, rules] of Object.entries(schema)) {
      const value = body[field];

      // required tekshirish
      if (rules.required && (value === undefined || value === null || value === "")) {
        errors.push(`${field} majburiy`);
        continue;
      }

      // Agar qiymat yo'q va majburiy emas — o'tkazib yuboramiz
      if (value === undefined || value === null) continue;

      // type tekshirish
      if (rules.type === "string" && typeof value !== "string") {
        errors.push(`${field} matn bo'lishi kerak`);
      }
      if (rules.type === "number" && (typeof value !== "number" || isNaN(value))) {
        errors.push(`${field} raqam bo'lishi kerak`);
      }
      if (rules.type === "array" && !Array.isArray(value)) {
        errors.push(`${field} massiv bo'lishi kerak`);
      }

      // min/max (raqam uchun)
      if (rules.min !== undefined && typeof value === "number" && value < rules.min) {
        errors.push(`${field} kamida ${rules.min} bo'lishi kerak`);
      }
      if (rules.max !== undefined && typeof value === "number" && value > rules.max) {
        errors.push(`${field} ko'pi bilan ${rules.max} bo'lishi kerak`);
      }

      // minLength/maxLength (string uchun)
      if (rules.minLength && typeof value === "string" && value.length < rules.minLength) {
        errors.push(`${field} kamida ${rules.minLength} ta belgi bo'lishi kerak`);
      }
      if (rules.maxLength && typeof value === "string" && value.length > rules.maxLength) {
        errors.push(`${field} ko'pi bilan ${rules.maxLength} ta belgi bo'lishi kerak`);
      }

      // enum tekshirish
      if (rules.enum && !rules.enum.includes(value)) {
        errors.push(`${field} quyidagilardan biri bo'lishi kerak: ${rules.enum.join(", ")}`);
      }

      // pattern (regex)
      if (rules.pattern && typeof value === "string" && !rules.pattern.test(value)) {
        errors.push(`${field} noto'g'ri formatda`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: "Validatsiya xatosi", details: errors });
    }

    next();
  };
}

/**
 * Request body ni tozalash — faqat ruxsat berilgan fieldlarni qoldirish
 */
function sanitize(allowedFields) {
  return (req, res, next) => {
    const clean = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        clean[field] = req.body[field];
      }
    }
    req.body = clean;
    next();
  };
}

module.exports = { validate, sanitize };