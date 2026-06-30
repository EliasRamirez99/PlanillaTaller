/* ============================================================
   Lógica de la planilla de Supervisores  (sector: Taller)
   ============================================================ */
(function () {
  "use strict";

  const SECTOR = "Taller";
  const COLS_REP = ["dominio", "repuesto", "tiempo"];
  const edicion = leerEdicion();
  const enEd = !!(edicion && edicion.planilla === "Supervisores");
  let MECS = []; // mecánicos de la ubicación/taller elegidos (para "Ver listado")

  prepararListados(function () {
    poblarSemanas($("semana"));
    poblarSelect($("supervisor"), LISTADOS.supervisores, (s) => s[0], (s) => s[0]);
    enlazarSemana("semana", "desde", "hasta");

    $("supervisor").addEventListener("change", function () {
      const s = LISTADOS.supervisores.find((x) => x[0] === this.value);
      $("ubicacion").value = s ? s[1] : "";
      $("taller").value = s ? s[2] : "";
      recalcMecanicos();
    });
    $("ver-mecanicos").addEventListener("click", abrirGestionMecanicos);

    const repCtrl = tablaDinamica("tabla-repuestos", COLS_REP, (n) => ($("espera_repuesto").value = n), 33);
    const necCtrl = tablaDinamica("tabla-necesidades", ["necesidad"], (n) => ($("necesidades_cant").value = n), 33);
    wireAgregar("add-repuestos", repCtrl);
    wireAgregar("add-necesidades", necCtrl);

    // Cargar repuestos/necesidades de la semana anterior (misma persona).
    $("prev-repuestos").addEventListener("click", () => cargarAnterior(repCtrl, COLS_REP, leerRepsDeFila));
    $("prev-necesidades").addEventListener("click", () => cargarAnterior(necCtrl, ["necesidad"], leerNecsDeFila));

    if (enEd) prefill(edicion.fila, repCtrl, necCtrl);

    conectarForm(recolectar, validar, function () {
      if (enEd) { limpiarEdicion(); alert("✅ Cambios guardados."); location.href = "index.html"; return; }
      $("form").reset();
      $("desde").value = $("hasta").value = $("ubicacion").value = $("taller").value = "";
      $("espera_repuesto").value = $("necesidades_cant").value = "0";
      MECS = [];
    });
  });

  function recalcMecanicos() {
    const u = $("ubicacion").value, t = $("taller").value;
    MECS = (LISTADOS.mecanicos || []).filter((m) => m[1] === u && m[2] === t);
    $("cant_mecanicos").value = MECS.length;
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // Gestor editable de mecánicos: el supervisor suma/quita mecánicos de su taller
  // o les cambia la designación, eligiendo SIEMPRE de los que ya existen.
  function abrirGestionMecanicos() {
    const U = $("ubicacion").value, T = $("taller").value;
    if (!U) { alert("Elegí primero tu supervisor (para saber tu ubicación)."); return; }

    const cache = listadosCache();
    const mec = (cache && cache.datos && cache.datos.mecanicos) ? cache.datos.mecanicos : null;
    if (!mec || !mec.length) { // sin ids en caché → solo lectura
      mostrarLista("Mecánicos — " + U + " / " + (T || "?"), MECS.map((m) => m[0]));
      return;
    }

    // Talleres disponibles en MI ubicación (más mi propio taller).
    const tset = new Set();
    if (T) tset.add(T);
    (LISTADOS.supervisores || []).forEach((s) => { if (s[1] === U && s[2]) tset.add(s[2]); });
    (LISTADOS.mecanicos || []).forEach((m) => { if (m[1] === U && m[2]) tset.add(m[2]); });
    const talleres = Array.from(tset).sort();

    const html =
      `<h3>Mecánicos — tu taller: ${esc(U)} / ${esc(T || "?")}</h3>` +
      `<p class="modal-nota">Sumá un mecánico a tu taller, cambiale la designación, o sacalo (queda sin asignar). Solo podés elegir de los que ya existen.</p>` +
      `<input type="text" id="mec-buscar" class="mec-buscar" placeholder="Buscar por nombre…" />` +
      `<div class="status" id="mec-status"></div>` +
      `<div class="mec-scroll"><table class="grid mec-tabla"><thead><tr>` +
      `<th style="text-align:left">Nombre</th><th>Asignación actual</th><th>Asignar a (${esc(U)})</th>` +
      `</tr></thead><tbody></tbody></table></div>`;
    const body = modalHTML(html);
    const tbody = body.querySelector("tbody");
    const buscar = body.querySelector("#mec-buscar");
    const setM = hacerStatus(body.querySelector("#mec-status"));

    function pintar(filtro) {
      const f = (filtro || "").trim().toLowerCase();
      const filas = mec.filter((m) => !f || String(m.fila[0] || "").toLowerCase().includes(f));
      tbody.innerHTML = filas.length ? filas.map((m) => {
        const nombre = m.fila[0] || "", ubi = m.fila[1] || "", tal = m.fila[2] || "";
        const actual = (ubi === U) ? tal : "";
        const cur = (ubi || tal) ? esc(ubi) + (tal ? " · " + esc(tal) : "") : "<em>sin asignar</em>";
        const opts = '<option value="">— Sin asignar —</option>' +
          talleres.map((t) => `<option value="${esc(t)}"${t === actual ? " selected" : ""}>${esc(t)}</option>`).join("");
        return `<tr data-id="${esc(m.id)}"><td>${esc(nombre)}</td><td>${cur}</td>` +
          `<td><select data-mec="${esc(m.id)}">${opts}</select></td></tr>`;
      }).join("") : '<tr><td colspan="3"><em>Sin resultados.</em></td></tr>';
    }
    pintar("");

    buscar.addEventListener("input", function () { pintar(this.value); });
    tbody.addEventListener("change", function (ev) {
      const sel = ev.target;
      if (!sel.matches("select[data-mec]")) return;
      const id = sel.getAttribute("data-mec");
      const nuevoTaller = sel.value;
      const nuevaUbi = nuevoTaller ? U : "";
      sel.disabled = true;
      setM("Guardando…", "");
      asignarMecanicoSrv(id, nuevaUbi, nuevoTaller).then(function () {
        const m = mec.find((x) => String(x.id) === String(id));
        const nombre = m ? m.fila[0] : "";
        if (m) { m.fila[1] = nuevaUbi; m.fila[2] = nuevoTaller; }
        (LISTADOS.mecanicos || []).forEach((arr) => { if (arr[0] === nombre) { arr[1] = nuevaUbi; arr[2] = nuevoTaller; } });
        try { localStorage.setItem("ops_listados", JSON.stringify(cache)); } catch (e) {}
        recalcMecanicos();
        setM("✅ Guardado.", "ok");
        pintar(buscar.value);
      }).catch(function () {
        setM("❌ No se pudo guardar. Probá de nuevo.", "err");
        sel.disabled = false;
      });
    });
  }

  function asignarMecanicoSrv(id, ubicacion, taller) {
    if (!CONFIG.APPS_SCRIPT_URL) return Promise.resolve(); // demo
    return postReintento({ accion: "asignar_mecanico", sector: SECTOR, clave: claveSector(), id: id, ubicacion: ubicacion, taller: taller }, 3)
      .then(function (o) { if (!o || !o.ok) throw new Error((o && o.error) || "error"); });
  }

  function leerRepsDeFila(f) {
    const r = [];
    for (let i = 1; i <= 33; i++) {
      const dom = f["rep" + i + "_dominio"], rep = f["rep" + i + "_repuesto"], tie = f["rep" + i + "_tiempo"];
      if (("" + (dom || "")).trim() || ("" + (rep || "")).trim()) r.push({ dominio: dom, repuesto: rep, tiempo: tie });
    }
    return r;
  }
  function leerNecsDeFila(f) {
    const r = [];
    for (let i = 1; i <= 33; i++) if (("" + (f["nec" + i] || "")).trim()) r.push({ necesidad: f["nec" + i] });
    return r;
  }

  function cargarAnterior(ctrl, cols, extractor) {
    const sup = $("supervisor").value, sem = $("semana").value;
    if (!sem || !sup) { alert("Elegí primero la semana y el supervisor."); return; }
    traerCargaAnterior("Supervisores", sem, (s) => s.fila.supervisor === sup).then((res) => {
      if (!res.semanaAnt) { alert("No hay semana anterior."); return; }
      if (!res.sub) { alert("No se encontró carga de " + sup + " en " + res.semanaAnt + "."); return; }
      const items = extractor(res.sub.fila);
      if (!items.length) { alert("La semana anterior no tenía datos para cargar."); return; }
      llenarDinamica(cols === COLS_REP ? "tabla-repuestos" : "tabla-necesidades", ctrl, items, cols);
    });
  }

  function prefill(f, repCtrl, necCtrl) {
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
    $("tercerizado").value = f.tercerizado || "";
    llenarDinamica("tabla-repuestos", repCtrl, leerRepsDeFila(f), COLS_REP);
    llenarDinamica("tabla-necesidades", necCtrl, leerNecsDeFila(f), ["necesidad"]);
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
      repuestos: leerTabla("tabla-repuestos", COLS_REP),
      necesidades: leerTabla("tabla-necesidades", ["necesidad"]),
    };
    if (enEd) { d.accion = "editar_carga"; d.id = edicion.id; }
    return d;
  }

  function validar(d) {
    if (!d.semana) return "Elegí la semana.";
    if (!d.supervisor) return "Elegí el supervisor.";
    return null;
  }
})();
