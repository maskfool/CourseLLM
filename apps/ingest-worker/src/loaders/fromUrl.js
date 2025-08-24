// apps/ingest-worker/src/loaders/fromUrl.js
import { SitemapLoader } from "@langchain/community/document_loaders/web/sitemap";
import { RecursiveUrlLoader } from "@langchain/community/document_loaders/web/recursive_url";
import { Document } from "@langchain/core/documents";

/**
 * Smart URL ingestion:
 * 1) Try sitemap at <origin>/sitemap.xml
 * 2) Fallback to recursive crawl within same origin (depth=2)
 * Each page is tagged with metadata.source = page URL and metadata.docId
 */
export async function fromUrl(startUrl, docId) {
  const baseUrl = normalizeUrl(startUrl);

  // 1) Try sitemap first
  const sitemapUrl = new URL("/sitemap.xml", baseUrl).toString();
  try {
    console.log(`[fromUrl] Trying sitemap: ${sitemapUrl}`);
    const sitemap = new SitemapLoader(sitemapUrl, {
      filterUrls: (u) => sameOrigin(baseUrl, u),
    });
    const docs = await sitemap.load();
    if (docs?.length) {
      console.log(`[fromUrl] Loaded ${docs.length} pages via sitemap`);
      return docs.map((d) =>
        new Document({
          pageContent: d.pageContent || "",
          metadata: {
            ...(d.metadata || {}),
            source:
              d.metadata?.source ||
              d.metadata?.loc ||
              d.metadata?.link ||
              d.metadata?.url ||
              baseUrl,
            origin: new URL(baseUrl).origin,
            type: "url",
            docId,
          },
        })
      );
    }
  } catch (e) {
    console.warn(`[fromUrl] Sitemap missing/failed → ${e.message}`);
  }

  // 2) Fallback: recursive crawl (depth=2)
  console.log(`[fromUrl] Using RecursiveUrlLoader depth=2: ${baseUrl}`);
  const recursive = new RecursiveUrlLoader(baseUrl, {
    maxDepth: 2,
    sameDomain: true,
    // Do NOT pass "extractor: 'html'". If needed, you can pass a function:
    // extractor: (html, url) => html,  // raw HTML
    excludeDirs: ["/login", "/auth", "/_next", "/static", "/assets"],
    // You can also pass "timeout" etc. if required
  });

  const pages = await recursive.load();
  console.log(`[fromUrl] Crawled ${pages.length} pages via recursive loader`);

  return pages.map((p) =>
    new Document({
      pageContent: p.pageContent || "",
      metadata: {
        ...(p.metadata || {}),
        source:
          p.metadata?.source ||
          p.metadata?.loc ||
          p.metadata?.link ||
          p.metadata?.url ||
          baseUrl,
        origin: new URL(baseUrl).origin,
        type: "url",
        docId,
      },
    })
  );
}

function normalizeUrl(u) {
  try {
    return new URL(u).toString();
  } catch {
    return u;
  }
}

function sameOrigin(a, b) {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}