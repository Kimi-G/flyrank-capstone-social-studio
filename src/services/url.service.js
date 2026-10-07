const cheerio = require("cheerio");

function normalizeText(value) {
  return value
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchPostFromUrl(sourceUrl) {
  let parsedUrl;

  try {
    parsedUrl = new URL(sourceUrl);
  } catch {
    throw new Error("Invalid source_url: a valid URL is required");
  }

  if (
    parsedUrl.protocol !== "http:" &&
    parsedUrl.protocol !== "https:"
  ) {
    throw new Error(
      "Invalid source_url: only http and https URLs are allowed"
    );
  }

  let response;

  try {
    response = await fetch(parsedUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
      headers: {
        "User-Agent":
          "FlyRank-Social-Media-Studio/1.0"
      }
    });
  } catch {
    throw new Error(
      "Could not fetch the supplied URL"
    );
  }

  if (!response.ok) {
    throw new Error(
      `URL fetch failed with status ${response.status}`
    );
  }

  const contentType =
    response.headers.get("content-type") || "";

  if (!contentType.includes("text/html")) {
    throw new Error(
      "URL must return an HTML page"
    );
  }

  const html = await response.text();

  const $ = cheerio.load(html);

  $("script, style, noscript, svg, form").remove();

  const title =
    normalizeText(
      $('meta[property="og:title"]')
        .attr("content") || ""
    ) ||
    normalizeText(
      $("h1").first().text()
    ) ||
    normalizeText(
      $("title").first().text()
    ) ||
    parsedUrl.hostname;

  let content =
    normalizeText(
      $("article").first().text()
    );

  if (!content) {
    content = normalizeText(
      $("main").first().text()
    );
  }

  if (!content) {
    content = normalizeText(
      $("body").text()
    );
  }

  if (!content) {
    throw new Error(
      "No readable content was found at the supplied URL"
    );
  }

  return {
    title,
    content,
    sourceUrl: response.url || parsedUrl.toString()
  };
}

module.exports = {
  fetchPostFromUrl
};