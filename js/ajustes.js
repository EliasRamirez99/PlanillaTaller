/* ============================================================
   Ajustes — ver / agregar / editar / borrar listados  (Admin)
   Fuente de verdad: pestaña cfg_listados en la Google Sheet.
   ============================================================ */
(function () {
  "use strict";

  const sesion = obtenerSesion("Admin");
  if (!sesion) return;

  // Valores estandarizados (se calculan a partir de lo cargado, sobre todo supervisores).
  let UBIS = [];
  let TALLERES = [];

  // cols: { etq, opts?(desplegable), fecha?(formato dd-mm-aaaa) }. Supervisores va primero.
  const TIPOS = [
    { tipo: "supervisores", titulo: "Listado de Supervisores", cols: [
      { etq: "Nombre" }, { etq: "Ubicación", opts: () => UBIS }, { etq: "Taller", opts: () => TALLERES } ] },
    { tipo: "mecanicos", titulo: "Listado de Mecánicos", cols: [
      { etq: "Nombre" }, { etq: "Ubicación", opts: () => UBIS }, { etq: "Taller", opts: () => TALLERES } ] },
    { tipo: "panoleros", titulo: "Listado de Pañoleros", cols: [
      { etq: "Nombre" }, { etq: "Ubicación", opts: () => UBIS }, { etq: "Pañol" } ] },
    { tipo: "obras", titulo: "Listado de Obras", cols: [
      { etq: "Ubicación", opts: () => UBIS }, { etq: "Obra" } ] },
    { tipo: "semanas", titulo: "Listado de Semanas", cols: [
      { etq: "Semana" }, { etq: "Desde", fecha: true }, { etq: "Hasta", fecha: true } ] },
  ];

  const cont = $("ajustes");
  let ESTADO = {}; // { tipo: [{ id, fila:[...] }] }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function post(body) {
    return fetch(CONFIG.APPS_SCRIPT_URL, {
      method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body),
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

  // Calcula los valores estandarizados de Ubicación y Taller (base: supervisores).
  function computarOpts() {
    const ubi = new Set(), tal = new Set();
    (ESTADO.supervisores || []).forEach((e) => { if (e.fila[1]) ubi.add(e.fila[1]); if (e.fila[2]) tal.add(e.fila[2]); });
    (ESTADO.mecanicos || []).forEach((e) => { if (e.fila[1]) ubi.add(e.fila[1]); if (e.fila[2]) tal.add(e.fila[2]); });
    (ESTADO.obras || []).forEach((e) => { if (e.fila[0]) ubi.add(e.fila[0]); });
    (LISTADOS.talleres || []).forEach((t) => tal.add(t));
    UBIS = Array.from(ubi).sort();
    TALLERES = Array.from(tal).sort();
  }

  function selectHtml(attr, opts, valor) {
    const arr = opts.slice();
    if (valor && arr.indexOf(valor) < 0) arr.unshift(valor);
    return `<select ${attr}><option value="">—</option>` +
      arr.map((o) => `<option${o === valor ? " selected" : ""}>${esc(o)}</option>`).join("") + "</select>";
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

  // ---- carga inicial ----
  cargar();
  async function cargar() {
    cont.innerHTML = '<p class="status">Cargando…</p>';
    if (!CONFIG.APPS_SCRIPT_URL) {
      TIPOS.forEach((t) => { ESTADO[t.tipo] = (LISTADOS[t.tipo] || []).map((f) => ({ id: "demo-" + Math.random(), fila: f.slice() })); });
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
    computarOpts();
    cont.innerHTML = "";
    TIPOS.forEach(renderCard);
  }

  function renderCard(cfg) {
    const card = document.createElement("div");
    card.className = "card-form";
    const addInputs = cfg.cols.map((c, i) => c.opts
      ? selectHtml(`data-new="${i}"`, c.opts(), "")
      : `<input type="text" data-new="${i}" placeholder="${esc(c.etq)}" />`).join("");
    const ths = cfg.cols.map((c) => `<th>${esc(c.etq)}</th>`).join("");
    card.innerHTML =
      `<h2>${esc(cfg.titulo)} <small data-count></small></h2>` +
      `<div class="add-row">${addInputs}<button type="button" class="primary small" data-add>Agregar</button></div>` +
      `<div class="status" data-status></div>` +
      `<table class="grid"><thead><tr>${ths}<th class="acc-h">Acciones</th></tr></thead><tbody></tbody></table>`;
    cont.appendChild(card);

    const tbody = card.querySelector("tbody");
    const setStatus = hacerStatus(card.querySelector("[data-status]"));
    let editId = null;

    function celda(c, v) { return esc(c.fecha ? formatearFecha(v) : v); }

    function filaHtml(e) {
      if (e.id === editId) {
        const celdas = cfg.cols.map((c, i) => {
          const v = e.fila[i] || "";
          if (c.opts) return `<td>${selectHtml(`data-edit="${i}"`, c.opts(), v)}</td>`;
          return `<td><input type="text" data-edit="${i}" value="${esc(c.fecha ? formatearFecha(v) : v)}" /></td>`;
        }).join("");
        return `<tr data-id="${esc(e.id)}">${celdas}<td class="acc"><button type="button" data-save title="Guardar">✓</button><button type="button" data-cancel title="Cancelar">✗</button></td></tr>`;
      }
      const celdas = cfg.cols.map((c, i) => `<td>${celda(c, e.fila[i] || "")}</td>`).join("");
      return `<tr data-id="${esc(e.id)}">${celdas}<td class="acc"><button type="button" data-ed title="Editar">✎</button><button type="button" data-del title="Borrar">🗑</button></td></tr>`;
    }
    function pintar() {
      const items = ESTADO[cfg.tipo] || [];
      card.querySelector("[data-count]").textContent = "(" + items.length + ")";
      tbody.innerHTML = items.map(filaHtml).join("");
    }
    pintar();

    card.querySelector("[data-add]").addEventListener("click", function () {
      const fila = cfg.cols.map((_, i) => card.querySelector(`[data-new="${i}"]`).value.trim());
      if (!fila[0]) { setStatus("Completá al menos el primer campo.", "err"); return; }
      setStatus("Guardando…", "");
      srvAgregar(cfg.tipo, fila).then((id) => {
        (ESTADO[cfg.tipo] = ESTADO[cfg.tipo] || []).push({ id: id, fila: fila });
        guardarCache();
        card.querySelectorAll("[data-new]").forEach((i) => (i.value = ""));
        setStatus("✅ Agregado.", "ok");
        pintar();
      }).catch((err) => setStatus("❌ " + msgErr(err), "err"));
    });

    tbody.addEventListener("click", function (ev) {
      const tr = ev.target.closest("tr");
      if (!tr) return;
      const id = tr.dataset.id;
      if (ev.target.matches("[data-ed]")) { editId = id; pintar(); }
      else if (ev.target.matches("[data-cancel]")) { editId = null; pintar(); }
      else if (ev.target.matches("[data-del]")) {
        if (!confirm("¿Borrar esta fila?")) return;
        setStatus("Borrando…", "");
        srvBorrar(id).then(() => {
          ESTADO[cfg.tipo] = (ESTADO[cfg.tipo] || []).filter((e) => e.id !== id);
          guardarCache(); setStatus("✅ Borrado.", "ok"); pintar();
        }).catch((err) => setStatus("❌ " + msgErr(err), "err"));
      } else if (ev.target.matches("[data-save]")) {
        const fila = cfg.cols.map((_, i) => tr.querySelector(`[data-edit="${i}"]`).value.trim());
        if (!fila[0]) { setStatus("Completá al menos el primer campo.", "err"); return; }
        setStatus("Guardando…", "");
        srvEditar(id, fila).then(() => {
          const e = (ESTADO[cfg.tipo] || []).find((x) => x.id === id);
          if (e) e.fila = fila;
          guardarCache(); editId = null; setStatus("✅ Guardado.", "ok"); pintar();
        }).catch((err) => setStatus("❌ " + msgErr(err), "err"));
      }
    });
  }
})();
