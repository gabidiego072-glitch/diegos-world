/**
 * FÍSICA DEL SUELO: todo se basa en lanzar "rayos" contra la Valencia 3D.
 *
 *  - Rayo hacia ABAJO: sale desde poco por encima del jugador (no desde el cielo), así
 *    no se sube a árboles, toldos o balcones que están por encima de él.
 *  - Rayo hacia DELANTE: detecta paredes; si están muy cerca, el jugador choca y se para.
 *
 * Usa scene.pickFromRay, que solo "ve" las teselas que se están dibujando en pantalla
 * (por eso la cámara siempre sigue al jugador).
 */
import { vectoresLocales, direccionRumbo } from "./geo.js";

export class FisicaSuelo {
  constructor(scene) {
    this.scene = scene;
    this.excluir = [];      // modelos propios (coche, personaje) que los rayos deben ignorar
    this.rayosEsteFotograma = 0;
  }

  ignorar(primitiva) {
    if (primitiva && !this.excluir.includes(primitiva)) this.excluir.push(primitiva);
  }

  /** Lanza un rayo genérico. Devuelve { posicion, distancia } o undefined. */
  rayo(origen, direccion) {
    this.rayosEsteFotograma++;
    let r;
    try {
      r = this.scene.pickFromRay(new Cesium.Ray(origen, direccion), this.excluir);
    } catch (e) {
      return undefined; // p. ej. mientras cargan las teselas
    }
    if (!r || !r.position) return undefined;
    return { posicion: r.position, distancia: Cesium.Cartesian3.distance(origen, r.position) };
  }

  /**
   * Altura del suelo bajo (lon, lat). El rayo sale a `alturaInicio` metros sobre `alturaActual`.
   * Devuelve la altura (m sobre el elipsoide) o undefined si no hay nada debajo cargado.
   */
  alturaSuelo(lon, lat, alturaActual, alturaInicio) {
    const origen = Cesium.Cartesian3.fromRadians(lon, lat, alturaActual + alturaInicio);
    const abajo = Cesium.Cartesian3.negate(vectoresLocales(lon, lat).arriba, new Cesium.Cartesian3());
    const r = this.rayo(origen, abajo);
    if (!r) return undefined;
    return Cesium.Cartographic.fromCartesian(r.posicion).height;
  }

  /** Distancia a la primera pared en la dirección `rumbo`, con el rayo a `alturaRayo` m del suelo. */
  distanciaPared(lon, lat, altura, rumbo, alturaRayo) {
    const origen = Cesium.Cartesian3.fromRadians(lon, lat, altura + alturaRayo);
    const r = this.rayo(origen, direccionRumbo(lon, lat, rumbo));
    return r ? r.distancia : Infinity;
  }

  /**
   * Altura del suelo con el máximo detalle (carga las teselas si hace falta). Para aparecer en un sitio.
   * Lanza el rayo desde 600 m de altura hacia abajo.
   */
  async alturaSueloDetallada(lon, lat) {
    const origen = Cesium.Cartesian3.fromRadians(lon, lat, 600);
    const abajo = Cesium.Cartesian3.negate(vectoresLocales(lon, lat).arriba, new Cesium.Cartesian3());
    try {
      const r = await this.scene.pickFromRayMostDetailed(new Cesium.Ray(origen, abajo), this.excluir);
      if (r && r.position) return Cesium.Cartographic.fromCartesian(r.position).height;
    } catch (e) {
      console.warn("No se pudo calcular la altura detallada", e);
    }
    return undefined;
  }
}
