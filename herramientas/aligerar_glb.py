"""Aligera un .glb: reduce las texturas (máx. 1024 px) y pasa a JPEG las que no tienen transparencia.

Uso:  python3 herramientas/aligerar_glb.py entrada.glb salida.glb
"""
import io
import json
import struct
import sys

from PIL import Image

MAX_LADO = 1024


def leer_glb(ruta):
    datos = open(ruta, "rb").read()
    largo_json = struct.unpack("<I", datos[12:16])[0]
    gltf = json.loads(datos[20:20 + largo_json])
    inicio_bin = 20 + largo_json
    largo_bin = struct.unpack("<I", datos[inicio_bin:inicio_bin + 4])[0]
    binario = datos[inicio_bin + 8:inicio_bin + 8 + largo_bin]
    return gltf, binario


def aligerar(gltf, binario):
    imagenes = {i["bufferView"]: n for n, i in enumerate(gltf.get("images", [])) if "bufferView" in i}
    nuevo = bytearray()
    for n, vista in enumerate(gltf["bufferViews"]):
        trozo = binario[vista.get("byteOffset", 0):vista.get("byteOffset", 0) + vista["byteLength"]]
        if n in imagenes:
            img = Image.open(io.BytesIO(trozo))
            img.load()
            if max(img.size) > MAX_LADO:
                img.thumbnail((MAX_LADO, MAX_LADO), Image.LANCZOS)
            salida = io.BytesIO()
            tiene_alfa = img.mode in ("RGBA", "LA") and img.getchannel("A").getextrema()[0] < 255
            if tiene_alfa:
                img.save(salida, "PNG", optimize=True)
                gltf["images"][imagenes[n]]["mimeType"] = "image/png"
            else:
                img.convert("RGB").save(salida, "JPEG", quality=85, optimize=True)
                gltf["images"][imagenes[n]]["mimeType"] = "image/jpeg"
            trozo = salida.getvalue()
        while len(nuevo) % 4:
            nuevo.append(0)
        vista["byteOffset"] = len(nuevo)
        vista["byteLength"] = len(trozo)
        nuevo.extend(trozo)
    while len(nuevo) % 4:
        nuevo.append(0)
    gltf["buffers"] = [{"byteLength": len(nuevo)}]
    return gltf, bytes(nuevo)


def escribir_glb(ruta, gltf, binario):
    js = json.dumps(gltf, separators=(",", ":")).encode()
    js += b" " * ((4 - len(js) % 4) % 4)
    with open(ruta, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(binario)))
        f.write(struct.pack("<II", len(js), 0x4E4F534A) + js)
        f.write(struct.pack("<II", len(binario), 0x004E4942) + binario)


if __name__ == "__main__":
    g, b = leer_glb(sys.argv[1])
    g, b = aligerar(g, b)
    escribir_glb(sys.argv[2], g, b)
    print("Listo:", sys.argv[2], len(b) // 1024, "KB de datos")
