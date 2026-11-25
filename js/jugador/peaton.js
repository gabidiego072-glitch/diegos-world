/**
 * PEATÓN: andar (W/S), girar (A/D), correr (Shift). Usa el personaje animado "Cesium Man".
 */
import { PEATON } from "../config.js";
import { CuerpoTerrestre } from "./cuerpoTerrestre.js";

export class Peaton extends CuerpoTerrestre {
  constructor(fisica, modelo, correccionRumbo, alturaBase) {
    super(fisica, PEATON, modelo, correccionRumbo, alturaBase);
    this.fase = 0;          // fase de la animación de caminar
    this.corriendo = false;
    this.prepararAnimacion();
  }

  prepararAnimacion() {
    const m = this.modelo;
    if (!m) return;
    const arrancar = () => {
      m.activeAnimations.animateWhilePaused = true;
      // Controlamos el tiempo de la animación nosotros: así las piernas van al ritmo de la velocidad.
      m.activeAnimations.addAll({
        loop: Cesium.ModelAnimationLoop.REPEAT,
        animationTime: (duracion) => this.fase / duracion,
      });
    };
    if (m.ready) arrancar();
    else m.readyEvent.addEventListener(arrancar);
  }

  get estado() {
    if (Math.abs(this.velocidad) < 0.2) return "Quieto";
    return this.corriendo ? "Corriendo" : "Andando";
  }

  actualizar(dt, c) {
    const P = PEATON;
    this.corriendo = c.turbo && c.adelante;
    let objetivo = 0;
    if (c.adelante && !c.atras) objetivo = this.corriendo ? P.velocidadCorrer : P.velocidadAndar;
    else if (c.atras && !c.adelante) objetivo = -P.velocidadAtras;

    this.velocidad += (objetivo - this.velocidad) * Math.min(1, dt * 8);
    if (Math.abs(this.velocidad) < 0.02) this.velocidad = 0;
    this.rumbo += c.giro * P.giro * dt;

    const chocado = this.mover(dt);
    if (chocado) this.velocidad = 0;

    // La animación avanza proporcional a la velocidad (1,7 m/s ≈ ritmo normal del modelo).
    this.fase += (this.velocidad / 1.7) * dt * (this.corriendo ? 0.75 : 1);
    return false;
  }
}
