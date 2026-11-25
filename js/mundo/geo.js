/**
 * Utilidades geográficas pequeñas y sin dependencias raras.
 * Convención del proyecto:
 *   - lon / lat en RADIANES, altura en metros sobre el elipsoide WGS84.
 *   - "rumbo" = dirección tipo brújula en radianes: 0 = norte, PI/2 = este (sentido horario).
 */
const RADIO_TIERRA = 6378137.0;

/** Vectores locales (este, norte, arriba) en coordenadas terrestres (ECEF). */
export function vectoresLocales(lon, lat) {
  const sLon = Math.sin(lon), cLon = Math.cos(lon);
  const sLat = Math.sin(lat), cLat = Math.cos(lat);
  return {
    este: new Cesium.Cartesian3(-sLon, cLon, 0),
    norte: new Cesium.Cartesian3(-sLat * cLon, -sLat * sLon, cLat),
    arriba: new Cesium.Cartesian3(cLat * cLon, cLat * sLon, sLat),
  };
}

/** Dirección horizontal (vector unitario ECEF) para un rumbo dado. */
export function direccionRumbo(lon, lat, rumbo) {
  const { este, norte } = vectoresLocales(lon, lat);
  const d = new Cesium.Cartesian3();
  Cesium.Cartesian3.multiplyByScalar(este, Math.sin(rumbo), d);
  Cesium.Cartesian3.add(d, Cesium.Cartesian3.multiplyByScalar(norte, Math.cos(rumbo), new Cesium.Cartesian3()), d);
  return Cesium.Cartesian3.normalize(d, d);
}

/** Desplaza (lon, lat) unos metros hacia el este y el norte. */
export function desplazar(lon, lat, metrosEste, metrosNorte) {
  return {
    lon: lon + metrosEste / (RADIO_TIERRA * Math.cos(lat)),
    lat: lat + metrosNorte / RADIO_TIERRA,
  };
}

/** Normaliza un ángulo a [-PI, PI]. */
export function normalizarAngulo(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/** Interpolación de ángulos por el camino más corto. */
export function interpolarAngulo(a, b, t) {
  return a + normalizarAngulo(b - a) * t;
}

export const grados = Cesium.Math.toDegrees;
export const radianes = Cesium.Math.toRadians;
