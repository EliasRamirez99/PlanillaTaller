/* ============================================================
   GOOGLE APPS SCRIPT — Receptor de planillas OPS
   ------------------------------------------------------------
   Qué hace:
   - Recibe los datos del formulario web (doPost).
   - Valida la "clave del sector".
   - Agrega una fila por cada carga en la pestaña correspondiente.

   Cómo instalarlo (ver README.md, paso 2):
   1. Crear una Google Sheet nueva.
   2. Extensiones > Apps Script. Borrar el código de ejemplo y
      pegar TODO este archivo.
   3. Cambiar las claves de abajo (CLAVES).
   4. Implementar > Nueva implementación > tipo "Aplicación web".
      - Ejecutar como: Yo.
      - Quién tiene acceso: Cualquiera.
   5. Copiar la URL (termina en /exec) y pegarla en js/config.js.
   ============================================================ */

// 🔑 CAMBIÁ ESTAS CLAVES por las reales y compartilas con cada sector.
const CLAVES = {
  "Taller":  "taller-2026",
  "Almacen": "almacen-2026",
  "Panol":   "panol-2026",
};

// Columnas reutilizadas.
const REP = ["dominio", "repuesto", "tiempo"];            // repuestos en espera
const COLS3 = ["total", "items", "repuestos"];            // movimientos / transferencias
const MOV_KEYS = ["or_cargadas", "remitos_egreso", "remitos_ingreso"];
const TRANSF_KEYS = ["720", "745", "758", "760", "base7"];
const EQ_COLS = ["total", "disponible", "reparacion", "demora", "observaciones"];

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);

    // --- validar clave de sector ---
    const claveOk = CLAVES[d.sector];
    if (!claveOk || d.clave !== claveOk) {
      return json({ ok: false, error: "clave" });
    }

    // El inicio sólo pregunta si la clave es correcta (no guarda nada).
    if (d.accion === "validar") {
      return json({ ok: true });
    }

    switch (d.planilla) {
      case "Supervisores":  guardarSupervisores(d); break;
      case "Estacionarios": guardarEstacionarios(d); break;
      case "Almacen":       guardarAlmacen(d); break;
      default: return json({ ok: false, error: "planilla desconocida: " + d.planilla });
    }
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/* ---------------- Supervisores (1 fila por carga) ---------------- */
function encabezadosSupervisores() {
  const h = ["timestamp", "semana", "desde", "hasta", "supervisor", "ubicacion",
    "taller", "obra", "cant_mecanicos", "km", "ordenes", "tareas",
    "en_reparacion", "tercerizado", "espera_repuesto", "necesidades_cant"];
  for (let i = 1; i <= 5; i++) REP.forEach((c) => h.push(`rep${i}_${c}`));
  for (let i = 1; i <= 5; i++) h.push(`nec${i}`);
  return h;
}

function guardarSupervisores(d) {
  const sh = hoja("Supervisores", encabezadosSupervisores());
  const fila = [
    new Date(), d.semana, d.desde, d.hasta, d.supervisor, d.ubicacion,
    d.taller, d.obra, d.cant_mecanicos, d.km, d.ordenes, d.tareas,
    d.en_reparacion, d.tercerizado, d.espera_repuesto, d.necesidades_cant,
  ];
  for (let i = 0; i < 5; i++) {
    const r = (d.repuestos && d.repuestos[i]) || {};
    REP.forEach((c) => fila.push(r[c] || ""));
  }
  for (let i = 0; i < 5; i++) {
    const n = (d.necesidades && d.necesidades[i]) || {};
    fila.push(n.necesidad || "");
  }
  sh.appendRow(fila);
}

/* ---------- Estacionarios (1 fila por equipo cargado) ---------- */
function guardarEstacionarios(d) {
  const sh = hoja("Estacionarios",
    ["timestamp", "semana", "desde", "hasta", "ubicacion", "cant_panoleros",
      "equipo", "total", "disponible", "reparacion", "demora", "observaciones"]);
  const ts = new Date();
  (d.equipos || []).forEach((e) => {
    sh.appendRow([ts, d.semana, d.desde, d.hasta, d.ubicacion, d.cant_panoleros,
      e.equipo, e.total, e.disponible, e.reparacion, e.demora, e.observaciones]);
  });
}

/* ---------------- Almacén (1 fila por carga) ---------------- */
function encabezadosAlmacen() {
  const h = ["timestamp", "semana", "desde", "hasta", "ubicacion", "cant_panoleros"];
  MOV_KEYS.forEach((k) => COLS3.forEach((c) => h.push(`${k}_${c}`)));
  TRANSF_KEYS.forEach((k) => COLS3.forEach((c) => h.push(`transf_${k}_${c}`)));
  h.push("repuesto_en_espera", "necesidades_cant");
  for (let i = 1; i <= 10; i++) REP.forEach((c) => h.push(`rep${i}_${c}`));
  for (let i = 1; i <= 5; i++) h.push(`nec${i}`);
  return h;
}

function guardarAlmacen(d) {
  const sh = hoja("Almacen", encabezadosAlmacen());
  const mov = d.movimientos || {};
  const transf = d.transferencias || {};
  const fila = [new Date(), d.semana, d.desde, d.hasta, d.ubicacion, d.cant_panoleros];
  MOV_KEYS.forEach((k) => { const o = mov[k] || {}; COLS3.forEach((c) => fila.push(o[c] || "")); });
  TRANSF_KEYS.forEach((k) => { const o = transf[k] || {}; COLS3.forEach((c) => fila.push(o[c] || "")); });
  fila.push(d.repuesto_en_espera || "", d.necesidades_cant || "");
  for (let i = 0; i < 10; i++) {
    const r = (d.repuestos && d.repuestos[i]) || {};
    REP.forEach((c) => fila.push(r[c] || ""));
  }
  for (let i = 0; i < 5; i++) {
    const n = (d.necesidades && d.necesidades[i]) || {};
    fila.push(n.necesidad || "");
  }
  sh.appendRow(fila);
}

// Devuelve la pestaña; la crea con encabezados si no existe.
function hoja(nombre, encabezados) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(nombre);
  if (!sh) {
    sh = ss.insertSheet(nombre);
    sh.appendRow(encabezados);
    sh.setFrozenRows(1);
  }
  return sh;
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Permite probar el despliegue abriendo la URL en el navegador.
function doGet() {
  return json({ ok: true, msg: "Receptor de planillas OPS activo." });
}
