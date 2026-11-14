# TopoCalc

Topography calculator for landscape architects — slope, elevation, stairs and distance calculations. Originally built with [Base44](https://base44.com).

## Development

```bash
npm install
npm run dev
```

To run against the Base44 backend, create `.env.local`:

```
VITE_BASE44_APP_ID=your_app_id
VITE_BASE44_APP_BASE_URL=your_backend_url
```

## CI & deployment

`.github/workflows/deploy.yml` lints and builds on pull requests, and on every push to `master` it builds and deploys to **GitHub Pages** (also runnable manually from the Actions tab).

The Pages build is a standalone static site:

- `BASE_PATH=/<repo-name>/` sets the Vite base path and router basename.
- `VITE_STANDALONE=true` skips the Base44 backend auth check (there is no backend on Pages).
- `404.html` is a copy of `index.html` so client-side routes work on refresh.

One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Local equivalent of the Pages build:

```bash
BASE_PATH=/TopoCalc/ VITE_STANDALONE=true npm run build
```
