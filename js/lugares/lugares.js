/**
 * LUGARES de teletransporte.
 * Coordenadas comprobadas con OpenStreetMap: cada punto está EN LA CALZADA o en la plaza
 * peatonal (no sobre un edificio), y el rumbo mira hacia el monumento.
 *   lon / lat en grados; rumbo en grados tipo brújula (0 = norte, 90 = este).
 *
 * Para añadir un sitio nuevo basta con añadir una línea aquí.
 */
export const LUGARES = [
  {
    id: "xativa",
    nombre: "Calle de Xàtiva",
    descripcion: "Plaza de Toros y Estación del Norte",
    lon: -0.37598, lat: 39.46728, rumbo: 283, // calzada entre la Plaza de Toros y la Estación, mirando a la Estación
  },
  {
    id: "ayuntamiento",
    nombre: "Plaza del Ayuntamiento",
    descripcion: "El corazón de Valencia",
    lon: -0.37645, lat: 39.46995, rumbo: 330,
  },
  {
    id: "mercado",
    nombre: "Mercado Central",
    descripcion: "Plaza del Mercado, frente a La Lonja",
    lon: -0.37852, lat: 39.47388, rumbo: 200,
  },
  {
    id: "serranos",
    nombre: "Torres de Serranos",
    descripcion: "Plaza de los Fueros",
    lon: -0.37612, lat: 39.47860, rumbo: 0,
  },
  {
    id: "artes",
    nombre: "Ciudad de las Artes y las Ciencias",
    descripcion: "Avenida del Profesor López Piñero",
    lon: -0.35400, lat: 39.45512, rumbo: 312,
  },
];

/** Lugar donde empieza la partida. */
export const LUGAR_INICIAL = "xativa";

export function buscarLugar(id) {
  return LUGARES.find((l) => l.id === id) ?? LUGARES[0];
}
