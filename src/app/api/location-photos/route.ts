import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type CommonsMetadataValue = { value?: string };
type CommonsImageInfo = {
  thumburl?: string;
  url?: string;
  descriptionurl?: string;
  extmetadata?: Record<string, CommonsMetadataValue>;
};
type CommonsPage = { title?: string; imageinfo?: CommonsImageInfo[] };
type CommonsSearchResponse = { query?: { pages?: Record<string, CommonsPage> } };

const curatedSearchTerms: Record<string, string> = {
  thika: "Thika town Kenya street buildings",
  wajir: "Wajir town Kenya",
  isiolo: "Isiolo town Kenya",
  osiolo: "Isiolo town Kenya",
  busia: "Busia Kenya town street",
  "el wak": "El Wak Kenya town",
  gilgil: "Gilgil town Kenya",
  wanguru: "Wanguru Mwea Kenya",
  turi: "Turi Kenya Nakuru",
  moyale: "Moyale Kenya town",
  mumias: "Mumias Kenya town",
  kerugoya: "Kerugoya town Kenya",
  kitui: "Kitui town Kenya",
  elburgon: "Elburgon town Kenya",
  nyamira: "Nyamira town Kenya",
  kakuma: "Kakuma town Kenya",
  lafey: "Lafey Mandera Kenya",
  taveta: "Taveta town Kenya",
  wote: "Wote town Makueni Kenya",
  kiminini: "Kiminini Trans Nzoia Kenya",
  mbita: "Mbita town Lake Victoria Kenya",
  bura: "Bura Tana Kenya landscape",
  suneka: "Suneka town Kisii Kenya",
  luanda: "Luanda Vihiga Kenya",
  "ol kalou": "Ol Kalou town Nyandarua Kenya",
  rumuruti: "Rumuruti Laikipia Kenya",
  chavakali: "Chavakali Vihiga Kenya",
  vipingo: "Vipingo Kenya coast",
  modogashe: "Modogashe Kenya",
  "mau narok": "Mau Narok Kenya farms",
  ahero: "Ahero Kisumu Kenya rice fields",
  bomet: "Bomet town Kenya",
  kinna: "Kinna Isiolo Kenya",
  kwale: "Kwale town Kenya",
  diani: "Diani Beach Kenya coastline",
};

const plain = (value?: CommonsMetadataValue) =>
  String(value?.value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

function isLikelyMap(title: string, description: string) {
  return /\b(map|locator|location map|street map|road map|topographic|topographical|plan of|outline map|blank map|svg map)\b/i.test(
    `${title} ${description}`
  );
}

async function search(term: string) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.search = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: term,
    gsrnamespace: "6",
    gsrlimit: "12",
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "640",
    format: "json",
  }).toString();

  const response = await fetch(url, {
    headers: { "User-Agent": "ZuriStay/1.0 (destination photo discovery)" },
    signal: AbortSignal.timeout(6500),
    next: { revalidate: 86400 },
  });
  if (!response.ok) return [];
  const data = (await response.json()) as CommonsSearchResponse;
  return Object.values(data.query?.pages || {}).flatMap((page) => {
    const info = page.imageinfo?.[0];
    const meta = info?.extmetadata || {};
    const title = String(page.title || "").replace(/^File:/, "");
    const description = plain(meta.ImageDescription);
    const imageUrl = info?.thumburl || info?.url || "";
    const sourceUrl = info?.descriptionurl || "";
    if (!imageUrl || !sourceUrl || isLikelyMap(title, description)) return [];
    if (/\.svg(?:$|\?)/i.test(imageUrl) || /\b(flag|coat of arms|logo|icon)\b/i.test(title)) return [];
    return [{
      title,
      imageUrl,
      sourceUrl,
      credit: plain(meta.Artist) || plain(meta.Credit) || "Wikimedia Commons contributor",
      license: plain(meta.LicenseShortName) || "See source page",
      licenseUrl: plain(meta.LicenseUrl),
    }];
  });
}

export async function GET(request: NextRequest) {
  const location = (request.nextUrl.searchParams.get("location") || "").trim();
  if (!location || location.length > 120) {
    return NextResponse.json({ error: "A valid location is required." }, { status: 400 });
  }

  try {
    const cleanLocation = location.replace(/,\s*(Kenya|Kenya County)$/i, "").trim();
    const parts = cleanLocation.split(",").map((part) => part.trim()).filter(Boolean);
    const placeKey = (parts[0] || cleanLocation).toLowerCase();
    const countyPart = parts.find((part) => !/^kenya$/i.test(part) && part.toLowerCase() !== placeKey);
    const terms = Array.from(new Set([
      curatedSearchTerms[placeKey],
      `${parts[0] || placeKey} Kenya photograph`,
      `${parts[0] || placeKey} town Kenya`,
      countyPart ? `${countyPart} County Kenya landscape` : "",
    ].filter(Boolean) as string[]));

    // Search a few focused phrases concurrently rather than waiting through a long fallback chain.
    const batches = await Promise.all(terms.slice(0, 4).map((term) => search(term).catch(() => [])));
    const seen = new Set<string>();
    const photos = batches.flat().filter((photo) => {
      const key = photo.imageUrl.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 8);

    return NextResponse.json(
      { success: true, location, photos },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } }
    );
  } catch {
    return NextResponse.json(
      { success: false, location, photos: [] },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } }
    );
  }
}
