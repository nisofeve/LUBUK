"""Check game entry files, local HTML references, and release packages."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
from zipfile import ZipFile
import json

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
GAMES = ["comfront", "compy", "mymyth", "plotbound", "sigilbound", "type-zomba", "ketum-farmer"]
PACKAGES = {
    "Hyperbloomers-v0.2-Windows.zip": "Hyperbloomer.exe",
    "333-HD27-Windows.zip": "333.exe",
    "TGC-42-Windows.zip": "ToGatherCrops.exe",
}
errors = []

class References(HTMLParser):
    def __init__(self, base):
        super().__init__()
        self.base = base
    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        for attr in ("src", "href"):
            value = values.get(attr)
            if not value or value.startswith(("#", "data:", "mailto:", "http:", "https:")):
                continue
            parsed = urlsplit(value)
            if parsed.path.startswith("/"):
                errors.append(f"Root-based link: {self.base / parsed.path}")
                continue
            target = (self.base / unquote(parsed.path)).resolve()
            if parsed.path and not target.exists():
                errors.append(f"Missing reference: {self.base} -> {value}")

References(SITE).feed((SITE / "index.html").read_text(encoding="utf-8"))
References(SITE).feed((SITE / "report.html").read_text(encoding="utf-8"))
for slug in GAMES:
    index = SITE / "games" / slug / "index.html"
    if not index.is_file():
        errors.append(f"Missing game entry: {index}")
        continue
    References(index.parent).feed(index.read_text(encoding="utf-8"))

report = json.loads((SITE / "report.json").read_text(encoding="utf-8"))
if len(report["inventory"]) != 11:
    errors.append("Report inventory should list seven HTML5 games, one PC web game, and three PC builds")
if not any(item["name"] == "Skeet Shooting" and item.get("hosting") == "itch.io" for item in report["inventory"]):
    errors.append("Skeet Shooting missing from report")
if not any(item["name"] == "Ketum Farmer" and item["kind"] == "Web game for PC" for item in report["inventory"]):
    errors.append("Ketum Farmer not classified as web game for PC")
for slug, count in {"comfront": 3, "compy": 3, "mymyth": 3, "plotbound": 3,
                    "sigilbound": 3, "type-zomba": 3, "skeet-shooting": 3,
                    "ketum-farmer": 3, "hyperbloomers": 3, "333": 3, "tgc": 3}.items():
    for number in range(1, count + 1):
        if not (SITE / "screenshots" / slug / f"{number}.png").is_file():
            errors.append(f"Missing screenshot: {slug}/{number}.png")
for filename, exe in PACKAGES.items():
    target = ROOT / "pc-releases" / filename
    if not target.is_file():
        errors.append(f"Missing release package: {filename}")
        continue
    with ZipFile(target) as archive:
        names = archive.namelist()
        if exe not in names:
            errors.append(f"{filename}: missing {exe}")
        if any("DoNotShip" in name for name in names):
            errors.append(f"{filename}: contains DoNotShip files")

if errors:
    print("\n".join(errors))
    raise SystemExit(1)
print("Checked seven hosted entries, report inventory, and three PC packages.")
