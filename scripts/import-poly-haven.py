#!/usr/bin/env python3
"""Rebuild the checked-in Ashford assets from their licensed Poly Haven sources."""

from concurrent.futures import ThreadPoolExecutor
from hashlib import md5
from io import BytesIO
import json
from pathlib import Path
from struct import pack
from subprocess import check_output

from PIL import Image


ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
SURFACES = ASSETS / "surfaces"
SOURCES = {
    "wood_floor_worn": ("Worn pine", "Safehouse floor and millwork"),
    "asphalt_02": ("Asphalt 02", "Patrol road and main street"),
    "interior_tiles": ("Interior Tiles", "Market and clinic floors"),
    "painted_plaster_wall": ("Painted Plaster Wall", "Safehouse, market and clinic walls"),
    "Shelf_01": ("Shelf 01", "Market rear display"),
}


def request(url):
    return check_output(["curl", "--fail", "--silent", "--show-error", "--location",
                         "--max-time", "45", "--retry", "2", "--user-agent",
                         "Ashford-Rebirth-Asset-Import/1.0 (offline game build)", url])


def download(source):
    data = request(source["url"])
    if len(data) != source["size"] or md5(data).hexdigest() != source["md5"]:
        raise ValueError(f"Poly Haven checksum mismatch for {source['url']}")
    return data


def encode_image(data, edge, quality, file_format, mode="RGB"):
    with Image.open(BytesIO(data)) as image:
        image = image.convert(mode)
        image.thumbnail((edge, edge), Image.Resampling.LANCZOS)
        output = BytesIO()
        if file_format == "JPEG":
            image.save(output, format="JPEG", quality=quality, optimize=True)
        else:
            image.save(output, format="WEBP", quality=quality, method=6)
        return output.getvalue()


def write_surfaces(asset, files):
    recipes = [("Diffuse", "color", 512, 83, "RGB"), ("nor_gl", "normal", 512, 87, "RGB"),
               ("Rough", "rough", 256, 79, "L")]
    entries = []
    for map_name, suffix, edge, quality, mode in recipes:
        source = files[map_name]["1k"]["jpg"]
        path = SURFACES / f"{asset}-{suffix}.webp"
        path.write_bytes(encode_image(download(source), edge, quality, "WEBP", mode))
        entries.append((suffix, source, path))
    return entries


def write_shelf(files):
    source = files["gltf"]["1k"]["gltf"]
    document = json.loads(download(source))
    original = [source, *source["include"].values()]
    (buffer,) = document["buffers"]
    binary = bytearray(download(source["include"][buffer["uri"]]))
    for image in document["images"]:
        name = image.pop("uri")
        edge = 512 if "_diff_" in name else 256
        compressed = encode_image(download(source["include"][name]), edge, 85, "JPEG")
        binary.extend(b"\0" * (-len(binary) % 4))
        image["bufferView"] = len(document["bufferViews"])
        image["mimeType"] = "image/jpeg"
        document["bufferViews"].append({"buffer": 0, "byteOffset": len(binary), "byteLength": len(compressed)})
        binary.extend(compressed)
    binary.extend(b"\0" * (-len(binary) % 4))
    document["buffers"] = [{"byteLength": len(binary)}]
    metadata = json.dumps(document, separators=(",", ":"), ensure_ascii=False).encode()
    metadata += b" " * (-len(metadata) % 4)
    path = ASSETS / "market-shelf.glb"
    with path.open("wb") as output:
        output.write(pack("<4sII", b"glTF", 2, 28 + len(metadata) + len(binary)))
        output.write(pack("<I4s", len(metadata), b"JSON"))
        output.write(metadata)
        output.write(pack("<I4s", len(binary), b"BIN\0"))
        output.write(binary)
    return [("GLB component", item, path) for item in original]


def acquire(asset):
    info = json.loads(request(f"https://api.polyhaven.com/info/{asset}"))
    files = json.loads(request(f"https://api.polyhaven.com/files/{asset}"))
    return asset, info["authors"], write_shelf(files) if asset == "Shelf_01" else write_surfaces(asset, files)


def main():
    SURFACES.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=5) as pool:
        results = list(pool.map(acquire, SOURCES))
    manifest = ["# Ashford asset manifest", "", "All Poly Haven resources below use [CC0 1.0]"
                "(https://polyhaven.com/license). Attribution is optional and recorded here for provenance.", "",
                "Sizes are in bytes. Source sizes refer to the 1K downloads, before resizing and encoding.", ""]
    for asset, authors, entries in results:
        label, usage = SOURCES[asset]
        manifest += [f"## {label}", "", f"[Poly Haven asset](https://polyhaven.com/a/{asset}) · "
                     f"{', '.join(authors)} · {usage}", "", "| Component | Source download | Original | Runtime file | Runtime |",
                     "| --- | --- | ---: | --- | ---: |"]
        for role, source, path in entries:
            manifest.append(f"| {role} | [Download]({source['url']}) | {source['size']:,} | "
                            f"`{path.relative_to(ROOT)}` | {path.stat().st_size:,} |")
        manifest.append("")
    manifest += ["Shelf geometry and UVs are unchanged. Its compressed JPEG materials are embedded in one GLB. "
                 "The table repeats the total output size for each upstream component.", "", "## Loading code", "",
                 "`src/vendor/loaders/GLTFLoader.js` and `src/vendor/utils/BufferGeometryUtils.js` are unmodified "
                 "[Three.js r160.1](https://github.com/mrdoob/three.js/tree/r160.1/examples/jsm) add-ons. "
                 "The three.js authors’ MIT notice is in `src/vendor/THREE-LICENSE.txt`.", ""]
    (ROOT / "docs" / "ASSET_MANIFEST.md").write_text("\n".join(manifest), encoding="utf8")


if __name__ == "__main__":
    main()
