const TMDB_BASE_URL = "https://www.themoviedb.org";
const LANGUAGE = "en-US";
const SEARCH_TYPES = ["movie", "tv"];

export default {
  async fetch(request) {
    const requestUrl = new URL(request.url);
    const query = requestUrl.searchParams.get("query") || requestUrl.searchParams.get("q");

    if (!query || !query.trim()) {
      return jsonResponse(
        {
          error: "Missing search query.",
          usage: "Use ?query=inside out or ?q=inside out",
          example: `${requestUrl.origin}/?query=inside%20out`
        },
        400
      );
    }

    try {
      const movies = await fetchAllResults("movie", query.trim());
      const tvShows = await fetchAllResults("tv", query.trim());

      return jsonResponse({
        query: query.trim(),
        results: [...movies, ...tvShows]
      });
    } catch (error) {
      return jsonResponse(
        {
          error: "Could not fetch TMDB search results.",
          details: error instanceof Error ? error.message : String(error)
        },
        502
      );
    }
  }
};

async function fetchAllResults(type, query) {
  const firstHtml = await fetchSearchPage(type, query, 1);
  const totalPages = getTotalPages(firstHtml, type);
  const pages = [firstHtml];

  if (totalPages > 1) {
    for (let page = 2; page <= totalPages; page += 1) {
      await sleep(1000);
      pages.push(await fetchSearchPage(type, query, page));
    }
  }

  return dedupeResults(
    pages.flatMap((html) => extractResults(html, type))
  );
}

async function fetchSearchPage(type, query, page) {
  const path = type === "movie" ? "/search" : `/search/${type}`;
  const url = new URL(path, TMDB_BASE_URL);
  url.searchParams.set("language", LANGUAGE);
  url.searchParams.set("query", query);
  if (page > 1) {
    url.searchParams.set("page", String(page));
  }

  let response;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; tmdbextract-worker/1.0)",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });

    if (response.status !== 429 || attempt === 5) {
      break;
    }

    const retryAfter = Number(response.headers.get("Retry-After"));
    await sleep(Number.isFinite(retryAfter) ? retryAfter * 1000 : 2000 * attempt);
  }

  if (!response.ok) {
    throw new Error(`TMDB returned HTTP ${response.status} for ${type} page ${page}`);
  }

  return response.text();
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function extractResults(html, type) {
  const section = getActiveSearchSection(html, type);
  const cardMatches = section.matchAll(
    /<div\b[^>]*class="[^"]*\bcomp:media-card\b[^"]*"[\s\S]*?(?=<div\b[^>]*class="[^"]*\bcomp:media-card\b|<script\b|<div\b[^>]*class="[^"]*\bpagination_wrapper\b|<\/section>)/g
  );

  const results = [];
  for (const match of cardMatches) {
    const card = match[0];
    const titleMatch = card.match(/<h2\b[^>]*>[\s\S]*?<span\b[^>]*>([\s\S]*?)<\/span>[\s\S]*?<\/h2>/i);
    const linkMatch = card.match(new RegExp(`<a\\b[^>]*data-media-type="${type}"[^>]*href="([^"]+)"`, "i"));

    if (!titleMatch || !linkMatch) {
      continue;
    }

    const name = decodeHtml(stripTags(titleMatch[1]));
    const link = absoluteTmdbLink(decodeHtml(linkMatch[1]));
    const tmdbId = extractTmdbId(link, type);

    if (name && tmdbId) {
      results.push({
        type,
        name,
        tmdb_id: tmdbId,
        link
      });
    }
  }

  return results;
}

function getActiveSearchSection(html, type) {
  const startPattern = new RegExp(`<div\\b[^>]*class="[^"]*\\bsearch_results\\b[^"]*\\b${type}\\b[^"]*"`, "i");
  const startMatch = html.match(startPattern);
  if (!startMatch || startMatch.index === undefined) {
    return html;
  }

  const start = startMatch.index;
  const nextSectionPattern = /<div\b[^>]*class="[^"]*\bsearch_results\b[^"]*"/gi;
  nextSectionPattern.lastIndex = start + startMatch[0].length;
  const nextMatch = nextSectionPattern.exec(html);
  return html.slice(start, nextMatch?.index ?? html.length);
}

function getTotalPages(html, type) {
  const section = getActiveSearchSection(html, type);
  const pages = [...section.matchAll(/[?&]page=(\d+)/g)].map((match) => Number(match[1]));
  return Math.max(1, ...pages.filter(Number.isFinite));
}

function extractTmdbId(link, type) {
  const url = new URL(link);
  const [mediaType, slug] = url.pathname.split("/").filter(Boolean);
  if (mediaType !== type || !slug) {
    return "";
  }

  return slug.match(/^\d+/)?.[0] || "";
}

function absoluteTmdbLink(href) {
  return new URL(href, TMDB_BASE_URL).toString();
}

function dedupeResults(results) {
  const seen = new Set();
  return results.filter((result) => {
    const key = `${result.type}:${result.tmdb_id}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function stripTags(value) {
  return value.replace(/<[^>]*>/g, " ");
}

function decodeHtml(value) {
  const entities = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: "\""
  };

  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([a-f\d]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (_, name) => entities[name.toLowerCase()] ?? `&${name};`)
    .replace(/\s+/g, " ")
    .trim();
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
