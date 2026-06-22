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
    poblarSelect($("semana"), LISTADOS.semanas, (s) => s[0], (s) => s[0]);
    poblarSelect($("supervisor"), LISTADOS.supervisores, (s) => s[0], (s) => s[0]);
    enlazarSemana("semana", "desde", "hasta");

    $("supervisor").addEventListener("change", function () {
      const s = LISTADOS.supervisores.find((x) => x[0] === this.value);
      $("ubicacion").value = s ? s[1] : "";
      $("taller").value = s ? s[2] : "";
      recalcMecanicos();
    });
    $("ver-mecanicos").addEventListener("click", () =>
      mostrarLista("Mecánicos — " + ($("ubicacion").value || "?") + " / " + ($("taller").value || "?"),
        MECS.map((m) => m[0])));

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
