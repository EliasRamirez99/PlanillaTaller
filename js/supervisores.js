/* ============================================================
   Lógica de la planilla de Supervisores  (sector: Taller)
   ============================================================ */
(function () {
  "use strict";

  const SECTOR = "Taller";
  const sesion = obtenerSesion(SECTOR); // redirige al inicio si no pasó la clave
  if (!sesion) return;

  const COLS_REP = ["dominio", "repuesto", "tiempo"];

  // Trae listados agregados desde Ajustes y recién ahí arma el formulario.
  cargarExtras(function () {
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

    // ---------- Tablas dinámicas (autocompletan los contadores) ----------
    const repCtrl = tablaDinamica("tabla-repuestos", COLS_REP, (n) => ($("espera_repuesto").value = n));
    const necCtrl = tablaDinamica("tabla-necesidades", ["necesidad"], (n) => ($("necesidades_cant").value = n));
    wireAgregar("add-repuestos", repCtrl);
    wireAgregar("add-necesidades", necCtrl);

    conectarForm(recolectar, validar, function () {
      $("form").reset();
      $("desde").value = $("hasta").value = $("ubicacion").value = $("taller").value = "";
      $("espera_repuesto").value = $("necesidades_cant").value = "0";
    });
  });

  // ---------- Datos / validación ----------
  function recolectar() {
    return {
      sector: SECTOR,
      planilla: "Supervisores",
      clave: sesion.clave,
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
  }

  function validar(d) {
    if (!d.semana) return "Elegí la semana.";
    if (!d.supervisor) return "Elegí el supervisor.";
    return null;
  }
})();
