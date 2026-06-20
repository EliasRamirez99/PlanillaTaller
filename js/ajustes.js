/* ============================================================
   Ajustes — ver / agregar / editar / borrar listados  (Admin)
   Fuente de verdad: pestaña cfg_listados en la Google Sheet.
   ============================================================ */
(function () {
  "use strict";

  const sesion = obtenerSesion("Admin");
  if (!sesion) return;

  const TIPOS = [
    { tipo: "mecanicos",    titulo: "Listado de Mecánicos",    cols: ["Nombre", "Ubicación", "Taller"] },
    { tipo: "panoleros",    titulo: "Listado de Pañoleros",    cols: ["Nombre", "Ubicación", "Pañol"] },
    { tipo: "supervisores", titulo: "Listado de Supervisores", cols: ["Nombre", "Ubicación", "Taller"] },
    { tipo: "obras",        titulo: "Listado de Obras",        cols: ["Ubicación", "Obra"] },
    { tipo: "semanas",      titulo: "Listado de Semanas",      cols: ["Semana", "Desde", "Hasta"] },
  ];

  const cont = $("ajustes");
  let ESTADO = {}; // { tipo: [{ id, fila:[...] }] }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function post(body) {
    return fetch(CONFIG.APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
    }).then((r) => r.json());
  }
  function guardarCache() {
    try { localStorage.setItem("ops_listados", JSON.stringify({ seeded: true, datos: ESTADO })); } catch (e) {}
  }
  function msgErr(err) {
    const m = String((err && err.message) || err);
    if (m === "clave") return "Clave de admin incorrecta. Volvé a entrar desde el inicio.";
    return "No se pudo. Revisá tu internet.";
  }

  // ---- operaciones (servidor; o local si está en demo) ----
  function srvAgregar(tipo, fila) {
    if (!CONFIG.APPS_SCRIPT_URL) return Promise.resolve("demo-" + Date.now() + "-" + Math.random());
    return post({ accion: "agregar_listado", sector: "Admin", clave: sesion.clave, tipo: tipo, fila: fila })
      .then((o) => { if (!o.ok) throw new Error(o.error || "error"); return o.id; });
  }
  function srvEditar(id, fila) {
    if (!CONFIG.APPS_SCRIPT_URL) return Promise.resolve();
    return post({ accion: "editar_listado", sector: "Admin", clave: sesion.clave, id: id, fila: fila })
      .then((o) => { if (!o.ok) throw new Error(o.error || "error"); });
  }
  function srvBorrar(id) {
    if (!CONFIG.APPS_SCRIPT_URL) return Promise.resolve();
    return post({ accion: "borrar_listado", sector: "Admin", clave: sesion.clave, id: id })
      .then((o) => { if (!o.ok) throw new Error(o.error || "error"); });
  }

  // ---- carga inicial (siembra los valores base la primera vez) ----
  cargar();
  async function cargar() {
    cont.innerHTML = '<p class="status">Cargando…</p>';

    if (!CONFIG.APPS_SCRIPT_URL) {
      TIPOS.forEach((t) => {
        ESTADO[t.tipo] = (LISTADOS[t.tipo] || []).map((f) => ({ id: "demo-" + Math.random(), fila: f.slice() }));
      });
      pintarTodo();
      return;
    }

    try {
      let r = await post({ accion: "listados" });
      if (r && r.ok && !r.seeded) {
        const base = {};
        TIPOS.forEach((t) => (base[t.tipo] = LISTADOS[t.tipo] || []));
        await post({ accion: "seed_listados", sector: "Admin", clave: sesion.clave, datos: base });
        r = await post({ accion: "listados" });
      }
      if (!r || !r.ok) throw new Error((r && r.error) || "error");
      ESTADO = r.datos || {};
      guardarCache();
      pintarTodo();
    } catch (e) {
      cont.innerHTML = '<p class="status err">No se pudo cargar. Revisá tu internet o la clave Admin, y volvé a entrar desde el inicio.</p>';
    }
  }

  function pintarTodo() {
    cont.innerHTML = "";
    TIPOS.forEach(renderCard);
  }

  function renderCard(cfg) {
    const card = document.createElement("div");
    card.className = "card-form";
    const addInputs = cfg.cols.map((etq, i) => `<input type="text" data-new="${i}" placeholder="${esc(etq)}" />`).join("");
    const ths = cfg.cols.map((etq) => `<th>${esc(etq)}</th>`).join("");
    card.innerHTML =
      `<h2>${esc(cfg.titulo)} <small data-count></small></h2>` +
      `<div class="add-row">${addInputs}<button type="button" class="primary small" data-add>Agregar</button></div>` +
      `<div class="status" data-status></div>` +
      `<table class="grid"><thead><tr>${ths}<th class="acc-h">Acciones</th></tr></thead><tbody></tbody></table>`;
    cont.appendChild(card);

    const tbody = card.querySelector("tbody");
    const setStatus = hacerStatus(card.querySelector("[data-status]"));
    let editId = null;

    function filaHtml(e) {
      if (e.id === editId) {
        const celdas = cfg.cols.map((_, i) => `<td><input type="text" data-edit="${i}" value="${esc(e.fila[i] || "")}" /></td>`).join("");
        return `<tr data-id="${esc(e.id)}">${celdas}<td class="acc"><button type="button" data-save title="Guardar">✓</button><button type="button" data-cancel title="Cancelar">✗</button></td></tr>`;
      }
      const celdas = cfg.cols.map((_, i) => `<td>${esc(e.fila[i] || "")}</td>`).join("");
      return `<tr data-id="${esc(e.id)}">${celdas}<td class="acc"><button type="button" data-ed title="Editar">✎</button><button type="button" data-del title="Borrar">🗑</button></td></tr>`;
    }
    function pintar() {
      const items = ESTADO[cfg.tipo] || [];
      card.querySelector("[data-count]").textContent = "(" + items.length + ")";
      tbody.innerHTML = items.map(filaHtml).join("");
    }
    pintar();

    // Agregar
    card.querySelector("[data-add]").addEventListener("click", function () {
      const fila = cfg.cols.map((_, i) => card.querySelector(`input[data-new="${i}"]`).value.trim());
      if (!fila[0]) { setStatus("Completá al menos el primer campo.", "err"); return; }
      setStatus("Guardando…", "");
      srvAgregar(cfg.tipo, fila).then((id) => {
        (ESTADO[cfg.tipo] = ESTADO[cfg.tipo] || []).push({ id: id, fila: fila });
        guardarCache();
        card.querySelectorAll("input[data-new]").forEach((i) => (i.value = ""));
        setStatus("✅ Agregado.", "ok");
        pintar();
      }).catch((err) => setStatus("❌ " + msgErr(err), "err"));
    });

    // Editar / borrar / guardar / cancelar (delegado en el tbody)
    tbody.addEventListener("click", function (ev) {
      const tr = ev.target.closest("tr");
      if (!tr) return;
      const id = tr.dataset.id;

      if (ev.target.matches("[data-ed]")) {
        editId = id; pintar();
      } else if (ev.target.matches("[data-cancel]")) {
        editId = null; pintar();
      } else if (ev.target.matches("[data-del]")) {
        if (!confirm("¿Borrar esta fila?")) return;
        setStatus("Borrando…", "");
        srvBorrar(id).then(() => {
          ESTADO[cfg.tipo] = (ESTADO[cfg.tipo] || []).filter((e) => e.id !== id);
          guardarCache();
          setStatus("✅ Borrado.", "ok");
          pintar();
        }).catch((err) => setStatus("❌ " + msgErr(err), "err"));
      } else if (ev.target.matches("[data-save]")) {
        const fila = cfg.cols.map((_, i) => tr.querySelector(`input[data-edit="${i}"]`).value.trim());
        if (!fila[0]) { setStatus("Completá al menos el primer campo.", "err"); return; }
        setStatus("Guardando…", "");
        srvEditar(id, fila).then(() => {
          const e = (ESTADO[cfg.tipo] || []).find((x) => x.id === id);
          if (e) e.fila = fila;
          guardarCache();
          editId = null;
          setStatus("✅ Guardado.", "ok");
          pintar();
        }).catch((err) => setStatus("❌ " + msgErr(err), "err"));
      }
    });
  }
})();
