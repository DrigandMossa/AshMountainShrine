# Ash Mountain Shrine

A cozy-but-eerie prototype. You are an outcast on a mountain, cursed by the vengeful spirit of a villager who was sacrificed at the shrine. Make offerings of coins and treats to wake **wisplings**, little kemonomimi spirits who chop wood, forage and build. Keep them fed, housed and held when they ask for "uppies". Neglect them, and she wakes the volcano.

## Play

- **In a browser:** open `index.html` from a local web server (for example `python3 -m http.server`, then visit http://localhost:8000). It loads Three.js and three-vrm from jsDelivr. If you open the file directly, the built-in VRM models in `models/` won't load and the game falls back to its simple shapes.
- **Windows (offline):** download [`builds/AshMountainShrine-Windows-x64.zip`](builds/AshMountainShrine-Windows-x64.zip), unzip it, and double-click *Ash Mountain Shrine.exe*. It's unsigned, so click "More info", then "Run anyway" if Windows warns you. To fit GitHub's 100 MB file limit, this build keeps only the English language pack and leaves out Chromium's software renderer, so it needs a working graphics driver.
- **Mac and Linux:** build them yourself (see below).

Controls: WASD/arrows to move, Shift to run, mouse to look (click to lock), E or click to act, Space to jump, Q or right-click to toss a wispling you're holding, Esc to free the mouse. On phones, use the left side to move (push all the way to run) and the right side to look.

**Chapter one:** wake five wisplings and give each a bed. **Chapter two:** she gives you her spirit axe and follows you from the trees. Restore her shrine with five lost artifacts from the mountain and the village below, where you must not stare at the hollow ones.

## Layout

| Path | What it is |
| --- | --- |
| `index.html` | The whole game: Three.js r164 + @pixiv/three-vrm 2.1.3 |
| `models/` | VRM 1.0 characters (six wisplings and the shrine lady) and `manifest.json` mapping roles to files |
| `desktop/` | Electron wrapper (`main.js`), offline copies of the libraries and fonts (`lib/`), and `build.py` |
| `tools/model-builder/` | Scripts that generate the wispling VRMs in headless Chromium |

You can swap in your own VRoid `.vrm` characters from the in-game ☺ Characters menu. They're stored in your browser only.

## Build the desktop apps

```sh
python3 desktop/build.py
```

This produces Windows, macOS (Apple Silicon and Intel) and Linux packages in `dist/`. The builds are unsigned, and each one includes a README explaining how to open it.

## Credits

Three.js (MIT), three-vrm (MIT), Electron (MIT). Fonts are Yuji Syuku and Zen Maru Gothic, under the SIL Open Font License.
