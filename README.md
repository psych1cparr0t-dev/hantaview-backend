# Hantaview

A real-time hantavirus surveillance dashboard. Aggregates case data from official public health sources and displays it on an interactive world map with outbreak alerts and prevention guidance.

**Live:** [psych1cparr0t-dev.github.io/hantaview](https://psych1cparr0t-dev.github.io/hantaview/) · **API:** [hantaview-backend.onrender.com](https://hantaview-backend.onrender.com/api/health)

---

## What it does

- **Interactive map** — plots confirmed hantavirus cases globally, clustered by region, color-coded by strain (Andes = orange, all others = teal)
- **Live data** — pulls from three official sources on startup, caches for 1 hour, serves stale cache if sources go down
- **Outbreak alert** — dedicated tab for the MV Hondius cruise ship outbreak (May 2026, Andes virus, 11 cases / 3 deaths)
- **Education tab** — transmission routes, PPE guidance, prevention strategies, why it won't pandemic

## Data sources

| Source | Data | Method |
|--------|------|--------|
| CDC NNDSS | US state-level HPS cases (2022, most recent public dataset) | Socrata JSON API |
| WHO Disease Outbreak News | Active outbreak alerts | RSS feed |
| ECDC | MV Hondius 2026 evacuees + European AER 2022 aggregate | Reference data (pages are JS-rendered) |

**Note on 2026 non-MV-Hondius data:** South American (Argentina, Chile) and East Asian (South Korea, Japan) 2026 entries are based on known endemic patterns and regional health agency reporting trends — not pulled from a live API. They are labeled accordingly in the source field.

## Stack

- **Frontend** — vanilla HTML/CSS/JS, Leaflet.js map, hosted on GitHub Pages
- **Backend** — Node.js + Express, in-memory cache, hosted on Render
- **Data pipeline** — axios fetching, cheerio/xml2js parsing, zod validation, deduplication across sources

## API

```
GET /api/cases          — all cases (filters: ?year=, ?strain=, ?country=)
GET /api/stats          — global totals by strain and source
GET /api/outbreak/mv-hondius  — MV Hondius outbreak detail
GET /api/health         — uptime + per-source sync status
```

## Local dev

```bash
cp .env.example .env
npm install
npm run dev
```
