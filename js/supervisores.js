/* ============================================================
   Lógica de la planilla de Supervisores
   ============================================================ */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const FILAS_REPUESTOS = 5;
  const FILAS_NECESIDADES = 5;

  // ---------- Poblar desplegables ----------
  function poblarSelect(sel, items, valueFn, textFn) {
    items.forEach((it) => {
      const o = document.createElement("option");
      o.value = valueFn(it);
      o.textContent = textFn(it);
      sel.appendChild(o);
    });
  }

  poblarSelect($("semana"), LISTADOS.semanas, (s) => s[0], (s) => s[0]);
  poblarSelect($("supervisor"), LISTADOS.supervisores, (s) => s[0], (s) => s[0]);
  poblarSelect($("obra"), LISTADOS.obras, (o) => o[1], (o) => `${o[1]}  (${o[0]})`);

  // ---------- Autocompletar al elegir ----------
  $("semana").addEventListener("change", function () {
    const s = LISTADOS.semanas.find((x) => x[0] === this.value);
    $("desde").value = s ? s[1] : "";
    $("hasta").value = s ? s[2] : "";
  });

  $("supervisor").addEventListener("change", function () {
    const s = LISTADOS.supervisores.find((x) => x[0] === this.value);
    $("ubicacion").value = s ? s[1] : "";
    $("taller").value = s ? s[2] : "";
  });

  // ---------- Construir filas de tablas ----------
  function construirTabla(tbodyId, filas, cols) {
    const tb = document.querySelector(`#${tbodyId} tbody`);
    for (let i = 1; i <= filas; i++) {
      const tr = document.createElement("tr");
      let html = `<td class="num">${i}</td>`;
      cols.forEach((c) => {
        html += `<td><input type="text" data-fila="${i}" data-col="${c}" /></td>`;
      });
      tr.innerHTML = html;
      tb.appendChild(tr);
    }
  }
  construirTabla("tabla-repuestos", FILAS_REPUESTOS, ["dominio", "repuesto", "tiempo"]);
  construirTabla("tabla-necesidades", FILAS_NECESIDADES, ["necesidad"]);

  // ---------- Recolectar datos ----------
  function leerTabla(tablaId, cols) {
    const filas = [];
    document.querySelectorAll(`#${tablaId} tbody tr`).forEach((tr) => {
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

  function recolectar() {
    return {
      sector: CONFIG.SECTOR,
      planilla: "Supervisores",
      clave: $("clave").value,
      semana: $("semana").value,
      desde: $("desde").value,
      hasta: $("hasta").value,
      supervisor: $("supervisor").value,
      ubicacion: $("ubicacion").value,
      taller: $("taller").value,
      obra: $("obra").value,
      cant_mecanicos: $("cant_mecanicos").value,
      km: $("km").value,
      ordenes: $("ordenes").value,
      tareas: $("tareas").value,
      en_reparacion: $("en_reparacion").value,
      tercerizado: $("tercerizado").value,
      espera_repuesto: $("espera_repuesto").value,
      necesidades_cant: $("necesidades_cant").value,
      repuestos: leerTabla("tabla-repuestos", ["dominio", "repuesto", "tiempo"]),
      necesidades: leerTabla("tabla-necesidades", ["necesidad"]),
    };
  }

  function validar(d) {
    if (!d.clave) return "Ingresá la clave del sector.";
    if (!d.semana) return "Elegí la semana.";
    if (!d.supervisor) return "Elegí el supervisor.";
    return null;
  }

  // ---------- Estado ----------
  const status = $("status");
  function setStatus(msg, tipo) {
    status.textContent = msg;
    status.className = "status" + (tipo ? " " + tipo : "");
  }

  // ---------- Envío ----------
  async function enviar(d) {
    // Modo DEMO si no hay URL configurada
    if (!CONFIG.APPS_SCRIPT_URL) {
      $("preview").style.display = "block";
      const copia = Object.assign({}, d, { clave: "•••" });
      $("preview").textContent =
        "MODO DEMO (todavía no configuraste APPS_SCRIPT_URL en js/config.js)\n" +
        "Esto es lo que se enviaría a la Google Sheet:\n\n" +
        JSON.stringify(copia, null, 2);
      setStatus("Modo demo: datos mostrados abajo, no se envió nada.", "ok");
      return;
    }

    setStatus("Enviando…", "");
    try {
      const resp = await fetch(CONFIG.APPS_SCRIPT_URL, {
        method: "POST",
        // text/plain evita el preflight CORS con Apps Script
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(d),
      });
      const out = await resp.json();
      if (out.ok) {
        setStatus("✅ Enviado correctamente. ¡Gracias!", "ok");
        $("form").reset();
        $("desde").value = $("hasta").value = $("ubicacion").value = $("taller").value = "";
      } else if (out.error === "clave") {
        setStatus("❌ Clave de sector incorrecta.", "err");
      } else {
        setStatus("❌ Error: " + (out.error || "desconocido"), "err");
      }
    } catch (e) {
      setStatus("❌ No se pudo conectar. Revisá tu internet o la URL configurada.", "err");
    }
  }

  // ---------- Eventos ----------
  $("form").addEventListener("submit", function (ev) {
    ev.preventDefault();
    const d = recolectar();
    const err = validar(d);
    if (err) { setStatus(err, "err"); return; }
    enviar(d);
  });

  $("btn-preview").addEventListener("click", function () {
    const d = recolectar();
    const copia = Object.assign({}, d, { clave: "•••" });
    $("preview").style.display = "block";
    $("preview").textContent = JSON.stringify(copia, null, 2);
    setStatus("Vista previa (no se envió nada).", "");
  });
})();
