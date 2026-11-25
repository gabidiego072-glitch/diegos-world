/**
 * MUNDO: crea el visor de Cesium y carga la Valencia fotorrealista (Google Photorealistic 3D Tiles).
 *
 * Reglas de la licencia de Google que respetamos aquí:
 *  - Los créditos y el logo de Google se muestran en pantalla (showCreditsOnScreen + créditos de Cesium visibles).
 *  - No usamos ningún buscador (geocoder) que no sea de Google; de hecho no usamos ninguno.
 *  - No mezclamos las teselas de Google con el globo/terreno de otro proveedor: el globo está oculto.
 */
import { CALIDADES, HORA_SOL } from "../config.js";
import { aplicarEstilo, efectosAlta } from "./estilo.js";

export async function crearMundo(contenedor, token, nivelCalidad) {
  Cesium.Ion.defaultAccessToken = token;

  const viewer = new Cesium.Viewer(contenedor, {
    globe: false,               // sin globo: solo las 3D Tiles de Google
    baseLayer: false,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    animation: false,
    timeline: false,
    fullscreenButton: false,
    infoBox: false,
    selectionIndicator: false,
    shadows: false,             // sin sombras por defecto (PC flojo)
    skyAtmosphere: new Cesium.SkyAtmosphere(),
    requestRenderMode: false,   // es un juego: se dibuja en cada fotograma
  });

  const scene = viewer.scene;
  scene.skyAtmosphere.show = true;
  scene.backgroundColor = Cesium.Color.fromCssColorString("#0b0d12");
  scene.highDynamicRange = false;
  scene.screenSpaceCameraController.enableCollisionDetection = true;

  // Sol fijo de media mañana: así los modelos (coche, personaje) siempre se ven iluminados.
  viewer.clock.currentTime = Cesium.JulianDate.fromIso8601(HORA_SOL);
  viewer.clock.shouldAnimate = false;

  // Quitamos el "doble clic para seguir entidad" de Cesium: el doble clic lo usamos nosotros.
  viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

  const calidad = CALIDADES[nivelCalidad] ?? CALIDADES.baja;
  const tileset = await Cesium.createGooglePhotorealistic3DTileset(
    { onlyUsingWithGoogleGeocoder: true },
    {
      showCreditsOnScreen: true,
      maximumScreenSpaceError: calidad.errorPantalla,
      cacheBytes: calidad.cacheMB * 1024 * 1024,
      shadows: Cesium.ShadowMode.DISABLED,
    },
  );
  scene.primitives.add(tileset);

  aplicarEstilo(viewer);
  const mundo = { viewer, scene, tileset, nivelCalidad };
  aplicarCalidad(mundo, nivelCalidad);
  return mundo;
}

/** Cambia la calidad gráfica en caliente. */
export function aplicarCalidad(mundo, nivel) {
  const c = CALIDADES[nivel] ?? CALIDADES.baja;
  const { viewer, scene, tileset } = mundo;
  tileset.maximumScreenSpaceError = c.errorPantalla;
  tileset.cacheBytes = c.cacheMB * 1024 * 1024;
  viewer.resolutionScale = c.escalaResolucion;
  scene.msaaSamples = c.msaa;
  scene.postProcessStages.fxaa.enabled = c.fxaa;
  efectosAlta(viewer, nivel === "alta");
  mundo.nivelCalidad = nivel;
}

/** Destruye el visor (al volver a la pantalla de inicio). */
export function destruirMundo(mundo) {
  if (mundo && !mundo.viewer.isDestroyed()) mundo.viewer.destroy();
}
