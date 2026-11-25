/**
 * PROYECCIÓN LOCAL: pasa de lon/lat a metros (x = este, y = norte) alrededor de un origen.
 * Precisa al centímetro en 1–2 km, que es lo que ocupa la zona generada.
 * Todo el generador trabaja en estos metros; la matriz `enu` lleva los metros a la Tierra.
 */
const A = 6378137.0;
const E2 = 0.00669437999014;

export class Proyeccion {
  constructor(lonGrados, latGrados) {
    this.lon0 = Cesium.Math.toRadians(lonGrados);
    this.lat0 = Cesium.Math.toRadians(latGrados);
    const s = Math.sin(this.lat0);
    const w = 1 - E2 * s * s;
    this.radioN = A / Math.sqrt(w);                 // radio de la primera vertical
    this.radioM = (A * (1 - E2)) / Math.pow(w, 1.5); // radio del meridiano
    this.cosLat0 = Math.cos(this.lat0);
    this.enu = Cesium.Transforms.eastNorthUpToFixedFrame(Cesium.Cartesian3.fromRadians(this.lon0, this.lat0, 0));
  }

  /** lon/lat en RADIANES → {x, y} en metros. */
  aLocal(lon, lat) {
    return { x: (lon - this.lon0) * this.radioN * this.cosLat0, y: (lat - this.lat0) * this.radioM };
  }

  /** lon/lat en GRADOS → {x, y}. */
  aLocalGrados(lonG, latG) {
    return this.aLocal(Cesium.Math.toRadians(lonG), Cesium.Math.toRadians(latG));
  }

  /** {x, y} → lon/lat en RADIANES. */
  aGeo(x, y) {
    return { lon: this.lon0 + x / (this.radioN * this.cosLat0), lat: this.lat0 + y / this.radioM };
  }

  /** Matriz de un objeto colocado en (x, y, z) local y girado `angulo` (radianes, 0 = este, antihorario). */
  matrizObjeto(x, y, z, angulo, resultado = new Cesium.Matrix4()) {
    const c = Math.cos(angulo), s = Math.sin(angulo);
    const local = Cesium.Matrix4.fromRowMajorArray([c, -s, 0, x, s, c, 0, y, 0, 0, 1, z, 0, 0, 0, 1], escratch);
    return Cesium.Matrix4.multiply(this.enu, local, resultado);
  }
}
const escratch = new Cesium.Matrix4();
