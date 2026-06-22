/* ============================================================
   COMMON — utilidades compartidas por todas las planillas
   ============================================================ */

const $ = (id) => document.getElementById(id);

// Clave que las planillas mandan al guardar (las planillas ya no la piden al usuario).
// Fallback "123" por si quedó un config.js viejo cacheado, así el guardar nunca falla.
function claveSector() {
  return (typeof CONFIG !== "undefined" && CONFIG.SECTOR_CLAVE) || "123";
}

// fetch con timeout (para que una conexión colgada no espere para siempre).
function fetchConTimeout(url, opts, ms) {
  if (typeof AbortController === "undefined") return fetch(url, opts);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms || 15000);
  return fetch(url, Object.assign({}, opts, { signal: ctrl.signal })).finally(() => clearTimeout(t));
}

// POST al Apps Script con REINTENTOS (clave para internet inestable del trabajo).
// Devuelve el JSON de respuesta, o null si la red falló en todos los intentos.
async function postReintento(body, intentos) {
  intentos = intentos || 3;
  const opts = { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) };
  for (let i = 0; i < intentos; i++) {
    try {
      const resp = await fetchConTimeout(CONFIG.APPS_SCRIPT_URL, opts, 15000);
      return await resp.json();
    } catch (e) {
      if (i < intentos - 1) await new Promise((r) => setTimeout(r, 900 * (i + 1)));
    }
  }
  return null;
}

// Llena un <select> con opciones.
function poblarSelect(sel, items, valueFn, textFn) {
  items.forEach((it) => {
    const o = document.createElement("option");
    o.value = valueFn(it);
    o.textContent = textFn(it);
    sel.appendChild(o);
  });
}

// Formatea una fecha a dd-mm-aaaa. Acepta ISO (de Google Sheets),
// d/m/aaaa, d-m-aaaa o un Date; si no reconoce, devuelve el valor tal cual.
function formatearFecha(v) {
  if (v == null || v === "") return "";
  const s = String(v);
  const p = (n) => String(n).padStart(2, "0");
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d)) return `${p(d.getUTCDate())}-${p(d.getUTCMonth() + 1)}-${d.getUTCFullYear()}`;
  }
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return `${p(m[1])}-${p(m[2])}-${m[3]}`;
  return s;
}

// Autocompleta Desde/Hasta a partir de la semana elegida (en formato dd-mm-aaaa).
function enlazarSemana(selId, desdeId, hastaId) {
  $(selId).addEventListener("change", function () {
    const s = LISTADOS.semanas.find((x) => x[0] === this.value);
    $(desdeId).value = s ? formatearFecha(s[1]) : "";
    $(hastaId).value = s ? formatearFecha(s[2]) : "";
  });
}

// ---------- Clave de sector / sesión ----------

// Valida la clave contra el Apps Script. En modo demo (sin URL) acepta
// cualquier clave no vacía.
async function validarClave(sector, clave) {
  if (!CONFIG.APPS_SCRIPT_URL) return !!clave;
  const out = await postReintento({ accion: "validar", sector: sector, clave: clave }, 3);
  if (out === null) return null; // error de conexión tras reintentos
  return !!out.ok;
}

// Reemplaza en LISTADOS los tipos editables con la estructura {tipo:[{id,fila}]}.
function aplicarListados(estructura) {
  if (!estructura || typeof LISTADOS === "undefined") return;
  Object.keys(estructura).forEach((tipo) => {
    if (Array.isArray(LISTADOS[tipo]) && Array.isArray(estructura[tipo])) {
      LISTADOS[tipo] = estructura[tipo].map((e) => (e && e.fila ? e.fila : e));
    }
  });
}

function listadosCache() {
  try { return JSON.parse(localStorage.getItem("ops_listados") || "null"); } catch (e) { return null; }
}

// Arma los listados SIN depender de internet:
// 1) si ya hay datos sembrados en caché, los aplica y llama cb() para construir YA.
//    Si no, usa los valores base de js/listados.js.
// 2) refresca desde el servidor en segundo plano (no bloquea; si falla, no pasa nada).
function prepararListados(cb) {
  const cache = listadosCache();
  if (cache && cache.seeded && cache.datos) aplicarListados(cache.datos);
  cb();
  if (!CONFIG.APPS_SCRIPT_URL) return;
  postReintento({ accion: "listados" }, 2).then((out) => {
    if (out && out.ok && out.seeded && out.datos) {
      try { localStorage.setItem("ops_listados", JSON.stringify({ seeded: true, datos: out.datos })); } catch (e) {}
    }
  });
}

// Edición de una carga existente (se setea desde el historial y se lee en el form).
function leerEdicion() {
  try { return JSON.parse(sessionStorage.getItem("ops_edit") || "null"); } catch (e) { return null; }
}
function limpiarEdicion() { sessionStorage.removeItem("ops_edit"); }

// Lee la sesión guardada al pasar la clave en el inicio.
// Si no coincide con el sector esperado, redirige al inicio (refuerza el acceso).
function obtenerSesion(sectorEsperado) {
  const sector = sessionStorage.getItem("ops_sector");
  const clave = sessionStorage.getItem("ops_clave");
  if (!sector || sector !== sectorEsperado || !clave) {
    location.replace("index.html");
    return null;
  }
  return { sector, clave };
}

// ---------- Tablas ----------

// Filas con etiqueta fija en la 1ª columna (equipos, conceptos…).
// rows = [[clave, etiqueta], ...]
function construirFilasEtiqueta(tbodyId, rows, cols) {
  const tb = document.querySelector(`#${tbodyId} tbody`);
  rows.forEach(([clave, etiqueta]) => {
    const tr = document.createElement("tr");
    tr.dataset.clave = clave;
    let html = `<td class="label">${etiqueta}</td>`;
    cols.forEach((c) => { html += `<td><input type="text" data-col="${c}" /></td>`; });
    tr.innerHTML = html;
    tb.appendChild(tr);
  });
}

// Tabla DINÁMICA: arranca con 1 fila, se agregan/quitan con botones.
// onCount(n) se llama con la cantidad de filas con datos (para autocompletar).
// max = tope de filas (lo que se guarda en la Sheet). Devuelve { agregar }.
// listas (opcional) = { columna: idDeDatalist } para sugerencias en un input.
function tablaDinamica(tbodyId, cols, onCount, max, listas) {
  const tb = document.querySelector(`#${tbodyId} tbody`);

  function renumerar() {
    tb.querySelectorAll("tr").forEach((tr, i) => {
      const n = tr.querySelector("td.num");
      if (n) n.textContent = i + 1;
    });
  }
  function contar() {
    let n = 0;
    tb.querySelectorAll("tr").forEach((tr) => {
      const algo = cols.some((c) => {
        const inp = tr.querySelector(`input[data-col="${c}"]`);
        return inp && inp.value.trim();
      });
      if (algo) n++;
    });
    return n;
  }
  function notificar() { if (onCount) onCount(contar()); }

  function agregar() {
    if (max && tb.querySelectorAll("tr").length >= max) return null; // tope
    const tr = document.createElement("tr");
    let html = `<td class="num"></td>`;
    cols.forEach((c) => {
      const lst = listas && listas[c] ? ` list="${listas[c]}"` : "";
      html += `<td><input type="text" data-col="${c}"${lst} /></td>`;
    });
    html += `<td class="del"><button type="button" class="row-del" title="Quitar fila">×</button></td>`;
    tr.innerHTML = html;
    tb.appendChild(tr);
    renumerar();
    return tr;
  }

  tb.addEventListener("input", notificar);
  tb.addEventListener("click", (e) => {
    if (!e.target.classList.contains("row-del")) return;
    if (tb.querySelectorAll("tr").length > 1) {
      e.target.closest("tr").remove();
    } else {
      e.target.closest("tr").querySelectorAll("input").forEach((i) => (i.value = ""));
    }
    renumerar();
    notificar();
  });

  agregar(); // primera fila
  return { agregar };
}

// Engancha un botón "Agregar" a una tabla dinámica.
function wireAgregar(btnId, ctrl) {
  $(btnId).addEventListener("click", () => ctrl.agregar());
}

// Llena una tabla dinámica con filas existentes (modo edición).
function llenarDinamica(tbodyId, ctrl, items, cols) {
  const tb = document.querySelector(`#${tbodyId} tbody`);
  while (tb.querySelectorAll("tr").length < items.length) ctrl.agregar();
  const trs = tb.querySelectorAll("tr");
  items.forEach((it, idx) => {
    cols.forEach((c) => {
      const inp = trs[idx].querySelector(`input[data-col="${c}"]`);
      if (inp) inp.value = it[c] || "";
    });
  });
  const first = tb.querySelector("input");
  if (first) first.dispatchEvent(new Event("input", { bubbles: true })); // recalcula contadores
}

// Muestra una lista simple en un modal (crea el modal si no existe).
function mostrarLista(titulo, lineas) {
  let ov = document.getElementById("lista-modal");
  if (!ov) {
    ov = document.createElement("div");
    ov.id = "lista-modal";
    ov.className = "modal";
    ov.innerHTML = '<div class="modal-box"><button type="button" class="modal-close" title="Cerrar">×</button><div id="lista-body"></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener("click", (e) => { if (e.target === ov || e.target.classList.contains("modal-close")) ov.style.display = "none"; });
  }
  const e2 = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  document.getElementById("lista-body").innerHTML = `<h3>${e2(titulo)}</h3>` +
    (lineas.length ? '<ul class="lista-ul">' + lineas.map((l) => `<li>${e2(l)}</li>`).join("") + "</ul>" : "<p>(sin datos)</p>");
  ov.style.display = "flex";
}

// Semana anterior (según el orden de LISTADOS.semanas).
function semanaAnteriorDe(semana) {
  const orden = (typeof LISTADOS !== "undefined" ? LISTADOS.semanas || [] : []).map((s) => s[0]);
  const i = orden.indexOf(semana);
  return i > 0 ? orden[i - 1] : null;
}

// Trae del historial la carga de la semana anterior que cumpla matchFn (misma persona/ubicación).
function traerCargaAnterior(planilla, semanaActual, matchFn) {
  const ant = semanaAnteriorDe(semanaActual);
  if (!ant || !CONFIG.APPS_SCRIPT_URL) return Promise.resolve({ semanaAnt: ant, sub: null });
  return postReintento({ accion: "historial" }, 2).then((out) => {
    const subs = ((out && out.datos) || []).filter((s) => s.planilla === planilla && s.fila && s.fila.semana === ant && matchFn(s));
    return { semanaAnt: ant, sub: subs.length ? subs[subs.length - 1] : null };
  });
}

// Lee tabla (numerada o dinámica) -> array de objetos (sólo filas con dato).
function leerTabla(tbodyId, cols) {
  const filas = [];
  document.querySelectorAll(`#${tbodyId} tbody tr`).forEach((tr) => {
    const obj = {};
    let algo = false;
    cols.forEach((c) => {
      const inp = tr.querySelector(`input[data-col="${c}"]`);
      obj[c] = inp ? inp.value.trim() : "";
      if (obj[c]) algo = true;
    });
    if (algo) filas.push(obj);
  });
  return filas;
}

// Lee tabla con etiqueta fija -> objeto { clave: {col: val} } (ignora la fila Total).
function leerTablaEtiqueta(tbodyId, cols) {
  const out = {};
  document.querySelectorAll(`#${tbodyId} tbody tr`).forEach((tr) => {
    if (!tr.dataset.clave) return; // saltea la fila "Total"
    const o = {};
    cols.forEach((c) => {
      const inp = tr.querySelector(`input[data-col="${c}"]`);
      o[c] = inp ? inp.value.trim() : "";
    });
    out[tr.dataset.clave] = o;
  });
  return out;
}

// Agrega una fila "Total" al final de una tabla de etiqueta y suma cada columna.
// Devuelve la función para recalcular (útil después de reset).
function filaTotal(tbodyId, cols, etiqueta) {
  const tb = document.querySelector(`#${tbodyId} tbody`);
  const tr = document.createElement("tr");
  tr.className = "total-row";
  let html = `<td class="label">${etiqueta || "Total"}</td>`;
  cols.forEach((c) => { html += `<td data-total="${c}" class="num-total">0</td>`; });
  tr.innerHTML = html;
  tb.appendChild(tr);

  function recomputar() {
    cols.forEach((c) => {
      let suma = 0;
      tb.querySelectorAll(`tr:not(.total-row) input[data-col="${c}"]`).forEach((inp) => {
        const v = parseFloat(inp.value);
        if (!isNaN(v)) suma += v;
      });
      tr.querySelector(`[data-total="${c}"]`).textContent = suma;
    });
  }
  tb.addEventListener("input", recomputar);
  recomputar();
  return recomputar;
}

// Lee tabla con etiqueta fija -> array [{etiqueta, col...}] (sólo filas con dato).
function leerTablaEtiquetaArray(tbodyId, campoEtiqueta, cols) {
  const filas = [];
  document.querySelectorAll(`#${tbodyId} tbody tr`).forEach((tr) => {
    const o = {};
    o[campoEtiqueta] = tr.dataset.clave;
    let algo = false;
    cols.forEach((c) => {
      const inp = tr.querySelector(`input[data-col="${c}"]`);
      o[c] = inp ? inp.value.trim() : "";
      if (o[c]) algo = true;
    });
    if (algo) filas.push(o);
  });
  return filas;
}

// ---------- Estado / envío ----------

function hacerStatus(el) {
  return (msg, tipo) => {
    el.textContent = msg;
    el.className = "status" + (tipo ? " " + tipo : "");
  };
}

async function enviarDatos(d, statusEl, onOk) {
  const setStatus = hacerStatus(statusEl);

  if (!CONFIG.APPS_SCRIPT_URL) {
    setStatus("✅ (Demo) Datos válidos. Configurá APPS_SCRIPT_URL en js/config.js para enviar de verdad.", "ok");
    return;
  }

  setStatus("Enviando…", "");
  const out = await postReintento(d, 3);
  if (out === null) {
    setStatus("⚠️ La red del trabajo cortó la conexión (probé 3 veces). Tus datos siguen cargados — esperá unos segundos y tocá Enviar de nuevo.", "err");
    return;
  }
  if (out.ok) {
    setStatus("✅ Enviado correctamente. ¡Gracias!", "ok");
    if (onOk) onOk();
  } else if (out.error === "clave") {
    setStatus("❌ Clave de sector incorrecta. Volvé a entrar desde el inicio.", "err");
  } else {
    setStatus("❌ Error: " + (out.error || "desconocido"), "err");
  }
}

// Conecta el botón Enviar de un formulario.
function conectarForm(recolectar, validar, onOk) {
  const status = $("status");
  const setStatus = hacerStatus(status);
  $("form").addEventListener("submit", function (ev) {
    ev.preventDefault();
    const d = recolectar();
    const err = validar(d);
    if (err) { setStatus(err, "err"); return; }
    enviarDatos(d, status, onOk);
  });
}
