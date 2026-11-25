/**
 * CONSTRUIR CELDA: fabrica la calle jugable de un cuadrado de 200 × 200 m a partir de la Zona (OpenStreetMap).
 *   Fase 1: suelo (acera), calzadas, líneas, pasos de cebra, bordillos, plazas y zonas verdes.
 *   Fase 2: árboles, farolas, semáforos y bancos.
 *   Fase 3: bajos de los edificios (paredes y escaparates) con los letreros reales de las tiendas.
 * Nada se coloca a mano: todo sale de los datos reales o de reglas.
 */
import { ConstructorGlb, BLANCO } from "./constructorGlb.js";
import { crearAtlasLetreros, categoriaDe, PLAZAS_ATLAS } from "./texturas.js";
import { TODAS } from "./zona.js";

export const MATERIALES = {
  acera: { textura: "acera" },
  asfalto: { textura: "asfalto", rugosidad: 0.95 },
  adoquin: { textura: "adoquin" },
  cesped: { textura: "cesped" },
  bordillo: { color: [0.8, 0.79, 0.76, 1] },
  marca: { color: [0.93, 0.93, 0.9, 1], rugosidad: 0.6 },
  pared: { textura: "pared", ajustarV: true, dobleCara: true },
  escaparate: { textura: "escaparate", ajustarV: true, dobleCara: true, rugosidad: 0.4 },
  letrero: { textura: "letreros", emisivo: [0.45, 0.45, 0.45], emisivoTextura: true },
  metal: { color: [0.23, 0.24, 0.26, 1], metal: 0.5, rugosidad: 0.5 },
  madera: { color: [0.5, 0.33, 0.2, 1] },
  tronco: { color: [0.38, 0.28, 0.2, 1] },
  hojas: { color: [0.36, 0.52, 0.24, 1] },
  farol: { color: [1, 0.96, 0.82, 1], emisivo: [0.9, 0.85, 0.6] },
  luzRoja: { color: [0.9, 0.1, 0.08, 1], emisivo: [1, 0.08, 0.05] },
  luzAmbar: { color: [0.45, 0.3, 0.05, 1], emisivo: [0.15, 0.09, 0] },
  luzVerde: { color: [0.08, 0.35, 0.15, 1], emisivo: [0.02, 0.12, 0.05] },
};

// Alturas sobre el suelo (m) de cada capa, para que no se pisen entre sí.
const Z = { verde: 0.03, plaza: 0.035, peaton: 0.04, bici: 0.045, coche: 0.06, marca: 0.1, cebra: 0.105 };
const PALETA_FACHADAS = [
  [0.95, 0.91, 0.82], [0.9, 0.78, 0.6], [0.86, 0.66, 0.52], [0.97, 0.96, 0.93],
  [0.83, 0.82, 0.79], [0.96, 0.9, 0.72], [0.78, 0.84, 0.86], [0.92, 0.84, 0.78],
];
const COLOR_BICI = [0.78, 0.42, 0.38];

/** Número pseudoaleatorio estable a partir de un entero (misma calle → mismo resultado). */
function hash(n) {
  let x = (n | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/**
 * @param {import("./zona.js").Zona} zona
 * @param {{x0:number,y0:number,x1:number,y1:number}} celda   límites en metros locales
 * @param {(x:number,y:number)=>number} H   altura del suelo
 * @param {number} techo   altura absoluta hasta donde llegan los bajos (justo por encima del recorte de Google)
 * @param {object} texturas  texturas compartidas
 * @returns {Promise<Uint8Array|null>} GLB
 */
export async function construirCelda(zona, celda, H, techo, texturas) {
  const g = new ConstructorGlb(MATERIALES);
  const dentro = (x, y) => x >= celda.x0 && x < celda.x1 && y >= celda.y0 && y < celda.y1;

  sueloBase(g, celda, H);
  zonasVerdesYPlazas(g, zona, dentro, H);
  calles(g, zona, dentro, H);
  mobiliario(g, zona, dentro, H);
  const letreros = fachadas(g, zona, dentro, H, techo);

  if (g.vacio) return null;
  const imagenes = { ...texturas };
  if (letreros.length) imagenes.letreros = (await letreros.atlas).imagen;
  return g.glb(imagenes);
}

// ------------------------------------------------------------------ FASE 1

function sueloBase(g, c, H) {
  const paso = 10;
  for (let x = c.x0; x < c.x1; x += paso) {
    for (let y = c.y0; y < c.y1; y += paso) {
      const p = (px, py) => [px, py, H(px, py)];
      g.quadSuelo("acera", p(x, y), p(x + paso, y), p(x + paso, y + paso), p(x, y + paso), 2);
    }
  }
}

function centroide(anillo) {
  let x = 0, y = 0;
  for (const p of anillo) { x += p[0]; y += p[1]; }
  return [x / anillo.length, y / anillo.length];
}

function zonasVerdesYPlazas(g, zona, dentro, H) {
  for (const v of zona.verdes) {
    const [cx, cy] = centroide(v.anillo);
    if (!dentro(cx, cy)) continue;
    const color = v.tipo === "pista" ? [0.75, 0.55, 0.45] : BLANCO;
    g.poligono(v.tipo === "pista" ? "adoquin" : "cesped", v.anillo, (x, y) => H(x, y) + Z.verde, 3, color);
  }
  for (const pl of zona.plazas) {
    const [cx, cy] = centroide(pl.anillo);
    if (!dentro(cx, cy)) continue;
    g.poligono("adoquin", pl.anillo, (x, y) => H(x, y) + Z.plaza, 2.5);
  }
}

function calles(g, zona, dentro, H) {
  for (const calle of zona.calles) {
    const material = calle.clase === "coche" ? "asfalto" : calle.clase === "bici" ? "asfalto" : "adoquin";
    const color = calle.clase === "bici" ? COLOR_BICI : BLANCO;
    const dz = Z[calle.clase];
    const P = calle.puntos;
    // Distancia acumulada (para que las líneas discontinuas sigan un ritmo a lo largo de la calle).
    const acum = [0];
    for (let i = 1; i < P.length; i++) acum.push(acum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));

    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1];
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      if (!dentro(mx, my)) continue;
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
      if (L < 0.05) continue;
      const ux = dx / L, uy = dy / L, nx = -uy, ny = ux; // n = izquierda
      const hw = calle.hw;
      const q = (p, s) => [p[0] + nx * hw * s, p[1] + ny * hw * s, H(p[0], p[1]) + dz];
      g.quadSuelo(material, q(a, -1), q(b, -1), q(b, 1), q(a, 1), calle.clase === "coche" ? 4 : 2.5, color);

      if (calle.clase === "coche") {
        bordillos(g, zona, calle, a, ux, uy, nx, ny, L, H);
        marcas(g, zona, calle, a, ux, uy, nx, ny, L, acum[i], H);
      }
    }
    // Discos en los vértices: rellenan curvas y cruces.
    for (let i = 0; i < P.length; i++) {
      if (!dentro(P[i][0], P[i][1])) continue;
      g.disco(material, P[i][0], P[i][1], H(P[i][0], P[i][1]) + dz, calle.hw, calle.clase === "coche" ? 4 : 2.5, color);
    }
  }
  pasosDeCebra(g, zona, dentro, H);
}

function bordillos(g, zona, calle, a, ux, uy, nx, ny, L, H) {
  const tramo = 1.5;
  const angulo = Math.atan2(uy, ux);
  for (const lado of [-1, 1]) {
    for (let s = 0; s < L; s += tramo) {
      const largo = Math.min(tramo, L - s);
      if (largo < 0.2) continue;
      const cx = a[0] + ux * (s + largo / 2) + nx * (calle.hw + 0.12) * lado;
      const cy = a[1] + uy * (s + largo / 2) + ny * (calle.hw + 0.12) * lado;
      if (zona.dentroDeCalzada(cx, cy, calle, -0.2)) continue;   // dentro de otra calle (cruce)
      if (zona.cercaDeCruce(cx, cy, 3)) continue;               // rebaje en los pasos de cebra
      g.caja("bordillo", cx, cy, H(cx, cy) - 0.05, largo + 0.02, 0.25, 0.25, angulo);
    }
  }
}

function marcas(g, zona, calle, a, ux, uy, nx, ny, L, s0, H) {
  if (calle.ancho < 6 || calle.tipo === "service" || calle.tipo === "living_street") return;
  const lineas = []; // {offset, discontinua}
  const hw = calle.hw;
  if (calle.sentidoUnico) {
    const n = Math.max(1, Math.round(calle.carriles));
    for (let k = 1; k < n; k++) lineas.push({ o: -hw + (2 * hw * k) / n, disc: true });
  } else {
    lineas.push({ o: 0, disc: calle.carriles <= 3 });
    const porSentido = Math.max(1, Math.floor(calle.carriles / 2));
    for (let k = 1; k < porSentido; k++) {
      lineas.push({ o: (hw * k) / porSentido, disc: true });
      lineas.push({ o: (-hw * k) / porSentido, disc: true });
    }
  }
  if (["primary", "secondary", "trunk", "motorway"].includes(calle.tipo) && calle.ancho >= 8) {
    lineas.push({ o: hw - 0.4, disc: false });
    lineas.push({ o: -hw + 0.4, disc: false });
  }
  const ANCHO = 0.13, ON = 3, CICLO = 7.5;
  for (const lin of lineas) {
    let s = 0;
    while (s < L) {
      let ini = s, fin;
      if (lin.disc) {
        const fase = (s0 + s) % CICLO;
        if (fase >= ON) { s += CICLO - fase; continue; }
        fin = Math.min(L, s + (ON - fase));
      } else {
        fin = Math.min(L, s + 2);
      }
      s = fin;
      if (fin - ini < 0.3) continue;
      const mx = a[0] + ux * ((ini + fin) / 2) + nx * lin.o, my = a[1] + uy * ((ini + fin) / 2) + ny * lin.o;
      if (zona.dentroDeCalzada(mx, my, calle, 0.5) || zona.cercaDeCruce(mx, my, 3)) continue;
      const p = (t, w) => {
        const x = a[0] + ux * t + nx * (lin.o + w), y = a[1] + uy * t + ny * (lin.o + w);
        return [x, y, H(x, y) + Z.marca];
      };
      g.quadSuelo("marca", p(ini, -ANCHO / 2), p(fin, -ANCHO / 2), p(fin, ANCHO / 2), p(ini, ANCHO / 2), 1);
    }
  }
}

function direccionEnNodo(calle, i) {
  const P = calle.puntos;
  const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
  return [dx / L, dy / L];
}

function pasosDeCebra(g, zona, dentro, H) {
  for (const c of zona.cruces) {
    if (!dentro(c.x, c.y)) continue;
    const en = (zona.nodoACalles.get(c.id) || []).find((e) => e.calle.clase === "coche");
    if (!en) continue;
    const { calle, i } = en;
    const [ux, uy] = direccionEnNodo(calle, i);
    const nx = -uy, ny = ux;
    const LARGO = 3.5, ANCHO_FRANJA = 0.5;
    for (let o = -calle.hw + 0.5; o <= calle.hw - 0.5; o += 1) {
      const p = (t, w) => {
        const x = c.x + ux * t + nx * (o + w), y = c.y + uy * t + ny * (o + w);
        return [x, y, H(x, y) + Z.cebra];
      };
      g.quadSuelo("marca", p(-LARGO / 2, 0), p(LARGO / 2, 0), p(LARGO / 2, ANCHO_FRANJA), p(-LARGO / 2, ANCHO_FRANJA), 1);
    }
  }
}

// ------------------------------------------------------------------ FASE 2

function mobiliario(g, zona, dentro, H) {
  const ocupados = []; // puntos donde ya hay algo (para no amontonar)
  const libre = (x, y, r) => !ocupados.some((p) => Math.abs(p[0] - x) < r && Math.abs(p[1] - y) < r);
  const sitioValido = (x, y) => !zona.dentroDeCalzada(x, y, null, -0.6, TODAS) && !zona.edificioEn(x, y) && !zona.cercaDeCruce(x, y, 2.5);

  // Árboles: los reales de OpenStreetMap; si en la celda no hay, se plantan en las avenidas.
  const arbolesOsm = zona.arboles.filter((t) => dentro(t.x, t.y));
  const arboles = [...arbolesOsm];
  if (arbolesOsm.length < 3) {
    recorrerAceras(zona, dentro, 9, 5, 1.6, (x, y) => { if (sitioValido(x, y)) arboles.push({ x, y }); });
  }
  for (const t of arboles) {
    if (!libre(t.x, t.y, 1.2)) continue;
    ocupados.push([t.x, t.y]);
    arbol(g, t.x, t.y, H(t.x, t.y));
  }

  // Farolas: las de OpenStreetMap o, si no hay, una cada 30 m alternando aceras.
  const farolasOsm = zona.farolas.filter((f) => dentro(f.x, f.y));
  if (farolasOsm.length) {
    for (const f of farolasOsm) { farola(g, f.x, f.y, H(f.x, f.y), 0, 0); ocupados.push([f.x, f.y]); }
  } else {
    recorrerAceras(zona, dentro, 30, 3, 0.45, (x, y, haciaCalle) => {
      if (!sitioValido(x, y) || !libre(x, y, 1.5)) return;
      ocupados.push([x, y]);
      farola(g, x, y, H(x, y), haciaCalle[0], haciaCalle[1]);
    }, true);
  }

  // Semáforos reales.
  for (const s of zona.semaforos) {
    if (!dentro(s.x, s.y)) continue;
    const en = (zona.nodoACalles.get(s.id) || []).find((e) => e.calle.clase === "coche");
    if (!en) continue;
    const [ux, uy] = direccionEnNodo(en.calle, en.i);
    const hw = en.calle.hw;
    // Para los coches que vienen en el sentido de la vía: poste a su derecha, antes del cruce.
    const sentidos = en.calle.sentidoUnico ? [1] : [1, -1];
    for (const sg of sentidos) {
      const dx = ux * sg, dy = uy * sg;           // sentido de la marcha
      const rx = dy, ry = -dx;                     // derecha
      const x = s.x - dx * 2 + rx * (hw + 0.4), y = s.y - dy * 2 + ry * (hw + 0.4);
      semaforo(g, x, y, H(x, y), dx, dy);
      ocupados.push([x, y]);
    }
  }

  // Bancos reales.
  for (const b of zona.bancos) {
    if (!dentro(b.x, b.y) || zona.edificioEn(b.x, b.y)) continue;
    banco(g, b.x, b.y, H(b.x, b.y), hash(b.id) * Math.PI * 2);
  }
}

/** Recorre las aceras de las calzadas anchas cada `paso` m y llama a f(x, y, haciaCalle). */
function recorrerAceras(zona, dentro, paso, anchoMin, separacion, f, alternar = false) {
  for (const calle of zona.calles) {
    if (calle.clase !== "coche" || calle.hw < anchoMin || calle.tipo === "service") continue;
    const P = calle.puntos;
    let s = hash(calle.id) * paso, k = 0;
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1];
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
      if (L < 0.1) continue;
      const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
      for (; s < L; s += paso, k++) {
        const lados = alternar ? [k % 2 ? 1 : -1] : [-1, 1];
        for (const lado of lados) {
          const x = a[0] + ux * s + nx * (calle.hw + separacion) * lado;
          const y = a[1] + uy * s + ny * (calle.hw + separacion) * lado;
          if (dentro(x, y)) f(x, y, [-nx * lado, -ny * lado]);
        }
      }
      s -= L;
    }
  }
}

function arbol(g, x, y, z) {
  const r = hash(Math.round(x * 7) * 73856093 ^ Math.round(y * 7) * 19349663);
  const alto = 2.6 + r * 1.2;
  g.cilindro("tronco", x, y, z - 0.1, 0.13 + r * 0.06, alto + 0.6, BLANCO, 7);
  const verde = [0.85 + r * 0.25, 0.9 + r * 0.2, 0.8 + r * 0.2];
  const radio = 1.7 + r * 0.8;
  g.esfera("hojas", x, y, z + alto + radio * 0.55, radio, verde, 0.8, 9, 6);
  g.esfera("hojas", x + radio * 0.4, y - radio * 0.3, z + alto + radio * 0.9, radio * 0.7, verde, 0.85, 8, 5);
}

function farola(g, x, y, z, hx, hy) {
  g.cilindro("metal", x, y, z - 0.1, 0.07, 6.6, BLANCO, 6);
  if (hx || hy) {
    const ang = Math.atan2(hy, hx);
    g.caja("metal", x + hx * 0.7, y + hy * 0.7, z + 6.35, 1.4, 0.08, 0.08, ang);
    g.caja("farol", x + hx * 1.35, y + hy * 1.35, z + 6.2, 0.55, 0.26, 0.13, ang);
  } else {
    g.caja("farol", x, y, z + 6.5, 0.4, 0.4, 0.5, 0);
  }
}

function semaforo(g, x, y, z, dx, dy) {
  g.cilindro("metal", x, y, z - 0.1, 0.06, 3.4, BLANCO, 6);
  const ang = Math.atan2(dy, dx) + Math.PI / 2; // la cara frontal (+y local) mira hacia los coches que llegan
  g.caja("metal", x, y, z + 2.35, 0.3, 0.22, 0.95, ang);
  const fx = -dx * 0.12, fy = -dy * 0.12;
  g.caja("luzRoja", x + fx, y + fy, z + 3.02, 0.17, 0.05, 0.17, ang);
  g.caja("luzAmbar", x + fx, y + fy, z + 2.76, 0.17, 0.05, 0.17, ang);
  g.caja("luzVerde", x + fx, y + fy, z + 2.5, 0.17, 0.05, 0.17, ang);
}

function banco(g, x, y, z, ang) {
  g.caja("madera", x, y, z + 0.42, 1.6, 0.42, 0.06, ang);
  const bx = -Math.sin(ang) * 0.2, by = Math.cos(ang) * 0.2;
  g.caja("madera", x + bx, y + by, z + 0.55, 1.6, 0.05, 0.4, ang);
  for (const s of [-0.7, 0.7]) {
    g.caja("metal", x + Math.cos(ang) * s, y + Math.sin(ang) * s, z, 0.06, 0.4, 0.42, ang);
  }
}

// ------------------------------------------------------------------ FASE 3

function fachadas(g, zona, dentro, H, techo) {
  const letreros = [];
  const pendientes = []; // letreros a colocar cuando tengamos el atlas
  for (const e of zona.edificios) {
    if (!dentro(e.cx, e.cy)) continue;
    const A = e.anillo;
    const base = Math.min(...A.map((p) => H(p[0], p[1]))) - 0.3;
    const bajito = e.altura !== undefined && e.altura < 4.2;
    const arriba = bajito ? base + 0.3 + e.altura : techo;
    const tinte = PALETA_FACHADAS[Math.floor(hash(e.id) * PALETA_FACHADAS.length)];

    for (let i = 0; i < A.length; i++) {
      const a = A[i], b = A[(i + 1) % A.length];
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
      if (L < 0.3) continue;
      const n = zona.normalExterior(e, i);
      const locales = e.locales.filter((l) => l.pared === i);
      const mat = locales.length ? "escaparate" : "pared";
      const suelo = H((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      // Orden de los vértices para que la cara buena mire hacia fuera.
      // Visto desde fuera, la derecha es (-ny, nx): si a→b va hacia la derecha, el orden es a, b.
      const haciaDerecha = -dx * n[1] + dy * n[0] > 0;
      const [p, q] = haciaDerecha ? [a, b] : [b, a];
      const rep = Math.max(1, Math.round(L / 4));
      const v = (z) => 1 - (z - suelo) / 3.5;
      g.quad(mat,
        [p[0], p[1], base], [q[0], q[1], base], [q[0], q[1], arriba], [p[0], p[1], arriba],
        [n[0], n[1], 0],
        [0, v(base), rep, v(base), rep, v(arriba), 0, v(arriba)],
        mat === "pared" ? tinte : BLANCO);

      // Letreros de las tiendas de esta pared.
      let ocupadoHasta = -Infinity;
      const ordenados = locales
        .map((l) => ({ l, t: ((l.x - a[0]) * dx + (l.y - a[1]) * dy) / L }))
        .sort((m1, m2) => m1.t - m2.t);
      for (const { l, t } of ordenados) {
        const categoria = categoriaDe(l.tags);
        const texto = l.nombre || categoria.etiqueta;
        const ancho = Math.min(Math.max(1.6 + texto.length * 0.2, 1.8), 5.5, L - 0.3);
        if (ancho < 1.2) continue;
        let centro = Math.min(Math.max(t, ancho / 2 + 0.1), L - ancho / 2 - 0.1);
        if (centro - ancho / 2 < ocupadoHasta + 0.2) centro = ocupadoHasta + 0.2 + ancho / 2;
        if (centro + ancho / 2 > L) continue;
        ocupadoHasta = centro + ancho / 2;
        const ux = dx / L, uy = dy / L;
        pendientes.push({
          x: a[0] + ux * centro + n[0] * 0.09, y: a[1] + uy * centro + n[1] * 0.09,
          z: suelo + 2.78, ancho, n, indice: letreros.length,
        });
        letreros.push({ texto, categoria });
      }
    }
    if (bajito) g.poligono("bordillo", A, arriba, 4);
  }

  if (!letreros.length) return [];
  const atlas = crearAtlasLetreros(letreros);
  letreros.atlas = atlas;
  // El atlas se dibuja de forma asíncrona; las coordenadas UV se conocen ya (cuadrícula fija).
  const uvDe = (i) => {
    const cols = 2, px = (i % cols) * 512, py = Math.floor(i / cols) * 64;
    return [px / 1024, py / 1024, (px + 512) / 1024, (py + 64) / 1024];
  };
  for (const s of pendientes) {
    const ang = Math.atan2(s.n[1], s.n[0]) - Math.PI / 2; // +y local = hacia la calle
    const frente = s.indice < PLAZAS_ATLAS ? { clave: "letrero", uv: uvDe(s.indice) } : null;
    g.caja("metal", s.x, s.y, s.z, s.ancho, 0.16, 0.55, ang, BLANCO, frente);
  }
  return letreros;
}

