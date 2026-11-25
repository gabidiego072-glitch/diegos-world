/**
 * COCHES APARCADOS GENERADOS: coches ligeros hechos con código (perfil lateral extruido + ruedas).
 * Van todos dentro del modelo de la celda, así que cientos de coches cuestan casi nada.
 */
import { BLANCO, ConstructorGlb } from "./constructorGlb.js";

// Colores apagados, como el tráfico de GTA IV.
const COLORES = [
  [0.08, 0.08, 0.09], [0.45, 0.46, 0.48], [0.7, 0.71, 0.7], [0.85, 0.85, 0.83], [0.12, 0.2, 0.42],
  [0.5, 0.08, 0.07], [0.14, 0.3, 0.2], [0.6, 0.5, 0.22], [0.32, 0.12, 0.24], [0.36, 0.22, 0.12],
  [0.18, 0.18, 0.2], [0.25, 0.35, 0.5],
];

// Perfiles laterales (u = largo, w = alto), sentido antihorario visto desde la izquierda del coche.
const PERFILES = {
  turismo: [[-2.2, 0.28], [2.2, 0.28], [2.25, 0.72], [1.95, 0.86], [1.05, 0.96], [0.45, 1.42], [-0.9, 1.45], [-1.7, 1.02], [-2.25, 0.95]],
  compacto: [[-1.9, 0.28], [1.9, 0.28], [1.95, 0.7], [1.6, 0.86], [0.85, 0.98], [0.3, 1.48], [-1.45, 1.5], [-1.95, 1.05]],
  furgoneta: [[-2.4, 0.3], [2.4, 0.3], [2.45, 0.8], [2.05, 1.05], [1.6, 1.85], [-2.4, 1.95]],
};
// Tramos del contorno que son cristal (índices de lado del perfil).
const CRISTALES = { turismo: [4, 5, 6], compacto: [4, 5], furgoneta: [3] };

function azar(n) {
  let x = (n | 0) ^ 0x2545f491;
  x = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d);
  x = Math.imul(x ^ (x >>> 12), 0x297a2d39);
  return ((x ^ (x >>> 15)) >>> 0) / 4294967296;
}

/** Añade un coche aparcado. (x, y) centro, z suelo, angulo de la calle, semilla para variar. */
export function cocheAparcado(g, x, y, z, angulo, semilla) {
  const r = azar(semilla);
  const tipo = r < 0.55 ? "turismo" : r < 0.85 ? "compacto" : "furgoneta";
  const color = COLORES[Math.floor(azar(semilla + 3) * COLORES.length)];
  const ancho = tipo === "furgoneta" ? 1.9 : 1.75;
  const perfil = PERFILES[tipo];
  const cristales = new Set(CRISTALES[tipo]);
  g.prisma("carroceria", perfil, ancho, x, y, z, angulo, color, (i) => (cristales.has(i) ? { clave: "cristalCoche", color: BLANCO } : null));
  // Ventanillas laterales (un poco por fuera de la carrocería).
  const c = Math.cos(angulo), s = Math.sin(angulo);
  const ventanilla = tipo === "furgoneta"
    ? [[1.55, 1.15], [1.95, 1.15], [1.6, 1.75]]
    : tipo === "turismo"
      ? [[-1.55, 1.02], [0.95, 1.0], [0.42, 1.36], [-0.85, 1.39]]
      : [[-1.75, 1.05], [0.78, 1.02], [0.28, 1.42], [-1.38, 1.44]];
  for (const lado of [1, -1]) {
    const v = (ancho / 2 + 0.01) * lado;
    const pts = ventanilla.map(([u, w]) => [x + u * c - v * s, y + u * s + v * c, z + w]);
    const n = [-s * lado, c * lado, 0];
    const gr = g.grupo("cristalCoche");
    const base = gr.pos.length / 3;
    pts.forEach((p) => g.vertice(gr, p[0], p[1], p[2], n[0], n[1], n[2], 0, 0, BLANCO));
    for (let i = 1; i < pts.length - 1; i++) {
      if (lado > 0) gr.idx.push(base, base + i + 1, base + i);
      else gr.idx.push(base, base + i, base + i + 1);
    }
  }
  // Ruedas
  const largo = Math.abs(perfil[1][0] - perfil[0][0]);
  for (const u of [largo * 0.32, -largo * 0.32]) {
    for (const lado of [1, -1]) {
      const v = (ancho / 2 - 0.12) * lado;
      g.rueda("neumatico", x + u * c - v * s, y + u * s + v * c, z + 0.33, 0.33, 0.24, angulo);
    }
  }
  // Parachoques
  for (const u of [perfil[1][0] + 0.02, perfil[0][0] - 0.02]) {
    g.caja("neumatico", x + u * c, y + u * s, z + 0.3, 0.14, ancho + 0.04, 0.24, angulo, [2.2, 2.2, 2.2]);
  }
  // Faros y pilotos
  const uf = perfil[1][0] + 0.03, ut = perfil[0][0] - 0.03;
  for (const lado of [1, -1]) {
    const v = (ancho / 2 - 0.32) * lado;
    g.caja("faroCoche", x + uf * c - v * s, y + uf * s + v * c, z + 0.6, 0.06, 0.32, 0.12, angulo);
    g.caja("pilotoCoche", x + ut * c - v * s, y + ut * s + v * c, z + 0.72, 0.06, 0.3, 0.12, angulo);
  }
}

/**
 * Modelos sueltos para el tráfico NPC: varias combinaciones de tipo y color, generadas una vez.
 * Devuelve URLs (blob:) listas para Cesium.Model.fromGltfAsync. El coche mira hacia +X (el "este" del modelo).
 */
export function crearModelosTrafico(materiales, cantidad = 10) {
  const urls = [];
  for (let v = 0; v < cantidad; v++) {
    const g = new ConstructorGlb(materiales);
    cocheAparcado(g, 0, 0, 0, 0, v * 7919 + 13);
    urls.push(URL.createObjectURL(new Blob([g.glb()], { type: "model/gltf-binary" })));
  }
  return urls;
}
