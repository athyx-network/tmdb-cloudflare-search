# TMDB Cloudflare Worker Search Extractor

A Cloudflare Worker that searches TMDB movies and TV shows, automatically fetches every search result page, and returns the result name, TMDB ID, TMDB link, and cover image link.

## Install

```powershell
npm install
```

## Run Locally

```powershell
npm run dev
```

Then open:

```text
http://localhost:8787/?query=inside%20out
```

You can also use `q`:

```text
http://localhost:8787/?q=inside%20out
```

## Deploy

```powershell
npm run deploy
```
