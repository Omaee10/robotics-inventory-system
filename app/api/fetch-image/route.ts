import { NextResponse } from "next/server";

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function absolutize(raw: string, baseUrl: string): string {
  const t = decodeHtmlEntities(raw.trim());
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  try {
    return new URL(t, baseUrl).href;
  } catch {
    return t;
  }
}

function firstMetaMatch(html: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    const v = match?.[1]?.trim();
    if (v) return v;
  }
  return null;
}

function pushImageField(field: unknown, into: string[]): void {
  if (field === null || field === undefined) return;
  if (typeof field === "string") {
    const t = field.trim();
    if (t) into.push(t);
    return;
  }
  if (Array.isArray(field)) {
    field.forEach((x) => pushImageField(x, into));
    return;
  }
  if (typeof field === "object") {
    const img = field as Record<string, unknown>;
    if (typeof img.url === "string") into.push(img.url.trim());
    if (typeof img.contentUrl === "string") into.push(img.contentUrl.trim());
  }
}

/** Walk JSON-LD and collect image URLs from Product (and similar) nodes. */
function collectJsonLdProductImages(node: unknown, urls: string[]): void {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) {
    node.forEach((n) => collectJsonLdProductImages(n, urls));
    return;
  }
  if (typeof node !== "object") return;
  const o = node as Record<string, unknown>;
  const types = o["@type"];
  const typeArr = Array.isArray(types) ? types : types != null ? [types] : [];
  const isProduct = typeArr.some(
    (t) => typeof t === "string" && /product/i.test(String(t))
  );
  if (isProduct && o.image !== undefined) {
    pushImageField(o.image, urls);
  }
  for (const v of Object.values(o)) {
    collectJsonLdProductImages(v, urls);
  }
}

function extractJsonLdImages(html: string, baseUrl: string): string[] {
  const urls: string[] = [];
  const re =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1].trim());
      collectJsonLdProductImages(data, urls);
    } catch {
      /* ignore invalid JSON */
    }
  }
  return Array.from(
    new Set(urls.map((u) => absolutize(u, baseUrl)).filter(Boolean))
  );
}

/**
 * Best-effort image URL from raw HTML (no JS execution).
 * Many storefronts only expose images in JSON-LD or og tags.
 */
function extractImageFromPageHtml(
  html: string,
  pageUrl: string
): { url: string; source: string } | null {
  const ogPatterns = [
    /<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image:secure_url["']/i,
    /<meta[^>]+property=["']og:image:url["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image:url["']/i,
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
  ];
  const og = firstMetaMatch(html, ogPatterns);
  if (og) {
    return { url: absolutize(og, pageUrl), source: "og:image" };
  }

  const twPatterns = [
    /<meta[^>]+name=["']twitter:image:src["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image:src["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  ];
  const tw = firstMetaMatch(html, twPatterns);
  if (tw) {
    return { url: absolutize(tw, pageUrl), source: "twitter:image" };
  }

  const linkMatch =
    html.match(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i) ||
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']image_src["']/i);
  if (linkMatch?.[1]) {
    return { url: absolutize(linkMatch[1], pageUrl), source: "link:image_src" };
  }

  const micro = firstMetaMatch(html, [
    /<meta[^>]+itemprop=["']image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+itemprop=["']image["']/i,
  ]);
  if (micro) {
    return { url: absolutize(micro, pageUrl), source: "microdata" };
  }

  const jsonLd = extractJsonLdImages(html, pageUrl);
  if (jsonLd.length > 0) {
    return { url: jsonLd[0], source: "json-ld" };
  }

  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");
  const vendorUrl = searchParams.get("vendor_url");

  // ── Case 1: Extract image hints from a product page (server-side HTML only) ──
  if (vendorUrl) {
    try {
      const res = await fetch(vendorUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(12_000),
      });

      if (!res.ok) {
        return NextResponse.json(
          { error: `Page returned ${res.status}` },
          { status: 502 }
        );
      }

      const html = await res.text();
      const finalPageUrl = res.url || vendorUrl;
      const extracted = extractImageFromPageHtml(html, finalPageUrl);

      if (extracted?.url && /^https?:\/\//i.test(extracted.url)) {
        return NextResponse.json({
          url: extracted.url,
          source: extracted.source,
        });
      }

      return NextResponse.json(
        {
          error:
            "No product image found in the page HTML. This site may load images only in the browser (JavaScript). Copy the image address from the product page and paste it into Image URL.",
        },
        { status: 404 }
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch vendor URL";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // ── Case 2: Keyword search via Unsplash Source ────────────────────────────
  if (query) {
    const terms = encodeURIComponent(`${query} electronics component`);
    const sourceUrl = `https://source.unsplash.com/400x300/?${terms}`;

    try {
      const res = await fetch(sourceUrl, {
        redirect: "follow",
        signal: AbortSignal.timeout(10_000),
      });

      const finalUrl = res.url && res.url !== sourceUrl ? res.url : null;
      if (finalUrl) {
        return NextResponse.json({ url: finalUrl, source: "unsplash" });
      }
    } catch {
      // fall through to placeholder
    }

    const placeholder = `https://placehold.co/400x300/1e293b/ffffff?text=${encodeURIComponent(query)}`;
    return NextResponse.json({ url: placeholder, source: "placeholder" });
  }

  return NextResponse.json(
    { error: "Provide ?query= or ?vendor_url= parameter" },
    { status: 400 }
  );
}
