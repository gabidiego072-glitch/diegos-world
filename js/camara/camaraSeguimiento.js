/**
 * CÁMARA EN TERCERA PERSONA: sigue al coche o al peatón desde atrás.
 *  - Se acerca sola si hay una pared entre la cámara y el jugador (rayo de cámara).
 *  - Mira hacia DELANTE del jugador (no al suelo), para ver la calle y los edificios.
 *  - Arrastrar con el ratón (o el dedo): mirar alrededor y arriba/abajo. Rueda: acercar / alejar.
 */
import { vectoresLocales, interpolarAngulo } from "../mundo/geo.js";

const c3 = Cesium.Cartesian3;

export class CamaraSeguimiento {
  constructor(viewer, fisica) {
    this.viewer = viewer;
    this.camera = viewer.camera;
    this.fisica = fisica;
    this.ajustes = { distancia: 9, altura: 3, alturaMirada: 1.3 };
    this.rumboCamara = 0;
    this.giroRaton = 0;      // giro extra que pone el jugador con el ratón
    this.mirarArriba = 0;    // -0.4 (mirar al suelo) … 0.45 (mirar a los tejados)
    this.zoom = 1;
    this.distanciaActual = 9;
    this.activa = false;
    this.escucharRaton(viewer.canvas);
  }

  configurar(ajustes, rumboInicial) {
    this.ajustes = ajustes;
    this.rumboCamara = rumboInicial ?? this.rumboCamara;
    this.distanciaActual = ajustes.distancia;
    this.giroRaton = 0;
    this.mirarArriba = 0;
  }

  activar(v) {
    this.activa = v;
    // En coche / a pie, Cesium no mueve la cámara: la movemos nosotros.
    this.viewer.scene.screenSpaceCameraController.enableInputs = !v;
  }

  escucharRaton(canvas) {
    let arrastrando = false;
    let ultimoX = 0;
    let ultimoY = 0;
    canvas.addEventListener("pointerdown", (e) => {
      if (this.activa) { arrastrando = true; ultimoX = e.clientX; ultimoY = e.clientY; }
    });
    window.addEventListener("pointerup", () => { arrastrando = false; });
    window.addEventListener("pointermove", (e) => {
      if (!arrastrando || !this.activa) return;
      this.giroRaton += (e.clientX - ultimoX) * 0.004;
      this.mirarArriba = Cesium.Math.clamp(this.mirarArriba - (e.clientY - ultimoY) * 0.0015, -0.4, 0.45);
      ultimoX = e.clientX;
      ultimoY = e.clientY;
    });
    canvas.addEventListener("wheel", (e) => {
      if (!this.activa) return;
      e.preventDefault();
      this.zoom = Cesium.Math.clamp(this.zoom * (e.deltaY > 0 ? 1.1 : 0.9), 0.45, 2.5);
    }, { passive: false });
  }

  /** @param {{lon:number, lat:number, altura:number, rumbo:number, velocidad:number}} objetivo */
  actualizar(dt, objetivo) {
    if (!this.activa) return;
    const a = this.ajustes;

    // Al moverse, el giro del ratón vuelve poco a poco a cero (la cámara se recoloca detrás).
    if (Math.abs(objetivo.velocidad) > 1) {
      this.giroRaton *= Math.max(0, 1 - dt * 1.5);
      this.mirarArriba *= Math.max(0, 1 - dt * 0.8);
    }

    this.rumboCamara = interpolarAngulo(this.rumboCamara, objetivo.rumbo + this.giroRaton, Math.min(1, dt * 5));

    const { este, norte, arriba } = vectoresLocales(objetivo.lon, objetivo.lat);
    const sinR = Math.sin(this.rumboCamara), cosR = Math.cos(this.rumboCamara);
    const delante = c3.add(c3.multiplyByScalar(este, sinR, new c3()), c3.multiplyByScalar(norte, cosR, new c3()), new c3());

    // Punto base: el jugador a la altura de los ojos / del techo.
    const base = c3.fromRadians(objetivo.lon, objetivo.lat, objetivo.altura + a.alturaMirada);

    // La cámara va detrás y un poco por encima.
    const distancia = a.distancia * this.zoom;
    const altura = a.altura * this.zoom;
    const haciaCamara = c3.multiplyByScalar(delante, -distancia, new c3());
    c3.add(haciaCamara, c3.multiplyByScalar(arriba, altura, new c3()), haciaCamara);
    const largoTotal = c3.magnitude(haciaCamara);
    const dir = c3.normalize(haciaCamara, new c3());

    // Si hay una pared en medio, acercamos la cámara.
    let largo = largoTotal;
    const choque = this.fisica.rayo(base, dir);
    if (choque && choque.distancia < largoTotal) largo = Math.max(1.0, choque.distancia - 0.4);
    // Acercarse es instantáneo (para no atravesar paredes); alejarse, suave.
    this.distanciaActual = largo < this.distanciaActual ? largo : this.distanciaActual + (largo - this.distanciaActual) * Math.min(1, dt * 3);
    const posicion = c3.add(base, c3.multiplyByScalar(dir, this.distanciaActual, new c3()), new c3());

    // Miramos a un punto por DELANTE del jugador (y más alto si el jugador "mira arriba").
    const mirada = c3.add(base, c3.multiplyByScalar(delante, a.adelanto, new c3()), new c3());
    c3.add(mirada, c3.multiplyByScalar(arriba, this.mirarArriba * a.adelanto * 1.2, new c3()), mirada);

    const direccion = c3.normalize(c3.subtract(mirada, posicion, new c3()), new c3());
    const derecha = c3.normalize(c3.cross(direccion, arriba, new c3()), new c3());
    const arribaCam = c3.cross(derecha, direccion, new c3());

    const cam = this.camera;
    cam.lookAtTransform(Cesium.Matrix4.IDENTITY);
    c3.clone(posicion, cam.position);
    c3.clone(direccion, cam.direction);
    c3.clone(arribaCam, cam.up);
    c3.clone(derecha, cam.right);
  }
}
