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
js/modos/juego.js       Orquesta modos, teletransporte y bucle principal.
assets/modelos/         coche.glb (generado por herramientas/generar_coche.py) y peaton.glb (Cesium Man, CC-BY 4.0).
pruebas/fisica.html     Escenario sin Google para probar la física (suelo, pared, bordillo, escalón, toldo).
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

## Siguientes pasos sugeridos

1. Controles táctiles (joystick) para coche y a pie en móvil.
2. NPCs peatones generados a partir de las aceras de OpenStreetMap.
3. Primer “interior bajo demanda”: al acercarse a un local, leer su tipo en OpenStreetMap (farmacia, heladería…) y generar un interior simple.
4. Multijugador (WebSocket) usando el estado compacto del jugador; Battle Royale con teletransporte a 150–250 m.

## Cómo probar

```bash
python3 -m http.server 8000
```
Abrir `http://localhost:8000/` (juego) o `http://localhost:8000/pruebas/fisica.html` (física sin Google).
