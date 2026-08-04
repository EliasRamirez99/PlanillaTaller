/* ============================================================
   Lógica de la planilla de Supervisores  (sector: Taller)
   ============================================================ */
(function () {
  "use strict";

  const SECTOR = "Taller";
  const COLS_REP = ["dominio", "repuesto", "tiempo"];
  const COLS_TER = ["dominio", "razon", "fecha"];
  const edicion = leerEdicion();
  const enEd = !!(edicion && edicion.planilla === "Supervisores");
  let MECS = []; // mecánicos de la ubicación/taller elegidos (para "Ver listado")

  prepararListados(function () {
    poblarSemanas($("semana"));
    poblarSelect($("supervisor"), LISTADOS.supervisores, (s) => s[0], (s) => s[0]);
    enlazarSemana("semana", "desde", "hasta");
    if (!enEd) preseleccionarSemana("semana");

    $("supervisor").addEventListener("change", function () {
      const s = LISTADOS.supervisores.find((x) => x[0] === this.value);
      $("ubicacion").value = s ? s[1] : "";
      $("taller").value = s ? s[2] : "";
      recalcMecanicos();
    });
    $("ver-mecanicos").addEventListener("click", abrirGestionMecanicos);

    const repCtrl = tablaDinamica("tabla-repuestos", COLS_REP, (n) => ($("espera_repuesto").value = n), 33, null, { tiempo: "date" });
    const terCtrl = tablaDinamica("tabla-tercerizado", COLS_TER, (n) => { $("tercerizado").value = n; $("tercerizado_vista").value = n; }, 33, null, { fecha: "date" });
    const necCtrl = tablaDinamica("tabla-necesidades", ["necesidad", "fecha"], (n) => ($("necesidades_cant").value = n), 33, null, { fecha: "date" });
    wireAgregar("add-repuestos", repCtrl);
    wireAgregar("add-tercerizado", terCtrl);
    wireAgregar("add-necesidades", necCtrl);

    // Cargar repuestos/tercerizados/necesidades de la semana anterior (misma persona).
    $("prev-repuestos").addEventListener("click", () => cargarAnterior("tabla-repuestos", repCtrl, COLS_REP, leerRepsDeFila));
    $("prev-tercerizado").addEventListener("click", () => cargarAnterior("tabla-tercerizado", terCtrl, COLS_TER, leerTersDeFila));
    $("prev-necesidades").addEventListener("click", () => cargarAnterior("tabla-necesidades", necCtrl, ["necesidad", "fecha"], leerNecsDeFila));

    if (enEd) prefill(edicion.fila, repCtrl, necCtrl, terCtrl);

    conectarForm(recolectar, validar, function () {
      if (enEd) { limpiarEdicion(); alert("✅ Cambios guardados."); location.href = "index.html"; return; }
      $("form").reset();
      $("desde").value = $("hasta").value = $("ubicacion").value = $("taller").value = "";
      $("espera_repuesto").value = $("necesidades_cant").value = "0";
      $("tercerizado").value = $("tercerizado_vista").value = "0";
      MECS = [];
      preseleccionarSemana("semana");
    });
  });

  function recalcMecanicos() {
    const u = norm($("ubicacion").value), t = norm($("taller").value);
    MECS = (LISTADOS.mecanicos || []).filter((m) => norm(m[1]) === u && norm(m[2]) === t);
    $("cant_mecanicos").value = MECS.length;
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function norm(v) { return String(v == null ? "" : v).trim(); }

  // Gestor editable de mecánicos. Primero los que ya están en tu taller (para
  // cambiarles la designación o sacarlos); abajo, un buscador para agregar del
  // resto. Siempre se elige de los mecánicos que ya existen.
  function abrirGestionMecanicos() {
    const U = $("ubicacion").value, T = $("taller").value;
    if (!U) { alert("Elegí primero tu supervisor (para saber tu ubicación)."); return; }
    if (!T) { alert("Tu supervisor no tiene un taller asignado."); return; }

    const cache = listadosCache();
    const mec = (cache && cache.datos && cache.datos.mecanicos) ? cache.datos.mecanicos : null;
    if (!mec || !mec.length) { // sin ids en caché → solo lectura
      mostrarLista("Mecánicos — " + U + " / " + T, MECS.map((m) => m[0]));
      return;
    }

    const enMiTaller = (m) => norm(m.fila[1]) === norm(U) && norm(m.fila[2]) === norm(T);

    // Talleres disponibles en MI ubicación (para cambiar designación).
    const tset = new Set([T]);
    (LISTADOS.supervisores || []).forEach((s) => { if (norm(s[1]) === norm(U) && s[2]) tset.add(s[2]); });
    (LISTADOS.mecanicos || []).forEach((m) => { if (norm(m[1]) === norm(U) && m[2]) tset.add(m[2]); });
    const talleres = Array.from(tset).sort();

    const html =
      `<h3>Mecánicos — ${esc(U)} / ${esc(T)}</h3>` +
      `<h4 class="mec-h4">En tu taller</h4>` +
      `<div class="status" id="mec-status"></div>` +
      `<table class="grid mec-tabla"><tbody id="mec-asig"></tbody></table>` +
      `<h4 class="mec-h4">Agregar mecánico</h4>` +
      `<p class="modal-nota">Buscá por nombre entre el resto de mecánicos y agregalo a tu taller.</p>` +
      `<input type="text" id="mec-buscar" class="mec-buscar" placeholder="Buscar por nombre…" />` +
      `<table class="grid mec-tabla"><tbody id="mec-resto"></tbody></table>` +
      `<h4 class="mec-h4">¿No está en ningún listado? Cargalo como nuevo</h4>` +
      `<p class="modal-nota">Se agrega al listado general de mecánicos, en tu taller (${esc(U)} · ${esc(T)}).</p>` +
      `<div class="add-row"><input type="text" id="mec-nuevo" placeholder="Apellido y nombre…" />` +
      `<button type="button" class="primary small" id="mec-crear">＋ Crear nuevo</button></div>`;
    const body = modalHTML(html);
    const setM = hacerStatus(body.querySelector("#mec-status"));
    const tbAsig = body.querySelector("#mec-asig");
    const tbResto = body.querySelector("#mec-resto");
    const buscar = body.querySelector("#mec-buscar");

    function pintarAsig() {
      const filas = mec.filter(enMiTaller);
      tbAsig.innerHTML = filas.length ? filas.map((m) => {
        const opts = talleres.map((t) => `<option value="${esc(t)}"${norm(t) === norm(T) ? " selected" : ""}>${esc(t)}</option>`).join("") +
          '<option value="">— Sacar de mi taller —</option>';
        return `<tr data-id="${esc(m.id)}"><td>${esc(m.fila[0] || "")}</td>` +
          `<td class="mec-sel"><select data-mec="${esc(m.id)}" title="Cambiar designación o sacar">${opts}</select></td></tr>`;
      }).join("") : '<tr><td colspan="2"><em>Todavía no hay mecánicos en tu taller.</em></td></tr>';
    }

    function pintarResto(filtro) {
      const f = norm(filtro).toLowerCase();
      if (!f) { tbResto.innerHTML = '<tr><td><em>Escribí un nombre para buscar…</em></td></tr>'; return; }
      const filas = mec.filter((m) => !enMiTaller(m) && norm(m.fila[0]).toLowerCase().includes(f));
      tbResto.innerHTML = filas.length ? filas.map((m) => {
        const ubi = norm(m.fila[1]), tal = norm(m.fila[2]);
        const cur = (ubi || tal) ? esc(ubi) + (tal ? " · " + esc(tal) : "") : "<em>sin asignar</em>";
        return `<tr data-id="${esc(m.id)}"><td>${esc(m.fila[0] || "")}<div class="mec-cur">${cur}</div></td>` +
          `<td class="mec-acc"><button type="button" class="ghost small mec-add" data-add="${esc(m.id)}">＋ Agregar</button></td></tr>`;
      }).join("") : '<tr><td colspan="2"><em>Sin resultados.</em></td></tr>';
    }

    function aplicar(id, ubic, taller, ctrl) {
      if (ctrl) ctrl.disabled = true;
      setM("Guardando…", "");
      asignarMecanicoSrv(id, ubic, taller).then(function () {
        const m = mec.find((x) => String(x.id) === String(id));
        const nombre = m ? m.fila[0] : "";
        if (m) { m.fila[1] = ubic; m.fila[2] = taller; }
        (LISTADOS.mecanicos || []).forEach((arr) => { if (arr[0] === nombre) { arr[1] = ubic; arr[2] = taller; } });
        try { localStorage.setItem("ops_listados", JSON.stringify(cache)); } catch (e) {}
        recalcMecanicos();
        setM("✅ Guardado.", "ok");
        pintarAsig(); pintarResto(buscar.value);
      }).catch(function () {
        setM("❌ No se pudo guardar. Probá de nuevo.", "err");
        if (ctrl) ctrl.disabled = false;
      });
    }

    pintarAsig(); pintarResto("");

    // Crear un mecánico NUEVO (no existe en ningún listado) y sumarlo a este taller.
    const bCrear = body.querySelector("#mec-crear");
    const iNuevo = body.querySelector("#mec-nuevo");
    bCrear.addEventListener("click", function () {
      const nombre = norm(iNuevo.value);
      if (!nombre) { setM("Escribí el nombre del mecánico.", "err"); return; }
      const yaExiste = mec.find((m) => norm(m.fila[0]).toLowerCase() === nombre.toLowerCase());
      if (yaExiste) {
        const donde = [norm(yaExiste.fila[1]), norm(yaExiste.fila[2])].filter(Boolean).join(" · ") || "sin asignar";
        setM("Ya existe \"" + yaExiste.fila[0] + "\" (" + donde + "). Buscalo arriba y agregalo desde ahí.", "err");
        buscar.value = nombre; pintarResto(nombre);
        return;
      }
      bCrear.disabled = true;
      setM("Creando…", "");
      crearMecanicoSrv(nombre, U, T).then(function (id) {
        mec.push({ id: id, fila: [nombre, U, T] });
        (LISTADOS.mecanicos = LISTADOS.mecanicos || []).push([nombre, U, T]);
        try { localStorage.setItem("ops_listados", JSON.stringify(cache)); } catch (e) {}
        recalcMecanicos();
        iNuevo.value = "";
        setM("✅ Mecánico creado y agregado a tu taller.", "ok");
        pintarAsig(); pintarResto(buscar.value);
        bCrear.disabled = false;
      }).catch(function () {
        setM("❌ No se pudo crear. Revisá tu internet y probá de nuevo.", "err");
        bCrear.disabled = false;
      });
    });

    tbAsig.addEventListener("change", function (ev) {
      const sel = ev.target;
      if (!sel.matches("select[data-mec]")) return;
      const taller = sel.value;
      aplicar(sel.getAttribute("data-mec"), taller ? U : "", taller, sel);
    });
    tbResto.addEventListener("click", function (ev) {
      const b = ev.target.closest("button[data-add]");
      if (!b) return;
      aplicar(b.getAttribute("data-add"), U, T, b);
    });
    buscar.addEventListener("input", function () { pintarResto(this.value); });
  }

  function asignarMecanicoSrv(id, ubicacion, taller) {
    if (!CONFIG.APPS_SCRIPT_URL) return Promise.resolve(); // demo
    return postReintento({ accion: "asignar_mecanico", sector: SECTOR, clave: claveSector(), id: id, ubicacion: ubicacion, taller: taller }, 3)
      .then(function (o) { if (!o || !o.ok) throw new Error((o && o.error) || "error"); });
  }

  // Alta de un mecánico nuevo en el listado maestro (cfg_listados).
  function crearMecanicoSrv(nombre, ubicacion, taller) {
    if (!CONFIG.APPS_SCRIPT_URL) return Promise.resolve("demo-" + Date.now()); // demo
    return postReintento({ accion: "agregar_listado", sector: SECTOR, clave: claveSector(), tipo: "mecanicos", fila: [nombre, ubicacion, taller] }, 3)
      .then(function (o) {
        if (!o || !o.ok) throw new Error((o && o.error) || "error");
        return o.id;
      });
  }

  function leerRepsDeFila(f) {
    const r = [];
    for (let i = 1; i <= 33; i++) {
      const dom = f["rep" + i + "_dominio"], rep = f["rep" + i + "_repuesto"], tie = f["rep" + i + "_tiempo"];
      if (("" + (dom || "")).trim() || ("" + (rep || "")).trim()) r.push({ dominio: dom, repuesto: rep, tiempo: fechaISO(tie) });
    }
    return r;
  }
  function leerNecsDeFila(f) {
    const r = [];
    for (let i = 1; i <= 33; i++) if (("" + (f["nec" + i] || "")).trim()) r.push({ necesidad: f["nec" + i], fecha: fechaISO(f["necfecha" + i]) });
    return r;
  }
  function leerTersDeFila(f) {
    const r = [];
    for (let i = 1; i <= 33; i++) {
      const dom = f["ter" + i + "_dominio"], raz = f["ter" + i + "_razon"], fec = f["ter" + i + "_fecha"];
      if (("" + (dom || "")).trim() || ("" + (raz || "")).trim()) r.push({ dominio: dom, razon: raz, fecha: fechaISO(fec) });
    }
    return r;
  }

  function cargarAnterior(tbodyId, ctrl, cols, extractor) {
    const sup = $("supervisor").value, sem = $("semana").value;
    if (!sem || !sup) { alert("Elegí primero la semana y el supervisor."); return; }
    traerCargaAnterior("Supervisores", sem, (s) => s.fila.supervisor === sup).then((res) => {
      if (!res.semanaAnt) { alert("No hay semana anterior."); return; }
      if (!res.sub) { alert("No se encontró carga de " + sup + " en " + res.semanaAnt + "."); return; }
      const items = extractor(res.sub.fila);
      if (!items.length) { alert("La semana anterior no tenía datos para cargar."); return; }
      llenarDinamica(tbodyId, ctrl, items, cols);
    });
  }

  function prefill(f, repCtrl, necCtrl, terCtrl) {
    document.querySelector(".titulo").textContent = "EDITANDO CARGA — SUPERVISORES DE TALLER";
    document.querySelector("button.primary").textContent = "Guardar cambios";
    $("semana").value = f.semana || ""; $("semana").dispatchEvent(new Event("change"));
    $("supervisor").value = f.supervisor || ""; $("supervisor").dispatchEvent(new Event("change"));
    $("ubicacion").value = f.ubicacion || ""; $("taller").value = f.taller || "";
    recalcMecanicos();
    if (f.cant_mecanicos) $("cant_mecanicos").value = f.cant_mecanicos;
    $("ordenes").value = f.ordenes || "";
    $("tareas").value = f.tareas || "";
    $("en_reparacion").value = f.en_reparacion || "";
    $("observaciones").value = f.observaciones || "";
    llenarDinamica("tabla-repuestos", repCtrl, leerRepsDeFila(f), COLS_REP);
    llenarDinamica("tabla-tercerizado", terCtrl, leerTersDeFila(f), COLS_TER);
    llenarDinamica("tabla-necesidades", necCtrl, leerNecsDeFila(f), ["necesidad", "fecha"]);
    // Cargas viejas (sin tabla de tercerizado): conservar el número que tenían.
    if (!leerTersDeFila(f).length && f.tercerizado) {
      $("tercerizado").value = f.tercerizado;
      $("tercerizado_vista").value = f.tercerizado;
    }
  }

  function recolectar() {
    const d = {
      sector: SECTOR,
      planilla: "Supervisores",
      clave: claveSector(),
      semana: $("semana").value,
      desde: $("desde").value,
      hasta: $("hasta").value,
      supervisor: $("supervisor").value,
      ubicacion: $("ubicacion").value,
      taller: $("taller").value,
      cant_mecanicos: $("cant_mecanicos").value,
      ordenes: $("ordenes").value,
      tareas: $("tareas").value,
      en_reparacion: $("en_reparacion").value,
      tercerizado: $("tercerizado").value,
      espera_repuesto: $("espera_repuesto").value,
      necesidades_cant: $("necesidades_cant").value,
      observaciones: $("observaciones").value.trim(),
      repuestos: leerTabla("tabla-repuestos", COLS_REP),
      tercerizados: leerTabla("tabla-tercerizado", COLS_TER),
      necesidades: leerTabla("tabla-necesidades", ["necesidad", "fecha"]),
    };
    if (enEd) { d.accion = "editar_carga"; d.id = edicion.id; }
    return d;
  }

  function validar(d) {
    if (!d.semana) return "Elegí la semana.";
    if (!d.supervisor) return "Elegí el supervisor.";
    if (faltaFechaEn("tabla-repuestos", ["dominio", "repuesto"], "tiempo")) return "Completá la fecha de pedido en todos los repuestos en espera.";
    if (faltaFechaEn("tabla-tercerizado", ["dominio", "razon"], "fecha")) return "Completá la fecha en todos los tercerizados.";
    if (faltaFechaEn("tabla-necesidades", ["necesidad"], "fecha")) return "Completá la fecha de pedido en todas las necesidades.";
    return null;
  }
})();
