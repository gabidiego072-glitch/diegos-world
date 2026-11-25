/**
 * PUNTO DE ENTRADA de Diego's World.
 * 1) Pantalla de inicio (token)  →  2) Crear el mundo  →  3) Empezar el juego.
 */
import { CALIDAD_POR_DEFECTO, CALIDADES, CLAVE_CALIDAD } from "./config.js";
import { crearMundo, destruirMundo } from "./mundo/mundo.js";
import { Entrada } from "./jugador/entrada.js";
import { Juego } from "./modos/juego.js";
import { mostrarInicio } from "./interfaz/inicio.js";
import { carga } from "./interfaz/hud.js";

const entrada = new Entrada();
let mundo = null;
let juego = null;

function calidadGuardada() {
  try {
    const c = localStorage.getItem(CLAVE_CALIDAD);
    return CALIDADES[c] ? c : CALIDAD_POR_DEFECTO;
  } catch {
    return CALIDAD_POR_DEFECTO;
  }
}

async function jugar(token) {
  carga(true, "Conectando con Cesium ion…");
  try {
    mundo = await crearMundo(document.getElementById("mundo"), token, calidadGuardada());
    carga(true, "Cargando Valencia…");
    juego = new Juego(mundo, entrada, { alSalir: salir });
    await juego.iniciar();
  } catch (e) {
    salir(true);
    throw e;
  } finally {
    carga(false);
  }
}

function salir(silencioso) {
  if (juego) juego.destruir();
  destruirMundo(mundo);
  juego = null;
  mundo = null;
  if (silencioso !== true) mostrarInicio(jugar);
}

if (typeof Cesium === "undefined") {
  mostrarInicio(jugar, "No se pudo descargar CesiumJS. Comprueba tu conexión a Internet y recarga la página.");
} else {
  mostrarInicio(jugar);
}

// Exponemos el estado en la consola del navegador para depurar (escribe `diegosWorld` en la consola).
window.diegosWorld = { get mundo() { return mundo; }, get juego() { return juego; } };
