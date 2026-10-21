# LUBUK Game Archive

`site/` is GitHub Pages content. `pc-releases/` contains local Windows ZIPs for GitHub Releases and is excluded from Git commits.

Live URLs: [game archive](https://nisofeve.github.io/LUBUK/), [game summary](https://nisofeve.github.io/LUBUK/summary.html), and [update report](https://nisofeve.github.io/LUBUK/report.html).

## Current collection

HTML5: ComFront, Compy, MyMyth (`Mymyth_v2`), Plotbound, Sigilbound, Type Zomba, [Skeet Shooting](https://rafiktodak.itch.io/skeet-shooting), [i-Li Liquid State](https://zoolism.itch.io/i-li-liquid-state), [Don't Touch The Same](https://mudzakkir90.itch.io/dont-touch-the-same), [Potionpendium](https://potionpendium.vercel.app/), and [QuantumLoom](https://quantum-loom.vercel.app/). Desktop browser games: Ketum Farmer, [Tower Rush](https://mudzakkir90.itch.io/tower-rush), and [Purritory](https://purri-tory.vercel.app/). Windows builds: Hyperbloomers v0.2, Don't Forget to Pee HD 27 (project 333), ToGather:Crops Build 42 (project TGC), and Police N Thief v1.10.

## Update workflow

1. Add human-written gameplay notes to `reports/notes.json`: objects with `date` (YYYY-MM-DD), `game`, and `text`.
2. Run `powershell -File scripts/refresh-local.ps1` to sync HTML5 games and update report. Add `-PackagePC` when PC builds changed. Script keeps source projects untouched and excludes source files, dependencies, old ZIPs, and Unity debug folders.
3. Commit and push site, report, and notes to GitHub. Pages workflow publishes `site/` on push to `main`.
4. Upload `pc-releases/` ZIPs to GitHub Releases using matching tags:

| Tag | Asset |
| --- | --- |
| `hyperbloomers-v0.2` | `Hyperbloomers-v0.2-Windows.zip` |
| `333-hd27` | `333-HD27-Windows.zip` |
| `tgc-42` | `TGC-42-Windows.zip` |
| `police-n-thief-v1.10` | `Police-N-Thief-v1.10-Windows.zip` |

Report page's **Update report** button fetches latest published `report.json`. GitHub Pages cannot inspect local files or write commits; run local report script and push before button can show new folder changes. Release links target `nisofeve/LUBUK`.

Create a GitHub repository with `main` branch, push this folder, then set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. Run `python -m http.server 8000 --directory site` for local preview, then open `http://localhost:8000/`.

## Notes

- ComFront and Plotbound copied builds originally use root-based paths. `refresh-local.ps1` rewrites them for Pages.
- Type Zomba loads Babylon.js from CDN; first play needs internet.
- ComFront multiplayer and cloud features require their original external services. Plotbound and Sigilbound can run local-only according to their source READMEs.
- Test all game links on a local HTTP server and again on actual GitHub Pages URL.
