const config = require("../config");

/**
 * Oddiy in-memory rate limiter
 * Production da Redis-based limiter ishlatish tavsiya qilinadi
 */
const requestCounts = new Map();

// Har 5 daqiqada eski yozuvlarni tozalash
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of requestCounts) {
    if (now - data.windowStart > config.rateLimit.windowMs * 2) {
      requestCounts.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Rate limiter yaratish
 * @param {Object} options - { windowMs, max, keyGenerator, message }
 */
function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || config.rateLimit.windowMs;
  const max = options.max || config.rateLimit.max;
  const message = options.message || "Juda ko'p so'rov. Biroz kutib turing.";
  const keyGenerator = options.keyGenerator || ((req) => {
    return req.ip || req.headers["x-forwarded-for"] || "unknown";
  });

  return (req, res, next) => {
    const key = keyGenerator(req);
    const now = Date.now();

    if (!requestCounts.has(key)) {
      requestCounts.set(key, { count: 1, windowStart: now });
      return next();
    }

    const data = requestCounts.get(key);

    // Oyna tugadimi?
    if (now - data.windowStart > windowMs) {
      data.count = 1;
      data.windowStart = now;
      return next();
    }

    data.count++;

    if (data.count > max) {
      res.set("Retry-After", Math.ceil((windowMs - (now - data.windowStart)) / 1000));
      return res.status(429).json({ error: message });
    }

    next();
  };
}

// Tayyor limiterlar
const apiLimiter = createRateLimiter();

const orderLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 daqiqa
  max: 10,
  message: "Juda ko'p buyurtma. 1 daqiqa kutib turing.",
  keyGenerator: (req) => `order:${req.body.telegramId || req.ip}`,
});

const broadcastLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 soat
  max: 5,
  message: "Broadcast limiti tugadi. 1 soatdan keyin urinib ko'ring.",
  keyGenerator: (req) => `broadcast:${req.admin?.restaurantId || req.ip}`,
});

const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 daqiqa
  max: 10,
  message: "Juda ko'p login urinish. 15 daqiqa kutib turing.",
});

module.exports = {
  createRateLimiter,
  apiLimiter,
  orderLimiter,
  broadcastLimiter,
  loginLimiter,
};