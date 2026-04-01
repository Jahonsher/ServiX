const https = require("https");
const FormData = require("form-data");
const config = require("../config");
const logger = require("../utils/logger");

/**
 * Face++ orqali ikki rasmni solishtirish
 * @param {string} photo1 - base64 rasm 1
 * @param {string} photo2 - base64 rasm 2
 * @returns {Promise<{ok: boolean, confidence?: number, threshold?: number, error?: string}>}
 */
async function compareFaces(photo1, photo2) {
  return new Promise((resolve) => {
    try {
      if (!config.facepp.apiKey || !config.facepp.apiSecret) {
        return resolve({ ok: false, error: "Face++ API kalitlari sozlanmagan" });
      }

      const b1 = photo1.replace(/^data:image\/\w+;base64,/, "");
      const b2 = photo2.replace(/^data:image\/\w+;base64,/, "");

      const form = new FormData();
      form.append("api_key", config.facepp.apiKey);
      form.append("api_secret", config.facepp.apiSecret);
      form.append("image_base64_1", b1);
      form.append("image_base64_2", b2);

      const options = {
        hostname: "api-us.faceplusplus.com",
        path: "/facepp/v3/compare",
        method: "POST",
        headers: form.getHeaders(),
        timeout: 15000,
      };

      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const result = JSON.parse(data);
            if (result.confidence !== undefined) {
              resolve({
                ok: true,
                confidence: result.confidence,
                threshold: result.thresholds?.["1e-5"] || 73,
              });
            } else {
              resolve({ ok: false, error: result.error_message || "Face++ xato" });
            }
          } catch (e) {
            resolve({ ok: false, error: "JSON parse xato" });
          }
        });
      });

      req.on("error", (e) => resolve({ ok: false, error: e.message }));
      req.on("timeout", () => {
        req.destroy();
        resolve({ ok: false, error: "Timeout — Face++ javob bermadi" });
      });

      form.pipe(req);
    } catch (e) {
      resolve({ ok: false, error: e.message });
    }
  });
}

module.exports = { compareFaces };