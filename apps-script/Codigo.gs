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
// "Admin" es la clave para entrar a Ajustes (editar los listados).
const CLAVES = {
  "Taller":  "taller-2026",
  "Almacen": "almacen-2026",
  "Panol":   "panol-2026",
  "Admin":   "admin-2026",
};

// Columnas reutilizadas.
const REP = ["dominio", "repuesto", "tiempo"];            // repuestos en espera
const COLS3 = ["total", "items", "repuestos"];            // movimientos / transferencias
const MOV_KEYS = ["or_cargadas", "remitos_egreso", "remitos_ingreso"];
const TRANSF_KEYS = ["720", "745", "758", "760", "base7"];
const EQ_COLS = ["total", "disponible", "reparacion", "demora", "observaciones"];

// Tope de filas guardadas para Repuestos en espera y Necesidades (Supervisores y Almacén).
const MAX_LISTA = 33;

// Cantidad de columnas de cada listado editable desde Ajustes.
const LISTADO_COLS = {
  supervisores: 3, // nombre, ubicacion, taller
  mecanicos: 3,    // nombre, ubicacion, taller
  panoleros: 3,    // nombre, ubicacion, panol
  obras: 2,        // ubicacion, obra
  semanas: 3,      // semana, desde, hasta
};

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);

    // --- lecturas abiertas (no requieren clave) ---
    if (d.accion === "historial") return json({ ok: true, datos: leerHistorial() });
    if (d.accion === "listados_extra") return json({ ok: true, datos: leerListadosExtra() });

    // --- validar clave (sector, o Admin para Ajustes) ---
    const sectorClave = (d.accion === "agregar_listado") ? "Admin" : d.sector;
    const claveOk = CLAVES[sectorClave];
    if (!claveOk || d.clave !== claveOk) {
      return json({ ok: false, error: "clave" });
    }

    // El inicio sólo pregunta si la clave es correcta (no guarda nada).
    if (d.accion === "validar") {
      return json({ ok: true });
    }

    // Agregar un dato a un listado (desde Ajustes, con clave Admin).
    if (d.accion === "agregar_listado") {
      agregarListado(d);
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
  for (let i = 1; i <= MAX_LISTA; i++) REP.forEach((c) => h.push(`rep${i}_${c}`));
  for (let i = 1; i <= MAX_LISTA; i++) h.push(`nec${i}`);
  return h;
}

function guardarSupervisores(d) {
  const sh = hoja("Supervisores", encabezadosSupervisores());
  const fila = [
    new Date(), d.semana, d.desde, d.hasta, d.supervisor, d.ubicacion,
    d.taller, d.obra, d.cant_mecanicos, d.km, d.ordenes, d.tareas,
    d.en_reparacion, d.tercerizado, d.espera_repuesto, d.necesidades_cant,
  ];
  for (let i = 0; i < MAX_LISTA; i++) {
    const r = (d.repuestos && d.repuestos[i]) || {};
    REP.forEach((c) => fila.push(r[c] || ""));
  }
  for (let i = 0; i < MAX_LISTA; i++) {
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
  for (let i = 1; i <= MAX_LISTA; i++) REP.forEach((c) => h.push(`rep${i}_${c}`));
  for (let i = 1; i <= MAX_LISTA; i++) h.push(`nec${i}`);
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
  for (let i = 0; i < MAX_LISTA; i++) {
    const r = (d.repuestos && d.repuestos[i]) || {};
    REP.forEach((c) => fila.push(r[c] || ""));
  }
  for (let i = 0; i < MAX_LISTA; i++) {
    const n = (d.necesidades && d.necesidades[i]) || {};
    fila.push(n.necesidad || "");
  }
  sh.appendRow(fila);
}

/* ---------------- Historial (lectura de cargas) ---------------- */
function leerHistorial() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const out = [];

  // Supervisores y Almacén: 1 fila = 1 carga.
  ["Supervisores", "Almacen"].forEach((t) => {
    const sh = ss.getSheetByName(t);
    if (!sh || sh.getLastRow() < 2) return;
    const data = sh.getDataRange().getValues();
    const head = data[0];
    for (let i = 1; i < data.length; i++) {
      out.push({ planilla: t, fila: filaObj(head, data[i]) });
    }
  });

  // Estacionarios: varias filas (1 por equipo) = 1 carga -> agrupar por timestamp.
  const she = ss.getSheetByName("Estacionarios");
  if (she && she.getLastRow() >= 2) {
    const data = she.getDataRange().getValues();
    const head = data[0];
    const grupos = {};
    for (let i = 1; i < data.length; i++) {
      const o = filaObj(head, data[i]);
      const k = String(o.timestamp);
      if (!grupos[k]) {
        grupos[k] = {
          planilla: "Estacionarios",
          fila: {
            timestamp: o.timestamp, semana: o.semana, desde: o.desde,
            hasta: o.hasta, ubicacion: o.ubicacion, cant_panoleros: o.cant_panoleros,
          },
          equipos: [],
        };
      }
      grupos[k].equipos.push({
        equipo: o.equipo, total: o.total, disponible: o.disponible,
        reparacion: o.reparacion, demora: o.demora, observaciones: o.observaciones,
      });
    }
    Object.keys(grupos).forEach((k) => out.push(grupos[k]));
  }

  // Más recientes primero.
  out.sort((a, b) => new Date(b.fila.timestamp) - new Date(a.fila.timestamp));
  return out;
}

function filaObj(head, row) {
  const o = {};
  head.forEach((h, j) => { o[h] = row[j]; });
  return o;
}

/* ---------------- Listados (Ajustes) ---------------- */
function hojaListados() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName("cfg_listados");
  if (!sh) {
    sh = ss.insertSheet("cfg_listados");
    sh.appendRow(["timestamp", "tipo", "v1", "v2", "v3"]);
    sh.setFrozenRows(1);
  }
  return sh;
}

// Devuelve sólo lo agregado desde Ajustes (los valores base viven en js/listados.js).
function leerListadosExtra() {
  const sh = hojaListados();
  const out = { supervisores: [], mecanicos: [], panoleros: [], obras: [], semanas: [] };
  if (sh.getLastRow() < 2) return out;
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const tipo = data[i][1];
    if (!out[tipo]) continue;
    const n = LISTADO_COLS[tipo] || 3;
    const fila = [];
    for (let c = 0; c < n; c++) fila.push(data[i][2 + c]);
    out[tipo].push(fila);
  }
  return out;
}

function agregarListado(d) {
  if (!LISTADO_COLS[d.tipo]) throw new Error("tipo de listado invalido: " + d.tipo);
  const sh = hojaListados();
  const f = d.fila || [];
  sh.appendRow([new Date(), d.tipo, f[0] || "", f[1] || "", f[2] || ""]);
}

// Devuelve la pestaña; la crea con encabezados si no existe.
function hoja(nombre, encabezados) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(nombre);
  if (!sh) {
    sh = ss.insertSheet(nombre);
    sh.appendRow(encabezados);
    sh.setFrozenRows(1);
    return sh;
  }
  // Si subimos los límites, completamos los encabezados que falten.
  if (sh.getLastColumn() < encabezados.length) {
    sh.getRange(1, 1, 1, encabezados.length).setValues([encabezados]);
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
