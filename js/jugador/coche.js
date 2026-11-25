/**
 * COCHE: acelerar (W/↑), frenar y marcha atrás (S/↓), girar (A/D, ←/→), turbo (Shift), freno de mano (Espacio).
 */
import { COCHE } from "../config.js";
import { CuerpoTerrestre } from "./cuerpoTerrestre.js";

const KMH = 1 / 3.6;

export class Coche extends CuerpoTerrestre {
  constructor(fisica, modelo, correccionRumbo) {
    super(fisica, COCHE, modelo, correccionRumbo);
    this.turbo = false;
  }

  get kmh() { return Math.abs(this.velocidad) / KMH; }
  get maxKmh() { return COCHE.velocidadTurboKmh; }

  /** Avanza un paso de simulación. Devuelve true si ha chocado. */
  actualizar(dt, c) {
    const C = COCHE;
    this.turbo = c.turbo && c.adelante;
    const vMax = (this.turbo ? C.velocidadTurboKmh : C.velocidadMaxKmh) * KMH;
    const vAtras = C.velocidadAtrasKmh * KMH;
    let v = this.velocidad;

    if (c.adelante && !c.atras) {
      v += (v < 0 ? C.frenada : this.turbo ? C.aceleracionTurbo : C.aceleracion) * dt;
    } else if (c.atras && !c.adelante) {
      v -= (v > 0.3 ? C.frenada : C.aceleracion * 0.7) * dt;
    } else {
      // Sin pedal: el coche se va frenando solo (rozamiento + aire).
      const rozamiento = (C.rozamiento + 0.004 * v * v) * dt;
      v = Math.abs(v) <= rozamiento ? 0 : v - Math.sign(v) * rozamiento;
    }
    if (c.freno) {
      const f = C.frenada * 1.3 * dt;
      v = Math.abs(v) <= f ? 0 : v - Math.sign(v) * f;
    }

    // Si soltamos el turbo, bajamos de velocidad poco a poco hasta la máxima normal.
    if (v > vMax) v = Math.max(vMax, v - C.frenada * 0.5 * dt);
    if (v < -vAtras) v = -vAtras;
    this.velocidad = v;

    // Giro: no se gira parado y se gira menos a mucha velocidad.
    const rapidez = Math.abs(v);
    const factor = Math.min(rapidez / 4, 1) * (1 - Math.min(rapidez / 60, 0.55));
    this.rumbo += c.giro * C.giro * factor * Math.sign(v) * dt;

    const chocado = this.mover(dt);
    if (chocado) {
      const impacto = Math.abs(this.velocidad);
      this.velocidad = -this.velocidad * 0.15; // pequeño rebote
      return impacto > 1.5;
    }
    return false;
  }
}
