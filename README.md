# TMDB Cloudflare Worker Search Extractor

A Cloudflare Worker that searches TMDB movies and TV shows, automatically fetches every search result page, and returns only the result name, TMDB ID, and link.

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

## Response

```json
{
  "query": "inside out",
  "results": [
    {
      "type": "movie",
      "name": "Inside Out",
      "tmdb_id": "150540",
      "link": "https://www.themoviedb.org/movie/150540-inside-out?language=en-US"
    }
  ]
}
```
