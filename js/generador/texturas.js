/**
 * TEXTURAS PROCEDURALES: se dibujan con código (canvas) al arrancar. No hay que descargar imágenes.
 *   asfalto, acera (baldosa), adoquin (plazas), cesped, pared (planta baja), escaparate (tienda)
 * y un "atlas" de letreros con los nombres reales de las tiendas.
 */

/** Generador pseudoaleatorio con semilla (las texturas salen siempre iguales). */
function aleatorio(semilla) {
  let s = semilla >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function lienzo(ancho, alto = ancho) {
  const c = document.createElement("canvas");
  c.width = ancho;
  c.height = alto;
  return [c, c.getContext("2d")];
}

function ruido(ctx, w, h, cantidad, base, variacion, alfa, semilla, tam = 2) {
  const r = aleatorio(semilla);
  for (let i = 0; i < cantidad; i++) {
    const v = base + (r() - 0.5) * variacion;
    ctx.fillStyle = `rgba(${v | 0},${v | 0},${v | 0},${alfa})`;
    ctx.fillRect(r() * w, r() * h, tam * (0.5 + r()), tam * (0.5 + r()));
  }
}

async function aBytes(canvas, mime = "image/jpeg") {
  const blob = await new Promise((res) => canvas.toBlob(res, mime, 0.88));
  return { bytes: new Uint8Array(await blob.arrayBuffer()), mime };
}

function texturaAsfalto() {
  const [c, x] = lienzo(512);
  x.fillStyle = "#3b3d40";
  x.fillRect(0, 0, 512, 512);
  ruido(x, 512, 512, 26000, 70, 60, 0.35, 1, 2);
  ruido(x, 512, 512, 3000, 120, 40, 0.25, 2, 1.5);
  // manchas y parches
  const r = aleatorio(3);
  for (let i = 0; i < 14; i++) {
    x.fillStyle = `rgba(20,20,22,${0.08 + r() * 0.1})`;
    x.beginPath();
    x.ellipse(r() * 512, r() * 512, 20 + r() * 60, 10 + r() * 40, r() * 3, 0, Math.PI * 2);
    x.fill();
  }
  return c;
}

function texturaAcera() {
  // Baldosa gris-beige de 33 cm con relieve de botones (típica de Valencia). La textura cubre 2 m.
  const [c, x] = lienzo(512);
  x.fillStyle = "#b9b2a6";
  x.fillRect(0, 0, 512, 512);
  const n = 6, t = 512 / n;
  const r = aleatorio(7);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const v = 175 + (r() - 0.5) * 22;
      x.fillStyle = `rgb(${v},${v - 6},${v - 16})`;
      x.fillRect(i * t + 2, j * t + 2, t - 4, t - 4);
      x.fillStyle = "rgba(0,0,0,0.07)";
      for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
        x.beginPath();
        x.arc(i * t + t * (a + 0.5) / 4, j * t + t * (b + 0.5) / 4, t * 0.07, 0, Math.PI * 2);
        x.fill();
      }
    }
  }
  ruido(x, 512, 512, 9000, 120, 80, 0.12, 8, 2);
  return c;
}

function texturaAdoquin() {
  const [c, x] = lienzo(512);
  x.fillStyle = "#8f877b";
  x.fillRect(0, 0, 512, 512);
  const r = aleatorio(11);
  const filas = 10, alto = 512 / filas;
  for (let f = 0; f < filas; f++) {
    const ancho = alto * 1.9;
    const desfase = (f % 2) * ancho * 0.5;
    for (let px = -ancho; px < 512 + ancho; px += ancho) {
      const v = 165 + (r() - 0.5) * 35;
      x.fillStyle = `rgb(${v},${v - 8},${v - 20})`;
      x.fillRect(px + desfase + 2, f * alto + 2, ancho - 4, alto - 4);
    }
  }
  ruido(x, 512, 512, 8000, 110, 70, 0.12, 12, 2);
  return c;
}

function texturaCesped() {
  const [c, x] = lienzo(256);
  x.fillStyle = "#4f7a35";
  x.fillRect(0, 0, 256, 256);
  const r = aleatorio(21);
  for (let i = 0; i < 9000; i++) {
    const g = 90 + r() * 70;
    x.fillStyle = `rgba(${40 + r() * 40},${g},${30 + r() * 20},0.5)`;
    x.fillRect(r() * 256, r() * 256, 1.5, 3 + r() * 3);
  }
  return c;
}

/** Planta baja sin tienda: zócalo, portal de madera y ventana con reja. Cubre 4 m × 3,5 m. Se tiñe con el color de la fachada. */
function texturaPared() {
  const [c, x] = lienzo(512, 448);
  x.fillStyle = "#f2f0ec";
  x.fillRect(0, 0, 512, 448);
  ruido(x, 512, 448, 12000, 200, 60, 0.12, 31, 2);
  // zócalo de piedra
  x.fillStyle = "#9c968c";
  x.fillRect(0, 384, 512, 64);
  x.strokeStyle = "rgba(0,0,0,0.2)";
  for (let i = 0; i < 512; i += 64) x.strokeRect(i, 384, 64, 64);
  // portal
  x.fillStyle = "#4a2f1d";
  x.fillRect(48, 140, 150, 244);
  x.strokeStyle = "#2c1a0e";
  x.lineWidth = 6;
  x.strokeRect(48, 140, 150, 244);
  x.beginPath();
  x.moveTo(123, 140);
  x.lineTo(123, 384);
  x.stroke();
  x.fillStyle = "#c9a227";
  x.fillRect(108, 260, 8, 14);
  x.fillRect(130, 260, 8, 14);
  // ventana con reja
  x.fillStyle = "#2b3540";
  x.fillRect(290, 150, 160, 170);
  x.fillStyle = "rgba(160,190,220,0.25)";
  x.fillRect(290, 150, 80, 170);
  x.strokeStyle = "#1a1a1a";
  x.lineWidth = 5;
  for (let i = 300; i < 450; i += 22) { x.beginPath(); x.moveTo(i, 150); x.lineTo(i, 320); x.stroke(); }
  x.strokeRect(290, 150, 160, 170);
  // cornisa
  x.fillStyle = "rgba(0,0,0,0.12)";
  x.fillRect(0, 0, 512, 18);
  return c;
}

/** Escaparate de tienda: cristal, marco y puerta. Cubre 4 m × 3,5 m. */
function texturaEscaparate() {
  const [c, x] = lienzo(512, 448);
  x.fillStyle = "#e9e5dd";
  x.fillRect(0, 0, 512, 448);
  ruido(x, 512, 448, 8000, 200, 50, 0.1, 41, 2);
  // banda superior (aquí va el letrero)
  x.fillStyle = "#d8d2c6";
  x.fillRect(0, 0, 512, 70);
  // marco de aluminio
  x.fillStyle = "#5d6166";
  x.fillRect(14, 80, 484, 330);
  // cristales
  const grad = x.createLinearGradient(0, 80, 512, 410);
  grad.addColorStop(0, "#1f2d3a");
  grad.addColorStop(0.5, "#33495c");
  grad.addColorStop(1, "#1b2530");
  x.fillStyle = grad;
  x.fillRect(24, 90, 300, 310);
  x.fillRect(336, 90, 152, 310);
  // reflejos
  x.fillStyle = "rgba(255,255,255,0.10)";
  x.beginPath(); x.moveTo(40, 400); x.lineTo(140, 90); x.lineTo(180, 90); x.lineTo(80, 400); x.fill();
  // interior iluminado (estanterías)
  x.fillStyle = "rgba(255,220,160,0.18)";
  for (let i = 0; i < 4; i++) x.fillRect(40, 140 + i * 60, 260, 10);
  // tirador puerta
  x.fillStyle = "#c0c4c8";
  x.fillRect(350, 230, 8, 70);
  // zócalo
  x.fillStyle = "#6f6a62";
  x.fillRect(0, 410, 512, 38);
  return c;
}

/**
 * Planta de piso (para las plantas altas): una ventana-balcón valenciana con persiana.
 * Cubre 4 m de ancho × 3,2 m de alto y se repite en horizontal y vertical. Se tiñe con el color de la fachada.
 */
function texturaFachada(conBalcon, semilla) {
  const [c, x] = lienzo(512, 410);
  const r = aleatorio(semilla);
  x.fillStyle = "#f4f2ee";
  x.fillRect(0, 0, 512, 410);
  ruido(x, 512, 410, 9000, 205, 50, 0.1, semilla + 1, 2);
  // línea de forjado
  x.fillStyle = "rgba(0,0,0,0.10)";
  x.fillRect(0, 396, 512, 14);
  const vx = 176, vy = 70, vw = 160, vh = conBalcon ? 300 : 220;
  // moldura
  x.fillStyle = "rgba(255,255,255,0.55)";
  x.fillRect(vx - 14, vy - 14, vw + 28, vh + 22);
  x.fillStyle = "rgba(0,0,0,0.18)";
  x.fillRect(vx - 14, vy - 14, vw + 28, 6);
  // cristal con reflejo del cielo
  const grad = x.createLinearGradient(vx, vy, vx + vw, vy + vh);
  grad.addColorStop(0, "#5f7c96");
  grad.addColorStop(0.45, "#2c3e50");
  grad.addColorStop(1, "#1d2733");
  x.fillStyle = grad;
  x.fillRect(vx, vy, vw, vh);
  x.fillStyle = "rgba(255,255,255,0.14)";
  x.beginPath(); x.moveTo(vx, vy + vh * 0.7); x.lineTo(vx + vw * 0.6, vy); x.lineTo(vx + vw * 0.85, vy); x.lineTo(vx, vy + vh); x.fill();
  // carpintería
  x.strokeStyle = "#e8e4dc";
  x.lineWidth = 7;
  x.strokeRect(vx, vy, vw, vh);
  x.beginPath(); x.moveTo(vx + vw / 2, vy); x.lineTo(vx + vw / 2, vy + vh); x.stroke();
  // persiana enrollable (típica), bajada a una altura al azar
  const bajada = vh * (0.15 + r() * 0.5);
  const colorPersiana = r() < 0.5 ? "#2f5d3a" : "#6b4a2b";
  x.fillStyle = colorPersiana;
  x.fillRect(vx - 4, vy - 4, vw + 8, bajada);
  x.fillStyle = "rgba(0,0,0,0.18)";
  for (let yy = vy; yy < vy + bajada; yy += 9) x.fillRect(vx - 4, yy, vw + 8, 2);
  if (conBalcon) {
    // losa del balcón y barandilla de forja
    x.fillStyle = "#cfc9bd";
    x.fillRect(vx - 40, vy + vh - 4, vw + 80, 16);
    x.strokeStyle = "#1b1b1b";
    x.lineWidth = 4;
    x.strokeRect(vx - 36, vy + vh - 96, vw + 72, 92);
    for (let i = vx - 36; i <= vx + vw + 36; i += 14) { x.beginPath(); x.moveTo(i, vy + vh - 96); x.lineTo(i, vy + vh - 4); x.stroke(); }
  } else {
    x.fillStyle = "#d8d2c6";
    x.fillRect(vx - 10, vy + vh, vw + 20, 12);
  }
  return c;
}

function texturaMedianera() {
  const [c, x] = lienzo(256);
  x.fillStyle = "#ebe7e0";
  x.fillRect(0, 0, 256, 256);
  ruido(x, 256, 256, 9000, 200, 70, 0.14, 61, 2);
  return c;
}

function texturaTejado() {
  const [c, x] = lienzo(256);
  x.fillStyle = "#8d8a86";
  x.fillRect(0, 0, 256, 256);
  ruido(x, 256, 256, 14000, 140, 80, 0.3, 71, 2);
  x.strokeStyle = "rgba(0,0,0,0.12)";
  for (let i = 0; i < 256; i += 64) { x.strokeRect(i, 0, 64, 256); }
  return c;
}

/** Texturas fijas compartidas por todas las celdas. */
export async function crearTexturas() {
  const [asfalto, acera, adoquin, cesped, pared, escaparate, fachadaA, fachadaB, medianera, tejado] = await Promise.all([
    aBytes(texturaAsfalto()),
    aBytes(texturaAcera()),
    aBytes(texturaAdoquin()),
    aBytes(texturaCesped()),
    aBytes(texturaPared()),
    aBytes(texturaEscaparate()),
    aBytes(texturaFachada(true, 81)),
    aBytes(texturaFachada(false, 91)),
    aBytes(texturaMedianera()),
    aBytes(texturaTejado()),
  ]);
  return { asfalto, acera, adoquin, cesped, pared, escaparate, fachadaA, fachadaB, medianera, tejado };
}

// ---------------------------------------------------------------- letreros

/** Cómo "lee" el juego cada tipo de local de OpenStreetMap (la base de la futura IA de interiores). */
export const CATEGORIAS = [
  { si: (t) => t.amenity === "pharmacy", etiqueta: "FARMACIA", fondo: "#14934a", icono: "✚" },
  { si: (t) => t.amenity === "ice_cream" || t.shop === "ice_cream", etiqueta: "HELADERÍA", fondo: "#e0569a", icono: "🍦" },
  { si: (t) => t.amenity === "cafe", etiqueta: "CAFETERÍA", fondo: "#6b4226", icono: "☕" },
  { si: (t) => t.amenity === "bar" || t.amenity === "pub", etiqueta: "BAR", fondo: "#a4561c", icono: "🍺" },
  { si: (t) => t.amenity === "restaurant", etiqueta: "RESTAURANTE", fondo: "#8e1b1b", icono: "🍽" },
  { si: (t) => t.amenity === "fast_food", etiqueta: "COMIDA RÁPIDA", fondo: "#d35400", icono: "🍔" },
  { si: (t) => t.amenity === "bank" || t.amenity === "bureau_de_change", etiqueta: "BANCO", fondo: "#1f3c88", icono: "🏦" },
  { si: (t) => ["supermarket", "convenience", "greengrocer", "butcher"].includes(t.shop), etiqueta: "SUPERMERCADO", fondo: "#e67e22", icono: "🛒" },
  { si: (t) => ["bakery", "pastry", "confectionery"].includes(t.shop), etiqueta: "PANADERÍA", fondo: "#b9822e", icono: "🥖" },
  { si: (t) => ["clothes", "shoes", "fashion_accessories", "bag", "jewelry"].includes(t.shop), etiqueta: "MODA", fondo: "#2d2d2d", icono: "👕" },
  { si: (t) => ["hairdresser", "beauty", "cosmetics", "perfumery"].includes(t.shop), etiqueta: "BELLEZA", fondo: "#8e44ad", icono: "✂" },
  { si: (t) => ["dentist", "clinic", "doctors", "optician", "hearing_aids"].includes(t.amenity) || t.shop === "optician", etiqueta: "SALUD", fondo: "#16a085", icono: "✚" },
  { si: (t) => t.amenity === "cinema" || t.amenity === "theatre", etiqueta: "CINE", fondo: "#4a148c", icono: "🎬" },
  { si: (t) => t.tourism === "hotel" || t.tourism === "hostel", etiqueta: "HOTEL", fondo: "#0d47a1", icono: "🛏" },
  { si: (t) => !!t.shop, etiqueta: "TIENDA", fondo: "#34495e", icono: "🛍" },
  { si: () => true, etiqueta: "LOCAL", fondo: "#455a64", icono: "★" },
];

export function categoriaDe(tags) {
  return CATEGORIAS.find((c) => c.si(tags));
}

const ATLAS = 1024, SLOT_W = 512, SLOT_H = 64;
export const PLAZAS_ATLAS = (ATLAS / SLOT_W) * (ATLAS / SLOT_H); // 32 letreros por celda

/**
 * Dibuja los letreros de una celda en un atlas. Devuelve { imagen, uv(i) }.
 * @param {{texto:string, categoria:object}[]} letreros
 */
export async function crearAtlasLetreros(letreros) {
  const [c, x] = lienzo(ATLAS);
  const cols = ATLAS / SLOT_W;
  letreros.slice(0, PLAZAS_ATLAS).forEach((l, i) => {
    const px = (i % cols) * SLOT_W, py = Math.floor(i / cols) * SLOT_H;
    x.fillStyle = l.categoria.fondo;
    x.fillRect(px, py, SLOT_W, SLOT_H);
    x.fillStyle = "rgba(255,255,255,0.15)";
    x.fillRect(px, py, SLOT_W, 4);
    x.fillStyle = "#fff";
    x.textBaseline = "middle";
    x.font = "34px sans-serif";
    x.fillText(l.categoria.icono, px + 10, py + SLOT_H / 2 + 2);
    let tam = 34;
    const texto = l.texto.toUpperCase();
    x.font = `bold ${tam}px "Inter", "Segoe UI", sans-serif`;
    while (x.measureText(texto).width > SLOT_W - 70 && tam > 14) {
      tam -= 2;
      x.font = `bold ${tam}px "Inter", "Segoe UI", sans-serif`;
    }
    x.fillText(texto, px + 58, py + SLOT_H / 2 + 2, SLOT_W - 66);
  });
  const imagen = await aBytes(c, "image/png");
  return {
    imagen,
    uv(i) {
      const px = (i % cols) * SLOT_W, py = Math.floor(i / cols) * SLOT_H;
      return [px / ATLAS, py / ATLAS, (px + SLOT_W) / ATLAS, (py + SLOT_H) / ATLAS];
    },
  };
}
