# Building HullRegistry.exe

From this folder, with Python 3 and PyInstaller (`pip install pyinstaller`):

    pyinstaller --onefile --name HullRegistry --console --icon NONE serve.py

The exe lands in `dist/HullRegistry.exe`; copy it next to `index.html`. It serves whatever folder it sits in, so the viewer
files, `models/` and `blueprints/` must be beside it.
