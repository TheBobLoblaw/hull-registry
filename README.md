# Hull Registry

A 3D viewer for the Old Dominion blueprint library: 461 community-built Dual Universe ships and buildings, with a model
preview, stats, component lists and a copy-able blueprint link for each one.

## Easiest: open it in a browser

http://138.197.88.4:8088/ — nothing to install. Click a hull in the list to see it in 3D, search by name, builder or
component, filter by size and role. "copy blueprint link" gives a URL you can paste into a myDU server's blueprint import.

## Run it on your own PC

You need Python 3 (https://www.python.org, tick "Add to PATH" when installing).

1. Download this repository: green **Code** button, **Download ZIP**, unzip it anywhere. Or `git clone https://github.com/TheBobLoblaw/hull-registry`.
2. Double-click **Start Hull Registry.bat**. A window opens the viewer at http://localhost:8765/.
3. The 3D models and blueprint files stream from the VPS as you click hulls (they are 32 GB, so they are not in the download).

Keys in the viewer: `j` `k` move through the list, `space` picks, `r` resets the camera; drag to orbit, wheel to zoom.

## What is in here

- `index.html`, `registry.js`, `registry.css`, `kit.js`: the viewer (three.js from a CDN).
- `catalog.json`, `components.json`, `slots.json`: the catalogue, one row per hull, with its element list.
- `public.js`: where the models and blueprints come from.
- `serve.py` and the .bat: a tiny local web server, because browsers will not load the catalogue from a plain file.

Updated from the main server project (`du-server/tools/hull-registry/export_standalone.sh`) whenever the library changes.
