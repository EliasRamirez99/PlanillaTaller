/* ============================================================
   COMMON — utilidades compartidas por todas las planillas
   ============================================================ */

const $ = (id) => document.getElementById(id);

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

// Construye filas numeradas (1..n) con inputs por columna.
function construirFilas(tbodyId, filas, cols) {
  const tb = document.querySelector(`#${tbodyId} tbody`);
  for (let i = 1; i <= filas; i++) {
    const tr = document.createElement("tr");
    let html = `<td class="num">${i}</td>`;
    cols.forEach((c) => {
      html += `<td><input type="text" data-col="${c}" /></td>`;
    });
    tr.innerHTML = html;
    tb.appendChild(tr);
  }
}

// Construye filas con una etiqueta fija en la 1ª columna (equipos, conceptos…).
// rows = [[clave, etiqueta], ...]
function construirFilasEtiqueta(tbodyId, rows, cols) {
  const tb = document.querySelector(`#${tbodyId} tbody`);
  rows.forEach(([clave, etiqueta]) => {
    const tr = document.createElement("tr");
    tr.dataset.clave = clave;
    let html = `<td class="label">${etiqueta}</td>`;
    cols.forEach((c) => {
      html += `<td><input type="text" data-col="${c}" /></td>`;
    });
    tr.innerHTML = html;
    tb.appendChild(tr);
  });
}

// Lee tabla numerada -> array de objetos (sólo filas con algún dato).
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

function hacerStatus(el) {
  return (msg, tipo) => {
    el.textContent = msg;
    el.className = "status" + (tipo ? " " + tipo : "");
  };
}

// Envía los datos al Apps Script (o modo DEMO si no hay URL).
async function enviarDatos(d, statusEl, previewEl, onOk) {
  const setStatus = hacerStatus(statusEl);

  if (!CONFIG.APPS_SCRIPT_URL) {
    previewEl.style.display = "block";
    previewEl.textContent =
      "MODO DEMO (todavía no configuraste APPS_SCRIPT_URL en js/config.js)\n" +
      "Esto es lo que se enviaría a la Google Sheet:\n\n" +
      JSON.stringify(Object.assign({}, d, { clave: "•••" }), null, 2);
    setStatus("Modo demo: datos mostrados abajo, no se envió nada.", "ok");
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
      setStatus("❌ Clave de sector incorrecta.", "err");
    } else {
      setStatus("❌ Error: " + (out.error || "desconocido"), "err");
    }
  } catch (e) {
    setStatus("❌ No se pudo conectar. Revisá tu internet o la URL configurada.", "err");
  }
}

// Muestra los datos sin enviar.
function vistaPrevia(d, statusEl, previewEl) {
  previewEl.style.display = "block";
  previewEl.textContent = JSON.stringify(Object.assign({}, d, { clave: "•••" }), null, 2);
  hacerStatus(statusEl)("Vista previa (no se envió nada).", "");
}

// Conecta los botones Enviar / Ver datos de un formulario.
function conectarForm(recolectar, validar, onOk) {
  const status = $("status");
  const preview = $("preview");
  const setStatus = hacerStatus(status);

  $("form").addEventListener("submit", function (ev) {
    ev.preventDefault();
    const d = recolectar();
    const err = validar(d);
    if (err) { setStatus(err, "err"); return; }
    enviarDatos(d, status, preview, onOk);
  });

  $("btn-preview").addEventListener("click", function () {
    vistaPrevia(recolectar(), status, preview);
  });
}
