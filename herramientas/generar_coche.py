"""Genera assets/modelos/coche.glb: un coche sencillo hecho con cajas y cilindros.

Uso:  python3 herramientas/generar_coche.py
Convenciones glTF: +Y arriba, +Z hacia delante, unidades en metros.
"""
import json
import math
import struct
from pathlib import Path

MATERIALES = {
    "carroceria": {"pbrMetallicRoughness": {"baseColorFactor": [0.78, 0.09, 0.12, 1], "metallicFactor": 0.4, "roughnessFactor": 0.35}},
    "cristal":    {"pbrMetallicRoughness": {"baseColorFactor": [0.08, 0.11, 0.15, 1], "metallicFactor": 0.2, "roughnessFactor": 0.1}},
    "rueda":      {"pbrMetallicRoughness": {"baseColorFactor": [0.05, 0.05, 0.05, 1], "metallicFactor": 0.0, "roughnessFactor": 0.9}},
    "llanta":     {"pbrMetallicRoughness": {"baseColorFactor": [0.75, 0.75, 0.78, 1], "metallicFactor": 0.9, "roughnessFactor": 0.3}},
    "faro":       {"pbrMetallicRoughness": {"baseColorFactor": [1, 0.97, 0.85, 1]}, "emissiveFactor": [1, 0.95, 0.8]},
    "piloto":     {"pbrMetallicRoughness": {"baseColorFactor": [0.9, 0.05, 0.05, 1]}, "emissiveFactor": [0.8, 0.02, 0.02]},
    "negro":      {"pbrMetallicRoughness": {"baseColorFactor": [0.03, 0.03, 0.03, 1], "metallicFactor": 0.0, "roughnessFactor": 0.7}},
}


def caja(cx, cy, cz, sx, sy, sz):
    """Caja centrada en (cx,cy,cz) con tamaño (sx,sy,sz). Devuelve (posiciones, normales, indices)."""
    hx, hy, hz = sx / 2, sy / 2, sz / 2
    caras = [
        ((1, 0, 0), [(hx, -hy, -hz), (hx, hy, -hz), (hx, hy, hz), (hx, -hy, hz)]),
        ((-1, 0, 0), [(-hx, -hy, hz), (-hx, hy, hz), (-hx, hy, -hz), (-hx, -hy, -hz)]),
        ((0, 1, 0), [(-hx, hy, -hz), (-hx, hy, hz), (hx, hy, hz), (hx, hy, -hz)]),
        ((0, -1, 0), [(-hx, -hy, hz), (-hx, -hy, -hz), (hx, -hy, -hz), (hx, -hy, hz)]),
        ((0, 0, 1), [(hx, -hy, hz), (hx, hy, hz), (-hx, hy, hz), (-hx, -hy, hz)]),
        ((0, 0, -1), [(-hx, -hy, -hz), (-hx, hy, -hz), (hx, hy, -hz), (hx, -hy, -hz)]),
    ]
    pos, nor, idx = [], [], []
    for n, vs in caras:
        base = len(pos)
        for v in vs:
            pos.append((v[0] + cx, v[1] + cy, v[2] + cz))
            nor.append(n)
        idx += [base, base + 1, base + 2, base, base + 2, base + 3]
    return pos, nor, idx


def cilindro_x(cx, cy, cz, radio, ancho, lados=18):
    """Cilindro con el eje en X (una rueda)."""
    pos, nor, idx = [], [], []
    hx = ancho / 2
    for i in range(lados):
        a0 = 2 * math.pi * i / lados
        a1 = 2 * math.pi * (i + 1) / lados
        y0, z0 = math.cos(a0), math.sin(a0)
        y1, z1 = math.cos(a1), math.sin(a1)
        base = len(pos)
        pos += [(cx - hx, cy + y0 * radio, cz + z0 * radio), (cx + hx, cy + y0 * radio, cz + z0 * radio),
                (cx + hx, cy + y1 * radio, cz + z1 * radio), (cx - hx, cy + y1 * radio, cz + z1 * radio)]
        nor += [(0, y0, z0), (0, y0, z0), (0, y1, z1), (0, y1, z1)]
        idx += [base, base + 2, base + 1, base, base + 3, base + 2]
    for lado in (-1, 1):
        centro = len(pos)
        pos.append((cx + lado * hx, cy, cz))
        nor.append((lado, 0, 0))
        for i in range(lados):
            a = 2 * math.pi * i / lados
            pos.append((cx + lado * hx, cy + math.cos(a) * radio, cz + math.sin(a) * radio))
            nor.append((lado, 0, 0))
        for i in range(lados):
            a, b = centro + 1 + i, centro + 1 + (i + 1) % lados
            idx += [centro, a, b] if lado < 0 else [centro, b, a]
    return pos, nor, idx


def unir(*partes):
    pos, nor, idx = [], [], []
    for p, n, i in partes:
        base = len(pos)
        pos += p
        nor += n
        idx += [base + k for k in i]
    return pos, nor, idx


def construir():
    piezas = {
        "carroceria": unir(
            caja(0, 0.55, 0, 1.80, 0.55, 4.25),          # cuerpo
            caja(0, 0.80, 1.55, 1.74, 0.12, 1.10),       # capó
            caja(0, 1.42, -0.25, 1.50, 0.07, 1.75),      # techo
        ),
        "cristal": caja(0, 1.10, -0.20, 1.58, 0.56, 2.05),
        "negro": unir(caja(0, 0.30, 2.13, 1.70, 0.22, 0.08), caja(0, 0.30, -2.13, 1.70, 0.22, 0.08)),
        "faro": unir(caja(0.62, 0.66, 2.13, 0.36, 0.12, 0.04), caja(-0.62, 0.66, 2.13, 0.36, 0.12, 0.04)),
        "piloto": unir(caja(0.64, 0.68, -2.13, 0.32, 0.12, 0.04), caja(-0.64, 0.68, -2.13, 0.32, 0.12, 0.04)),
    }
    ruedas, llantas = [], []
    for x in (-0.82, 0.82):
        for z in (-1.35, 1.35):
            ruedas.append(cilindro_x(x, 0.34, z, 0.34, 0.26))
            llantas.append(cilindro_x(x + (0.012 if x > 0 else -0.012), 0.34, z, 0.2, 0.26))
    piezas["rueda"] = unir(*ruedas)
    piezas["llanta"] = unir(*llantas)
    return piezas


def escribir_glb(piezas, ruta):
    binario = bytearray()
    vistas, accesores, primitivas, materiales = [], [], [], []


    for nombre, (pos, nor, idx) in piezas.items():
        materiales.append(dict(MATERIALES[nombre], name=nombre))
        flat_pos = [c for p in pos for c in p]
        flat_nor = [c for n in nor for c in n]
        while len(binario) % 4:
            binario.append(0)
        o = len(binario); binario.extend(struct.pack("<%df" % len(flat_pos), *flat_pos))
        vistas.append({"buffer": 0, "byteOffset": o, "byteLength": len(binario) - o, "target": 34962})
        mins = [min(p[k] for p in pos) for k in range(3)]
        maxs = [max(p[k] for p in pos) for k in range(3)]
        accesores.append({"bufferView": len(vistas) - 1, "componentType": 5126, "count": len(pos), "type": "VEC3", "min": mins, "max": maxs})
        a_pos = len(accesores) - 1
        o = len(binario); binario.extend(struct.pack("<%df" % len(flat_nor), *flat_nor))
        vistas.append({"buffer": 0, "byteOffset": o, "byteLength": len(binario) - o, "target": 34962})
        accesores.append({"bufferView": len(vistas) - 1, "componentType": 5126, "count": len(nor), "type": "VEC3"})
        a_nor = len(accesores) - 1
        o = len(binario); binario.extend(struct.pack("<%dI" % len(idx), *idx))
        vistas.append({"buffer": 0, "byteOffset": o, "byteLength": len(binario) - o, "target": 34963})
        accesores.append({"bufferView": len(vistas) - 1, "componentType": 5125, "count": len(idx), "type": "SCALAR"})
        primitivas.append({"attributes": {"POSITION": a_pos, "NORMAL": a_nor}, "indices": len(accesores) - 1, "material": len(materiales) - 1})

    while len(binario) % 4:
        binario.append(0)
    gltf = {
        "asset": {"version": "2.0", "generator": "Diego's World - generar_coche.py"},
        "scene": 0, "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": "coche"}],
        "meshes": [{"primitives": primitivas, "name": "coche"}],
        "materials": materiales, "accessors": accesores, "bufferViews": vistas,
        "buffers": [{"byteLength": len(binario)}],
    }
    js = json.dumps(gltf, separators=(",", ":")).encode()
    js += b" " * ((4 - len(js) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(binario)
    with open(ruta, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<II", len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack("<II", len(binario), 0x004E4942)); f.write(binario)


if __name__ == "__main__":
    salida = Path(__file__).resolve().parent.parent / "assets" / "modelos" / "coche.glb"
    escribir_glb(construir(), salida)
    print("Coche generado en", salida, salida.stat().st_size, "bytes")
