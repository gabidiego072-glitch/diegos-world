/**
 * PANTALLA DE INICIO: pide el token de Cesium ion y lo guarda SOLO en localStorage.
 */
import { CLAVE_TOKEN } from "../config.js";

const $ = (id) => document.getElementById(id);

export function leerToken() {
  try { return localStorage.getItem(CLAVE_TOKEN) || ""; } catch { return ""; }
}
function guardarToken(t) {
  try { localStorage.setItem(CLAVE_TOKEN, t); } catch { /* modo privado: solo dura esta sesión */ }
}
function borrarToken() {
  try { localStorage.removeItem(CLAVE_TOKEN); } catch { /* nada */ }
}

/**
 * Muestra la pantalla de inicio. `alJugar(token)` debe devolver una promesa;
 * si falla, el error se muestra aquí mismo.
 */
export function mostrarInicio(alJugar, mensajeError) {
  const pantalla = $("pantalla-inicio");
  const campo = $("campo-token");
  const form = $("form-token");
  const boton = $("boton-jugar");
  const botonBorrar = $("boton-borrar-token");
  const error = $("error-inicio");

  pantalla.hidden = false;
  const guardado = leerToken();
  campo.value = guardado;
  botonBorrar.hidden = !guardado;
  $("instrucciones").open = !guardado;
  boton.textContent = guardado ? "Continuar en Valencia" : "Entrar en Valencia";
  mostrarError(mensajeError);

  function mostrarError(msg) {
    error.hidden = !msg;
    error.textContent = msg || "";
  }

  $("ver-token").onclick = () => { campo.type = campo.type === "password" ? "text" : "password"; };
  botonBorrar.onclick = () => {
    borrarToken();
    campo.value = "";
    botonBorrar.hidden = true;
    $("instrucciones").open = true;
    boton.textContent = "Entrar en Valencia";
    mostrarError("Token borrado de este navegador.");
  };

  form.onsubmit = async (e) => {
    e.preventDefault();
    const token = campo.value.trim().replace(/^["']|["']$/g, "");
    if (token.length < 20) {
      mostrarError("Ese token parece incompleto. Copia el token entero desde ion.cesium.com → Access Tokens.");
      return;
    }
    guardarToken(token);
    mostrarError("");
    boton.disabled = true;
    try {
      pantalla.hidden = true;
      await alJugar(token);
    } catch (err) {
      pantalla.hidden = false;
      mostrarError(explicarError(err));
      botonBorrar.hidden = false;
    } finally {
      boton.disabled = false;
    }
  };
}

/** Traduce los errores típicos a algo entendible. */
function explicarError(err) {
  const txt = String(err?.message || err || "");
  console.error(err);
  if (/401|Unauthorized|invalid.*token|Invalid access token/i.test(txt)) {
    return "Cesium ion no acepta ese token. Revisa que lo has copiado entero (Access Tokens → Default Token).";
  }
  if (/404|not found|2275207/i.test(txt)) {
    return "Tu cuenta no tiene “Google Photorealistic 3D Tiles”. Añádelo desde Asset Depot (paso 2 de las instrucciones) y vuelve a intentarlo.";
  }
  if (/WebGL/i.test(txt)) {
    return "Tu navegador no puede usar WebGL (gráficos 3D). Prueba con Chrome o Edge actualizados y con la aceleración por hardware activada.";
  }
  if (/Failed to fetch|NetworkError/i.test(txt)) {
    return "No hay conexión con Cesium ion. Comprueba tu Internet y vuelve a intentarlo.";
  }
  return "No se pudo cargar Valencia: " + txt;
}
