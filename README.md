# Hantaview Backend

Real-time hantavirus surveillance API. Aggregates data from CDC (NNDSS Socrata API), WHO (RSS), and ECDC reference data.

## Deploy to Render (free, recommended)

1. Push this folder to a GitHub repo
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your GitHub repo
4. Render auto-detects `render.yaml` — click **Deploy**
5. Your API will be live at `https://hantaview-api.onrender.com` (or similar)

> **Free tier note:** Render spins the service down after 15 min of inactivity. First request after sleep takes ~30s. Upgrade to Starter ($7/mo) for always-on.

## Deploy to Railway ($5/mo, always-on)

```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

## Deploy to Fly.io (free tier, always-on)

```bash
npm install -g flyctl
fly auth login
fly launch          # auto-detects Dockerfile
fly deploy
```

## Update the frontend

Once deployed, set the API URL in `hantaview-complete.html`:

```js
// Replace this line:
const API_BASE = window.HANTAVIEW_API || 'http://localhost:3000/api';

// With your Render URL:
const API_BASE = 'https://hantaview-api.onrender.com/api';
```

Or host the HTML on Render/Netlify/GitHub Pages and inject the URL via a script tag before `hantaview-complete.html` loads:

```html
<script>window.HANTAVIEW_API = 'https://hantaview-api.onrender.com/api';</script>
```

## Local development

```bash
cp .env.example .env
npm install
npm run dev     # nodemon hot-reload
npm test        # Jest test suite
```

## API endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/cases` | All cases. Filters: `?year=2026&strain=andes&country=US` |
| `GET /api/stats` | Global summary counts |
| `GET /api/outbreak/mv-hondius` | MV Hondius 2026 outbreak detail |
| `GET /api/health` | Health check + source status |
| `POST /api/admin/refresh` | Force cache refresh (requires `X-Admin-Key` header) |
