# Hull Registry: instructions for Claude Code

You are setting up or maintaining a local copy of the Hull Registry, a 3D viewer for a library of Dual Universe
blueprints. Everything the viewer needs is either in this folder or in the GitHub release of this repository. Nothing
has to be generated from scratch: the 3D models cannot be rebuilt here (they come from the game's own voxel tool on a
myDU server), so always fetch them from the release.

## First-time setup (do this when models/ or blueprints/ is missing)

1. Make sure you are in the folder that contains `HullRegistry.exe` and `index.html`.
2. Fetch the latest release assets of `TheBobLoblaw/hull-registry`. With the GitHub CLI:

       gh release download --repo TheBobLoblaw/hull-registry --pattern "models*.zip" --pattern "blueprints.zip" --dir .

   Without `gh`, download the same files from https://github.com/TheBobLoblaw/hull-registry/releases/latest with curl
   or the browser. The models are split into `models-part1.zip` and `models-part2.zip` (about 1.4 GB each, GitHub's per-file
   limit is 2 GB); get both. `blueprints.zip` is about 450 MB.
3. Unzip every `models*.zip` and `blueprints.zip` here. Each zip already contains its top-level folder (`models/...`,
   `blueprints/...`), so after unzipping this folder holds `models\Ships\...`, `models\Elevators\...`, `models\Other\...`
   and `blueprints\...`. Delete the zips afterwards.
4. Check: `models` should hold about 458 `.glb` files and `blueprints` about 462 `.json` files. Compare with
   `catalog.json`: every row's `f` is a blueprint path; the model for it is the same path with `.glb` under `models`.
5. Start `HullRegistry.exe` (or `python serve.py`). It serves this folder on http://localhost:8765/ and opens the
   browser. `http://localhost:8765/glb-index.json` lists the models it found; if it is empty the `models` folder is in
   the wrong place.

## Updating later

- Viewer and catalogue: pull this repository (`git pull`) or download the ZIP again and overwrite the files, keeping
  `models` and `blueprints`.
- Models and blueprints: download the newest release assets and unzip over the existing folders. A release note says
  which hulls were added.

## What not to do

- Do not try to convert blueprint `.json` files into `.glb` models: the voxel mesh needs Novaquark's `dual-voxel` tool
  inside a myDU server container, plus the game's element meshes. It is not possible from this folder.
- Do not run the exe from inside a zip or from a folder without the viewer files: it serves whatever folder it sits in.
- Port 8765 must be free. If another program uses it, run `python serve.py` after editing `PORT` at the top.

## If something is wrong

- Viewer opens but the list is empty: `catalog.json` is missing or the page was opened as a file instead of through the
  server. Always use http://localhost:8765/.
- A hull shows "no 3D model for this hull yet": that `.glb` is not in `models`. Check the path against `catalog.json`.
- Models load but look untextured: the browser could not reach the CDN for three.js's decoder; internet is needed once.
