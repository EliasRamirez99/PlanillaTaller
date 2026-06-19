/* ============================================================
   Ajustes — ver y agregar datos a los listados  (sector: Admin)
   ============================================================ */
(function () {
  "use strict";

  const sesion = obtenerSesion("Admin");
  if (!sesion) return;

  // tipo = clave en LISTADOS; cols = [campo, etiqueta] en orden.
  const TIPOS = [
    { tipo: "mecanicos",   titulo: "Listado de Mecánicos",   cols: [["nombre", "Nombre"], ["ubicacion", "Ubicación"], ["taller", "Taller"]] },
    { tipo: "panoleros",   titulo: "Listado de Pañoleros",   cols: [["nombre", "Nombre"], ["ubicacion", "Ubicación"], ["panol", "Pañol"]] },
    { tipo: "supervisores",titulo: "Listado de Supervisores", cols: [["nombre", "Nombre"], ["ubicacion", "Ubicación"], ["taller", "Taller"]] },
    { tipo: "obras",       titulo: "Listado de Obras",       cols: [["ubicacion", "Ubicación"], ["obra", "Obra"]] },
    { tipo: "semanas",     titulo: "Listado de Semanas",     cols: [["semana", "Semana"], ["desde", "Desde"], ["hasta", "Hasta"]] },
  ];

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  const cont = $("ajustes");

  // Trae los extras (los suma a LISTADOS) y arma todo.
  cargarExtras(function () {
    TIPOS.forEach(render);
  });

  function render(cfg) {
    const card = document.createElement("div");
    card.className = "card-form";

    const inputs = cfg.cols
      .map(([campo, etq]) => `<input type="text" data-campo="${campo}" placeholder="${esc(etq)}" />`)
      .join("");
    const th = cfg.cols.map(([, etq]) => `<th>${esc(etq)}</th>`).join("");

    card.innerHTML = `
      <h2>${esc(cfg.titulo)} <small style="color:#888;font-weight:400">(${LISTADOS[cfg.tipo].length})</small></h2>
      <div class="add-row">${inputs}<button type="button" class="primary small" data-add>Agregar</button></div>
      <div class="status" data-status></div>
      <table class="grid"><thead><tr>${th}</tr></thead><tbody></tbody></table>`;
    cont.appendChild(card);

    const tbody = card.querySelector("tbody");
    const status = card.querySelector("[data-status]");
    const setStatus = hacerStatus(status);
    const count = card.querySelector("h2 small");

    function pintar() {
      tbody.innerHTML = LISTADOS[cfg.tipo]
        .map((fila) => "<tr>" + cfg.cols.map((c, i) => `<td>${esc(fila[i] || "")}</td>`).join("") + "</tr>")
        .join("");
      count.textContent = `(${LISTADOS[cfg.tipo].length})`;
    }
    pintar();

    card.querySelector("[data-add]").addEventListener("click", function () {
      const fila = cfg.cols.map(([campo]) => card.querySelector(`input[data-campo="${campo}"]`).value.trim());
      if (!fila[0]) { setStatus("Completá al menos el primer campo.", "err"); return; }

      // Modo demo: sin Google, agrega sólo en pantalla.
      if (!CONFIG.APPS_SCRIPT_URL) {
        LISTADOS[cfg.tipo].push(fila);
        pintar();
        card.querySelectorAll("input[data-campo]").forEach((i) => (i.value = ""));
        setStatus("✅ (Demo) Agregado solo localmente.", "ok");
        return;
      }

      setStatus("Guardando…", "");
      fetch(CONFIG.APPS_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ accion: "agregar_listado", sector: "Admin", clave: sesion.clave, tipo: cfg.tipo, fila: fila }),
      })
        .then((r) => r.json())
        .then((out) => {
          if (out && out.ok) {
            LISTADOS[cfg.tipo].push(fila);
            pintar();
            card.querySelectorAll("input[data-campo]").forEach((i) => (i.value = ""));
            setStatus("✅ Agregado.", "ok");
          } else if (out && out.error === "clave") {
            setStatus("❌ Clave de admin incorrecta. Volvé a entrar desde el inicio.", "err");
          } else {
            setStatus("❌ Error: " + ((out && out.error) || "desconocido"), "err");
          }
        })
        .catch(() => setStatus("❌ No se pudo conectar.", "err"));
    });
  }
})();
