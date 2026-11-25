/**
 * ENTRADA: lee el teclado (WASD / flechas / Shift) y lo traduce a "intenciones" de juego.
 * Separarlo así permite añadir mando, controles táctiles o red (multijugador) más adelante
 * sin tocar el coche ni el peatón.
 */
const TECLAS_JUEGO = new Set([
  "KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ShiftLeft", "ShiftRight", "Space",
]);

export class Entrada {
  constructor() {
    this.pulsadas = new Set();
    this.alPulsar = []; // callbacks (codigo) => void para teclas sueltas (1, 2, 3, T...)

    window.addEventListener("keydown", (e) => {
      if (esCampoDeTexto(e.target)) return;
      if (TECLAS_JUEGO.has(e.code)) e.preventDefault();
      if (!e.repeat) this.alPulsar.forEach((f) => f(e.code));
      this.pulsadas.add(e.code);
    });
    window.addEventListener("keyup", (e) => this.pulsadas.delete(e.code));
    window.addEventListener("blur", () => this.pulsadas.clear());
  }

  onTecla(f) { this.alPulsar.push(f); }

  /** Estado actual de los controles. giro: -1 izquierda, +1 derecha. */
  leer() {
    const p = this.pulsadas;
    const adelante = p.has("KeyW") || p.has("ArrowUp");
    const atras = p.has("KeyS") || p.has("ArrowDown");
    const izquierda = p.has("KeyA") || p.has("ArrowLeft");
    const derecha = p.has("KeyD") || p.has("ArrowRight");
    return {
      adelante,
      atras,
      giro: (derecha ? 1 : 0) - (izquierda ? 1 : 0),
      turbo: p.has("ShiftLeft") || p.has("ShiftRight"),
      freno: p.has("Space"),
    };
  }
}

function esCampoDeTexto(el) {
  return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}
