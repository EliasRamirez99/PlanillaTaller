/* ============================================================
   Lógica de la planilla de Almacén  (sector: Almacen)
   ============================================================ */
(function () {
  "use strict";

  const SECTOR = "Almacen";
  const COLS3 = ["total", "items", "repuestos"];
  const edicion = leerEdicion();
  const enEd = !!(edicion && edicion.planilla === "Almacen");

  const MOV_ROWS = [
    ["or_cargadas", "OR Cargadas"],
    ["remitos_egreso", "Remitos de Egreso"],
    ["remitos_ingreso", "Remitos de Ingreso"],
  ];
  const TRANSF_ROWS = [
    ["base4", "Base 4"],
    ["720", "720"],
    ["745", "745"],
    ["758", "758"],
    ["760", "760"],
    ["base7", "Base 7"],
  ];

  prepararListados(function () {
    poblarSelect($("semana"), LISTADOS.semanas, (s) => s[0], (s) => s[0]);
    poblarSelect($("ubicacion"), LISTADOS.obras, (o) => o[1], (o) => o[1]);
    enlazarSemana("semana", "desde", "hasta");

    construirFilasEtiqueta("tabla-movimientos", MOV_ROWS, COLS3);
    construirFilasEtiqueta("tabla-transferencias", TRANSF_ROWS, COLS3);
    const recalcTransf = filaTotal("tabla-transferencias", COLS3, "Total");

    const necCtrl = tablaDinamica("tabla-necesidades", ["necesidad"], (n) => ($("necesidades_cant").value = n), 33);
    wireAgregar("add-necesidades", necCtrl);

    if (enEd) prefill(edicion.fila, necCtrl, recalcTransf);

    conectarForm(recolectar, validar, function () {
      if (enEd) { limpiarEdicion(); alert("✅ Cambios guardados."); location.href = "index.html"; return; }
      $("form").reset();
      $("desde").value = $("hasta").value = "";
      $("necesidades_cant").value = "0";
      recalcTransf();
    });
  });

  function setEtiqueta(tbodyId, clave, valsObj) {
    document.querySelectorAll(`#${tbodyId} tbody tr`).forEach((tr) => {
      if (tr.dataset.clave === clave) {
        COLS3.forEach((c) => { const inp = tr.querySelector(`input[data-col="${c}"]`); if (inp) inp.value = valsObj[c] || ""; });
      }
    });
  }

  function prefill(f, necCtrl, recalcTransf) {
    document.querySelector(".titulo").textContent = "EDITANDO CARGA — ALMACÉN";
    document.querySelector("button.primary").textContent = "Guardar cambios";
    $("semana").value = f.semana || ""; $("semana").dispatchEvent(new Event("change"));
    $("ubicacion").value = f.ubicacion || "";
    $("cant_panoleros").value = f.cant_panoleros || "";

    MOV_ROWS.forEach(([clave]) => {
      setEtiqueta("tabla-movimientos", clave, { total: f[clave + "_total"], items: f[clave + "_items"], repuestos: f[clave + "_repuestos"] });
    });
    TRANSF_ROWS.forEach(([clave]) => {
      setEtiqueta("tabla-transferencias", clave, { total: f["transf_" + clave + "_total"], items: f["transf_" + clave + "_items"], repuestos: f["transf_" + clave + "_repuestos"] });
    });
    recalcTransf();

    const necs = [];
    for (let i = 1; i <= 33; i++) { const ne = f["nec" + i]; if (("" + (ne || "")).trim()) necs.push({ necesidad: ne }); }
    llenarDinamica("tabla-necesidades", necCtrl, necs, ["necesidad"]);
  }

  function recolectar() {
    const d = {
      sector: SECTOR,
      planilla: "Almacen",
      clave: claveSector(),
      semana: $("semana").value,
      desde: $("desde").value,
      hasta: $("hasta").value,
      ubicacion: $("ubicacion").value,
      cant_panoleros: $("cant_panoleros").value,
      movimientos: leerTablaEtiqueta("tabla-movimientos", COLS3),
      transferencias: leerTablaEtiqueta("tabla-transferencias", COLS3),
      necesidades_cant: $("necesidades_cant").value,
      necesidades: leerTabla("tabla-necesidades", ["necesidad"]),
    };
    if (enEd) { d.accion = "editar_carga"; d.id = edicion.id; }
    return d;
  }

  function validar(d) {
    if (!d.semana) return "Elegí la semana.";
    if (!d.ubicacion) return "Elegí la ubicación.";
    return null;
  }
})();
