/**
 * Configuración general de Diego's World.
 * Todo lo que quieras "afinar" sin tocar la lógica está aquí.
 */

/** Versión de CesiumJS (debe coincidir con la de index.html). */
export const VERSION_CESIUM = "1.146.0";

/** Claves de localStorage (el token SOLO vive en el navegador del jugador). */
export const CLAVE_TOKEN = "diegosworld.tokenCesiumIon";
export const CLAVE_CALIDAD = "diegosworld.calidad";
export const CLAVE_MODO = "diegosworld.ultimoModoTerrestre";

/**
 * Niveles de calidad.
 * - errorPantalla: maximumScreenSpaceError de las 3D Tiles (más alto = menos detalle, más rápido).
 * - escalaResolucion: resolutionScale (1 = resolución normal, 0.6 = 60 % de píxeles).
 */
export const CALIDADES = {
  baja: { nombre: "Baja", errorPantalla: 24, escalaResolucion: 0.65, msaa: 1, fxaa: false, cacheMB: 256 },
  alta: { nombre: "Alta", errorPantalla: 12, escalaResolucion: 1.0, msaa: 4, fxaa: true, cacheMB: 768 },
};
export const CALIDAD_POR_DEFECTO = "baja"; // pensado para PCs flojos

/** Hora fija del "sol" (UTC) para que el coche y el personaje se vean iluminados. */
export const HORA_SOL = "2026-06-21T10:30:00Z";

/** Física del coche (metros, segundos, radianes). */
export const COCHE = {
  velocidadMaxKmh: 70,
  velocidadTurboKmh: 140,
  velocidadAtrasKmh: 25,
  aceleracion: 5.5,
  aceleracionTurbo: 9,
  frenada: 13,
  rozamiento: 1.6,
  giro: 1.5,               // rad/s a velocidad media
  alturaRayoSuelo: 2.2,    // el rayo hacia abajo sale 2,2 m sobre el suelo (justo por encima del techo)
  alturaRayoPared: 0.9,    // altura del rayo hacia delante
  radioFrontal: 2.3,       // media longitud del coche
  escalonMax: 0.45,        // escalón más alto que se puede subir (si es mayor, es una pared)
};

/** Física del peatón. */
export const PEATON = {
  velocidadAndar: 1.7,
  velocidadCorrer: 5.5,
  velocidadAtras: 1.2,
  giro: 2.6,
  alturaRayoSuelo: 1.9,
  alturaRayoPared: 1.0,
  radioFrontal: 0.45,
  escalonMax: 0.45,
};

/**
 * Detalle en la distancia (dynamicScreenSpaceErrorDensity de Cesium). A ras de suelo la cámara ve hasta el
 * horizonte y el navegador intentaría descargar media Valencia con todo detalle: con un valor más alto,
 * lo lejano se carga en baja calidad y la calle cercana carga rápido y nítida.
 */
export const DETALLE_LEJANO = { coche: 0.0015, pie: 0.002, vuelo: 0.0002 };

/** Cámara en tercera persona. */
export const CAMARA = {
  // distancia: metros detrás · altura: metros por encima del punto de mirada
  // alturaMirada: a qué altura del jugador se mira · adelanto: cuántos metros por delante se apunta
  coche: { distancia: 7.5, altura: 1.9, alturaMirada: 1.3, adelanto: 9 },
  pie:   { distancia: 4.3, altura: 0.7, alturaMirada: 1.6, adelanto: 5 },
};

/** Modelos 3D. Los modelos glTF miran hacia +Z; Cesium los gira para que miren al "este".
 *  Si algún día un modelo sale mirando de lado, ajusta su corrección (en grados). */
export const MODELOS = {
  // alturaBase: cuánto hay que subir el modelo para que las ruedas toquen el suelo.
  coche: { url: new URL("../assets/modelos/coche_realista.glb", import.meta.url).href, correccionRumbo: 0, escala: 1, alturaBase: 0.49 },
  peaton: { url: new URL("../assets/modelos/peaton.glb", import.meta.url).href, correccionRumbo: 0, escala: 1, alturaBase: 0 },
};

/**
 * MODO HÍBRIDO: calle de videojuego generada con OpenStreetMap alrededor del jugador.
 *  - tamCelda: tamaño de cada trozo generado (m). radio: cuántas celdas alrededor (1 → 3×3 = 600×600 m).
 *  - corte: por debajo de esta altura (m sobre el suelo) se oculta la Valencia de Google en la zona generada.
 *  - distanciaReinicio: si te alejas tanto del centro, se vuelve a generar centrado en ti.
 */
export const CIUDAD = { activaPorDefecto: true, tamCelda: 200, radio: 1, corte: 3.6, distanciaReinicio: 450 };
export const CLAVE_CIUDAD = "diegosworld.ciudadGenerada";

/** NPCs (cantidad según la calidad gráfica). */
export const NPC = {
  coches: { baja: 4, alta: 8 },
  peatones: { baja: 10, alta: 22 },
  radioAparicion: [35, 170],
  radioDesaparicion: 230,
};
