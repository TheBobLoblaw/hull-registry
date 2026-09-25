# Hull Registry

A self-contained 3D viewer for the Old Dominion blueprint library: 461 community-built Dual Universe ships and buildings,
each with a model you can orbit, its stats, its full component list, and the blueprint file itself. Windows, portable,
nothing to install.

## Setup

Two ways:

- **With Claude Code in VS Code:** open this folder and say "set up the Hull Registry". `CLAUDE.md` tells it exactly what
  to do and how to check it.
- **By hand:** right-click `setup.ps1`, "Run with PowerShell". It downloads the models and blueprints from the release
  (about 3.3 GB) into this folder and starts the viewer. Then, any time: double-click `HullRegistry.exe`.

Windows SmartScreen may warn about the unsigned exe the first time: "More info", then "Run anyway". It is a small web
server that serves this folder on http://localhost:8765/ and nothing else; `serve.py` is its source.

## Portable

The folder is the whole program. Copy it to a USB stick or another PC, run the exe there. No internet is needed once the
models are in place; three.js is bundled under `vendor/`.

## Using it

- Click a hull. Drag to orbit, wheel to zoom, `r` resets the camera, `rotate` toggles the turntable, `wire` shows the mesh.
- Search by name, builder or component ("Basic Container L", "Atmospheric Engine M"). Filter by category, core size, role
  and builder; sort by mass, element count, cargo, weapons or engines.
- The details pane shows the fit, the component list and "copy blueprint link" for the file in `blueprints`.
- `j` and `k` move through the list.

## Contents

    HullRegistry.exe  setup.ps1  serve.py  BUILD.md
    index.html  registry.js  registry.css  kit.js  public.js  vendor/three/
    catalog.json  components.json  slots.json
    models/       from the release, 458 .glb (packed: WebP textures at 512 px, meshopt meshes; 2.85 GB)
    blueprints/   from the release, 462 .json (446 MB)

Refreshed from the main server project whenever the library changes; a new release carries new models.
