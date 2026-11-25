/**
 * CONSTRUCTOR DE GLB: crea modelos 3D (formato glTF binario) desde código.
 * Se usa para fabricar calles, aceras, fachadas, árboles, farolas… y dárselos a Cesium.
 *
 * Coordenadas de entrada: metros locales x = este, y = norte, z = arriba.
 * (glTF usa "Y arriba"; aquí se hace la conversión para que Cesium lo coloque bien.)
 */
export class ConstructorGlb {
  /**
   * @param {Object<string, object>} materiales  clave → { color:[r,g,b,a], textura?: string, emisivo?:[r,g,b],
   *        metal?:number, rugosidad?:number, dobleCara?:bool, ajustarV?:bool }
   */
  constructor(materiales) {
    this.materiales = materiales;
    this.grupos = new Map();
  }

  grupo(clave) {
    let g = this.grupos.get(clave);
    if (!g) {
      g = { pos: [], nor: [], uv: [], col: [], idx: [] };
      this.grupos.set(clave, g);
    }
    return g;
  }

  vertice(g, x, y, z, nx, ny, nz, u, v, c) {
    // ENU (x este, y norte, z arriba) → glTF que Cesium convierte de vuelta: (y, z, x)
    g.pos.push(y, z, x);
    g.nor.push(ny, nz, nx);
    g.uv.push(u, v);
    g.col.push(c[0], c[1], c[2]);
    return g.pos.length / 3 - 1;
  }

  /** Cuadrilátero a-b-c-d en sentido antihorario visto desde la cara buena. */
  quad(clave, a, b, c, d, n, uvs, color = BLANCO) {
    const g = this.grupo(clave);
    const i0 = this.vertice(g, a[0], a[1], a[2], n[0], n[1], n[2], uvs[0], uvs[1], color);
    const i1 = this.vertice(g, b[0], b[1], b[2], n[0], n[1], n[2], uvs[2], uvs[3], color);
    const i2 = this.vertice(g, c[0], c[1], c[2], n[0], n[1], n[2], uvs[4], uvs[5], color);
    const i3 = this.vertice(g, d[0], d[1], d[2], n[0], n[1], n[2], uvs[6], uvs[7], color);
    g.idx.push(i0, i1, i2, i0, i2, i3);
  }

  /** Cuadrilátero horizontal mirando hacia arriba, con UV según la posición (textura "del suelo"). */
  quadSuelo(clave, a, b, c, d, escalaUV, color = BLANCO) {
    const k = 1 / escalaUV;
    const uv = (p) => [p[0] * k, -p[1] * k];
    const [ua, va] = uv(a), [ub, vb] = uv(b), [uc, vc] = uv(c), [ud, vd] = uv(d);
    // asegurar orientación hacia arriba
    const cruz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (cruz >= 0) this.quad(clave, a, b, c, d, ARRIBA, [ua, va, ub, vb, uc, vc, ud, vd], color);
    else this.quad(clave, a, d, c, b, ARRIBA, [ua, va, ud, vd, uc, vc, ub, vb], color);
  }

  /** Disco horizontal (para rellenar cruces y curvas de las calles). */
  disco(clave, x, y, z, radio, escalaUV, color = BLANCO, lados = 12) {
    const g = this.grupo(clave);
    const k = 1 / escalaUV;
    const centro = this.vertice(g, x, y, z, 0, 0, 1, x * k, -y * k, color);
    const primero = g.pos.length / 3;
    for (let i = 0; i < lados; i++) {
      const a = (i / lados) * Math.PI * 2;
      const px = x + Math.cos(a) * radio, py = y + Math.sin(a) * radio;
      this.vertice(g, px, py, z, 0, 0, 1, px * k, -py * k, color);
    }
    for (let i = 0; i < lados; i++) g.idx.push(centro, primero + i, primero + ((i + 1) % lados));
  }

  /** Polígono horizontal (lista de [x,y]) triangulado, a altura z o con función de altura. */
  poligono(clave, puntos, z, escalaUV, color = BLANCO) {
    if (puntos.length < 3) return;
    let indices;
    try {
      indices = Cesium.PolygonPipeline.triangulate(puntos.map((p) => new Cesium.Cartesian2(p[0], p[1])));
    } catch {
      return;
    }
    if (!indices || !indices.length) return;
    const g = this.grupo(clave);
    const k = 1 / escalaUV;
    const base = g.pos.length / 3;
    for (const p of puntos) {
      const zz = typeof z === "function" ? z(p[0], p[1]) : z;
      this.vertice(g, p[0], p[1], zz, 0, 0, 1, p[0] * k, -p[1] * k, color);
    }
    // Asegurar que los triángulos miran hacia arriba.
    for (let i = 0; i < indices.length; i += 3) {
      const [a, b, c] = [puntos[indices[i]], puntos[indices[i + 1]], puntos[indices[i + 2]]];
      const cruz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (cruz >= 0) g.idx.push(base + indices[i], base + indices[i + 1], base + indices[i + 2]);
      else g.idx.push(base + indices[i], base + indices[i + 2], base + indices[i + 1]);
    }
  }

  /**
   * Caja: centro de la base en (x, y, z), medidas ancho (eje local x), fondo (eje local y), alto,
   * girada `angulo` radianes alrededor del eje vertical.
   * `caraFrontal` (opcional): { clave, uv:[u0,v0,u1,v1] } para la cara que mira a +y local.
   */
  caja(clave, x, y, z, ancho, fondo, alto, angulo, color = BLANCO, caraFrontal = null) {
    const c = Math.cos(angulo), s = Math.sin(angulo);
    const P = (lx, ly, lz) => [x + lx * c - ly * s, y + lx * s + ly * c, z + lz];
    const N = (nx, ny, nz) => [nx * c - ny * s, nx * s + ny * c, nz];
    const hx = ancho / 2, hy = fondo / 2;
    const uv = [0, 1, 1, 1, 1, 0, 0, 0];
    const caras = [
      [P(-hx, -hy, 0), P(hx, -hy, 0), P(hx, -hy, alto), P(-hx, -hy, alto), N(0, -1, 0), "atras"],
      [P(hx, hy, 0), P(-hx, hy, 0), P(-hx, hy, alto), P(hx, hy, alto), N(0, 1, 0), "frente"],
      [P(hx, -hy, 0), P(hx, hy, 0), P(hx, hy, alto), P(hx, -hy, alto), N(1, 0, 0), "lado"],
      [P(-hx, hy, 0), P(-hx, -hy, 0), P(-hx, -hy, alto), P(-hx, hy, alto), N(-1, 0, 0), "lado"],
      [P(-hx, -hy, alto), P(hx, -hy, alto), P(hx, hy, alto), P(-hx, hy, alto), [0, 0, 1], "arriba"],
    ];
    for (const [a, b, cc, d, n, nombre] of caras) {
      if (nombre === "frente" && caraFrontal) {
        const [u0, v0, u1, v1] = caraFrontal.uv;
        this.quad(caraFrontal.clave, a, b, cc, d, n, [u0, v1, u1, v1, u1, v0, u0, v0], BLANCO);
      } else {
        this.quad(clave, a, b, cc, d, n, uv, color);
      }
    }
  }

  /** Cilindro vertical (tronco, poste). */
  cilindro(clave, x, y, z, radio, alto, color = BLANCO, lados = 8) {
    const g = this.grupo(clave);
    for (let i = 0; i < lados; i++) {
      const a0 = (i / lados) * Math.PI * 2, a1 = ((i + 1) / lados) * Math.PI * 2;
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      const v0 = this.vertice(g, x + c0 * radio, y + s0 * radio, z, c0, s0, 0, i / lados, 1, color);
      const v1 = this.vertice(g, x + c1 * radio, y + s1 * radio, z, c1, s1, 0, (i + 1) / lados, 1, color);
      const v2 = this.vertice(g, x + c1 * radio, y + s1 * radio, z + alto, c1, s1, 0, (i + 1) / lados, 0, color);
      const v3 = this.vertice(g, x + c0 * radio, y + s0 * radio, z + alto, c0, s0, 0, i / lados, 0, color);
      g.idx.push(v0, v1, v2, v0, v2, v3);
    }
  }

  /** Esfera de pocos polígonos (copa de árbol). escalaZ < 1 la aplasta. */
  esfera(clave, x, y, z, radio, color = BLANCO, escalaZ = 1, seg = 8, anillos = 5) {
    const g = this.grupo(clave);
    const base = g.pos.length / 3;
    for (let r = 0; r <= anillos; r++) {
      const fi = (r / anillos) * Math.PI;
      for (let s = 0; s <= seg; s++) {
        const te = (s / seg) * Math.PI * 2;
        const nx = Math.sin(fi) * Math.cos(te), ny = Math.sin(fi) * Math.sin(te), nz = Math.cos(fi);
        this.vertice(g, x + nx * radio, y + ny * radio, z + nz * radio * escalaZ, nx, ny, nz, s / seg, r / anillos, color);
      }
    }
    for (let r = 0; r < anillos; r++) {
      for (let s = 0; s < seg; s++) {
        const a = base + r * (seg + 1) + s, b = a + seg + 1;
        g.idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }

  /**
   * Prisma: un perfil 2D (lista de [u, z] en sentido antihorario visto desde +v) extruido a lo ancho.
   * Se coloca con centro (x, y, z), eje u a lo largo de `angulo` y eje v a su izquierda.
   * `colorTramo(i)` permite pintar cada tramo del contorno (p. ej. cristales) con otra clave/color.
   */
  prisma(clave, perfil, ancho, x, y, z, angulo, color = BLANCO, colorTramo = null) {
    const c = Math.cos(angulo), s = Math.sin(angulo);
    const P = (u, v, w) => [x + u * c - v * s, y + u * s + v * c, z + w];
    const hv = ancho / 2;
    // Caras laterales (perfil triangulado).
    let indices;
    try {
      indices = Cesium.PolygonPipeline.triangulate(perfil.map((p) => new Cesium.Cartesian2(p[0], p[1])));
    } catch { return; }
    for (const lado of [1, -1]) {
      const g = this.grupo(clave);
      const base = g.pos.length / 3;
      const n = [-s * lado, c * lado, 0];
      for (const [u, w] of perfil) {
        const p = P(u, hv * lado, w);
        this.vertice(g, p[0], p[1], p[2], n[0], n[1], n[2], u * 0.2, w * 0.2, color);
      }
      for (let i = 0; i < indices.length; i += 3) {
        if (lado > 0) g.idx.push(base + indices[i], base + indices[i + 2], base + indices[i + 1]);
        else g.idx.push(base + indices[i], base + indices[i + 1], base + indices[i + 2]);
      }
    }
    // Contorno (techo, capó, parabrisas…).
    for (let i = 0; i < perfil.length; i++) {
      const [u0, w0] = perfil[i], [u1, w1] = perfil[(i + 1) % perfil.length];
      const du = u1 - u0, dw = w1 - w0, L = Math.hypot(du, dw) || 1;
      // normal hacia fuera del perfil antihorario: (dw, -du)
      const nu = dw / L, nw = -du / L;
      const n = [nu * c, nu * s, nw];
      const t = colorTramo ? colorTramo(i) : null;
      this.quad(t ? t.clave : clave,
        P(u0, hv, w0), P(u1, hv, w1), P(u1, -hv, w1), P(u0, -hv, w0), n,
        [0, 1, 1, 1, 1, 0, 0, 0], t ? t.color : color);
    }
  }

  /** Rueda: cilindro horizontal con el eje perpendicular a `angulo`. */
  rueda(clave, x, y, z, radio, ancho, angulo, color = BLANCO, lados = 10) {
    const c = Math.cos(angulo), s = Math.sin(angulo);
    const ax = -s, ay = c; // eje
    const g = this.grupo(clave);
    for (let i = 0; i < lados; i++) {
      const a0 = (i / lados) * Math.PI * 2, a1 = ((i + 1) / lados) * Math.PI * 2;
      const r0 = [Math.cos(a0) * c, Math.cos(a0) * s, Math.sin(a0)], r1 = [Math.cos(a1) * c, Math.cos(a1) * s, Math.sin(a1)];
      const p = (r, k) => [x + r[0] * radio + ax * ancho * k, y + r[1] * radio + ay * ancho * k, z + r[2] * radio];
      const a = p(r0, -0.5), b = p(r1, -0.5), d = p(r1, 0.5), e = p(r0, 0.5);
      const v0 = this.vertice(g, a[0], a[1], a[2], r0[0], r0[1], r0[2], 0, 0, color);
      const v1 = this.vertice(g, b[0], b[1], b[2], r1[0], r1[1], r1[2], 1, 0, color);
      const v2 = this.vertice(g, d[0], d[1], d[2], r1[0], r1[1], r1[2], 1, 1, color);
      const v3 = this.vertice(g, e[0], e[1], e[2], r0[0], r0[1], r0[2], 0, 1, color);
      g.idx.push(v0, v2, v1, v0, v3, v2);
      for (const k of [-0.5, 0.5]) {
        const cc = this.vertice(g, x + ax * ancho * k, y + ay * ancho * k, z, ax * Math.sign(k), ay * Math.sign(k), 0, 0.5, 0.5, color);
        const q0 = p(r0, k), q1 = p(r1, k);
        const i0 = this.vertice(g, q0[0], q0[1], q0[2], ax * Math.sign(k), ay * Math.sign(k), 0, 0, 0, color);
        const i1 = this.vertice(g, q1[0], q1[1], q1[2], ax * Math.sign(k), ay * Math.sign(k), 0, 1, 0, color);
        if (k > 0) g.idx.push(cc, i0, i1); else g.idx.push(cc, i1, i0);
      }
    }
  }

  get vacio() {
    for (const g of this.grupos.values()) if (g.idx.length) return false;
    return true;
  }

  /**
   * Genera el archivo GLB.
   * @param {Object<string, {bytes?: Uint8Array, mime?: string, uri?: string}>} imagenes  texturas por nombre
   */
  glb(imagenes = {}) {
    const json = {
      asset: { version: "2.0", generator: "Diego's World - generador de ciudad" },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0 }],
      meshes: [{ primitives: [] }],
      materials: [],
      accessors: [],
      bufferViews: [],
      buffers: [],
      textures: [],
      images: [],
      samplers: [
        { magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 },
        { magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 33071 },
      ],
    };
    const trozos = [];
    let largo = 0;
    const anadirVista = (bytes, objetivo) => {
      const relleno = (4 - (largo % 4)) % 4;
      if (relleno) { trozos.push(new Uint8Array(relleno)); largo += relleno; }
      json.bufferViews.push({ buffer: 0, byteOffset: largo, byteLength: bytes.byteLength, ...(objetivo ? { target: objetivo } : {}) });
      trozos.push(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
      largo += bytes.byteLength;
      return json.bufferViews.length - 1;
    };

    const texturaDe = new Map();
    const indiceTextura = (nombre, ajustarV) => {
      const clave = nombre + (ajustarV ? ":v" : "");
      if (texturaDe.has(clave)) return texturaDe.get(clave);
      const img = imagenes[nombre];
      if (!img) return undefined;
      let indiceImagen = json.images.findIndex((i) => i.name === nombre);
      if (indiceImagen < 0) {
        // Imagen compartida por URL (Cesium la carga una vez y la reutiliza en todos los modelos)
        // o incrustada dentro del GLB.
        if (img.uri) json.images.push({ name: nombre, uri: img.uri });
        else json.images.push({ name: nombre, mimeType: img.mime, bufferView: anadirVista(img.bytes) });
        indiceImagen = json.images.length - 1;
      }
      json.textures.push({ source: indiceImagen, sampler: ajustarV ? 1 : 0 });
      texturaDe.set(clave, json.textures.length - 1);
      return json.textures.length - 1;
    };

    for (const [clave, g] of this.grupos) {
      if (!g.idx.length) continue;
      const m = this.materiales[clave] || {};
      const mat = {
        name: clave,
        pbrMetallicRoughness: {
          baseColorFactor: m.color || [1, 1, 1, 1],
          metallicFactor: m.metal ?? 0,
          roughnessFactor: m.rugosidad ?? 0.9,
        },
        doubleSided: !!m.dobleCara,
      };
      if (m.textura) {
        const t = indiceTextura(m.textura, m.ajustarV);
        if (t !== undefined) mat.pbrMetallicRoughness.baseColorTexture = { index: t };
        if (t !== undefined && m.emisivoTextura) mat.emissiveTexture = { index: t };
      }
      if (m.emisivo) mat.emissiveFactor = m.emisivo;
      json.materials.push(mat);

      const pos = new Float32Array(g.pos);
      const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < pos.length; i += 3) {
        for (let k = 0; k < 3; k++) {
          if (pos[i + k] < min[k]) min[k] = pos[i + k];
          if (pos[i + k] > max[k]) max[k] = pos[i + k];
        }
      }
      const acc = (bytes, tipo, comp, n, extra = {}) => {
        json.accessors.push({ bufferView: anadirVista(bytes, tipo === "SCALAR" ? 34963 : 34962), componentType: comp, count: n, type: tipo, ...extra });
        return json.accessors.length - 1;
      };
      const nV = pos.length / 3;
      const prim = {
        attributes: {
          POSITION: acc(pos, "VEC3", 5126, nV, { min, max }),
          NORMAL: acc(new Float32Array(g.nor), "VEC3", 5126, nV),
          TEXCOORD_0: acc(new Float32Array(g.uv), "VEC2", 5126, nV),
          COLOR_0: acc(new Float32Array(g.col), "VEC3", 5126, nV),
        },
        indices: acc(new Uint32Array(g.idx), "SCALAR", 5125, g.idx.length),
        material: json.materials.length - 1,
      };
      json.meshes[0].primitives.push(prim);
    }
    if (!json.textures.length) { delete json.textures; delete json.images; delete json.samplers; }

    const relleno = (4 - (largo % 4)) % 4;
    if (relleno) { trozos.push(new Uint8Array(relleno)); largo += relleno; }
    json.buffers.push({ byteLength: largo });

    let textoJson = new TextEncoder().encode(JSON.stringify(json));
    const rellenoJson = (4 - (textoJson.length % 4)) % 4;
    if (rellenoJson) {
      const t = new Uint8Array(textoJson.length + rellenoJson);
      t.set(textoJson);
      t.fill(0x20, textoJson.length);
      textoJson = t;
    }
    const total = 12 + 8 + textoJson.length + 8 + largo;
    const salida = new Uint8Array(total);
    const dv = new DataView(salida.buffer);
    dv.setUint32(0, 0x46546c67, true);
    dv.setUint32(4, 2, true);
    dv.setUint32(8, total, true);
    dv.setUint32(12, textoJson.length, true);
    dv.setUint32(16, 0x4e4f534a, true);
    salida.set(textoJson, 20);
    let o = 20 + textoJson.length;
    dv.setUint32(o, largo, true);
    dv.setUint32(o + 4, 0x004e4942, true);
    o += 8;
    for (const t of trozos) { salida.set(t, o); o += t.byteLength; }
    return salida;
  }
}

export const BLANCO = [1, 1, 1];
const ARRIBA = [0, 0, 1];
