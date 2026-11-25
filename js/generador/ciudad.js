/**
 * GENERADOR DE CIUDAD (modo híbrido).
 *
 *  - Lejos: la Valencia real de Google (3D Tiles).
 *  - Cerca del jugador (celdas de 200 × 200 m): calle de videojuego generada con OpenStreetMap.
 *  - Modo "completo" (navegadores con WebGL 2): dentro de la zona generada se quita TODA la Valencia
 *    de Google salvo los monumentos (huecos en el recorte), y los edificios normales se generan enteros
 *    con su altura real medida en Google: nada se ve derretido y los monumentos siguen siendo los reales.
 *  - Modo "bajos" (reserva): a Google solo se le quita lo que está por debajo de ~3,6 m y se generan los bajos.
 *
 * Regla del proyecto: no se construye nada a mano; todo sale de datos reales o de reglas.
 */
import { CIUDAD } from "../config.js";
import { Proyeccion } from "./proyeccion.js";
import { AlmacenOsm, descargarOsm } from "./osm.js";
import { Zona, puntoEnPoligono } from "./zona.js";
import { CampoAlturas } from "./alturas.js";
import { crearTexturas } from "./texturas.js";
import { construirCelda } from "./construirCelda.js";

export class GeneradorCiudad {
  /**
   * @param {{viewer, scene, tileset}} mundo
   * @param {import("../mundo/fisica.js").FisicaSuelo} fisica
   */
  constructor(mundo, fisica, { descargar = descargarOsm, alAviso = () => {} } = {}) {
    this.viewer = mundo.viewer;
    this.scene = mundo.scene;
    this.tileset = mundo.tileset instanceof Cesium.Cesium3DTileset ? mundo.tileset : null;
    this.fisica = fisica;
    this.descargar = descargar;
    this.alAviso = alAviso;
    this.almacen = new AlmacenOsm();
    this.celdas = new Map();
    this.activo = true;
    this.visible = true;
    this.trabajando = false;
    this.generacion = 0;            // cambia en cada reinicio (para descartar trabajos viejos)
    this.modelosExtra = () => [];   // NPCs, que también hay que ignorar al medir el suelo
    this.avisoInicialDado = false;
  }

  async preparar() {
    this.texturas = await crearTexturas();
    try {
      const credito = new Cesium.Credit("Calles generadas con datos © colaboradores de OpenStreetMap", true);
      if (this.viewer.creditDisplay.addStaticCredit) this.viewer.creditDisplay.addStaticCredit(credito);
    } catch { /* sin créditos estáticos en esta versión */ }
    const soportaPoligonos = this.tileset ? Cesium.ClippingPolygonCollection.isSupported(this.scene) : true;
    this.modo = soportaPoligonos ? "completo" : "bajos";
    if (this.tileset && this.modo === "completo") {
      this.recortePol = new Cesium.ClippingPolygonCollection({ polygons: [], enabled: false });
      this.tileset.clippingPolygons = this.recortePol;
    } else if (this.tileset) {
      const planos = [
        new Cesium.ClippingPlane(new Cesium.Cartesian3(0, 0, 1), 0),   // por debajo del corte…
        new Cesium.ClippingPlane(new Cesium.Cartesian3(-1, 0, 0), 0),  // …y dentro de la caja
        new Cesium.ClippingPlane(new Cesium.Cartesian3(1, 0, 0), 0),
        new Cesium.ClippingPlane(new Cesium.Cartesian3(0, -1, 0), 0),
        new Cesium.ClippingPlane(new Cesium.Cartesian3(0, 1, 0), 0),
      ];
      this.recorte = new Cesium.ClippingPlaneCollection({ planes: planos, unionClippingRegions: false, edgeWidth: 0, enabled: false });
      this.tileset.clippingPlanes = this.recorte;
    }
  }

  // ---------------------------------------------------------------- zona

  /** Empieza una zona nueva centrada en (lon, lat) grados. `alturaSuelo`: altura real del suelo ahí. */
  reiniciar(lonG, latG, alturaSuelo) {
    this.vaciar();
    this.generacion++;
    this.proy = new Proyeccion(lonG, latG);
    this.zona = new Zona(this.proy);
    this.alturaOrigen = alturaSuelo;
    this.campo = new CampoAlturas(alturaSuelo);
    this.techo = alturaSuelo + CIUDAD.corte + 0.6;
    this.avisoInicialDado = false;
    this.actualizarRecorte();
  }

  vaciar() {
    for (const c of this.celdas.values()) this.quitarModelo(c);
    this.celdas.clear();
  }

  quitarModelo(c) {
    if (c.modelo && !c.modelo.isDestroyed()) this.scene.primitives.remove(c.modelo);
    if (c.url) URL.revokeObjectURL(c.url);
    c.modelo = null;
    c.url = null;
  }

  clave(i, j) { return i + "," + j; }

  celdaDe(x, y) {
    const t = CIUDAD.tamCelda;
    return [Math.floor(x / t + 0.5), Math.floor(y / t + 0.5)];
  }

  limites(i, j) {
    const t = CIUDAD.tamCelda;
    return { x0: (i - 0.5) * t, y0: (j - 0.5) * t, x1: (i + 0.5) * t, y1: (j + 0.5) * t };
  }

  /** Llamar en cada fotograma con la posición del jugador (radianes). */
  actualizar(lon, lat) {
    if (!this.proy || !this.activo || !this.visible) return;
    const p = this.proy.aLocal(lon, lat);
    if (Math.hypot(p.x, p.y) > CIUDAD.distanciaReinicio) {
      // Nos hemos alejado mucho del origen: nueva zona centrada en el jugador.
      this.reiniciar(Cesium.Math.toDegrees(lon), Cesium.Math.toDegrees(lat), this.campo.h(p.x, p.y));
      return;
    }
    const [ci, cj] = this.celdaDe(p.x, p.y);
    this.jugador = { x: p.x, y: p.y, ci, cj };
    const R = CIUDAD.radio;
    for (let i = ci - R; i <= ci + R; i++) {
      for (let j = cj - R; j <= cj + R; j++) {
        const k = this.clave(i, j);
        if (!this.celdas.has(k)) this.celdas.set(k, { i, j, estado: "nueva", datos: false });
      }
    }
    for (const [k, c] of this.celdas) {
      if (Math.max(Math.abs(c.i - ci), Math.abs(c.j - cj)) > R + 1) {
        this.quitarModelo(c);
        this.celdas.delete(k);
        this.actualizarRecorte();
      }
    }
    if (!this.trabajando) this.procesar();
  }

  /** ¿Hay calle generada (lista) en este punto? (radianes) */
  cubre(lon, lat) {
    if (!this.proy || !this.activo || !this.visible) return false;
    const p = this.proy.aLocal(lon, lat);
    const [i, j] = this.celdaDe(p.x, p.y);
    const c = this.celdas.get(this.clave(i, j));
    return !!c && c.estado === "lista";
  }

  // ---------------------------------------------------------------- trabajo

  async procesar() {
    this.trabajando = true;
    const gen = this.generacion;
    try {
      while (gen === this.generacion && this.activo) {
        // 1) Descargar datos de las celdas que aún no los tienen (en un solo pedido).
        const sinDatos = [...this.celdas.values()].filter((c) => !c.datos && c.estado !== "error");
        if (sinDatos.length) {
          await this.descargarCeldas(sinDatos, gen);
          continue;
        }
        // 2) Construir la celda pendiente más cercana al jugador.
        const pendientes = [...this.celdas.values()].filter((c) => c.estado === "nueva" && c.datos);
        if (!pendientes.length) break;
        const j = this.jugador || { ci: 0, cj: 0 };
        pendientes.sort((a, b) => (Math.abs(a.i - j.ci) + Math.abs(a.j - j.cj)) - (Math.abs(b.i - j.ci) + Math.abs(b.j - j.cj)));
        await this.construir(pendientes[0], gen);
      }
    } catch (e) {
      console.error("Generador de ciudad:", e);
    } finally {
      this.trabajando = false;
    }
  }

  async descargarCeldas(celdas, gen) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of celdas) {
      const l = this.limites(c.i, c.j);
      x0 = Math.min(x0, l.x0); y0 = Math.min(y0, l.y0); x1 = Math.max(x1, l.x1); y1 = Math.max(y1, l.y1);
    }
    const m = 60; // margen: calles y edificios que asoman desde fuera
    const so = this.proy.aGeo(x0 - m, y0 - m), ne = this.proy.aGeo(x1 + m, y1 + m);
    const g = Cesium.Math.toDegrees;
    if (!this.avisoInicialDado) this.alAviso("Generando las calles con OpenStreetMap…");
    try {
      const elementos = await this.descargar(g(so.lat), g(so.lon), g(ne.lat), g(ne.lon));
      if (gen !== this.generacion) return;
      this.almacen.anadir(elementos);
      celdas.forEach((c) => { c.datos = true; });
    } catch (e) {
      console.warn(e);
      if (gen !== this.generacion) return;
      celdas.forEach((c) => { c.estado = "error"; });
      this.alAviso("No se pudo descargar OpenStreetMap. Se usa la vista de Google.");
      // Reintento más tarde.
      setTimeout(() => {
        celdas.forEach((c) => { if (c.estado === "error") c.estado = "nueva"; });
      }, 20000);
    }
  }

  async construir(c, gen) {
    c.estado = "construyendo";
    this.zona.actualizar(this.almacen);
    const lim = this.limites(c.i, c.j);

    // Medimos la altura real del suelo en los ejes de las calles (antes de recortar Google aquí).
    await this.medirSuelo(lim, gen);
    if (gen !== this.generacion) return;

    const opciones = { modo: this.modo, techo: this.techo };
    const glb = await construirCelda(this.zona, lim, (x, y) => this.campo.h(x, y), opciones, this.texturas);
    if (gen !== this.generacion) return;
    if (!glb) { c.estado = "lista"; this.actualizarRecorte(); return; }

    c.url = URL.createObjectURL(new Blob([glb], { type: "model/gltf-binary" }));
    const modelo = await Cesium.Model.fromGltfAsync({
      url: c.url,
      modelMatrix: this.proy.enu,
      shadows: Cesium.ShadowMode.ENABLED,
      incrementallyLoadTextures: false,
    });
    if (gen !== this.generacion || !this.celdas.has(this.clave(c.i, c.j))) {
      URL.revokeObjectURL(c.url);
      modelo.destroy();
      return;
    }
    modelo.show = this.visible && this.activo;
    this.scene.primitives.add(modelo);
    c.modelo = modelo;
    await esperarListo(modelo);
    if (gen !== this.generacion) return;
    c.estado = "lista";
    this.actualizarRecorte();

    const listas = [...this.celdas.values()].filter((x) => x.estado === "lista").length;
    if (!this.avisoInicialDado && listas >= 4) {
      this.avisoInicialDado = true;
      this.alAviso("Calles generadas ✔");
    }
  }

  async medirSuelo(lim, gen) {
    if (!this.tileset) return;
    const puntos = [];
    const dentro = (x, y) => x >= lim.x0 && x < lim.x1 && y >= lim.y0 && y < lim.y1;
    for (const calle of this.zona.calles) {
      const P = calle.puntos;
      for (let i = 0; i < P.length - 1; i++) {
        const a = P[i], b = P[i + 1];
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        for (let s = 0; s < L; s += 15) {
          const x = a[0] + ((b[0] - a[0]) * s) / L, y = a[1] + ((b[1] - a[1]) * s) / L;
          if (dentro(x, y)) puntos.push([x, y]);
        }
      }
    }
    // Repartimos como mucho 140 muestras de suelo por la celda.
    let muestras = puntos;
    if (muestras.length > 140) {
      const paso = muestras.length / 140;
      muestras = Array.from({ length: 140 }, (_, k) => puntos[Math.floor(k * paso)]);
    }
    const nSuelo = muestras.length;
    // Y la altura real de cada edificio normal (tejado), para generarlo entero con su altura de verdad.
    const edificios = [];
    if (this.modo === "completo") {
      for (const e of this.zona.edificios) {
        if (e.emblematico || e.techoMedido !== undefined || !dentro(e.cx, e.cy)) continue;
        const pts = [[e.cx, e.cy], ...[0, Math.floor(e.anillo.length / 2)].map((i) => [
          e.cx + (e.anillo[i][0] - e.cx) * 0.4, e.cy + (e.anillo[i][1] - e.cy) * 0.4])];
        for (const [x, y] of pts) {
          if (!puntoEnPoligono(x, y, e.anillo)) continue;
          edificios.push(e);
          muestras.push([x, y]);
        }
        if (muestras.length > 700) break;
      }
    }
    if (!muestras.length) return;
    const cartos = muestras.map(([x, y]) => {
      const g = this.proy.aGeo(x, y);
      return new Cesium.Cartographic(g.lon, g.lat, 0);
    });
    const excluir = [...this.fisica.excluir, ...this.modelos(), ...this.modelosExtra()];
    try {
      const r = await this.scene.sampleHeightMostDetailed(cartos, excluir);
      if (gen !== this.generacion) return;
      this.campo.anadir(r.slice(0, nSuelo).map((c, k) => ({ x: muestras[k][0], y: muestras[k][1], h: c && c.height })));
      // Altura de cada edificio: mediana de sus muestras que estén claramente por encima del suelo
      // (si una cae en un patio interior o un árbol, se descarta).
      const porEdificio = new Map();
      r.slice(nSuelo).forEach((c, k) => {
        const e = edificios[k];
        if (!c || !Number.isFinite(c.height)) return;
        if (c.height < this.campo.h(e.cx, e.cy) + 3) return;
        if (!porEdificio.has(e)) porEdificio.set(e, []);
        porEdificio.get(e).push(c.height);
      });
      for (const [e, hs] of porEdificio) {
        hs.sort((a, b) => a - b);
        e.techoMedido = hs[Math.floor(hs.length / 2)];
      }
    } catch (e) {
      console.warn("No se pudo medir el suelo", e);
    }
  }

  modelos() {
    return [...this.celdas.values()].map((c) => c.modelo).filter(Boolean);
  }

  // ---------------------------------------------------------------- recorte de Google

  actualizarRecorte() {
    if (!this.proy || (!this.recorte && !this.recortePol)) return;
    const listas = [...this.celdas.values()].filter((c) => c.estado === "lista");
    const recorte = this.recortePol || this.recorte;
    if (!listas.length || !this.activo || !this.visible) {
      recorte.enabled = false;
      return;
    }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of listas) {
      const l = this.limites(c.i, c.j);
      x0 = Math.min(x0, l.x0); y0 = Math.min(y0, l.y0); x1 = Math.max(x1, l.x1); y1 = Math.max(y1, l.y1);
    }
    if (this.recortePol) {
      this.recortarPoligono(x0, y0, x1, y1);
      return;
    }
    const [, oeste, este, sur, norte] = [0, 1, 2, 3, 4].map((i) => this.recorte.get(i));
    oeste.distance = x0;   // conserva x < x0
    este.distance = -x1;   // conserva x > x1
    sur.distance = y0;
    norte.distance = -y1;

    const origen = Cesium.Cartesian3.fromRadians(this.proy.lon0, this.proy.lat0, this.alturaOrigen + CIUDAD.corte);
    const enuCorte = Cesium.Transforms.eastNorthUpToFixedFrame(origen);
    const inversa = Cesium.Matrix4.inverse(this.tileset.clippingPlanesOriginMatrix, new Cesium.Matrix4());
    this.recorte.modelMatrix = Cesium.Matrix4.multiply(inversa, enuCorte, new Cesium.Matrix4());
    this.recorte.enabled = true;
  }

  /** Quita de Google toda la caja generada menos los monumentos (huecos). */
  recortarPoligono(x0, y0, x1, y1) {
    const aCart = (x, y) => { const g = this.proy.aGeo(x, y); return Cesium.Cartesian3.fromRadians(g.lon, g.lat, 0); };
    const huecos = [];
    const usados = [];
    for (const h of this.zona && this.zona.emblemas ? this.zona.emblemas : []) {
      const m = 1.5; // margen alrededor del monumento
      const b = { minx: h.minx - m, miny: h.miny - m, maxx: h.maxx + m, maxy: h.maxy + m };
      if (b.minx <= x0 || b.miny <= y0 || b.maxx >= x1 || b.maxy >= y1) continue; // tiene que estar dentro
      if (usados.some((u) => b.minx < u.maxx && b.maxx > u.minx && b.miny < u.maxy && b.maxy > u.miny)) continue;
      usados.push(b);
      // Hueco = el contorno del monumento, un poco ampliado desde su centro.
      const cx = (h.minx + h.maxx) / 2, cy = (h.miny + h.maxy) / 2;
      huecos.push(h.anillo.map(([x, y]) => {
        const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy) || 1;
        return aCart(x + (dx / d) * m, y + (dy / d) * m);
      }));
    }
    const caja = [aCart(x0, y0), aCart(x1, y0), aCart(x1, y1), aCart(x0, y1)];
    this.recortePol.removeAll();
    this.recortePol.add(new Cesium.ClippingPolygon({ positions: caja, holes: huecos }));
    this.recortePol.enabled = true;
  }

  // ---------------------------------------------------------------- visibilidad

  /** Ocultar en vuelo libre (desde arriba se ve mejor la Valencia de Google completa). */
  mostrar(v) {
    this.visible = v;
    for (const c of this.celdas.values()) if (c.modelo) c.modelo.show = v && this.activo;
    this.actualizarRecorte();
  }

  /** Activar / desactivar el modo híbrido. */
  activar(v) {
    this.activo = v;
    this.mostrar(this.visible);
    if (v && !this.trabajando) this.procesar();
  }

  destruir() {
    this.generacion++;
    this.vaciar();
    if (this.tileset && !this.tileset.isDestroyed()) {
      if (this.recorte) this.recorte.enabled = false;
      if (this.recortePol) this.recortePol.enabled = false;
    }
  }
}

function esperarListo(modelo) {
  if (modelo.ready) return Promise.resolve();
  return new Promise((resolve) => {
    const quitar = modelo.readyEvent.addEventListener(() => { quitar(); resolve(); });
    // Por si acaso: no bloquear nunca más de 15 s.
    setTimeout(resolve, 15000);
  });
}
