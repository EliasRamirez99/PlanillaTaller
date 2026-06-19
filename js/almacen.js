/* ============================================================
   Lógica de la planilla de Almacén  (sector: Almacen)
   ============================================================ */
(function () {
  "use strict";

  const SECTOR = "Almacen";
  const sesion = obtenerSesion(SECTOR);
  if (!sesion) return;

  const COLS3 = ["total", "items", "repuestos"];
  const COLS_REP = ["dominio", "repuesto", "tiempo"];

  // [clave, etiqueta]
  const MOV_ROWS = [
    ["or_cargadas", "OR Cargadas"],
    ["remitos_egreso", "Remitos de Egreso"],
    ["remitos_ingreso", "Remitos de Ingreso"],
  ];
  const TRANSF_ROWS = [
    ["720", "720"],
    ["745", "745"],
    ["758", "758"],
    ["760", "760"],
    ["base7", "Base 7"],
  ];

  // ---------- Desplegables ----------
  poblarSelect($("semana"), LISTADOS.semanas, (s) => s[0], (s) => s[0]);
  poblarSelect($("ubicacion"), LISTADOS.obras, (o) => o[1], (o) => o[1]);
  enlazarSemana("semana", "desde", "hasta");

  // ---------- Tablas fijas ----------
  construirFilasEtiqueta("tabla-movimientos", MOV_ROWS, COLS3);
  construirFilasEtiqueta("tabla-transferencias", TRANSF_ROWS, COLS3);

  // ---------- Tablas dinámicas (autocompletan los contadores) ----------
  const repCtrl = tablaDinamica("tabla-repuestos", COLS_REP, (n) => ($("repuesto_en_espera").value = n));
  const necCtrl = tablaDinamica("tabla-necesidades", ["necesidad"], (n) => ($("necesidades_cant").value = n));
  wireAgregar("add-repuestos", repCtrl);
  wireAgregar("add-necesidades", necCtrl);

  // ---------- Datos / validación ----------
  function recolectar() {
    return {
      sector: SECTOR,
      planilla: "Almacen",
      clave: sesion.clave,
      semana: $("semana").value,
      desde: $("desde").value,
      hasta: $("hasta").value,
      ubicacion: $("ubicacion").value,
      cant_panoleros: $("cant_panoleros").value,
      movimientos: leerTablaEtiqueta("tabla-movimientos", COLS3),
      transferencias: leerTablaEtiqueta("tabla-transferencias", COLS3),
      repuesto_en_espera: $("repuesto_en_espera").value,
      necesidades_cant: $("necesidades_cant").value,
      repuestos: leerTabla("tabla-repuestos", COLS_REP),
      necesidades: leerTabla("tabla-necesidades", ["necesidad"]),
    };
  }

  function validar(d) {
    if (!d.semana) return "Elegí la semana.";
    if (!d.ubicacion) return "Elegí la ubicación.";
    return null;
  }

  conectarForm(recolectar, validar, function () {
    $("form").reset();
    $("desde").value = $("hasta").value = "";
    $("repuesto_en_espera").value = $("necesidades_cant").value = "0";
  });
})();
