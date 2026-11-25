# 🌍 Diego's World — prototipo v0.1 (Valencia)

> Un videojuego de mundo abierto donde el planeta Tierra real se convierte en un escenario jugable.
> Primera parada: **Valencia**, escaneada en 3D de verdad (Google Photorealistic 3D Tiles).

**▶ Jugar:** https://gabidiego072-glitch.github.io/diegos-world/
*(funciona en cuanto GitHub Pages esté activado; mira el apartado “Publicarlo” más abajo)*

Es una página web: no hay que instalar nada y no necesita una buena tarjeta gráfica, porque la ciudad 3D la envían los servidores de Google/Cesium.

---

## 1. Lo que necesitas (gratis)

Un **token de Cesium ion**. Es como una “llave” gratuita para descargar la Valencia 3D.

1. Entra en **https://ion.cesium.com** y crea una cuenta gratuita (no pide tarjeta).
2. Ve a **Asset Depot**, busca **“Google Photorealistic 3D Tiles”** y pulsa **“Add to my assets”**.
   (Si ya aparece en *My Assets*, no hace falta.)
3. Ve a **Access Tokens** y copia el **Default Token** entero (texto largo que empieza por `eyJ`).
4. Abre el juego, pega el token y pulsa **Entrar en Valencia**.

🔒 El token se guarda **solo en tu navegador** (localStorage). No se sube a GitHub ni a ningún otro sitio. Puedes borrarlo con el botón “Borrar token guardado”.

## 2. Controles

| Modo | Teclas |
|---|---|
| 🚗 **Coche** (tecla `1`) | `W`/`↑` acelerar · `S`/`↓` frenar y marcha atrás · `A` `D` / `←` `→` girar · `Shift` turbo · `Espacio` freno de mano |
| 🚶 **A pie** (tecla `2`) | `W` `S` andar · `A` `D` girar · `Shift` correr · `F` subir/bajar del coche |
| 🕊️ **Vuelo libre** (tecla `3`) | Ratón para moverte (como Google Earth) · **doble clic en una calle** para aparecer allí · en móvil: botón **“Aparecer aquí”** |

- Arrastra con el ratón para mirar alrededor (izquierda/derecha) y **arriba/abajo**; la rueda acerca o aleja la cámara.
- `T` abre el panel de **Lugares** (teletransporte): Calle de Xàtiva (Plaza de Toros y Estación del Norte), Plaza del Ayuntamiento, Mercado Central, Torres de Serranos y Ciudad de las Artes y las Ciencias.
- **Calidad Baja/Alta** (arriba a la derecha). Empieza en *Baja*, pensada para ordenadores flojos. Sin sombras.
- En el **móvil** funciona el modo de vuelo con los dedos (arrastrar, pellizcar) y el botón “Aparecer aquí”.

## 3. Modo híbrido: calles generadas (botón 🏙️ “Calles”)

La Valencia de Google está hecha con fotos desde aviones: desde lejos es espectacular, pero a ras de suelo
se ve “derretida”. Por eso, **alrededor del jugador** (unos 600 × 600 m) el juego **genera solo** una calle
de videojuego con los datos reales de **OpenStreetMap**:

1. **Asfalto, líneas, pasos de cebra, bordillos, aceras**, plazas y zonas verdes.
2. **Árboles, farolas, semáforos y bancos** (los reales del mapa; si no hay datos, se colocan con reglas).
3. **Edificios enteros, con su altura real** (medida en la Valencia de Google): fachadas con ventanas,
   balcones y persianas, medianeras, azoteas y, abajo, **escaparates con el nombre real de cada tienda**
   (farmacias, heladerías, cafeterías…).
4. **Coches y peatones NPC** que circulan por sus carriles y pasean por las aceras.

En esa zona se quita la Valencia “derretida” de Google **menos los monumentos** (Ciudad de las Artes,
Estación del Norte, Plaza de Toros, iglesias, edificios históricos…), que se quedan con su forma real.
Al moverte, la zona generada te acompaña. (En navegadores antiguos sin WebGL 2 se usa un modo de reserva:
solo se generan las plantas bajas.)
Con el botón **🏙️ Calles** puedes cambiar entre *Generadas* y *Google* (solo Google).

## 4. Cómo funciona (explicado fácil)

- **CesiumJS** dibuja el planeta en 3D dentro del navegador.
- **Google Photorealistic 3D Tiles** es la ciudad real escaneada: edificios, árboles, coches aparcados…
- Para que el coche “pise” el suelo real, el juego lanza **rayos invisibles**:
  - uno **hacia abajo**, desde un poco por encima del coche (así no se sube a árboles ni toldos);
  - uno **hacia delante**, para detectar paredes y parar al chocar;
  - si el escalón es más alto de 45 cm, se considera una pared.

## 5. Publicarlo gratis con GitHub Pages (una sola vez)

1. En GitHub, abre el repositorio **diegos-world** → **Settings** (Configuración).
2. En el menú de la izquierda, entra en **Pages**.
3. En **Build and deployment → Source**, elige **Deploy from a branch**.
4. En **Branch**, elige la rama donde está el juego (`claude/lucid-davinci-x60x3r`, o `main` si ya la has fusionado) y la carpeta **/ (root)**. Pulsa **Save**.
5. Espera 1–2 minutos y abre: **https://gabidiego072-glitch.github.io/diegos-world/**

## 6. Probarlo en tu ordenador (opcional)

Si tienes Python instalado:

```bash
python3 -m http.server 8000
```

Abre `http://localhost:8000`. (Abrir `index.html` con doble clic **no** funciona, porque los navegadores bloquean los módulos JavaScript en archivos locales.)

## 7. Estructura del proyecto

```
index.html           Pantallas e interfaz
css/estilo.css       Estilo oscuro tipo videojuego
js/config.js         Números ajustables (velocidades, cámara, calidad…)
js/mundo/            Mundo 3D, calidad y física de rayos
js/jugador/          Teclado, coche y peatón
js/camara/           Cámara en tercera persona
js/interfaz/         Pantalla de inicio y HUD
js/lugares/          Puntos de teletransporte
js/modos/juego.js    Une todo: modos, teletransporte y bucle del juego
js/generador/        Modo híbrido: descarga OpenStreetMap y genera calles, mobiliario y fachadas
js/npc/              Coches y peatones NPC
assets/modelos/      Coche y personaje 3D
pruebas/fisica.html  Escenario de prueba de la física (sin Google)
pruebas/ciudad.html  Prueba del modo híbrido con datos guardados de la Calle de Xàtiva (sin Google)
CLAUDE.md            Visión completa del proyecto y reglas de desarrollo
```

## 8. Créditos

- Calles generadas: datos © **colaboradores de OpenStreetMap** (ODbL).
- Ciudad 3D: **Google Photorealistic 3D Tiles** vía **Cesium ion** (los créditos de Google se muestran siempre en pantalla, como exige su licencia).
- Motor: **CesiumJS** (Apache 2.0).
- Coche: “Car Concept” © The Khronos Group, CC-BY 4.0.
- Personaje: “Cesium Man” © Cesium, CC-BY 4.0.
- Idea original: **Diego**.
