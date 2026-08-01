/* ============================================================
   RELAY — puente hacia Google Apps Script (corre en Vercel)
   ------------------------------------------------------------
   La red de la empresa a veces bloquea script.google.com.
   La página le pega a este relay (…vercel.app/api/proxy) y el
   relay reenvía el POST a Google desde afuera, donde no hay
   bloqueo. No guarda nada: es un caño de ida y vuelta.

   OJO: cuando se re-implementa el Apps Script y cambia la URL
   /exec, hay que actualizarla ACÁ y en js/config.js. El push a
   GitHub redespliega el relay solo (Vercel mira el repo).
   ============================================================ */

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbx3yq5XB_ZwkKx2WakykBbYPwXhyulSmRePpLveUIgrJt_cQkDeOb1q9SntPfvPx-JF/exec";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "solo POST" });

  try {
    const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
    const r = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: body,
    });
    const texto = await r.text();
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).send(texto);
  } catch (e) {
    return res.status(502).json({ ok: false, error: "relay: " + ((e && e.message) || String(e)) });
  }
}
