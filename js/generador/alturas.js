/**
 * CAMPO DE ALTURAS: a qué altura está el suelo real en cada punto.
 * Se mide la Valencia de Google en el centro de las calles (antes de recortarla) y se filtran
 * los valores raros (copas de árboles, autobuses…). Entre medias se interpola.
 */
const TAM = 50;

export class CampoAlturas {
  constructor(alturaPorDefecto) {
    this.porDefecto = alturaPorDefecto;
    this.muestras = [];
    this.indice = new Map();
  }

  clave(x, y) { return Math.floor(x / TAM) + "," + Math.floor(y / TAM); }

  /** Añade muestras {x, y, h} quitando las que se salen mucho de la mediana de su entorno. */
  anadir(lista) {
    const validas = lista.filter((m) => Number.isFinite(m.h));
    if (!validas.length) return;
    const todas = this.muestras.concat(validas);
    const buenas = validas.filter((m) => {
      const vecinas = todas.filter((o) => Math.abs(o.x - m.x) < 70 && Math.abs(o.y - m.y) < 70).map((o) => o.h).sort((a, b) => a - b);
      const mediana = vecinas[Math.floor(vecinas.length / 2)];
      return m.h - mediana < 0.8 && mediana - m.h < 2.5;
    });
    for (const m of buenas) {
      this.muestras.push(m);
      const k = this.clave(m.x, m.y);
      if (!this.indice.has(k)) this.indice.set(k, []);
      this.indice.get(k).push(m);
    }
  }

  /** Altura del suelo (m sobre el elipsoide) en el punto local (x, y). */
  h(x, y) {
    const ci = Math.floor(x / TAM), cj = Math.floor(y / TAM);
    let suma = 0, pesos = 0, n = 0;
    for (let r = 1; r <= 4 && n < 4; r++) {
      suma = 0; pesos = 0; n = 0;
      for (let i = ci - r; i <= ci + r; i++) {
        for (let j = cj - r; j <= cj + r; j++) {
          const lista = this.indice.get(i + "," + j);
          if (!lista) continue;
          for (const m of lista) {
            const d2 = (m.x - x) ** 2 + (m.y - y) ** 2 + 25;
            const w = 1 / (d2 * d2);
            suma += m.h * w; pesos += w; n++;
          }
        }
      }
    }
    return n ? suma / pesos : this.porDefecto;
  }
}
