#!/usr/bin/env python3
"""Build offline desktop apps of Ash Mountain Shrine (Windows, macOS, Linux) with Electron.

Usage:  python3 desktop/build.py            # from the repository root
Output: dist/AshMountainShrine-*.zip / .tar.gz

It downloads Electron's prebuilt zips from GitHub releases (checked against SHASUMS256.txt),
copies the game (index.html with its CDN links pointed at desktop/lib) and models/ into each app,
and packs the results. Nothing is compiled.
"""
import hashlib, io, os, plistlib, re, shutil, subprocess, tarfile, urllib.request, zipfile

ELECTRON = "v33.2.1"
NAME = "Ash Mountain Shrine"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DESK, CACHE, DIST = os.path.join(ROOT, "desktop"), os.path.join(ROOT, ".cache"), os.path.join(ROOT, "dist")
TARGETS = {"Windows-x64": "win32-x64", "Linux-x64": "linux-x64", "macOS-AppleSilicon": "darwin-arm64", "macOS-Intel": "darwin-x64"}
REWRITES = {
    '<link rel="preconnect" href="https://fonts.googleapis.com">\n': "",
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n': "",
    "https://fonts.googleapis.com/css2?family=Yuji+Syuku&family=Zen+Maru+Gothic:wght@500;700;900&display=swap": "lib/fonts/fonts.css",
    "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js": "./lib/three/build/three.module.js",
    "https://cdn.jsdelivr.net/npm/three@0.164.1/examples/jsm/": "./lib/three/examples/jsm/",
    "https://cdn.jsdelivr.net/npm/@pixiv/three-vrm@2.1.3/lib/three-vrm.module.min.js": "./lib/vrm/three-vrm.module.min.js",
}

def fetch(url):
    with urllib.request.urlopen(url) as r:
        return r.read()

def electron_zip(plat):
    os.makedirs(CACHE, exist_ok=True)
    name = f"electron-{ELECTRON}-{plat}.zip"; path = os.path.join(CACHE, name)
    sums = fetch(f"https://github.com/electron/electron/releases/download/{ELECTRON}/SHASUMS256.txt").decode()
    want = re.search(r"^([0-9a-f]{64}) \*?" + re.escape(name) + "$", sums, re.M).group(1)
    if not (os.path.exists(path) and hashlib.sha256(open(path, "rb").read()).hexdigest() == want):
        data = fetch(f"https://github.com/electron/electron/releases/download/{ELECTRON}/{name}")
        if hashlib.sha256(data).hexdigest() != want:
            raise SystemExit(f"checksum mismatch for {name}")
        open(path, "wb").write(data)
    return path

def stage_app(dest):
    game = os.path.join(dest, "game")
    os.makedirs(game)
    for f in ("main.js", "package.json"):
        shutil.copy(os.path.join(DESK, f), dest)
    shutil.copytree(os.path.join(DESK, "lib"), os.path.join(game, "lib"))
    shutil.copytree(os.path.join(ROOT, "models"), os.path.join(game, "models"))
    html = open(os.path.join(ROOT, "index.html"), encoding="utf8").read()
    for a, b in REWRITES.items():
        html = html.replace(a, b)
    head = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n'
    open(os.path.join(game, "index.html"), "w", encoding="utf8").write(head + html)

def unzip(src, dest):  # keeps symlinks and exec bits, which macOS bundles need
    subprocess.run(["unzip", "-q", src, "-d", dest], check=True)

def build(label, plat):
    work = os.path.join(DIST, label); shutil.rmtree(work, ignore_errors=True); os.makedirs(work)
    unzip(electron_zip(plat), work)
    if plat.startswith("win"):
        os.rename(os.path.join(work, "electron.exe"), os.path.join(work, NAME + ".exe")); res = os.path.join(work, "resources")
    elif plat.startswith("linux"):
        os.rename(os.path.join(work, "electron"), os.path.join(work, "ash-mountain-shrine")); res = os.path.join(work, "resources")
    else:
        app = os.path.join(work, NAME + ".app"); os.rename(os.path.join(work, "Electron.app"), app)
        res = os.path.join(app, "Contents", "Resources")
        pl = os.path.join(app, "Contents", "Info.plist"); d = plistlib.load(open(pl, "rb"))
        d.update(CFBundleName=NAME, CFBundleDisplayName=NAME, CFBundleIdentifier="com.vidyahgamu.ashmountainshrine")
        plistlib.dump(d, open(pl, "wb"))
    try: os.remove(os.path.join(res, "default_app.asar"))
    except FileNotFoundError: pass
    stage_app(os.path.join(res, "app"))
    shutil.copy(os.path.join(DESK, "readme", label.split("-")[0] + ".txt"), os.path.join(work, "README.txt"))
    out = os.path.join(DIST, f"AshMountainShrine-{label}")
    if plat.startswith("linux"):
        subprocess.run(["tar", "-czf", out + ".tar.gz", "-C", work, "--transform", "s,^\\.,AshMountainShrine,", "."], check=True)
    else:
        subprocess.run(["zip", "-qry", "-9", os.path.abspath(out + ".zip"), "."], cwd=work, check=True)
    print("built", out)

if __name__ == "__main__":
    for label, plat in TARGETS.items():
        build(label, plat)
