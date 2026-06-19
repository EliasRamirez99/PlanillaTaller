/* ============================================================
   Lógica de la planilla de Equipos Estacionarios  (sector: Panol)
   ============================================================ */
(function () {
  "use strict";

  const SECTOR = "Panol";
  const sesion = obtenerSesion(SECTOR);
  if (!sesion) return;

  const COLS_EQ = ["total", "disponible", "reparacion", "demora", "observaciones"];

  cargarExtras(function () {
    // ---------- Desplegables ----------
    poblarSelect($("semana"), LISTADOS.semanas, (s) => s[0], (s) => s[0]);
    poblarSelect($("ubicacion"), LISTADOS.obras, (o) => o[1], (o) => o[1]);
    enlazarSemana("semana", "desde", "hasta");

    // ---------- Grilla de equipos (etiqueta = nombre del equipo) ----------
    const filasEquipos = LISTADOS.equiposEstacionarios.map((eq) => [eq, eq]);
    construirFilasEtiqueta("tabla-equipos", filasEquipos, COLS_EQ);

    conectarForm(recolectar, validar, function () {
      $("form").reset();
      $("desde").value = $("hasta").value = "";
    });
  });

  // ---------- Datos / validación ----------
  function recolectar() {
    return {
      sector: SECTOR,
      planilla: "Estacionarios",
      clave: sesion.clave,
      semana: $("semana").value,
      desde: $("desde").value,
      hasta: $("hasta").value,
      ubicacion: $("ubicacion").value,
      cant_panoleros: $("cant_panoleros").value,
      equipos: leerTablaEtiquetaArray("tabla-equipos", "equipo", COLS_EQ),
    };
  }

  function validar(d) {
    if (!d.semana) return "Elegí la semana.";
    if (!d.ubicacion) return "Elegí la ubicación.";
    if (d.equipos.length === 0) return "Cargá al menos un equipo.";
    return null;
  }
})();
