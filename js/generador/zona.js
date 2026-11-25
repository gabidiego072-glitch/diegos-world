/**
 * ZONA: interpreta los datos de OpenStreetMap y los pasa a metros locales.
 * Aquí se decide qué es cada cosa: calzada para coches, calle peatonal, carril bici,
 * edificio, local comercial, árbol, semáforo, paso de cebra…
 */
const TIPOS_COCHE = new Set([
  "motorway", "trunk", "primary", "secondary", "tertiary", "unclassified", "residential", "living_street",
  "service", "busway", "road", "motorway_link", "trunk_link", "primary_link", "secondary_link", "tertiary_link",
]);
const TIPOS_PEATON = new Set(["pedestrian", "footway", "path", "steps", "track", "bridleway"]);
const ANCHO_POR_TIPO = {
  motorway: 14, trunk: 14, primary: 14, secondary: 11, tertiary: 9, unclassified: 7, residential: 7,
  living_street: 5.5, service: 4.5, busway: 4, road: 7, pedestrian: 7, footway: 2.6, path: 2.2,
  steps: 2.5, track: 3, bridleway: 2.5, cycleway: 2.2,
};
const AMENIDADES_LOCAL = new Set([
  "restaurant", "cafe", "bar", "pub", "fast_food", "ice_cream", "pharmacy", "bank", "clinic", "dentist", "doctors",
  "cinema", "theatre", "casino", "language_school", "bureau_de_change", "post_office", "nightclub", "library",
  "veterinary", "car_rental", "biergarten", "food_court", "driving_school", "money_transfer",
]);

const TAM_INDICE = 25; // metros por casilla del índice espacial

function numero(v) {
  if (v === undefined) return undefined;
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

function enSuperficie(t) {
  if (t.tunnel && t.tunnel !== "no") return false;
  if (t.location === "underground" || t.indoor === "yes") return false;
  const capa = numero(t.layer);
  return !(capa !== undefined && capa < 0);
}

export class Zona {
  constructor(proyeccion) {
    this.p = proyeccion;
    this.version = -1;
  }

  /** Reconstruye las listas si el almacén tiene datos nuevos. */
  actualizar(almacen) {
    if (almacen.version === this.version) return false;
    this.version = almacen.version;
    const p = this.p;
    const loc = (g) => { const v = p.aLocalGrados(g.lon, g.lat); return [v.x, v.y]; };

    this.calles = [];
    this.edificios = [];
    this.verdes = [];
    this.plazas = [];
    this.arboles = [];
    this.farolas = [];
    this.semaforos = [];
    this.cruces = [];
    this.bancos = [];
    this.locales = [];
    this.indiceSeg = new Map();
    this.indiceEdif = new Map();
    this.nodoACalles = new Map();

    for (const w of almacen.vias.values()) {
      const t = w.tags || {};
      const puntos = w.geometry.map(loc);
      const cerrada = w.nodes && w.nodes.length > 3 && w.nodes[0] === w.nodes[w.nodes.length - 1];

      if (t.highway && enSuperficie(t)) {
        if (cerrada && (t.area === "yes" || t.highway === "pedestrian") && t.highway !== "footway") {
          if (t.highway === "pedestrian" || t.area === "yes") this.plazas.push({ anillo: puntos.slice(0, -1) });
          if (t.area === "yes") continue;
        }
        if (t.footway === "sidewalk" || t.footway === "crossing" || t.cycleway === "crossing") continue;
        if (t.highway === "construction" || t.highway === "proposed" || t.highway === "platform") continue;
        let clase = null;
        if (TIPOS_COCHE.has(t.highway)) clase = "coche";
        else if (TIPOS_PEATON.has(t.highway)) clase = "peaton";
        else if (t.highway === "cycleway") clase = "bici";
        if (!clase) continue;
        const carriles = numero(t.lanes);
        let ancho = numero(t.width);
        if (!ancho && carriles && clase === "coche") ancho = carriles * 3.2;
        if (!ancho) ancho = ANCHO_POR_TIPO[t.highway] ?? 5;
        ancho = Math.min(Math.max(ancho, 1.5), 30);
        const calle = {
          id: w.id, tipo: t.highway, clase, ancho, hw: ancho / 2,
          carriles: carriles || (ancho >= 9 ? 2 : 1),
          sentidoUnico: t.oneway === "yes" || t.oneway === "1" || t.junction === "roundabout" || t.highway.endsWith("motorway"),
          puente: t.bridge && t.bridge !== "no",
          puntos, nodos: w.nodes || [], nombre: t.name,
        };
        this.calles.push(calle);
        for (let i = 0; i < puntos.length - 1; i++) {
          this.indexarSegmento({ calle, i, a: puntos[i], b: puntos[i + 1], hw: calle.hw });
        }
        calle.nodos.forEach((id, i) => {
          if (!this.nodoACalles.has(id)) this.nodoACalles.set(id, []);
          this.nodoACalles.get(id).push({ calle, i });
        });
        continue;
      }

      if (t["area:highway"] && cerrada) { this.plazas.push({ anillo: puntos.slice(0, -1) }); continue; }

      if (t.building && t.building !== "no" && t.building !== "roof" && cerrada && enSuperficie(t)) {
        const anillo = puntos.slice(0, -1);
        let area = 0, cx = 0, cy = 0;
        for (let i = 0; i < anillo.length; i++) {
          const [x1, y1] = anillo[i], [x2, y2] = anillo[(i + 1) % anillo.length];
          const f = x1 * y2 - x2 * y1;
          area += f; cx += (x1 + x2) * f; cy += (y1 + y2) * f;
        }
        area /= 2;
        if (Math.abs(area) < 4) continue;
        cx /= 6 * area; cy /= 6 * area;
        const xs = anillo.map((q) => q[0]), ys = anillo.map((q) => q[1]);
        const edif = {
          id: w.id, anillo, antihorario: area > 0, area: Math.abs(area), cx, cy,
          minx: Math.min(...xs), maxx: Math.max(...xs), miny: Math.min(...ys), maxy: Math.max(...ys),
          altura: numero(t.height) ?? (numero(t["building:levels"]) ? numero(t["building:levels"]) * 3.2 : undefined),
          tags: t, locales: [],
        };
        this.edificios.push(edif);
        this.indexar(this.indiceEdif, edif.minx, edif.miny, edif.maxx, edif.maxy, edif);
        continue;
      }

      if (cerrada && (/park|garden|playground|pitch/.test(t.leisure || "") || /grass|recreation_ground|village_green/.test(t.landuse || ""))) {
        this.verdes.push({ anillo: puntos.slice(0, -1), tipo: t.leisure === "pitch" ? "pista" : "cesped" });
      }
    }

    for (const n of almacen.nodos.values()) {
      const t = n.tags || {};
      const [x, y] = loc(n);
      if (t.natural === "tree") this.arboles.push({ x, y });
      else if (t.highway === "street_lamp") this.farolas.push({ x, y });
      else if (t.highway === "traffic_signals") this.semaforos.push({ x, y, id: n.id });
      else if (t.highway === "crossing" && t.crossing !== "unmarked" && t.crossing !== "no" && t.crossing_ref !== "none") this.cruces.push({ x, y, id: n.id });
      else if (t.amenity === "bench") this.bancos.push({ x, y, id: n.id });
      if ((t.shop && t.shop !== "vacant") || AMENIDADES_LOCAL.has(t.amenity) || t.tourism === "hotel" || t.tourism === "hostel") {
        this.locales.push({ x, y, tags: t, nombre: t["name:es"] || t.name || t.brand, id: n.id });
      }
    }
    this.indiceCruces = new Map();
    for (const c of this.cruces) this.indexar(this.indiceCruces, c.x - 6, c.y - 6, c.x + 6, c.y + 6, c);
    this.asignarLocales();
    return true;
  }

  clave(i, j) { return i + "," + j; }

  indexar(indice, minx, miny, maxx, maxy, objeto) {
    for (let i = Math.floor(minx / TAM_INDICE); i <= Math.floor(maxx / TAM_INDICE); i++) {
      for (let j = Math.floor(miny / TAM_INDICE); j <= Math.floor(maxy / TAM_INDICE); j++) {
        const k = this.clave(i, j);
        if (!indice.has(k)) indice.set(k, []);
        indice.get(k).push(objeto);
      }
    }
  }

  indexarSegmento(s) {
    const m = s.hw + 1;
    this.indexar(this.indiceSeg, Math.min(s.a[0], s.b[0]) - m, Math.min(s.a[1], s.b[1]) - m, Math.max(s.a[0], s.b[0]) + m, Math.max(s.a[1], s.b[1]) + m, s);
  }

  cercanos(indice, x, y) {
    return indice.get(this.clave(Math.floor(x / TAM_INDICE), Math.floor(y / TAM_INDICE))) || [];
  }

  /** ¿El punto está sobre alguna calzada (para coches) distinta de `excluir`? */
  dentroDeCalzada(x, y, excluirCalle = null, margen = 0, clases = SOLO_COCHE) {
    for (const s of this.cercanos(this.indiceSeg, x, y)) {
      if (s.calle === excluirCalle || !clases.has(s.calle.clase)) continue;
      if (distanciaSegmento(x, y, s.a, s.b) < s.hw - margen) return true;
    }
    return false;
  }

  /** ¿Hay un paso de cebra a menos de `r` metros? */
  cercaDeCruce(x, y, r) {
    for (const c of this.cercanos(this.indiceCruces, x, y)) if (Math.hypot(c.x - x, c.y - y) < r) return true;
    return false;
  }

  /** Edificio que contiene el punto (o null). */
  edificioEn(x, y) {
    for (const e of this.cercanos(this.indiceEdif, x, y)) {
      if (x < e.minx || x > e.maxx || y < e.miny || y > e.maxy) continue;
      if (puntoEnPoligono(x, y, e.anillo)) return e;
    }
    return null;
  }

  /** Reparte los locales comerciales en la pared del edificio más cercana (para el escaparate y el letrero). */
  asignarLocales() {
    for (const l of this.locales) {
      let edif = this.edificioEn(l.x, l.y);
      let mejor = null;
      const candidatos = edif ? [edif] : this.cercanos(this.indiceEdif, l.x, l.y);
      for (const e of candidatos) {
        for (let i = 0; i < e.anillo.length; i++) {
          const a = e.anillo[i], b = e.anillo[(i + 1) % e.anillo.length];
          const d = distanciaSegmento(l.x, l.y, a, b);
          // Preferimos paredes que dan a la calle (no medianeras).
          const fuera = this.normalExterior(e, i);
          const mx = (a[0] + b[0]) / 2 + fuera[0] * 4, my = (a[1] + b[1]) / 2 + fuera[1] * 4;
          const penal = this.edificioEn(mx, my) ? 25 : 0;
          if (!mejor || d + penal < mejor.d) mejor = { e, i, d: d + penal };
        }
      }
      if (mejor && mejor.d < 30) {
        mejor.e.locales.push({ ...l, pared: mejor.i });
      }
    }
  }

  normalExterior(e, i) {
    const a = e.anillo[i], b = e.anillo[(i + 1) % e.anillo.length];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    return e.antihorario ? [dy / l, -dx / l] : [-dy / l, dx / l];
  }
}

export const SOLO_COCHE = new Set(["coche"]);
export const TODAS = new Set(["coche", "peaton", "bici"]);

export function distanciaSegmento(x, y, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((x - a[0]) * dx + (y - a[1]) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy));
}

export function puntoEnPoligono(x, y, anillo) {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i], [xj, yj] = anillo[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}
