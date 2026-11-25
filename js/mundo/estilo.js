/**
 * ESTILO VISUAL "GTA IV": la atmósfera es lo que más se nota.
 *  - Corrección de color: colores algo apagados, tono cálido/tostado y más contraste.
 *  - Bruma con la distancia (oculta lo lejano y "derretido" y da profundidad).
 *  - Viñeta y grano de película muy suaves.
 *  - Calidad Alta: resplandor (bloom), sombras y oclusión ambiental.
 * Todo es un único paso de post-proceso barato; lo caro solo se activa en calidad Alta.
 */
import { ESTILO } from "../config.js";

const SHADER = /* glsl */ `
uniform sampler2D colorTexture;
uniform sampler2D depthTexture;
uniform float densidadBruma;
uniform vec3 colorBruma;
uniform float saturacion;
uniform vec3 tinte;
uniform float contraste;
uniform float vineta;
uniform float grano;
in vec2 v_textureCoordinates;

float azar(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  vec3 c = texture(colorTexture, v_textureCoordinates).rgb;

  // Bruma según la distancia real de cada píxel.
  float profundidad = czm_readDepth(depthTexture, v_textureCoordinates);
  float bruma;
  if (profundidad < 1.0) {
    vec4 ojo = czm_windowToEyeCoordinates(gl_FragCoord.xy, profundidad);
    float d = length(ojo.xyz);
    bruma = 1.0 - exp(-pow(d * densidadBruma, 1.5));
    bruma = min(bruma, 0.82);
  } else {
    bruma = 0.30; // cielo: un poco lechoso, como en GTA IV
  }
  c = mix(c, colorBruma, bruma);

  // Corrección de color.
  float luz = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(luz), c, saturacion);
  c *= tinte;
  c = (c - 0.5) * contraste + 0.5;
  // Sombras con un punto verdoso y luces amarillentas (típico de la paleta de GTA IV).
  c += vec3(-0.01, 0.006, 0.0) * (1.0 - luz);

  // Viñeta y grano.
  vec2 uv = v_textureCoordinates - 0.5;
  c *= 1.0 - dot(uv, uv) * vineta;
  c += (azar(v_textureCoordinates * 913.0 + float(czm_frameNumber)) - 0.5) * grano;

  out_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

export function aplicarEstilo(viewer) {
  const scene = viewer.scene;
  const e = ESTILO;

  // Luz de tarde, cálida.
  scene.light = new Cesium.SunLight({ color: Cesium.Color.fromCssColorString(e.colorSol), intensity: e.intensidadSol });

  // Cielo un poco más apagado y lechoso.
  if (scene.skyAtmosphere) {
    scene.skyAtmosphere.saturationShift = -0.25;
    scene.skyAtmosphere.brightnessShift = -0.05;
    scene.skyAtmosphere.hueShift = 0.0;
  }

  const etapa = new Cesium.PostProcessStage({
    name: "diegosworld_estilo",
    fragmentShader: SHADER,
    uniforms: {
      densidadBruma: e.densidadBruma,
      colorBruma: Cesium.Cartesian3.fromArray(e.colorBruma),
      saturacion: e.saturacion,
      tinte: Cesium.Cartesian3.fromArray(e.tinte),
      contraste: e.contraste,
      vineta: e.vineta,
      grano: e.grano,
    },
  });
  scene.postProcessStages.add(etapa);
  return etapa;
}

/** Efectos caros: solo en calidad Alta. */
export function efectosAlta(viewer, activar) {
  const scene = viewer.scene;
  const bloom = scene.postProcessStages.bloom;
  bloom.enabled = activar;
  if (activar) {
    bloom.uniforms.glowOnly = false;
    bloom.uniforms.contrast = 119;
    bloom.uniforms.brightness = -0.4;
    bloom.uniforms.delta = 0.9;
    bloom.uniforms.sigma = 2.2;
    bloom.uniforms.stepSize = 1.0;
  }
  viewer.shadows = activar;
  if (activar) {
    const sm = viewer.shadowMap;
    sm.maximumDistance = 220;
    sm.softShadows = false;
    sm.darkness = 0.45;
    sm.size = 2048;
  }
}
