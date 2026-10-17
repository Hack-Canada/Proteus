import { unstable_cache } from "next/cache";

import { kmFromVenue } from "@/lib/travel";

export type Place = {
  label: string;
  city: string;
  countryCode: string | null;
  km: number;
};

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    type?: string;
    name?: string;
    city?: string;
    state?: string;
    country?: string;
    countrycode?: string;
  };
};

const NAMED_TYPES = new Set(["city", "county", "state", "country"]);

export function travelQuery(travelFrom: string | null, country: string | null) {
  const text = (travelFrom ?? "").trim().replace(/\s+/g, " ");
  if (!text) return null;
  const extra = (country ?? "").trim();
  const query =
    extra && !text.toLowerCase().includes(extra.toLowerCase()) ? `${text}, ${extra}` : text;
  return query.toLowerCase();
}

// Photon is OpenStreetMap search by Komoot: free, no key, fair use. City-level layers stop
// "Chapel Hill" from matching a bank branch.
export async function lookupPlace(query: string): Promise<Place | null> {
  const params = new URLSearchParams({ q: query, limit: "1", lang: "en" });
  for (const layer of ["city", "locality", "district", "county", "state"]) {
    params.append("layer", layer);
  }
  let response: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    response = await fetch(`https://photon.komoot.io/api/?${params}`, {
      headers: { "User-Agent": "HackCanadaAdmin/1.0 (admin.hackcanada.org)" },
      signal: AbortSignal.timeout(5000),
    });
    if (response.status !== 429 && response.status !== 503) break;
  }
  if (!response?.ok) throw new Error(`photon ${response?.status}`);
  const body = (await response.json()) as { features?: PhotonFeature[] };
  const feature = body.features?.[0];
  if (!feature) return null;

  const { properties: p } = feature;
  const [lon, lat] = feature.geometry.coordinates;
  const city = (NAMED_TYPES.has(p.type ?? "") ? p.name : p.city ?? p.name) ?? query;
  const area = p.state && p.state !== city ? p.state : null;
  return {
    label: [city, area, p.country].filter(Boolean).join(", "),
    city,
    countryCode: p.countrycode ?? null,
    km: kmFromVenue(lat, lon),
  };
}

// ponytail: Next data cache keyed by the query string, 30 days. Failed lookups throw, so
// they are not cached and retry on the next render. Ceiling: one Photon call per new answer.
const cachedLookup = unstable_cache(lookupPlace, ["travel-geocode-v1"], {
  revalidate: 60 * 60 * 24 * 30,
});

export async function geocodeMany(queries: (string | null)[]) {
  const unique = [...new Set(queries.filter((query): query is string => !!query))];
  const places = new Map<string, Place | null>();
  // ponytail: sequential because the public Photon instance returns 503 on bursts.
  // Cached answers return instantly; only new answers pay the round trip.
  for (const query of unique) {
    try {
      places.set(query, await cachedLookup(query));
    } catch {
      places.set(query, null);
    }
  }
  return places;
}
