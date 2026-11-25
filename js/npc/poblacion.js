/**
 * POBLACIÓN (fase 4): coches y peatones NPC que se mueven por la ciudad generada.
 *  - Los coches van por su carril (a la derecha, como en España), respetan las calles de sentido
 *    único, giran en los cruces que existen de verdad y se paran si tienes el coche delante.
 *  - Los peatones pasean por las aceras y por las calles peatonales.
 * Usan el mismo "grafo" de calles de OpenStreetMap, así que funcionan en cualquier ciudad.
 */
import { MODELOS, NPC } from "../config.js";
import { aparcamiento } from "../generador/zona.js";
import { crearModelosTrafico } from "../generador/vehiculosGenerados.js";
import { MATERIALES } from "../generador/construirCelda.js";

const ARRIBA_CALZADA = 0.06;

export class Poblacion {
  /**
   * @param {Cesium.Scene} scene
   * @param {import("../generador/ciudad.js").GeneradorCiudad} ciudad
   */
  constructor(scene, ciudad) {
    this.scene = scene;
    this.ciudad = ciudad;
    this.coches = [];
    this.peatones = [];
    this.visible = true;
    this.calidad = "baja";
    this.matriz = new Cesium.Matrix4();
    this.esperaAparicion = 0;
    this.generacion = -1;
  }

  modelos() {
    return [...this.coches, ...this.peatones].map((n) => n.modelo).filter(Boolean);
  }

  ponerCalidad(nivel) { this.calidad = nivel; }

  mostrar(v) {
    this.visible = v;
    for (const n of [...this.coches, ...this.peatones]) if (n.modelo) n.modelo.show = v && n.activo;
  }

  /** Llamar en cada fotograma. `jugador`: {lon, lat} en radianes (o null). */
  actualizar(dt, jugador) {
    const c = this.ciudad;
    if (!c.proy || !c.zona || !c.zona.calles || !jugador || !c.activo || !this.visible) return;
    if (this.generacion !== c.generacion) {
      // Zona nueva: todos los NPC tienen que reaparecer.
      this.generacion = c.generacion;
      [...this.coches, ...this.peatones].forEach((n) => { n.activo = false; if (n.modelo) n.modelo.show = false; });
    }
    const p = c.proy.aLocal(jugador.lon, jugador.lat);
    this.jugador = p;

    // Crear / reciclar NPCs poco a poco (no todos en el mismo fotograma).
    this.esperaAparicion -= dt;
    if (this.esperaAparicion <= 0) {
      this.esperaAparicion = 0.25;
      this.rellenar(this.coches, NPC.coches[this.calidad] ?? 4, "coche");
      this.rellenar(this.peatones, NPC.peatones[this.calidad] ?? 10, "peaton");
    }

    for (const n of this.coches) if (n.activo) this.moverCoche(n, dt);
    for (const n of this.peatones) if (n.activo) this.moverPeaton(n, dt);
  }

  // ------------------------------------------------------------ aparición

  rellenar(lista, objetivo, tipo) {
    // Sobran: se ocultan.
    lista.forEach((n, i) => { if (i >= objetivo && n.activo) { n.activo = false; if (n.modelo) n.modelo.show = false; } });
    // Faltan o están lejos: se colocan en una calle cercana.
    for (let i = 0; i < objetivo; i++) {
      let n = lista[i];
      if (!n) {
        n = { tipo, activo: false, cargando: false, modelo: null, fase: Math.random() * 10 };
        lista.push(n);
      }
      if (n.activo && Math.hypot(n.x - this.jugador.x, n.y - this.jugador.y) < NPC.radioDesaparicion) continue;
      if (this.colocar(n)) {
        if (!n.modelo && !n.cargando) this.cargarModelo(n);
        if (n.modelo) n.modelo.show = this.visible;
        return; // uno por llamada
      }
    }
  }

  async cargarModelo(n) {
    n.cargando = true;
    try {
      // Coches: modelos ligeros generados (variados); peatones: el personaje animado.
      if (n.tipo === "coche" && !this.urlsTrafico) this.urlsTrafico = crearModelosTrafico(MATERIALES, 10);
      const url = n.tipo === "coche" ? this.urlsTrafico[Math.floor(Math.random() * this.urlsTrafico.length)] : MODELOS.peaton.url;
      const m = await Cesium.Model.fromGltfAsync({ url, shadows: Cesium.ShadowMode.ENABLED, modelMatrix: this.matrizDe(n) });
      if (n.tipo !== "coche") {
        m.color = Cesium.Color.fromHsl(Math.random(), 0.35, 0.6, 1);
        m.colorBlendMode = Cesium.ColorBlendMode.MIX;
        m.colorBlendAmount = 0.3;
        m.readyEvent.addEventListener(() => {
          m.activeAnimations.animateWhilePaused = true;
          m.activeAnimations.addAll({ loop: Cesium.ModelAnimationLoop.REPEAT, animationTime: (d) => n.fase / d });
        });
      }
      m.show = this.visible && n.activo;
      this.scene.primitives.add(m);
      n.modelo = m;
    } catch (e) {
      console.warn("No se pudo cargar un NPC", e);
    } finally {
      n.cargando = false;
    }
  }

  /** Busca un sitio válido para el NPC en una calle generada cercana. */
  colocar(n) {
    const z = this.ciudad.zona;
    const candidatas = z.calles.filter((c) => (n.tipo === "coche" ? c.clase === "coche" && c.tipo !== "service" : c.clase !== "bici"));
    if (!candidatas.length) return false;
    for (let intento = 0; intento < 12; intento++) {
      const calle = candidatas[Math.floor(Math.random() * candidatas.length)];
      const i = Math.floor(Math.random() * (calle.puntos.length - 1));
      const a = calle.puntos[i], b = calle.puntos[i + 1];
      const t = Math.random();
      const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
      const d = Math.hypot(x - this.jugador.x, y - this.jugador.y);
      if (d < NPC.radioAparicion[0] || d > NPC.radioAparicion[1]) continue;
      const geo = this.ciudad.proy.aGeo(x, y);
      if (!this.ciudad.cubre(geo.lon, geo.lat)) continue;
      // Sentido de la marcha
      const haciaDelante = calle.sentidoUnico || Math.random() < 0.5;
      const ruta = haciaDelante ? calle.puntos.slice(i) : calle.puntos.slice(0, i + 2).reverse();
      const nodos = haciaDelante ? calle.nodos.slice(i) : calle.nodos.slice(0, i + 2).reverse();
      Object.assign(n, {
        activo: true, calle, ruta, nodos, k: 0, adelante: haciaDelante,
        s: haciaDelante ? Math.hypot(x - a[0], y - a[1]) : Math.hypot(x - b[0], y - b[1]),
        vel: n.tipo === "coche" ? 6 : 1.3,
        velObjetivo: n.tipo === "coche" ? velocidadCalle(calle) : 1.1 + Math.random() * 0.5,
        lado: Math.random() < 0.5 ? 1 : -1,
        carril: Math.floor(Math.random() * Math.max(1, calle.carriles)),
        angulo: undefined,
      });
      this.posicionar(n);
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------ movimiento

  moverCoche(n, dt) {
    // ¿Hay alguien delante? (el jugador u otro coche)
    const [dx, dy] = this.direccion(n);
    let bloqueado = this.delante(n, this.jugador, dx, dy, 10, 2.2);
    if (!bloqueado) for (const o of this.coches) if (o !== n && o.activo && this.delante(n, o, dx, dy, 8, 1.8)) { bloqueado = true; break; }
    const objetivo = bloqueado ? 0 : n.velObjetivo;
    n.vel += Cesium.Math.clamp(objetivo - n.vel, -9 * dt, 3 * dt);
    this.avanzar(n, n.vel * dt);
  }

  moverPeaton(n, dt) {
    const [dx, dy] = this.direccion(n);
    const bloqueado = this.delante(n, this.jugador, dx, dy, 1.8, 0.8);
    const objetivo = bloqueado ? 0 : n.velObjetivo;
    n.vel += Cesium.Math.clamp(objetivo - n.vel, -4 * dt, 2 * dt);
    n.fase += (n.vel / 1.7) * dt;
    this.avanzar(n, n.vel * dt);
  }

  delante(n, o, dx, dy, distancia, ancho) {
    const rx = o.x - n.x, ry = o.y - n.y;
    const adelante = rx * dx + ry * dy;
    const lateral = Math.abs(-rx * dy + ry * dx);
    return adelante > 0 && adelante < distancia && lateral < ancho;
  }

  direccion(n) {
    const a = n.ruta[n.k], b = n.ruta[n.k + 1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
  }

  avanzar(n, distancia) {
    n.s += distancia;
    let vueltas = 0;
    while (vueltas++ < 20) {
      const a = n.ruta[n.k], b = n.ruta[n.k + 1];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (n.s <= L) break;
      n.s -= L;
      n.k++;
      if (n.k >= n.ruta.length - 1) {
        if (!this.siguienteCalle(n)) { n.activo = false; if (n.modelo) n.modelo.show = false; return; }
      }
    }
    this.posicionar(n);
    const geo = this.ciudad.proy.aGeo(n.x, n.y);
    if (!this.ciudad.cubre(geo.lon, geo.lat)) { n.activo = false; if (n.modelo) n.modelo.show = false; }
  }

  /** Al llegar al final de una calle, elige otra que salga del mismo cruce. */
  siguienteCalle(n) {
    const z = this.ciudad.zona;
    const nodo = n.nodos[n.nodos.length - 1];
    const anterior = n.ruta[n.ruta.length - 2];
    const opciones = [];
    for (const { calle, i } of z.nodoACalles.get(nodo) || []) {
      if (n.tipo === "coche" ? calle.clase !== "coche" || calle.tipo === "service" : calle.clase === "bici") continue;
      if (i < calle.puntos.length - 1) opciones.push({ calle, adelante: true, ruta: calle.puntos.slice(i), nodos: calle.nodos.slice(i) });
      if (i > 0 && (n.tipo === "peaton" || !calle.sentidoUnico)) {
        opciones.push({ calle, adelante: false, ruta: calle.puntos.slice(0, i + 1).reverse(), nodos: calle.nodos.slice(0, i + 1).reverse() });
      }
    }
    // No dar media vuelta si hay otra opción.
    const sinVolver = opciones.filter((o) => Math.hypot(o.ruta[1][0] - anterior[0], o.ruta[1][1] - anterior[1]) > 0.5);
    const lista = sinVolver.length ? sinVolver : opciones;
    if (!lista.length) return false;
    const o = lista[Math.floor(Math.random() * lista.length)];
    const mediaVuelta = !sinVolver.length;
    Object.assign(n, { calle: o.calle, ruta: o.ruta, nodos: o.nodos, k: 0, adelante: o.adelante });
    if (n.tipo === "coche") n.velObjetivo = velocidadCalle(o.calle);
    if (mediaVuelta && n.tipo === "peaton") n.lado = -n.lado; // seguir en la misma acera
    n.carril = Math.min(n.carril, Math.max(0, o.calle.carriles - 1));
    return true;
  }

  /** Calcula x, y, z y orientación a partir de la ruta y aplica la matriz al modelo. */
  posicionar(n) {
    const a = n.ruta[n.k], b = n.ruta[n.k + 1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
    const rx = uy, ry = -ux; // derecha
    const c = n.calle;
    let desplazamiento;
    if (n.tipo === "coche") {
      // Carriles libres: sin pisar los coches aparcados.
      const ap = aparcamiento(c);
      const derecha = n.adelante ? ap.der : ap.izq, izquierda = n.adelante ? ap.izq : ap.der;
      let lo, hi;
      if (c.sentidoUnico) { lo = -c.hw + (izquierda ? 2.3 : 0.4); hi = c.hw - (derecha ? 2.3 : 0.4); }
      else { lo = 0.3; hi = c.hw - (derecha ? 2.3 : 0.3); }
      if (hi < lo) hi = lo;
      const carriles = Math.max(1, Math.round((hi - lo) / 3.1));
      const k = Math.min(n.carril, carriles - 1);
      desplazamiento = lo + ((hi - lo) / carriles) * (k + 0.5);
    } else {
      desplazamiento = c.clase === "coche" ? (c.hw + 1.1) * n.lado : c.clase === "peaton" && c.hw > 2 ? c.hw * 0.5 * n.lado : 0;
    }
    n.x = a[0] + ux * n.s + rx * desplazamiento;
    n.y = a[1] + uy * n.s + ry * desplazamiento;
    const objetivo = Math.atan2(uy, ux);
    if (n.angulo === undefined) n.angulo = objetivo;
    else n.angulo += Math.atan2(Math.sin(objetivo - n.angulo), Math.cos(objetivo - n.angulo)) * 0.2;
    n.z = this.ciudad.campo.h(n.x, n.y) + (n.tipo === "coche" ? ARRIBA_CALZADA : 0);
    if (n.modelo) this.ciudad.proy.matrizObjeto(n.x, n.y, n.z, n.angulo, n.modelo.modelMatrix);
  }

  matrizDe(n) {
    return this.ciudad.proy.matrizObjeto(n.x ?? 0, n.y ?? 0, n.z ?? 0, n.angulo ?? 0, new Cesium.Matrix4());
  }

  destruir() {
    for (const n of [...this.coches, ...this.peatones]) {
      if (n.modelo && !n.modelo.isDestroyed()) this.scene.primitives.remove(n.modelo);
    }
    this.coches = [];
    this.peatones = [];
  }
}

function velocidadCalle(calle) {
  const kmh = { primary: 45, secondary: 40, tertiary: 35, trunk: 50, residential: 28, living_street: 15, unclassified: 30 }[calle.tipo] ?? 30;
  return (kmh * (0.8 + Math.random() * 0.3)) / 3.6;
}
