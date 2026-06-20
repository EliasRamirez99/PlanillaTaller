/* ============================================================
   Inicio: las planillas entran directo (sin clave).
   Sólo Ajustes pide la clave de administración.
   ============================================================ */
(function () {
  "use strict";

  // ---- Pestañas ----
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".tab-panel").forEach((p) => (p.style.display = "none"));
      $("panel-" + btn.dataset.tab).style.display = "block";
    });
  });

  const gate = $("gate");
  const gClave = $("gate-clave");
  const gStatus = $("gate-status");
  const setStatus = hacerStatus(gStatus);

  $("btn-ajustes").addEventListener("click", () => {
    $("gate-title").textContent = "Ajustes (listados)";
    gClave.value = "";
    setStatus("", "");
    gate.style.display = "block";
    gClave.focus();
    gate.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  async function acceder() {
    const clave = gClave.value.trim();
    if (!clave) { setStatus("Ingresá la clave.", "err"); return; }

    setStatus("Verificando…", "");
    const ok = await validarClave("Admin", clave);
    if (ok === null) { setStatus("❌ No se pudo verificar. Revisá tu internet.", "err"); return; }
    if (!ok) { setStatus("❌ Clave incorrecta.", "err"); return; }

    sessionStorage.setItem("ops_sector", "Admin");
    sessionStorage.setItem("ops_clave", clave);
    location.href = "ajustes.html";
  }

  $("gate-go").addEventListener("click", acceder);
  gClave.addEventListener("keydown", (e) => { if (e.key === "Enter") acceder(); });
  $("gate-cancel").addEventListener("click", () => { gate.style.display = "none"; });
})();
