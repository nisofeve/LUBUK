"""Create Windows release ZIPs without Unity's DoNotShip debug folders."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import shutil

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "pc-releases"
OUT.mkdir(exist_ok=True)

def package_directory(source: Path, target: Path):
    with ZipFile(target, "w", compression=ZIP_DEFLATED, compresslevel=6, allowZip64=True) as archive:
        for path in sorted(source.rglob("*")):
            if not path.is_file() or any("DoNotShip" in part for part in path.parts):
                continue
            archive.write(path, path.relative_to(source).as_posix())
    print(f"{target.name}: {target.stat().st_size / 1024**2:.1f} MB")

shutil.copy2(
    Path(r"F:\Projects\MyGames\Cloud n Sun\Windows Compile\Hyperbloomers v0_2.zip"),
    OUT / "Hyperbloomers-v0.2-Windows.zip",
)
print("Hyperbloomers-v0.2-Windows.zip: copied existing single-executable release")
package_directory(
    Path(r"F:\Projects\333\Project 3.33 HD_27"),
    OUT / "333-HD27-Windows.zip",
)
package_directory(
    Path(r"F:\Projects\Todak Studios\TGC\TGC_42"),
    OUT / "TGC-42-Windows.zip",
)
