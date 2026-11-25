/**
 * JUEGO: une todas las piezas y gestiona los tres modos (coche, a pie, vuelo libre),
 * el teletransporte y el bucle principal.
 */
import { CAMARA, CALIDADES, CLAVE_CALIDAD, CLAVE_MODO, DISTANCIA_VISION, MODELOS } from "../config.js";
import { aplicarCalidad } from "../mundo/mundo.js";
import { FisicaSuelo } from "../mundo/fisica.js";
import { desplazar, grados, radianes } from "../mundo/geo.js";
import { cargarModelo } from "../jugador/cuerpoTerrestre.js";
import { Coche } from "../jugador/coche.js";
import { Peaton } from "../jugador/peaton.js";
import { CamaraSeguimiento } from "../camara/camaraSeguimiento.js";
import { Hud } from "../interfaz/hud.js";
import { buscarLugar, LUGAR_INICIAL } from "../lugares/lugares.js";

const ALTURA_SUELO_SUPUESTA = 60; // m sobre el elipsoide; Valencia está a ~10 m sobre el mar (+50 m de geoide)

export class Juego {
  constructor(mundo, entrada, { alSalir }) {
    this.mundo = mundo;
    this.viewer = mundo.viewer;
    this.scene = mundo.scene;
    this.entrada = entrada;
    this.alSalir = alSalir;
    this.fisica = new FisicaSuelo(this.scene);
    this.camara = new CamaraSeguimiento(this.viewer, this.fisica);
    this.modo = null;
    this.ultimoTerrestre = leer(CLAVE_MODO, "coche") === "pie" ? "pie" : "coche";
    this.pausado = true;
    this.ocupado = false;
    this.ultimoTick = performance.now();
    this.ultimoAvisoChoque = 0;
    this.farOriginal = this.viewer.camera.frustum.far;

    this.hud = new Hud({
      alCambiarModo: (m) => this.cambiarModo(m),
      alTeletransportar: (id) => this.teletransportar(id),
      alCambiarCalidad: () => this.alternarCalidad(),
      alSalir: () => this.alSalir(),
      alAparecerAqui: () => this.aparecerDondeMiro(),
    });
  }

  async iniciar() {
    const [modeloCoche, modeloPeaton] = await Promise.all([
      cargarModelo(this.scene, MODELOS.coche),
      cargarModelo(this.scene, MODELOS.peaton),
    ]);
    this.coche = new Coche(this.fisica, modeloCoche, radianes(MODELOS.coche.correccionRumbo), MODELOS.coche.alturaBase);
    this.peaton = new Peaton(this.fisica, modeloPeaton, radianes(MODELOS.peaton.correccionRumbo), MODELOS.peaton.alturaBase);
    this.coche.visible = false;
    this.peaton.visible = false;

    // Bucle principal: Cesium llama a esto una vez por fotograma.
    this.quitarTick = this.viewer.clock.onTick.addEventListener(() => this.tick());

    // Doble clic (o doble toque) en vuelo libre: aparecer en ese punto.
    this.manejador = new Cesium.ScreenSpaceEventHandler(this.viewer.canvas);
    this.manejador.setInputAction((e) => this.dobleClic(e.position), Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

    // Teclas sueltas.
    this.alTecla = (codigo) => {
      if (this.destruido) return;
      if (codigo === "Digit1" || codigo === "Numpad1") this.cambiarModo("coche");
      else if (codigo === "Digit2" || codigo === "Numpad2") this.cambiarModo("pie");
      else if (codigo === "Digit3" || codigo === "Numpad3") this.cambiarModo("vuelo");
      else if (codigo === "KeyF") this.cambiarModo(this.modo === "coche" ? "pie" : "coche");
      else if (codigo === "KeyT") this.hud.panelLugares();
      else if (codigo === "Escape") this.hud.panelLugares(false);
    };
    this.entrada.onTecla(this.alTecla);

    this.hud.ponerCalidad(this.mundo.nivelCalidad);
    this.hud.mostrar(true);

    const inicio = buscarLugar(LUGAR_INICIAL);
    await this.aparecerEn(inicio.lon, inicio.lat, inicio.rumbo, this.ultimoTerrestre, { rapido: true });
    this.hud.aviso(`Bienvenido a Valencia · ${inicio.nombre}`, { duracion: 3500 });
  }

  // ------------------------------------------------------------------ bucle
  tick() {
    const ahora = performance.now();
    const dt = Math.min((ahora - this.ultimoTick) / 1000, 0.1);
    this.ultimoTick = ahora;
    if (this.pausado || this.destruido) return;

    const controles = this.entrada.leer();
    if (this.modo === "coche") {
      const choque = this.coche.actualizar(dt, controles);
      this.camara.actualizar(dt, this.coche);
      this.hud.velocidad(this.coche.kmh, this.coche.maxKmh, this.coche.turbo);
      if (choque) this.avisarChoque();
    } else if (this.modo === "pie") {
      this.peaton.actualizar(dt, controles);
      this.camara.actualizar(dt, this.peaton);
      this.hud.estadoPie(this.peaton.estado);
    }
  }

  avisarChoque() {
    this.hud.choque();
    const ahora = performance.now();
    if (ahora - this.ultimoAvisoChoque > 1500) {
      this.hud.aviso("¡Choque!", { peligro: true, duracion: 900 });
      this.ultimoAvisoChoque = ahora;
    }
  }

  // ------------------------------------------------------------------ modos
  cuerpo(modo) { return modo === "pie" ? this.peaton : this.coche; }

  activarModo(modo) {
    this.modo = modo;
    this.hud.ponerModo(modo);
    // En coche / a pie solo cargamos lo cercano; en vuelo, todo hasta el horizonte.
    this.viewer.camera.frustum.far = DISTANCIA_VISION[modo] ?? this.farOriginal;
    if (modo === "vuelo") {
      this.camara.activar(false);
      return;
    }
    this.ultimoTerrestre = modo;
    guardar(CLAVE_MODO, modo);
    const c = this.cuerpo(modo);
    this.coche.visible = true;                 // el coche siempre está (aparcado si vas a pie)
    this.peaton.visible = modo === "pie";
    this.camara.configurar(CAMARA[modo], c.rumbo);
    this.camara.activar(true);
  }

  cambiarModo(modo) {
    if (this.ocupado || modo === this.modo) return;

    if (modo === "vuelo") {
      this.activarModo("vuelo");
      this.hud.aviso("Vuelo libre · doble clic en una calle para aparecer allí");
      return;
    }

    // Desde el vuelo: aparecer donde está mirando la cámara.
    if (this.modo === "vuelo") {
      this.ultimoTerrestre = modo;
      this.aparecerDondeMiro();
      return;
    }

    if (modo === "pie") {
      // Bajarse del coche: el personaje aparece a la izquierda del coche.
      const c = this.coche;
      c.velocidad = 0;
      const lado = c.rumbo - Math.PI / 2;
      const p = desplazar(c.lon, c.lat, Math.sin(lado) * 2.3, Math.cos(lado) * 2.3);
      this.peaton.colocar(p.lon, p.lat, c.altura + 0.3, c.rumbo);
      this.peaton.suelo = undefined;
      this.activarModo("pie");
    } else {
      // Subirse al coche: si está lejos, el coche viene a ti.
      const p = this.peaton;
      const distancia = Cesium.Cartesian3.distance(p.posicion(), this.coche.posicion());
      if (distancia > 15) {
        this.coche.colocar(p.lon, p.lat, p.altura, p.rumbo);
        this.hud.aviso("Tu coche te estaba esperando aquí");
      }
      this.activarModo("coche");
    }
  }

  // ------------------------------------------------------------ teletransporte
  teletransportar(id) {
    const l = buscarLugar(id);
    const modo = this.modo ?? this.ultimoTerrestre;
    this.aparecerEn(l.lon, l.lat, l.rumbo, modo).then((ok) => {
      if (ok) this.hud.aviso(l.nombre, { duracion: 2500 });
    });
  }

  /**
   * Viaja a un punto (grados) y coloca allí al jugador, pegado al suelo real.
   * Devuelve true si ha ido bien.
   */
  async aparecerEn(lonG, latG, rumboG, modo, { rapido = false } = {}) {
    if (this.ocupado) return false;
    this.ocupado = true;
    this.pausado = true;
    this.camara.activar(false);
    this.viewer.camera.frustum.far = this.farOriginal;

    const lon = radianes(lonG), lat = radianes(latG), rumbo = radianes(rumboG);
    try {
      // 1) La cámara vuela a una vista elevada detrás del punto (así se cargan las teselas de esa zona).
      const atras = desplazar(lon, lat, -Math.sin(rumbo) * 140, -Math.cos(rumbo) * 140);
      await volar(this.viewer.camera, {
        destination: Cesium.Cartesian3.fromRadians(atras.lon, atras.lat, ALTURA_SUELO_SUPUESTA + 110),
        orientation: { heading: rumbo, pitch: radianes(-38), roll: 0 },
        duration: rapido ? 0 : 1.6,
      });
      if (this.destruido) return false;

      if (modo === "vuelo") {
        this.activarModo("vuelo");
        return true;
      }

      // 2) Buscamos la altura exacta del suelo en ese punto (con el máximo detalle).
      this.hud.aviso("Cargando calle…", { duracion: 8000 });
      const suelo = (await this.fisica.alturaSueloDetallada(lon, lat)) ?? ALTURA_SUELO_SUPUESTA;
      if (this.destruido) return false;

      // 3) Colocamos coche (y peatón al lado si vamos a pie).
      this.coche.colocar(lon, lat, suelo, rumbo);
      if (modo === "pie") {
        const lado = rumbo - Math.PI / 2;
        const p = desplazar(lon, lat, Math.sin(lado) * 2.3, Math.cos(lado) * 2.3);
        this.peaton.colocar(p.lon, p.lat, suelo + 0.3, rumbo);
        this.peaton.suelo = undefined;
      }
      this.modo = null; // fuerza a reactivar la cámara
      this.activarModo(modo);
      this.hud.aviso("¡A jugar!", { duracion: 900 });
      return true;
    } catch (e) {
      console.error(e);
      this.hud.aviso("No se pudo viajar a ese punto", { peligro: true });
      return false;
    } finally {
      this.ultimoTick = performance.now();
      this.pausado = false;
      this.ocupado = false;
    }
  }

  dobleClic(posicionPantalla) {
    if (this.modo !== "vuelo" || this.ocupado) return;
    const p = this.puntoEnPantalla(posicionPantalla);
    if (!p) { this.hud.aviso("Haz doble clic sobre una calle", { peligro: true }); return; }
    this.aparecerEn(p.lonG, p.latG, grados(this.viewer.camera.heading), this.ultimoTerrestre);
  }

  /** Botón "Aparecer aquí" (pensado para móvil): usa el centro de la pantalla. */
  aparecerDondeMiro() {
    const canvas = this.viewer.canvas;
    const centro = new Cesium.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2);
    const p = this.puntoEnPantalla(centro);
    if (!p) {
      this.hud.aviso("Apunta la cámara hacia una calle", { peligro: true });
      return;
    }
    this.aparecerEn(p.lonG, p.latG, grados(this.viewer.camera.heading), this.ultimoTerrestre);
  }

  puntoEnPantalla(posicion) {
    if (!this.scene.pickPositionSupported) return undefined;
    const cart = this.scene.pickPosition(posicion);
    if (!cart) return undefined;
    const c = Cesium.Cartographic.fromCartesian(cart);
    if (!c) return undefined;
    return { lonG: grados(c.longitude), latG: grados(c.latitude) };
  }

  // ------------------------------------------------------------------ calidad
  alternarCalidad() {
    const nueva = this.mundo.nivelCalidad === "alta" ? "baja" : "alta";
    aplicarCalidad(this.mundo, nueva);
    guardar(CLAVE_CALIDAD, nueva);
    this.hud.ponerCalidad(nueva);
    this.hud.aviso(`Calidad ${CALIDADES[nueva].nombre.toLowerCase()}`);
  }

  destruir() {
    this.destruido = true;
    if (this.quitarTick) this.quitarTick();
    if (this.manejador) this.manejador.destroy();
    this.hud.mostrar(false);
    this.hud.panelLugares(false);
  }
}

// ---------------------------------------------------------------- utilidades
function volar(camera, opciones) {
  return new Promise((resolve) => {
    if (opciones.duration === 0) {
      camera.setView(opciones);
      resolve();
      return;
    }
    camera.flyTo({ ...opciones, complete: resolve, cancel: resolve });
  });
}

function leer(clave, porDefecto) {
  try { return localStorage.getItem(clave) ?? porDefecto; } catch { return porDefecto; }
}
function guardar(clave, valor) {
  try { localStorage.setItem(clave, valor); } catch { /* nada */ }
}
