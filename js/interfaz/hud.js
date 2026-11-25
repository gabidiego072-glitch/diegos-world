/**
 * HUD: botones de modo, panel de lugares, calidad, velocímetro, ayudas y avisos.
 * No contiene lógica de juego: solo muestra cosas y avisa cuando el jugador pulsa algo.
 */
import { CALIDADES } from "../config.js";
import { LUGARES } from "../lugares/lugares.js";

const $ = (id) => document.getElementById(id);

const AYUDAS = {
  coche: "<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> conducir · <kbd>Shift</kbd> turbo · <kbd>Espacio</kbd> freno · arrastra para mirar",
  pie: "<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> andar · <kbd>Shift</kbd> correr · <kbd>1</kbd> volver al coche",
  vuelo: "Arrastra para mover · rueda para zoom · <kbd>Doble clic</kbd> en una calle para aparecer allí",
};

export class Hud {
  constructor({ alCambiarModo, alTeletransportar, alCambiarCalidad, alSalir, alAparecerAqui, alCambiarCiudad }) {
    this.raiz = $("hud");
    this.temporizadorAviso = null;

    document.querySelectorAll(".modo").forEach((b) => {
      b.addEventListener("click", () => { alCambiarModo(b.dataset.modo); b.blur(); });
    });

    const lista = $("lista-lugares");
    lista.innerHTML = "";
    LUGARES.forEach((l) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.className = "lugar";
      b.innerHTML = `<strong></strong><span></span>`;
      b.querySelector("strong").textContent = l.nombre;
      b.querySelector("span").textContent = l.descripcion;
      b.addEventListener("click", () => { this.panelLugares(false); alTeletransportar(l.id); });
      li.appendChild(b);
      lista.appendChild(li);
    });

    $("boton-lugares").addEventListener("click", (e) => { this.panelLugares(); e.currentTarget.blur(); });
    $("boton-calidad").addEventListener("click", (e) => { alCambiarCalidad(); e.currentTarget.blur(); });
    $("boton-salir").addEventListener("click", alSalir);
    $("boton-ciudad").addEventListener("click", (e) => { alCambiarCiudad(); e.currentTarget.blur(); });
    $("boton-aparecer").addEventListener("click", alAparecerAqui);
  }

  mostrar(v) { this.raiz.hidden = !v; }

  panelLugares(forzar) {
    const panel = $("panel-lugares");
    const abrir = forzar ?? panel.hidden;
    panel.hidden = !abrir;
    $("boton-lugares").setAttribute("aria-expanded", String(abrir));
  }

  ponerModo(modo) {
    document.querySelectorAll(".modo").forEach((b) => b.classList.toggle("activo", b.dataset.modo === modo));
    $("velocimetro").hidden = modo !== "coche";
    $("estado-pie").hidden = modo !== "pie";
    $("boton-aparecer").hidden = modo !== "vuelo";
    $("ayuda").innerHTML = AYUDAS[modo] || "";
  }

  ponerCiudad(activa) {
    $("texto-ciudad").textContent = activa ? "Generadas" : "Google";
  }

  ponerCalidad(nivel) {
    $("texto-calidad").textContent = CALIDADES[nivel]?.nombre ?? nivel;
  }

  velocidad(kmh, max, turbo) {
    $("vel-numero").textContent = Math.round(kmh);
    $("vel-relleno").style.width = Math.min(100, (kmh / max) * 100) + "%";
    $("vel-turbo").classList.toggle("on", turbo);
  }

  estadoPie(texto) {
    const el = $("pie-estado");
    if (el.textContent !== texto) el.textContent = texto;
  }

  aviso(texto, { peligro = false, duracion = 1800 } = {}) {
    const el = $("aviso");
    el.textContent = texto;
    el.classList.toggle("peligro", peligro);
    el.classList.add("visible");
    clearTimeout(this.temporizadorAviso);
    this.temporizadorAviso = setTimeout(() => el.classList.remove("visible"), duracion);
  }

  choque() {
    this.raiz.classList.add("choque");
    requestAnimationFrame(() => requestAnimationFrame(() => this.raiz.classList.remove("choque")));
  }
}

/** Pantalla de carga a pantalla completa. */
export function carga(visible, texto = "Cargando Valencia…") {
  $("pantalla-carga").hidden = !visible;
  $("texto-carga").textContent = texto;
}
