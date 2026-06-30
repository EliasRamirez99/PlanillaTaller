/* ============================================================
   Lógica de la planilla de Supervisores de Campo  (sector: Campo)
   ============================================================ */
(function () {
  "use strict";

  const SECTOR = "Campo";
  const edicion = leerEdicion();
  const enEd = !!(edicion && edicion.planilla === "Campo");

  const C_OBRAS = ["obra", "ordenes", "tareas"];
  const C_VEH = ["dominio", "asignacion", "km", "litros"];
  const C_INS = ["insumo", "cantidad"];
  const C_REP = ["obra", "repuesto", "fecha"];
  const C_PEND = ["obra", "pendiente"];
  const DL = { obra: "dl-obras" };

  prepararListados(function () {
    poblarSemanas($("semana"));
    const campoSup = (LISTADOS.supervisores || []).filter((s) => s[2] === "Campo");
    poblarSelect($("supervisor"), campoSup, (s) => s[0], (s) => s[0]);
    $("dl-obras").innerHTML = (LISTADOS.obras || []).map((o) => `<option value="${o[1]}"></option>`).join("");

    enlazarSemana("semana", "desde", "hasta");
    $("supervisor").addEventListener("change", function () {
      const s = (LISTADOS.supervisores || []).find((x) => x[0] === this.value);
      $("zona").value = s ? s[1] : "";
    });

    const cObras = tablaDinamica("tabla-obras", C_OBRAS, null, null, DL);
    const cVeh = tablaDinamica("tabla-vehiculos", C_VEH, null, null);
    const cIns = tablaDinamica("tabla-insumos", C_INS, null, null);
    const cRep = tablaDinamica("tabla-repuestos", C_REP, null, null, DL);
    const cPend = tablaDinamica("tabla-pendientes", C_PEND, null, null, DL);
    wireAgregar("add-obras", cObras);
    wireAgregar("add-vehiculos", cVeh);
    wireAgregar("add-insumos", cIns);
    wireAgregar("add-repuestos", cRep);
    wireAgregar("add-pendientes", cPend);

    $("prev-repuestos").addEventListener("click", () => cargarAnt("tabla-repuestos", cRep, C_REP, (s) => s.repuestos || []));
    $("prev-pendientes").addEventListener("click", () => cargarAnt("tabla-pendientes", cPend, C_PEND, (s) => s.pendientes || []));

    if (enEd) prefill(edicion, { cObras, cVeh, cIns, cRep, cPend });

    conectarForm(recolectar, validar, function () {
      if (enEd) { limpiarEdicion(); alert("✅ Cambios guardados."); location.href = "index.html"; return; }
      $("form").reset();
      $("desde").value = $("hasta").value = $("zona").value = "";
    });
  });

  function prefill(ed, c) {
    document.querySelector(".titulo").textContent = "EDITANDO CARGA — SUPERVISORES DE CAMPO";
    document.querySelector("button.primary").textContent = "Guardar cambios";
    const f = ed.fila || {};
    $("semana").value = f.semana || ""; $("semana").dispatchEvent(new Event("change"));
    $("supervisor").value = f.supervisor || ""; $("supervisor").dispatchEvent(new Event("change"));
    $("zona").value = f.zona || "";
    $("referente").value = f.referente || "";
    llenarDinamica("tabla-obras", c.cObras, ed.obras || [], C_OBRAS);
    llenarDinamica("tabla-vehiculos", c.cVeh, ed.vehiculos || [], C_VEH);
    llenarDinamica("tabla-insumos", c.cIns, ed.insumos || [], C_INS);
    llenarDinamica("tabla-repuestos", c.cRep, ed.repuestos || [], C_REP);
    llenarDinamica("tabla-pendientes", c.cPend, ed.pendientes || [], C_PEND);
  }

  function cargarAnt(tbodyId, ctrl, cols, extractor) {
    const sup = $("supervisor").value, sem = $("semana").value;
    if (!sem || !sup) { alert("Elegí primero la semana y el supervisor."); return; }
    traerCargaAnterior("Campo", sem, (s) => s.fila.supervisor === sup).then((res) => {
      if (!res.semanaAnt) { alert("No hay semana anterior."); return; }
      if (!res.sub) { alert("No se encontró carga de " + sup + " en " + res.semanaAnt + "."); return; }
      const items = extractor(res.sub);
      if (!items.length) { alert("La semana anterior no tenía datos para cargar."); return; }
      llenarDinamica(tbodyId, ctrl, items, cols);
    });
  }

  function recolectar() {
    const d = {
      sector: SECTOR,
      planilla: "Campo",
      clave: claveSector(),
      semana: $("semana").value,
      desde: $("desde").value,
      hasta: $("hasta").value,
      supervisor: $("supervisor").value,
      referente: $("referente").value,
      zona: $("zona").value,
      obras: leerTabla("tabla-obras", C_OBRAS),
      vehiculos: leerTabla("tabla-vehiculos", C_VEH),
      insumos: leerTabla("tabla-insumos", C_INS),
      repuestos: leerTabla("tabla-repuestos", C_REP),
      pendientes: leerTabla("tabla-pendientes", C_PEND),
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
