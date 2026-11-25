/**
 * CUERPO TERRESTRE: lo que comparten el coche y el peatón.
 * Sabe moverse por la Valencia 3D pegado al suelo real, subir bordillos pequeños,
 * caer por desniveles y chocar contra paredes.
 *
 * Estado (fácil de portar a Unreal Engine o de enviar por red en multijugador):
 *   lon, lat (radianes), altura (m), rumbo (radianes, 0 = norte), velocidad (m/s).
 */
import { desplazar } from "../mundo/geo.js";

const GRAVEDAD = 9.81;
const CAIDA_LIBRE = 0.6;      // si el suelo está más de 0,6 m por debajo, caemos (si no, nos "pegamos")
const INCLINACION_MAX = 0.35; // ~20 grados

export class CuerpoTerrestre {
  /**
   * @param {import("../mundo/fisica.js").FisicaSuelo} fisica
   * @param {object} ajustes  alturaRayoSuelo, alturaRayoPared, radioFrontal, escalonMax
   * @param {Cesium.Model} modelo
   * @param {number} correccionRumbo  radianes
   */
  constructor(fisica, ajustes, modelo, correccionRumbo = 0) {
    this.fisica = fisica;
    this.ajustes = ajustes;
    this.modelo = modelo;
    this.correccionRumbo = correccionRumbo;
    this.lon = 0;
    this.lat = 0;
    this.altura = 0;
    this.rumbo = 0;
    this.velocidad = 0;
    this.velVertical = 0;
    this.inclinacion = 0;
    this.suelo = undefined;
    this.matriz = new Cesium.Matrix4();
    if (modelo) fisica.ignorar(modelo);
  }

  colocar(lon, lat, altura, rumbo) {
    Object.assign(this, { lon, lat, altura, rumbo, velocidad: 0, velVertical: 0, inclinacion: 0, suelo: altura });
    this.actualizarModelo();
  }

  set visible(v) { if (this.modelo) this.modelo.show = v; }
  get visible() { return this.modelo ? this.modelo.show : false; }

  /**
   * Mueve el cuerpo según su velocidad. Devuelve true si ha chocado.
   */
  mover(dt) {
    const a = this.ajustes;
    const f = this.fisica;
    const distancia = this.velocidad * dt;
    let chocado = false;
    let pendienteObjetivo = 0;

    if (Math.abs(this.velocidad) > 0.05) {
      // 1) Rayo hacia delante (o hacia atrás si vamos marcha atrás): ¿hay pared?
      const rumboMovimiento = this.velocidad >= 0 ? this.rumbo : this.rumbo + Math.PI;
      const dPared = f.distanciaPared(this.lon, this.lat, this.altura, rumboMovimiento, a.alturaRayoPared);

      if (dPared < a.radioFrontal + Math.abs(distancia)) {
        chocado = true;
      } else {
        // 2) Rayo hacia abajo en la posición nueva, lanzado desde poco por encima de nosotros.
        const n = desplazar(this.lon, this.lat, Math.sin(this.rumbo) * distancia, Math.cos(this.rumbo) * distancia);
        const sueloNuevo = f.alturaSuelo(n.lon, n.lat, this.altura, a.alturaRayoSuelo);

        if (sueloNuevo !== undefined && sueloNuevo - this.altura > a.escalonMax) {
          chocado = true; // escalón demasiado alto: es una pared
        } else {
          if (sueloNuevo !== undefined) {
            const base = this.suelo ?? sueloNuevo;
            pendienteObjetivo = Math.atan((sueloNuevo - base) / distancia);
            this.suelo = sueloNuevo;
          }
          this.lon = n.lon;
          this.lat = n.lat;
        }
      }
    } else {
      const s = f.alturaSuelo(this.lon, this.lat, this.altura, a.alturaRayoSuelo);
      if (s !== undefined) this.suelo = s;
    }

    // 3) Movimiento vertical: pegarse al suelo o caer con gravedad.
    if (this.suelo !== undefined) {
      const diferencia = this.altura - this.suelo;
      if (diferencia > CAIDA_LIBRE || (this.velVertical < 0 && diferencia > 0.02)) {
        this.velVertical -= GRAVEDAD * dt;
        this.altura += this.velVertical * dt;
        if (this.altura <= this.suelo) {
          this.altura = this.suelo;
          this.velVertical = 0;
        }
      } else {
        this.altura += (this.suelo - this.altura) * Math.min(1, dt * 14);
        this.velVertical = 0;
      }
    }

    // 4) Inclinación suave (morro arriba en las cuestas).
    pendienteObjetivo = Cesium.Math.clamp(pendienteObjetivo || 0, -INCLINACION_MAX, INCLINACION_MAX);
    this.inclinacion += (pendienteObjetivo - this.inclinacion) * Math.min(1, dt * 5);

    this.actualizarModelo();
    return chocado;
  }

  /** Posición actual en coordenadas Cesium. */
  posicion() {
    return Cesium.Cartesian3.fromRadians(this.lon, this.lat, this.altura);
  }

  actualizarModelo() {
    if (!this.modelo) return;
    // Cesium: "heading" 0 = el modelo mira al este; nuestro rumbo 0 = norte.
    const hpr = new Cesium.HeadingPitchRoll(this.rumbo - Math.PI / 2 + this.correccionRumbo, this.inclinacion, 0);
    Cesium.Transforms.headingPitchRollToFixedFrame(this.posicion(), hpr, Cesium.Ellipsoid.WGS84, undefined, this.matriz);
    this.modelo.modelMatrix = this.matriz;
  }
}

/** Carga un modelo glTF/GLB y lo añade a la escena. */
export async function cargarModelo(scene, { url, escala = 1 }) {
  const modelo = await Cesium.Model.fromGltfAsync({ url, scale: escala, shadows: Cesium.ShadowMode.DISABLED });
  scene.primitives.add(modelo);
  return modelo;
}
