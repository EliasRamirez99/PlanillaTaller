/* ============================================================
   COMMON — utilidades compartidas por todas las planillas
   ============================================================ */

const $ = (id) => document.getElementById(id);

// Clave que las planillas mandan al guardar (las planillas ya no la piden al usuario).
// Fallback "123" por si quedó un config.js viejo cacheado, así el guardar nunca falla.
function claveSector() {
  return (typeof CONFIG !== "undefined" && CONFIG.SECTOR_CLAVE) || "123";
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

// Autocompleta Desde/Hasta a partir de la semana elegida.
function enlazarSemana(selId, desdeId, hastaId) {
  $(selId).addEventListener("change", function () {
    const s = LISTADOS.semanas.find((x) => x[0] === this.value);
    $(desdeId).value = s ? s[1] : "";
    $(hastaId).value = s ? s[2] : "";
  });
}

// ---------- Clave de sector / sesión ----------

// Valida la clave contra el Apps Script. En modo demo (sin URL) acepta
// cualquier clave no vacía.
async function validarClave(sector, clave) {
  if (!CONFIG.APPS_SCRIPT_URL) return !!clave;
  try {
    const resp = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ accion: "validar", sector: sector, clave: clave }),
    });
    const out = await resp.json();
    return !!out.ok;
  } catch (e) {
    return null; // error de conexión
  }
}

// Suma a LISTADOS los datos extra (los que se agregaron desde Ajustes).
function aplicarExtras(extras) {
  if (!extras || typeof LISTADOS === "undefined") return;
  Object.keys(extras).forEach((tipo) => {
    if (Array.isArray(LISTADOS[tipo]) && Array.isArray(extras[tipo])) {
      extras[tipo].forEach((f) => LISTADOS[tipo].push(f));
    }
  });
}

function extrasCache() {
  try { return JSON.parse(localStorage.getItem("ops_extras") || "null"); } catch (e) { return null; }
}

// Arma los listados SIN depender de internet:
// 1) aplica lo cacheado (instantáneo) y llama cb() para construir el form YA.
// 2) refresca los extras en segundo plano (no bloquea; si falla, no pasa nada).
function prepararListados(cb) {
  aplicarExtras(extrasCache());
  cb();
  if (!CONFIG.APPS_SCRIPT_URL) return;
  fetch(CONFIG.APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ accion: "listados_extra" }),
  })
    .then((r) => r.json())
    .then((out) => {
      if (out && out.ok && out.datos) {
        try { localStorage.setItem("ops_extras", JSON.stringify(out.datos)); } catch (e) {}
      }
    })
    .catch(() => {});
}

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
function tablaDinamica(tbodyId, cols, onCount, max) {
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
    cols.forEach((c) => { html += `<td><input type="text" data-col="${c}" /></td>`; });
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

// Lee tabla con etiqueta fija -> objeto { clave: {col: val} } (todas las filas).
function leerTablaEtiqueta(tbodyId, cols) {
  const out = {};
  document.querySelectorAll(`#${tbodyId} tbody tr`).forEach((tr) => {
    const o = {};
    cols.forEach((c) => {
      const inp = tr.querySelector(`input[data-col="${c}"]`);
      o[c] = inp ? inp.value.trim() : "";
    });
    out[tr.dataset.clave] = o;
  });
  return out;
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
  try {
    const resp = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // evita preflight CORS
      body: JSON.stringify(d),
    });
    const out = await resp.json();
    if (out.ok) {
      setStatus("✅ Enviado correctamente. ¡Gracias!", "ok");
      if (onOk) onOk();
    } else if (out.error === "clave") {
      setStatus("❌ Clave de sector incorrecta. Volvé a entrar desde el inicio.", "err");
    } else {
      setStatus("❌ Error: " + (out.error || "desconocido"), "err");
    }
  } catch (e) {
    setStatus("❌ No se pudo conectar. Revisá tu internet o la URL configurada.", "err");
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
