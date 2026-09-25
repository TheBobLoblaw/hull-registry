# Hull Registry: setup brief for Claude Code

You are in a copy of the Hull Registry, a self-contained 3D viewer for 461 Dual Universe blueprints. Your job is to make this
folder complete and working, without asking questions, and to keep it **portable**: everything lives in this one folder,
nothing is installed, registered or written anywhere else on the machine. When it is done the folder can be copied to a USB
stick or another Windows PC and `HullRegistry.exe` runs there as is.

## What "complete" means

    HullRegistry.exe           the local web server (9 MB, no dependencies; source is serve.py)
    index.html registry.js registry.css kit.js public.js    the viewer
    vendor/three/              three.js and its addons, bundled so no internet is needed to view
    catalog.json components.json slots.json                 the catalogue
    models/                    458 .glb files, same paths as the catalogue   <- from the GitHub release
    blueprints/                462 .json blueprint files                     <- from the GitHub release
    setup.ps1                  the script that fetches those two folders

`models` and `blueprints` are not in git (2.85 GB and 446 MB); they come from the release of `TheBobLoblaw/hull-registry`.

## Do this

1. From this folder run the setup script. It reads the latest release from the GitHub API, downloads `models-part1.zip`,
   `models-part2.zip` and `blueprints.zip` (about 3.3 GB in all, so it takes a while on a slow line), unpacks them here,
   deletes the zips, prints the counts and starts the viewer:

       powershell -ExecutionPolicy Bypass -File setup.ps1 -NoStart

   It is idempotent; if it was interrupted, run it again. It needs only PowerShell 5 or newer, which every Windows has.
2. If the script cannot run (no PowerShell, a corporate proxy, the API rate-limited), do the same by hand: download the
   three zips from https://github.com/TheBobLoblaw/hull-registry/releases/latest (with `gh release download --repo
   TheBobLoblaw/hull-registry --pattern "*.zip"`, `curl -L`, or a browser) and unzip each one into this folder. Every zip
   already contains its top-level folder, so unzipping here yields `models\Ships\...`, `models\Elevators\...`,
   `models\Other\...`, `models\Voxel\...` and `blueprints\...`. Never unzip into a subfolder of your own.
3. Verify, and fix anything that fails:
   - `models` holds 456 or more `.glb` files and `blueprints` holds 462 `.json` files.
   - `catalog.json` parses and has 461 rows; each row's `f` is a path like `Ships/M Cores/Name.json`; its model is the same
     path with `.glb` under `models`, its blueprint the same path under `blueprints`.
   - Start `HullRegistry.exe`. It prints the URL, opens the browser at http://localhost:8765/, and
     http://localhost:8765/glb-index.json returns a JSON list with the same count as the `.glb` files. Load
     http://localhost:8765/?sel=Ships%2FXS%20Cores%2FArmitage%20-%20APS%20Delta%20Mk1.json and confirm the model renders.
   - Windows SmartScreen may block the unsigned exe the first time: "More info", "Run anyway". If the exe is refused
     entirely, `python serve.py` does the same job when Python 3 is present.
4. Leave the folder tidy: no `_download` folder, no zips, no build output.

## Portability rules

- Everything is relative to the folder the exe sits in; do not move files out of it or point anything at absolute paths.
- Do not install Python, Node or anything else for the viewer; it does not need them. Do not add a scheduled task,
  service, firewall rule or shortcut outside the folder.
- To move it: copy the whole folder. To hand it to someone: zip the whole folder (about 3.4 GB with models).
- The browser remembers picks and panel positions in its own storage; that is fine and per machine.
- Port 8765 is the only thing it uses. If it is taken, edit `PORT` at the top of `serve.py` and run that instead.

## Updating later

- Viewer and catalogue: `git pull` here (or download the repo ZIP again and overwrite, keeping `models` and `blueprints`).
- Models and blueprints: run `setup.ps1` again; it skips assets already unpacked for that release and fetches new ones.

## Do not

- Do not try to rebuild models from blueprint JSON. The voxel mesh needs Novaquark's `dual-voxel` tool inside a myDU
  server container plus the game's element meshes; it is impossible from this folder. Always take models from the release.
- Do not open `index.html` as a file; the viewer must be served (the exe or `serve.py`) or the catalogue will not load.
- Do not commit `models`, `blueprints` or zips to git; `.gitignore` already excludes them.
