/**
 * OPENSTREETMAP: descarga los datos reales de una zona (calles, edificios, árboles, tiendas…)
 * con la API gratuita Overpass y los guarda en un almacén sin duplicados.
 * Datos © colaboradores de OpenStreetMap (licencia ODbL).
 */

const SERVIDORES = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

function consulta(s, o, n, e) {
  const b = `(${s.toFixed(6)},${o.toFixed(6)},${n.toFixed(6)},${e.toFixed(6)})`;
  return `[out:json][timeout:25];
(
  way["highway"]${b};
  way["building"]${b};
  way["leisure"~"park|garden|playground|pitch"]${b};
  way["landuse"~"grass|recreation_ground|village_green"]${b};
  way["area:highway"]${b};
  node["highway"~"traffic_signals|crossing|street_lamp"]${b};
  node["natural"="tree"]${b};
  node["amenity"]${b};
  node["shop"]${b};
  node["tourism"~"hotel|hostel"]${b};
);
out geom qt;`;
}

/** Descarga una caja (grados). Prueba varios servidores si uno falla. */
export async function descargarOsm(sur, oeste, norte, este) {
  const cuerpo = "data=" + encodeURIComponent(consulta(sur, oeste, norte, este));
  let ultimoError;
  for (const url of SERVIDORES) {
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), 30000);
    try {
      const r = await fetch(url, {
        method: "POST",
        body: cuerpo,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: control.signal,
      });
      if (!r.ok) throw new Error("Overpass respondió " + r.status);
      const json = await r.json();
      return json.elements || [];
    } catch (e) {
      ultimoError = e;
      console.warn("Overpass falló en", url, e);
    } finally {
      clearTimeout(reloj);
    }
  }
  throw ultimoError || new Error("No se pudo descargar OpenStreetMap");
}

/** Almacén de todo lo descargado (sin duplicados), en grados. */
export class AlmacenOsm {
  constructor() {
    this.vias = new Map();   // id → way (con geometry y nodes)
    this.nodos = new Map();  // id → node
    this.version = 0;
  }

  anadir(elementos) {
    let nuevos = 0;
    for (const e of elementos) {
      if (e.type === "way" && e.geometry && !this.vias.has(e.id)) { this.vias.set(e.id, e); nuevos++; }
      else if (e.type === "node" && !this.nodos.has(e.id)) { this.nodos.set(e.id, e); nuevos++; }
    }
    if (nuevos) this.version++;
    return nuevos;
  }
}
