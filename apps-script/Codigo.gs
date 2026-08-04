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
  "Taller":  "123",
  "Almacen": "123",
  "Panol":   "123",
  "Campo":   "123",
  "Admin":   "123",
};

// Columnas reutilizadas.
const REP = ["dominio", "repuesto", "tiempo"];            // repuestos en espera
const TER = ["dominio", "razon", "fecha"];                // tercerizados (Supervisores)
const INS = ["insumo", "cantidad"];                       // insumos utilizados (Almacén)
const VEH = ["dominio", "asignacion", "km", "litros"];    // vehículos utilizados (Almacén)
const COLS3 = ["total", "items", "repuestos"];            // movimientos / transferencias
const MOV_KEYS = ["or_cargadas", "remitos_egreso", "remitos_ingreso"];
const TRANSF_KEYS = ["720", "745", "758", "760", "base7", "base4"];
const EQ_COLS = ["operativa", "no_operativa", "total"];

// Tope de filas guardadas para Repuestos en espera y Necesidades (Supervisores y Almacén).
const MAX_LISTA = 33;
// Tope de equipos por carga de Estacionarios (catálogo + agregados).
const MAX_EQ = 40;

// Cantidad de columnas de cada listado editable desde Ajustes.
const LISTADO_COLS = {
  supervisores: 3, // nombre, ubicacion, taller
  mecanicos: 3,    // nombre, ubicacion, taller
  panoleros: 4,    // nombre, ubicacion, obra, panol
  obras: 2,        // ubicacion, obra
  semanas: 3,      // semana, desde, hasta
  equiposEstacionarios: 1, // nombre (sólo los agregados desde la planilla)
  destinosTransfer: 1,     // destino de transferencia agregado desde Almacén
};

// Tipos de listado que las planillas pueden AGREGAR con su clave de sector
// (mecánico nuevo desde Supervisores, equipo nuevo desde Estacionarios,
// destino de transferencia desde Almacén).
// Editar y borrar siguen siendo sólo con clave Admin.
const TIPOS_ALTA_SECTOR = ["mecanicos", "equiposEstacionarios", "destinosTransfer"];

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);

    // --- lecturas abiertas (no requieren clave) ---
    if (d.accion === "historial") return json({ ok: true, datos: leerHistorial() });
    if (d.accion === "listados") return json({ ok: true, seeded: estaSeedeado(), datos: leerListados() });
    if (d.accion === "leer_respuestas") return json({ ok: true, datos: leerRespuestas(d.semana) });
    if (d.accion === "guardar_respuestas") { guardarRespuestas(d); return json({ ok: true }); }
    if (d.accion === "historial_respuestas") return json({ ok: true, datos: historialRespuestas() });

    // --- acciones que requieren clave (sector, o Admin para Ajustes) ---
    const accionesAdmin = ["agregar_listado", "editar_listado", "borrar_listado", "seed_listados", "borrar_carga"];
    let sectorClave = (accionesAdmin.indexOf(d.accion) >= 0) ? "Admin" : d.sector;
    // Excepción: las planillas pueden dar de alta ciertos listados con su clave de sector.
    if (d.accion === "agregar_listado" && d.sector && d.sector !== "Admin" &&
        TIPOS_ALTA_SECTOR.indexOf(d.tipo) >= 0) {
      sectorClave = d.sector;
    }
    const claveOk = CLAVES[sectorClave];
    if (!claveOk || d.clave !== claveOk) {
      return json({ ok: false, error: "clave" });
    }

    // El inicio sólo pregunta si la clave es correcta (no guarda nada).
    if (d.accion === "validar") return json({ ok: true });

    // Ajustes: alta / edición / baja / siembra inicial de listados (clave Admin).
    if (d.accion === "seed_listados") return json({ ok: true, seeded: seedListados(d) });
    if (d.accion === "agregar_listado") return json({ ok: true, id: agregarListado(d) });
    if (d.accion === "editar_listado") { editarListado(d); return json({ ok: true }); }
    if (d.accion === "borrar_listado") { borrarListado(d); return json({ ok: true }); }

    // Editar una carga ya existente (desde el historial).
    if (d.accion === "editar_carga") { editarCarga(d); return json({ ok: true }); }

    // Borrar una carga completa por timestamp (sólo Admin; para correcciones).
    if (d.accion === "borrar_carga") { borrarCarga(d); return json({ ok: true }); }

    // Asignar/reasignar/desasignar un mecánico (desde la planilla de Supervisores).
    if (d.accion === "asignar_mecanico") { asignarMecanico(d); return json({ ok: true }); }

    // Sumar/sacar un pañolero de un depósito (desde la planilla de Almacén).
    if (d.accion === "asignar_panolero") { asignarPanolero(d); return json({ ok: true }); }

    switch (d.planilla) {
      case "Supervisores":  guardarSupervisores(d); break;
      case "Estacionarios": guardarEstacionarios(d); break;
      case "Almacen":       guardarAlmacen(d); break;
      case "Campo":         guardarCampo(d); break;
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
  for (let i = 1; i <= MAX_LISTA; i++) h.push(`necfecha${i}`);
  // Columnas nuevas SIEMPRE al final (para no desfasar las cargas viejas).
  h.push("observaciones");
  for (let i = 1; i <= MAX_LISTA; i++) TER.forEach((c) => h.push(`ter${i}_${c}`));
  return h;
}

function filaSupervisores(d, ts) {
  const fila = [
    ts, d.semana, d.desde, d.hasta, d.supervisor, d.ubicacion,
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
  for (let i = 0; i < MAX_LISTA; i++) {
    const n = (d.necesidades && d.necesidades[i]) || {};
    fila.push(n.fecha || "");
  }
  fila.push(d.observaciones || "");
  for (let i = 0; i < MAX_LISTA; i++) {
    const t = (d.tercerizados && d.tercerizados[i]) || {};
    TER.forEach((c) => fila.push(t[c] || ""));
  }
  return fila;
}

function guardarSupervisores(d) {
  hoja("Supervisores", encabezadosSupervisores()).appendRow(filaSupervisores(d, new Date()));
}

/* ---------- Estacionarios (1 fila por CARGA, como el resto) ----------
   Esquema: datos generales + eq1..eq40 (equipo/operativa/no_operativa/total).
   El formato viejo (1 fila por equipo) se migra solo la primera vez que se
   guarda/lee/edita: las filas viejas quedan respaldadas en la pestaña
   "Estacionarios_viejo" (no se borra ningún dato) y la principal se rearma
   agrupada por carga. ------------------------------------------------- */
function encabezadosEstacionarios() {
  const h = ["timestamp", "semana", "desde", "hasta", "ubicacion", "cant_panoleros", "observaciones"];
  for (let i = 1; i <= MAX_EQ; i++) {
    h.push(`eq${i}_equipo`);
    EQ_COLS.forEach((c) => h.push(`eq${i}_${c}`));
  }
  return h;
}

function filaEstacionarios(d, ts) {
  const fila = [ts, d.semana, d.desde, d.hasta, d.ubicacion, d.cant_panoleros, d.observaciones || ""];
  for (let i = 0; i < MAX_EQ; i++) {
    const e = (d.equipos && d.equipos[i]) || {};
    fila.push(e.equipo || "");
    EQ_COLS.forEach((c) => fila.push(e[c] || ""));
  }
  return fila;
}

// Si la pestaña sigue en el formato viejo (columna 7 = "equipo"), la respalda
// y la reescribe agrupada. Idempotente y barata cuando ya está migrada.
function migrarEstacionarios() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("Estacionarios");
  if (!sh || sh.getLastRow() < 1 || sh.getLastColumn() < 7) return;
  const head7 = sh.getRange(1, 7).getValue();
  if (head7 !== "equipo") return; // formato nuevo (o pestaña recién creada)

  const data = sh.getDataRange().getValues();
  const h = data[0];
  const idx = {};
  h.forEach((n, i) => { idx[n] = i; });

  const grupos = {};
  const orden = [];
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    const k = String(r[idx.timestamp]);
    if (!grupos[k]) {
      grupos[k] = {
        ts: r[idx.timestamp],
        d: {
          semana: r[idx.semana], desde: r[idx.desde], hasta: r[idx.hasta],
          ubicacion: r[idx.ubicacion], cant_panoleros: r[idx.cant_panoleros],
          observaciones: idx.observaciones != null ? r[idx.observaciones] : "",
          equipos: [],
        },
      };
      orden.push(k);
    }
    grupos[k].d.equipos.push({
      equipo: r[idx.equipo], operativa: r[idx.operativa],
      no_operativa: r[idx.no_operativa], total: r[idx.total],
    });
  }

  // Respaldo del formato viejo (no se borra nada).
  let nombreViejo = "Estacionarios_viejo";
  if (ss.getSheetByName(nombreViejo)) nombreViejo += "_" + new Date().getTime();
  sh.setName(nombreViejo);
  sh.hideSheet();

  const nuevo = hoja("Estacionarios", encabezadosEstacionarios());
  orden.forEach((k) => nuevo.appendRow(filaEstacionarios(grupos[k].d, grupos[k].ts)));
}

function guardarEstacionarios(d) {
  migrarEstacionarios();
  hoja("Estacionarios", encabezadosEstacionarios()).appendRow(filaEstacionarios(d, new Date()));
}

/* ---------------- Almacén (1 fila por carga) ---------------- */
function encabezadosAlmacen() {
  const h = ["timestamp", "semana", "desde", "hasta", "ubicacion", "cant_panoleros"];
  MOV_KEYS.forEach((k) => COLS3.forEach((c) => h.push(`${k}_${c}`)));
  TRANSF_KEYS.forEach((k) => COLS3.forEach((c) => h.push(`transf_${k}_${c}`)));
  h.push("repuesto_en_espera", "necesidades_cant");
  for (let i = 1; i <= MAX_LISTA; i++) REP.forEach((c) => h.push(`rep${i}_${c}`));
  for (let i = 1; i <= MAX_LISTA; i++) h.push(`nec${i}`);
  for (let i = 1; i <= MAX_LISTA; i++) INS.forEach((c) => h.push(`ins${i}_${c}`));
  for (let i = 1; i <= MAX_LISTA; i++) h.push(`necfecha${i}`);
  for (let i = 1; i <= MAX_LISTA; i++) VEH.forEach((c) => h.push(`veh${i}_${c}`));
  for (let i = 1; i <= MAX_LISTA; i++) h.push(`insunidad${i}`);
  h.push("observaciones"); // columnas nuevas siempre al final
  h.push("transf_extra");  // transferencias a destinos agregados (JSON)
  return h;
}

function filaAlmacen(d, ts) {
  const mov = d.movimientos || {};
  const transf = d.transferencias || {};
  const fila = [ts, d.semana, d.desde, d.hasta, d.ubicacion, d.cant_panoleros];
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
  for (let i = 0; i < MAX_LISTA; i++) {
    const s = (d.insumos && d.insumos[i]) || {};
    INS.forEach((c) => fila.push(s[c] || ""));
  }
  for (let i = 0; i < MAX_LISTA; i++) {
    const n = (d.necesidades && d.necesidades[i]) || {};
    fila.push(n.fecha || "");
  }
  for (let i = 0; i < MAX_LISTA; i++) {
    const v = (d.vehiculos && d.vehiculos[i]) || {};
    VEH.forEach((c) => fila.push(v[c] || ""));
  }
  for (let i = 0; i < MAX_LISTA; i++) {
    const s = (d.insumos && d.insumos[i]) || {};
    fila.push(s.unidad || "");
  }
  fila.push(d.observaciones || ""); // columnas nuevas siempre al final
  fila.push(JSON.stringify(d.transf_extra || []));
  return fila;
}

function guardarAlmacen(d) {
  hoja("Almacen", encabezadosAlmacen()).appendRow(filaAlmacen(d, new Date()));
}

/* ---------- Supervisores de Campo (1 fila por carga; listas como JSON) ---------- */
function encabezadosCampo() {
  return ["timestamp", "semana", "desde", "hasta", "supervisor", "referente", "zona",
    "obras", "vehiculos", "insumos", "repuestos", "pendientes", "observaciones"];
}

function filaCampo(d, ts) {
  return [ts, d.semana, d.desde, d.hasta, d.supervisor, d.referente, d.zona,
    JSON.stringify(d.obras || []), JSON.stringify(d.vehiculos || []),
    JSON.stringify(d.insumos || []), JSON.stringify(d.repuestos || []),
    JSON.stringify(d.pendientes || []), d.observaciones || ""];
}

function guardarCampo(d) {
  hoja("Campo", encabezadosCampo()).appendRow(filaCampo(d, new Date()));
}

function jsonParse(s) { try { return JSON.parse(s || "[]") || []; } catch (e) { return []; } }

/* ---------------- Editar una carga existente (por timestamp) ---------------- */
function editarCarga(d) {
  const ts = new Date(d.id);
  if (d.planilla === "Supervisores") {
    actualizarFila(hoja("Supervisores", encabezadosSupervisores()), ts, filaSupervisores(d, ts));
  } else if (d.planilla === "Almacen") {
    actualizarFila(hoja("Almacen", encabezadosAlmacen()), ts, filaAlmacen(d, ts));
  } else if (d.planilla === "Estacionarios") {
    migrarEstacionarios();
    actualizarFila(hoja("Estacionarios", encabezadosEstacionarios()), ts, filaEstacionarios(d, ts));
  } else if (d.planilla === "Campo") {
    actualizarFila(hoja("Campo", encabezadosCampo()), ts, filaCampo(d, ts));
  } else {
    throw new Error("planilla desconocida: " + d.planilla);
  }
}

// Borra por completo una carga (todas sus filas con ese timestamp).
function borrarCarga(d) {
  const encabezados = {
    Supervisores: encabezadosSupervisores, Estacionarios: encabezadosEstacionarios,
    Almacen: encabezadosAlmacen, Campo: encabezadosCampo,
  };
  if (!encabezados[d.planilla]) throw new Error("planilla desconocida: " + d.planilla);
  if (d.planilla === "Estacionarios") migrarEstacionarios();
  borrarFilasTimestamp(hoja(d.planilla, encabezados[d.planilla]()), new Date(d.id));
}

function actualizarFila(sh, tsDate, nuevaFila) {
  const t = tsDate.getTime();
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const c = data[i][0];
    if (c && new Date(c).getTime() === t) {
      sh.getRange(i + 1, 1, 1, nuevaFila.length).setValues([nuevaFila]);
      return;
    }
  }
  throw new Error("carga no encontrada");
}

function borrarFilasTimestamp(sh, tsDate) {
  const t = tsDate.getTime();
  const data = sh.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    const c = data[i][0];
    if (c && new Date(c).getTime() === t) sh.deleteRow(i + 1);
  }
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

  // Estacionarios: 1 fila por carga (formato nuevo; migra el viejo si hace falta).
  migrarEstacionarios();
  const she = ss.getSheetByName("Estacionarios");
  if (she && she.getLastRow() >= 2) {
    const data = she.getDataRange().getValues();
    const head = data[0];
    for (let i = 1; i < data.length; i++) {
      const o = filaObj(head, data[i]);
      const equipos = [];
      for (let j = 1; j <= MAX_EQ; j++) {
        const eq = o[`eq${j}_equipo`];
        if (eq == null || String(eq).trim() === "") continue;
        equipos.push({
          equipo: eq, operativa: o[`eq${j}_operativa`],
          no_operativa: o[`eq${j}_no_operativa`], total: o[`eq${j}_total`],
        });
      }
      out.push({
        planilla: "Estacionarios",
        fila: {
          timestamp: o.timestamp, semana: o.semana, desde: o.desde,
          hasta: o.hasta, ubicacion: o.ubicacion, cant_panoleros: o.cant_panoleros,
          observaciones: o.observaciones,
        },
        equipos: equipos,
      });
    }
  }

  // Campo: 1 fila = 1 carga; las listas vienen como JSON.
  const shc = ss.getSheetByName("Campo");
  if (shc && shc.getLastRow() >= 2) {
    const data = shc.getDataRange().getValues();
    const head = data[0];
    for (let i = 1; i < data.length; i++) {
      const o = filaObj(head, data[i]);
      out.push({
        planilla: "Campo",
        fila: { timestamp: o.timestamp, semana: o.semana, desde: o.desde, hasta: o.hasta,
          supervisor: o.supervisor, referente: o.referente, zona: o.zona },
        obras: jsonParse(o.obras), vehiculos: jsonParse(o.vehiculos), insumos: jsonParse(o.insumos),
        repuestos: jsonParse(o.repuestos), pendientes: jsonParse(o.pendientes),
      });
    }
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

/* ---------------- Listados (Ajustes: ver / agregar / editar / borrar) ----------------
   Pestaña cfg_listados = [id, tipo, v1, v2, v3]. Es la fuente de verdad.
   Se "siembra" una vez con los valores base que manda el front (js/listados.js).
   ------------------------------------------------------------------------------------- */
function hojaListados() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName("cfg_listados");
  if (!sh) {
    sh = ss.insertSheet("cfg_listados");
    sh.appendRow(["id", "tipo", "v1", "v2", "v3", "v4"]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function estaSeedeado() {
  return PropertiesService.getScriptProperties().getProperty("listados_seeded") === "1";
}

// Devuelve todos los listados agrupados, cada entrada con su id (para editar/borrar).
function leerListados() {
  const sh = hojaListados();
  const out = { supervisores: [], mecanicos: [], panoleros: [], obras: [], semanas: [], equiposEstacionarios: [], destinosTransfer: [] };
  if (sh.getLastRow() < 2) return out;
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const tipo = data[i][1];
    if (!out[tipo]) continue;
    const n = LISTADO_COLS[tipo] || 3;
    const fila = [];
    for (let c = 0; c < n; c++) fila.push(data[i][2 + c]);
    out[tipo].push({ id: String(data[i][0]), fila: fila });
  }
  return out;
}

// Carga inicial de los valores base (una sola vez).
function seedListados(d) {
  if (estaSeedeado()) return false;
  const sh = hojaListados();
  const datos = d.datos || {};
  const filas = [];
  Object.keys(datos).forEach((tipo) => {
    if (!LISTADO_COLS[tipo]) return;
    (datos[tipo] || []).forEach((fila) => {
      filas.push([Utilities.getUuid(), tipo, fila[0] || "", fila[1] || "", fila[2] || "", fila[3] || ""]);
    });
  });
  if (filas.length) sh.getRange(sh.getLastRow() + 1, 1, filas.length, 6).setValues(filas);
  PropertiesService.getScriptProperties().setProperty("listados_seeded", "1");
  return true;
}

function agregarListado(d) {
  if (!LISTADO_COLS[d.tipo]) throw new Error("tipo de listado invalido: " + d.tipo);
  const id = Utilities.getUuid();
  const f = d.fila || [];
  hojaListados().appendRow([id, d.tipo, f[0] || "", f[1] || "", f[2] || "", f[3] || ""]);
  return id;
}

function editarListado(d) {
  const sh = hojaListados();
  const data = sh.getDataRange().getValues();
  const f = d.fila || [];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(d.id)) {
      sh.getRange(i + 1, 3, 1, 4).setValues([[f[0] || "", f[1] || "", f[2] || "", f[3] || ""]]);
      return;
    }
  }
  throw new Error("id no encontrado");
}

// Cambia la ubicación/taller de un mecánico (col4=v2=ubicacion, col5=v3=taller).
function asignarMecanico(d) {
  const sh = hojaListados();
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(d.id) && data[i][1] === "mecanicos") {
      sh.getRange(i + 1, 4, 1, 2).setValues([[d.ubicacion || "", d.taller || ""]]);
      return;
    }
  }
  throw new Error("mecanico no encontrado");
}

// Cambia la ubicación/depósito de un pañolero (col4 = v2 = ubicacion).
function asignarPanolero(d) {
  const sh = hojaListados();
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(d.id) && data[i][1] === "panoleros") {
      sh.getRange(i + 1, 4, 1, 1).setValue(d.ubicacion || "");
      return;
    }
  }
  throw new Error("panolero no encontrado");
}

function borrarListado(d) {
  const sh = hojaListados();
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(d.id)) { sh.deleteRow(i + 1); return; }
  }
  throw new Error("id no encontrado");
}

/* ---------------- Respuestas de jefatura (1 fila por SEMANA) ----------------
   Esquema: [timestamp, semana] + resp1..resp40 (dominio/repuesto/fecha_pedido/
   tiempo_estimado) + nec1..nec40 (necesidad/fecha_pedido/respuesta).
   El formato viejo (1 fila por ítem) se migra solo la primera vez: las filas
   originales quedan respaldadas en "Respuestas_viejo" (oculta) y la pestaña
   principal se rearma con una fila por semana. Guardar reemplaza la fila de
   esa semana (o la agrega si no existía). ----------------------------------- */
const MAX_RESP = 60;
const RESP_COLS = ["dominio", "repuesto", "fecha_pedido", "tiempo_estimado"];
const NECR_COLS = ["necesidad", "fecha_pedido", "respuesta"];

function encabezadosRespuestas() {
  const h = ["timestamp", "semana"];
  for (let i = 1; i <= MAX_RESP; i++) RESP_COLS.forEach((c) => h.push(`resp${i}_${c}`));
  for (let i = 1; i <= MAX_RESP; i++) NECR_COLS.forEach((c) => h.push(`nec${i}_${c}`));
  return h;
}

function filaRespuestas(d, ts) {
  const fila = [ts, d.semana];
  for (let i = 0; i < MAX_RESP; i++) {
    const r = (d.repuestos && d.repuestos[i]) || {};
    RESP_COLS.forEach((c) => fila.push(r[c] || ""));
  }
  for (let i = 0; i < MAX_RESP; i++) {
    const n = (d.necesidades && d.necesidades[i]) || {};
    NECR_COLS.forEach((c) => fila.push(n[c] || ""));
  }
  return fila;
}

// Si la pestaña sigue en el formato viejo (columna 2 = "tipo"), la respalda
// y la rearma con 1 fila por semana. Idempotente.
function migrarRespuestas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("Respuestas");
  if (!sh || sh.getLastRow() < 1 || sh.getLastColumn() < 2) return;
  if (sh.getRange(1, 2).getValue() !== "tipo") return; // formato nuevo

  const data = sh.getDataRange().getValues();
  const map = {};
  const orden = [];
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    const sem = String(r[0]);
    if (!map[sem]) {
      map[sem] = { semana: r[0], ts: r[8], repuestos: [], necesidades: [] };
      orden.push(sem);
    }
    if (r[8] && new Date(r[8]) > new Date(map[sem].ts)) map[sem].ts = r[8];
    if (r[1] === "repuesto") {
      map[sem].repuestos.push({ dominio: r[2], repuesto: r[3], fecha_pedido: r[4], tiempo_estimado: r[5] });
    } else if (r[1] === "necesidad") {
      map[sem].necesidades.push({ necesidad: r[6], fecha_pedido: r[4], respuesta: r[7] });
    }
  }

  let nombreViejo = "Respuestas_viejo";
  if (ss.getSheetByName(nombreViejo)) nombreViejo += "_" + new Date().getTime();
  sh.setName(nombreViejo);
  sh.hideSheet();

  const nuevo = hoja("Respuestas", encabezadosRespuestas());
  orden.forEach((sem) => {
    const m = map[sem];
    nuevo.appendRow(filaRespuestas({ semana: m.semana, repuestos: m.repuestos, necesidades: m.necesidades }, m.ts || new Date()));
  });
}

// Reconstruye {repuestos, necesidades} desde una fila del formato nuevo.
function respuestasDeFila(o) {
  const out = { repuestos: [], necesidades: [] };
  for (let i = 1; i <= MAX_RESP; i++) {
    const dom = o[`resp${i}_dominio`], rep = o[`resp${i}_repuesto`];
    if (String(dom == null ? "" : dom).trim() === "" && String(rep == null ? "" : rep).trim() === "") continue;
    out.repuestos.push({ dominio: dom, repuesto: rep, fecha_pedido: o[`resp${i}_fecha_pedido`], tiempo_estimado: o[`resp${i}_tiempo_estimado`] });
  }
  for (let i = 1; i <= MAX_RESP; i++) {
    const ne = o[`nec${i}_necesidad`];
    if (String(ne == null ? "" : ne).trim() === "") continue;
    out.necesidades.push({ necesidad: ne, fecha_pedido: o[`nec${i}_fecha_pedido`], respuesta: o[`nec${i}_respuesta`] });
  }
  return out;
}

function leerRespuestas(semana) {
  migrarRespuestas();
  const sh = hoja("Respuestas", encabezadosRespuestas());
  if (sh.getLastRow() < 2) return { repuestos: [], necesidades: [] };
  const data = sh.getDataRange().getValues();
  const head = data[0];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(semana)) return respuestasDeFila(filaObj(head, data[i]));
  }
  return { repuestos: [], necesidades: [] };
}

function guardarRespuestas(d) {
  migrarRespuestas();
  const sh = hoja("Respuestas", encabezadosRespuestas());
  const fila = filaRespuestas(d, new Date());
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(d.semana)) {
      sh.getRange(i + 1, 1, 1, fila.length).setValues([fila]);
      return;
    }
  }
  sh.appendRow(fila);
}

// Lista de respuestas cargadas (1 fila = 1 semana), más recientes primero.
function historialRespuestas() {
  migrarRespuestas();
  const sh = hoja("Respuestas", encabezadosRespuestas());
  if (sh.getLastRow() < 2) return [];
  const data = sh.getDataRange().getValues();
  const head = data[0];
  const arr = [];
  for (let i = 1; i < data.length; i++) {
    const o = filaObj(head, data[i]);
    const r = respuestasDeFila(o);
    arr.push({ semana: o.semana, timestamp: o.timestamp, repuestos: r.repuestos, necesidades: r.necesidades });
  }
  arr.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return arr;
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
  // El encabezado siempre debe reflejar el esquema actual (por si cambian/achican
  // las columnas). Reescribimos las primeras N celdas de la fila 1.
  sh.getRange(1, 1, 1, encabezados.length).setValues([encabezados]);
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
