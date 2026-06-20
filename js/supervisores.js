/* ============================================================
   Lógica de la planilla de Supervisores  (sector: Taller)
   ============================================================ */
(function () {
  "use strict";

  const SECTOR = "Taller";
  const COLS_REP = ["dominio", "repuesto", "tiempo"];
  const edicion = leerEdicion();
  const enEd = !!(edicion && edicion.planilla === "Supervisores");

  prepararListados(function () {
    // ---------- Desplegables ----------
    poblarSelect($("semana"), LISTADOS.semanas, (s) => s[0], (s) => s[0]);
    poblarSelect($("supervisor"), LISTADOS.supervisores, (s) => s[0], (s) => s[0]);
    poblarSelect($("obra"), LISTADOS.obras, (o) => o[1], (o) => `${o[1]}  (${o[0]})`);

    // ---------- Autocompletado ----------
    enlazarSemana("semana", "desde", "hasta");
    $("supervisor").addEventListener("change", function () {
      const s = LISTADOS.supervisores.find((x) => x[0] === this.value);
      $("ubicacion").value = s ? s[1] : "";
      $("taller").value = s ? s[2] : "";
    });

    // ---------- Tablas dinámicas ----------
    const repCtrl = tablaDinamica("tabla-repuestos", COLS_REP, (n) => ($("espera_repuesto").value = n), 33);
    const necCtrl = tablaDinamica("tabla-necesidades", ["necesidad"], (n) => ($("necesidades_cant").value = n), 33);
    wireAgregar("add-repuestos", repCtrl);
    wireAgregar("add-necesidades", necCtrl);

    if (enEd) prefill(edicion.fila, repCtrl, necCtrl);

    conectarForm(recolectar, validar, function () {
      if (enEd) { limpiarEdicion(); alert("✅ Cambios guardados."); location.href = "index.html"; return; }
      $("form").reset();
      $("desde").value = $("hasta").value = $("ubicacion").value = $("taller").value = "";
      $("espera_repuesto").value = $("necesidades_cant").value = "0";
    });
  });

  function prefill(f, repCtrl, necCtrl) {
    document.querySelector(".titulo").textContent = "EDITANDO CARGA — SUPERVISORES";
    document.querySelector("button.primary").textContent = "Guardar cambios";

    $("semana").value = f.semana || ""; $("semana").dispatchEvent(new Event("change"));
    $("supervisor").value = f.supervisor || ""; $("supervisor").dispatchEvent(new Event("change"));
    $("ubicacion").value = f.ubicacion || ""; $("taller").value = f.taller || "";
    $("obra").value = f.obra || "";
    $("cant_mecanicos").value = f.cant_mecanicos || "";
    $("km").value = f.km || "";
    $("ordenes").value = f.ordenes || "";
    $("tareas").value = f.tareas || "";
    $("en_reparacion").value = f.en_reparacion || "";
    $("tercerizado").value = f.tercerizado || "";

    const reps = [];
    for (let i = 1; i <= 33; i++) {
      const dom = f["rep" + i + "_dominio"], rep = f["rep" + i + "_repuesto"], tie = f["rep" + i + "_tiempo"];
      if (("" + (dom || "")).trim() || ("" + (rep || "")).trim() || ("" + (tie || "")).trim())
        reps.push({ dominio: dom, repuesto: rep, tiempo: tie });
    }
    llenarDinamica("tabla-repuestos", repCtrl, reps, COLS_REP);

    const necs = [];
    for (let i = 1; i <= 33; i++) {
      const ne = f["nec" + i];
      if (("" + (ne || "")).trim()) necs.push({ necesidad: ne });
    }
    llenarDinamica("tabla-necesidades", necCtrl, necs, ["necesidad"]);
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
      obra: $("obra").value,
      cant_mecanicos: $("cant_mecanicos").value,
      km: $("km").value,
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
