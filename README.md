# Hull Registry

A 3D viewer for the Old Dominion blueprint library: 461 community-built Dual Universe ships and buildings, each with a
model you can orbit, its stats, its full component list, and the blueprint file itself.

Nothing to install and no account needed. Windows.

## Set it up (10 minutes, mostly download time)

1. Download this repository: green **Code** button, **Download ZIP**, unzip it somewhere (for example `C:\HullRegistry`).
2. Open the **Releases** page (right-hand side of the GitHub page) and download from the latest release:
   - `models-part1.zip` and `models-part2.zip` (about 1.4 GB each), unzip both **into the same folder**, so you get one `models` folder next to `HullRegistry.exe`.
   - `blueprints.zip` (about 450 MB), same thing: a `blueprints` folder next to the exe.
3. Double-click **HullRegistry.exe**. A black window stays open (that is the little web server; close it to quit) and the
   viewer opens in your browser at http://localhost:8765/.

Windows SmartScreen may warn about the exe because it is unsigned: "More info", then "Run anyway". It is a 9 MB Python
web server and nothing else; `serve.py` in this folder is its source.

If you have Claude Code, `CLAUDE.md` in this folder tells it how to do all of the above for you.

## Using it

- Click a hull in the list. Drag to orbit, wheel to zoom, `r` resets the camera, `rotate` toggles the turntable, `wire` shows the mesh.
- Search by name, builder or component ("Basic Container L", "Atmospheric Engine M"). Filter by category, core size, role
  and builder; sort by mass, element count, cargo, weapons or engines. "only with 3D model ready" hides hulls whose model is not in your `models` folder.
- The details pane shows the fit (engines, wings, containers, weapons, industry), the component list, and "copy blueprint
  link", which is the file in your `blueprints` folder.
- `j` and `k` move through the list.

## Folder layout

    HullRegistry.exe      the local web server (built from serve.py, see BUILD.md)
    index.html, registry.js, registry.css, kit.js    the viewer (three.js from a CDN, so it needs internet the first time)
    catalog.json, components.json, slots.json         the catalogue
    public.js             tells the viewer that models and blueprints are local folders
    models/               from models.zip: one .glb per hull, same paths as the catalogue
    blueprints/           from blueprints.zip: the blueprint .json files

Models are packed (WebP textures at 512 px, compressed meshes) from Blender exports of the blueprints, 2.8 GB in all; the
originals are 32 GB and live on the maintainer's PC. This copy is refreshed from the main server project whenever the library changes.
