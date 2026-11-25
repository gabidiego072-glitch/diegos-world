# CLAUDE.md — Diego's World

Guía para cualquier IA o persona que trabaje en este proyecto. **Idioma del proyecto: español** (código, comentarios, interfaz y documentación).

## Visión

> “Diego's World es un videojuego donde el planeta Tierra se convierte en un mundo abierto interactivo gracias a la inteligencia artificial.”

- **Autor de la idea:** Diego.
- **Filosofía:** *Si existe en el mundo real, existe en el juego. Si no es jugable, la IA lo convierte en jugable.*
- **Mapa:** el mundo real es el mapa. Calles, plazas y monumentos mantienen su ubicación real.
- **Primer prototipo:** Valencia (Plaza de Toros, Estación del Norte y calles cercanas).

## Regla de oro del desarrollo

**No construir ciudades a mano.** Siempre crear *sistemas* que generen zonas jugables e interiores **bajo demanda** a partir de datos reales (3D Tiles, OpenStreetMap, imágenes, carteles…). Si una tarea implica modelar a mano una calle o un edificio concreto, está mal planteada: hay que hacer el generador.

## Modos de juego (visión completa)

1. **Mundo Abierto (offline):** explorar, conducir, misiones y NPCs.
2. **Battle Royale:** eliges dónde aparecer; usas **teletransporte** para localizar rivales y luchas por ser el último superviviente.
   - El teletransporte **solo muestra la ubicación del enemigo al activarlo**. Si lo cancelas, lo pierdes.
   - Aparición propuesta: **entre 150 y 250 metros del rival**.
3. **Partidas privadas:** jugar con amigos en **cualquier ciudad del mundo**.

Ideas futuras: economía, inventario, policía, misiones, cooperativo, zombis, carreras y más modos usando el mismo mundo.

## Vehículos y NPCs

- **Vehículos:** coches ahora; más adelante motos, autobuses, barcos y aviones.
- **NPCs:** peatones, policías, dependientes y clientes.

## IA

- Genera **interiores coherentes** de edificios según lo que son en la realidad (farmacias, heladerías, supermercados, etc.).
- **Interpreta carteles** en distintos idiomas para saber qué es cada local.
- Crea y da comportamiento a los **NPCs**.

## Estilo gráfico

Primero **realista simplificado** para validar la jugabilidad; más adelante evolución hacia **hiperrealista**.

## Estado actual: prototipo web v0.1

- Web 3D en el navegador, **gratis**, pensada para un PC flojo: lo pesado (la ciudad 3D) lo sirven servidores externos.
- **CesiumJS 1.146.0** (fijado por CDN en `index.html` y `js/config.js`) + **Google Photorealistic 3D Tiles** a través de **Cesium ion**.
- El **token de Cesium ion** lo pega el jugador en la pantalla de inicio y se guarda **solo en `localStorage`**. **Nunca** debe aparecer en el código ni en el repositorio.
- Modos: **coche**, **a pie** y **vuelo libre** (doble clic / botón “Aparecer aquí” para bajar a la calle).
- Publicado con **GitHub Pages** (sitio estático, sin build).

## Arquitectura (módulos)

```
index.html              Estructura de pantallas y HUD; carga Cesium por CDN.
css/estilo.css          Estilo oscuro tipo videojuego (responsive).
js/main.js              Punto de entrada: inicio → mundo → juego.
js/config.js            TODOS los números ajustables (física, cámara, calidad, modelos).
js/mundo/               El mundo: visor Cesium, 3D Tiles, calidad, física de rayos, utilidades geo.
  mundo.js              crearMundo / aplicarCalidad / destruirMundo.
  fisica.js             FisicaSuelo: rayos hacia abajo (suelo) y hacia delante (paredes).
  geo.js                Vectores este/norte/arriba, desplazar en metros, ángulos.
js/jugador/             Lo que el jugador controla.
  entrada.js            Teclado → intenciones (adelante, giro, turbo…). Aquí irán táctil/mando/red.
  cuerpoTerrestre.js    Base común: pegarse al suelo, escalones, caídas, choques.
  coche.js / peaton.js  Dinámica concreta de cada uno.
js/camara/              Cámara en tercera persona con anti-paredes.
js/interfaz/            Pantalla de inicio (token) y HUD.
js/lugares/lugares.js   Puntos de teletransporte (datos puros, verificados con OpenStreetMap).
js/generador/           MODO HÍBRIDO (calles generadas bajo demanda con OpenStreetMap):
  osm.js                Descarga Overpass (varios servidores) y almacén sin duplicados.
  zona.js               Interpreta OSM → calles (coche/peatón/bici, ancho, carriles, sentido), edificios,
                        locales comerciales (asignados a su pared), árboles, semáforos, cruces, bancos.
  alturas.js            Campo de alturas del suelo (muestras de Google en ejes de calle, filtradas).
  construirCelda.js     Geometría de una celda de 200 m: fases 1-3 (calle, mobiliario, bajos y letreros).
  constructorGlb.js     Crea GLB en memoria (cajas, cilindros, esferas, polígonos) → Cesium.Model.
  texturas.js           Texturas procedurales (canvas) y atlas de letreros; CATEGORIAS = cómo se “lee” cada local.
  ciudad.js             Gestor: celdas 3×3 alrededor del jugador, recorte de Google (ClippingPlaneCollection:
                        por debajo de CIUDAD.corte y dentro de la caja generada), reinicio al alejarse.
  proyeccion.js         lon/lat ↔ metros locales y matriz ENU de la zona.
js/npc/poblacion.js     Fase 4: coches NPC por carriles (respetan sentido único) y peatones por aceras.
js/modos/juego.js       Orquesta modos, teletransporte y bucle principal.
assets/modelos/         coche_realista.glb (Car Concept, Khronos, CC-BY 4.0), peaton.glb (Cesium Man, CC-BY 4.0)
                        y coche.glb de reserva (generado por herramientas/generar_coche.py).
pruebas/fisica.html     Escenario sin Google para probar la física (suelo, pared, bordillo, escalón, toldo).
pruebas/ciudad.html     Modo híbrido sin Google con datos OSM guardados (pruebas/datos/osm_xativa.json).
```

### Convenciones

- Posiciones: `lon`, `lat` en **radianes** internamente (en `lugares.js`, en grados), altura en metros sobre el elipsoide WGS84.
- `rumbo`: radianes tipo brújula (0 = norte, sentido horario). Cesium usa `heading = rumbo - 90°` para modelos.
- El estado de un jugador es solo `{lon, lat, altura, rumbo, velocidad}`: fácil de enviar por red (multijugador) y de portar a **Unreal Engine 5** (Cesium for Unreal usa las mismas 3D Tiles).
- La lógica no depende del DOM: el HUD solo muestra y avisa.

### Física con rayos (importante)

- `scene.pickFromRay` solo “ve” las teselas que se están dibujando → la cámara siempre sigue al jugador.
- Rayo hacia **abajo** lanzado desde **poco por encima** del jugador (coche 2,2 m, peatón 1,9 m), **no desde el cielo**, para no subirse a árboles ni toldos.
- Rayo hacia **delante** para paredes; si el escalón supera `escalonMax` (0,45 m) se considera **pared**.
- Los modelos propios se excluyen de los rayos (`FisicaSuelo.ignorar`).

## Licencias y créditos (no romper)

- Google Photorealistic 3D Tiles: **mostrar siempre los créditos y el logo de Google** (no tapar la esquina inferior izquierda), no usar otro buscador que no sea el de Google, no mezclar con otro globo/terreno.
- Cesium Man: CC-BY 4.0, © Cesium. Ver `assets/modelos/CREDITOS.md`.

## Modo híbrido (implementado)

Las Google 3D Tiles se hacen con fotos aéreas: a ras de suelo se ven "derretidas". Solución (regla de oro):
cerca del jugador se genera geometría limpia de juego con OpenStreetMap y a Google se le recorta lo que está
por debajo de ~3,6 m solo en esa zona (se conservan fachadas altas y monumentos reales).
- En la zona generada los rayos de física IGNORAN el tileset de Google (FisicaSuelo.ignorarTilesetEn).
- Las alturas se miden en Google ANTES de recortar cada celda.
- En vuelo libre se oculta lo generado y se desactiva el recorte.
- Si Overpass falla, se queda la vista de Google y se reintenta a los 20 s.

## Siguientes pasos sugeridos

1. Controles táctiles (joystick) para coche y a pie en móvil.
2. Primer “interior bajo demanda”: entrar en un local (ya sabemos su tipo por `categoriaDe`) y generar un interior simple.
3. Semáforos con ciclo real y NPCs que los respetan; pasos de cebra con prioridad para peatones.
4. Fachadas completas para edificios sin buena malla de Google.
5. Multijugador (WebSocket) usando el estado compacto del jugador; Battle Royale con teletransporte a 150–250 m.

## Cómo probar

```bash
python3 -m http.server 8000
```
Abrir `http://localhost:8000/` (juego) o `http://localhost:8000/pruebas/fisica.html` (física sin Google).
