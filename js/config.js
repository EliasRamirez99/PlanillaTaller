/* ============================================================
   CONFIGURACIÓN
   ------------------------------------------------------------
   1) Cuando tengas la Google Sheet + Apps Script desplegado
      (ver README.md), pegá la URL del Web App acá abajo.
      Debe terminar en  /exec
   2) Mientras esté vacío, los formularios funcionan en modo
      DEMO: en vez de enviar, muestran los datos que enviarían.

   El sector de cada planilla (Taller / Panol / Almacen) está
   definido dentro de su propio archivo js (supervisores.js,
   estacionarios.js, almacen.js).
   ============================================================ */

const CONFIG = {
  // URL del Web App de Google Apps Script (termina en /exec)
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbw8OOIFm7LU9uJ48lF402Ck1VulZHbpqoSIDcDVUfSzqXfW5BmEM2lym0t-Y0yIMRmV/exec",

  // Las planillas de sector ya NO piden clave (carga sin fricción / sin internet).
  // El formulario manda esta clave automáticamente al guardar; debe coincidir con
  // la del Apps Script. Sólo Ajustes sigue pidiendo la clave Admin.
  SECTOR_CLAVE: "123",
};
