import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type CommonsMetadataValue = { value?: string };
type CommonsImageInfo = {
  thumburl?: string;
  url?: string;
  descriptionurl?: string;
  extmetadata?: Record<string, CommonsMetadataValue>;
};
type CommonsPage = {
  title?: string;
  imageinfo?: CommonsImageInfo[];
};
type CommonsSearchResponse = {
  query?: { pages?: Record<string, CommonsPage> };
};

export async function GET(request: NextRequest) {
  const location = (request.nextUrl.searchParams.get("location") || "").trim();
  if (!location || location.length > 120) {
    return NextResponse.json({ error: "A valid location is required." }, { status: 400 });
  }

  const search = async (term: string) => {
    const url = new URL("https://commons.wikimedia.org/w/api.php");
    url.search = new URLSearchParams({
      action: "query",
      generator: "search",
      gsrsearch: `filetype:bitmap ${term} Kenya`,
      gsrnamespace: "6",
      gsrlimit: "8",
      prop: "imageinfo",
      iiprop: "url|extmetadata",
      iiurlwidth: "1200",
      format: "json",
      origin: "*",
    }).toString();

    const response = await fetch(url, {
      headers: { "User-Agent": "ZuriStay/1.0 (destination photo discovery; contact: support@zuristay.co.ke)" },
      next: { revalidate: 86400 },
    });
    if (!response.ok) return [];
    const data = (await response.json()) as CommonsSearchResponse;
    const pages = Object.values(data.query?.pages || {});
    const plain = (value?: CommonsMetadataValue) =>
      String(value?.value || "").replace(/<[^>]*>/g, "").trim();

    return pages.map((page) => {
      const info = page.imageinfo?.[0];
      const meta = info?.extmetadata || {};
      return {
        title: String(page.title || "").replace(/^File:/, ""),
        imageUrl: info?.thumburl || info?.url || "",
        sourceUrl: info?.descriptionurl || "",
        credit: plain(meta.Artist) || plain(meta.Credit) || "Wikimedia Commons contributor",
        license: plain(meta.LicenseShortName) || "See source page",
        licenseUrl: plain(meta.LicenseUrl),
      };
    }).filter((item) => item.imageUrl && item.sourceUrl);
  };

  try {
    const cleanLocation = location.replace(/,\s*(Kenya|Kenya County)$/i, "").trim();
    if (/^bungoma(?: county)?$/i.test(cleanLocation)) {
      const featuredUrl = new URL("https://commons.wikimedia.org/w/api.php");
      featuredUrl.search = new URLSearchParams({
        action: "query",
        titles: "File:Khetias Euro.jpg",
        prop: "imageinfo",
        iiprop: "url|extmetadata",
        iiurlwidth: "1200",
        format: "json",
      }).toString();
      const featuredResponse = await fetch(featuredUrl, {
        headers: { "User-Agent": "ZuriStay/1.0 (destination photo discovery)" },
        next: { revalidate: 86400 },
      });
      if (featuredResponse.ok) {
        const featuredData = (await featuredResponse.json()) as CommonsSearchResponse;
        const featuredPage = Object.values(featuredData.query?.pages || {})[0];
        const featuredInfo = featuredPage?.imageinfo?.[0];
        if (featuredInfo?.thumburl || featuredInfo?.url) {
          const meta = featuredInfo.extmetadata || {};
          const plain = (value?: CommonsMetadataValue) => String(value?.value || "").replace(/<[^>]*>/g, "").trim();
          return NextResponse.json({
            success: true,
            location,
            photos: [{
              title: String(featuredPage?.title || "Khetias Euro.jpg").replace(/^File:/, ""),
              imageUrl: featuredInfo.thumburl || featuredInfo.url || "",
              sourceUrl: featuredInfo.descriptionurl || "https://commons.wikimedia.org/wiki/File:Khetias_Euro.jpg",
              credit: plain(meta.Artist) || plain(meta.Credit) || "Wikimedia Commons contributor",
              license: plain(meta.LicenseShortName) || "See source page",
              licenseUrl: plain(meta.LicenseUrl),
            }],
          }, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
        }
      }
    }
    const parts = cleanLocation.split(",").map((part) => part.trim()).filter(Boolean);
    const terms = Array.from(new Set([cleanLocation, parts[0], parts.length > 1 ? `${parts[1]} County` : ""])).filter(Boolean);
    let photos: ReturnType<typeof search> extends Promise<infer T> ? T : never = [];
    for (const term of terms) {
      photos = await search(term);
      if (photos.length) break;
    }
    return NextResponse.json(
      { success: true, location, photos },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } }
    );
  } catch {
    return NextResponse.json({ success: false, location, photos: [] }, { status: 200 });
  }
}
