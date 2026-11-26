import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Photo = {
  title: string;
  imageUrl: string;
  sourceUrl: string;
  credit: string;
  license: string;
  licenseUrl: string;
};

type OpenverseImage = {
  title?: string;
  url?: string;
  thumbnail?: string;
  foreign_landing_url?: string;
  creator?: string;
  creator_url?: string;
  license?: string;
  license_version?: string;
  license_url?: string;
  category?: string;
  filetype?: string;
  tags?: Array<{ name?: string }>;
};

type OpenverseResponse = { results?: OpenverseImage[] };
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
  return /\b(map|locator|location map|street map|road map|topographic|topographical|plan of|outline map|blank map|svg map|map of)\b/i.test(
    `${title} ${description}`
  );
}

function isNonPhoto(title: string, description: string, filetype = "") {
  return /\b(flag|coat of arms|logo|icon|symbol|diagram|chart|screenshot|satellite view)\b/i.test(
    `${title} ${description}`
  ) || /^(svg|gif)$/i.test(filetype);
}

async function searchOpenverse(term: string, placeName: string, countyName: string) {
  const url = new URL("https://api.openverse.org/v1/images/");
  url.search = new URLSearchParams({
    q: term,
    license_type: "commercial",
    category: "photograph",
    filter_dead: "true",
    mature: "false",
    page_size: "20",
  }).toString();

  const response = await fetch(url, {
    headers: { "User-Agent": "ZuriStay/1.0 (Kenya destination photography)" },
    signal: AbortSignal.timeout(7500),
    next: { revalidate: 86400 },
  });
  if (!response.ok) return [];
  const data = (await response.json()) as OpenverseResponse;
  return (data.results || []).flatMap((item) => {
    const title = String(item.title || "").trim();
    const tags = (item.tags || []).map((tag) => tag.name || "").join(" ");
    const searchable = `${title} ${tags}`.toLowerCase();
    if (!item.thumbnail && !item.url) return [];
    if (isLikelyMap(title, tags) || isNonPhoto(title, tags, item.filetype || "")) return [];
    const exactMatch = searchable.includes(placeName.toLowerCase());
    const countyMatch = Boolean(countyName) && searchable.includes(countyName.toLowerCase());
    // Search providers rank results for the specific town/county query.
    // Keep relevant local photos even when image metadata omits the place name.
    return [{
      title,
      imageUrl: item.thumbnail || item.url || "",
      sourceUrl: item.foreign_landing_url || item.url || "",
      credit: item.creator || "Openverse contributor",
      license: `${item.license || "Open licence"}${item.license_version ? ` ${item.license_version}` : ""}`,
      licenseUrl: item.license_url || "",
      rank: exactMatch ? 3 : countyMatch ? 2 : 1,
    }];
  });
}

async function searchCommons(term: string, placeName: string, countyName: string) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.search = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: term,
    gsrnamespace: "6",
    gsrlimit: "20",
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "720",
    format: "json",
  }).toString();

  const response = await fetch(url, {
    headers: { "User-Agent": "ZuriStay/1.0 (destination photo discovery)" },
    signal: AbortSignal.timeout(7500),
    next: { revalidate: 86400 },
  });
  if (!response.ok) return [];
  const data = (await response.json()) as CommonsSearchResponse;
  return Object.values(data.query?.pages || {}).flatMap((page) => {
    const info = page.imageinfo?.[0];
    const meta = info?.extmetadata || {};
    const title = String(page.title || "").replace(/^File:/, "");
    const description = plain(meta.ImageDescription);
    const searchable = `${title} ${description}`.toLowerCase();
    const imageUrl = info?.thumburl || info?.url || "";
    const sourceUrl = info?.descriptionurl || "";
    if (!imageUrl || !sourceUrl) return [];
    if (isLikelyMap(title, description) || isNonPhoto(title, description, imageUrl)) return [];
    const exactMatch = searchable.includes(placeName.toLowerCase());
    const countyMatch = Boolean(countyName) && searchable.includes(countyName.toLowerCase());
    // Commons search is already scoped to the named location query.
    // Do not reject valid local photos just because metadata is sparse.
    return [{
      title,
      imageUrl,
      sourceUrl,
      credit: plain(meta.Artist) || plain(meta.Credit) || "Wikimedia Commons contributor",
      license: plain(meta.LicenseShortName) || "See source page",
      licenseUrl: plain(meta.LicenseUrl),
      rank: exactMatch ? 3 : countyMatch ? 2 : 1,
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
    const placeName = parts[0] || cleanLocation;
    const placeKey = placeName.toLowerCase();
    const countyName = parts.find((part) =>
      !/^kenya$/i.test(part) &&
      part.toLowerCase() !== placeKey &&
      !/county$/i.test(part)
    ) || (parts.some((part) => /county$/i.test(part)) ? placeName.replace(/\s+county$/i, "") : "");
    const curated = curatedSearchTerms[placeKey];
    const terms = Array.from(new Set([
      `"${placeName}" Kenya`,
      curated,
      countyName ? `"${placeName}" ${countyName} Kenya` : "",
    ].filter(Boolean) as string[]));

    const batches = await Promise.all(terms.slice(0, 3).flatMap((term) => [
      searchOpenverse(term, placeName, countyName).catch(() => []),
      searchCommons(term, placeName, countyName).catch(() => []),
    ]));
    const seen = new Set<string>();
    const photos = batches.flat().sort((a, b) => b.rank - a.rank).filter((photo) => {
      const key = photo.imageUrl.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 10).map(({ rank: _rank, ...photo }) => photo);

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
