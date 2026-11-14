# TopoCalc

Topography tools for landscape architects, in one app. Originally built with [Base44](https://base44.com).

| Tool | What it does |
| ---- | ------------ |
| **Slope** | Distance, slope or height from the other two. |
| **Elevation** | Slope, second point or distance between two levels. |
| **Stairs** | Buildable riser / tread combinations with a scaled section. |
| **Path Sections** | From a DXF with a path and contours: the long section, cross sections every N metres and free-hand sections, with DXF export. |
| **Cut & Fill** | Cut and fill volumes on a grid of existing and planned levels (zero-line method), over an optional background plan, with CSV / SVG / DXF export. |

A tool can be linked to directly with `?tool=` (`slope`, `elevation`, `stairs`, `sections`, `cut-fill`).

## Layout

- `src/pages/SlopeCalculator.jsx` — the app shell: the tool list, folder tabs and the three calculators.
- `src/features/shared/` — the look shared by the two workspace tools (panels, buttons, stats, dialogs, colours).
- `src/features/sections/` — Path Sections. `geometry.ts`, `dxfService.ts` and `storageService.ts` are the calculation engine, DXF reader/writer and project storage.
- `src/features/cutfill/` — Cut & Fill. `math.ts` and `exporters.ts` are the volume engine and the exporters.

The two workspace tools are TypeScript and load on first use. Projects are saved in the browser only.

## Development

```bash
npm install
npm run dev
```

Checks: `npm run lint` (JS/JSX) and `npm run typecheck:features` (the TypeScript tools).

To run against the Base44 backend, create `.env.local`:

```
VITE_BASE44_APP_ID=your_app_id
VITE_BASE44_APP_BASE_URL=your_backend_url
```

## CI & deployment

`.github/workflows/deploy.yml` lints, type-checks and builds pull requests, and deploys to **GitHub Pages** on every push to `main` or `stage`:

| Branch  | URL |
| ------- | --- |
| `main`  | https://uriyalb.github.io/TopoCalc/ |
| `stage` | https://uriyalb.github.io/TopoCalc/stage/ |

Pages serves one site per repository, so each deploy rebuilds both branches and publishes them together. Try changes on `stage` first, then merge `stage` into `main` to release.

The Pages build is a standalone static site:

- `BASE_PATH=/<repo-name>/` sets the Vite base path and router basename.
- `VITE_STANDALONE=true` skips the Base44 backend auth check (there is no backend on Pages).
- `404.html` is a copy of `index.html` so client-side routes work on refresh.

One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Local equivalent of the Pages build:

```bash
BASE_PATH=/TopoCalc/ VITE_STANDALONE=true npm run build
```
