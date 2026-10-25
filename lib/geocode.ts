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

// ponytail: at most 4 live Photon calls. A burst from the public instance comes back 503.
let photonActive = 0;
const photonQueue: Array<() => void> = [];

async function withPhoton<T>(run: () => Promise<T>): Promise<T> {
  if (photonActive >= 4) await new Promise<void>((resolve) => photonQueue.push(resolve));
  photonActive++;
  try {
    return await run();
  } finally {
    photonActive--;
    photonQueue.shift()?.();
  }
}

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
  const response = await withPhoton(async () => {
    let latest: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
      latest = await fetch(`https://photon.komoot.io/api/?${params}`, {
        headers: { "User-Agent": "HackCanadaAdmin/1.0 (admin.hackcanada.org)" },
        signal: AbortSignal.timeout(5000),
      });
      if (latest.status !== 429 && latest.status !== 503) break;
    }
    return latest;
  });
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

// Successes stick in this process. Failures stay out so a later visit can retry.
// ponytail: the reimbursements list never waits on Photon. A handful of places
// (the review screen) still looks up inline. Ceiling: 4 Photon calls at a time.
const remembered = new Map<string, Place | null>();
const WAIT_INLINE = 6;

async function rememberOne(query: string) {
  if (remembered.has(query)) return;
  try {
    remembered.set(query, await cachedLookup(query));
  } catch {
    // Leave it out so the next visit tries again.
  }
}

export async function geocodeMany(queries: (string | null)[]) {
  const unique = [...new Set(queries.filter((query): query is string => !!query))];
  const places = new Map<string, Place | null>();
  // #region agent log
  const started = Date.now();
  let memoryHits = 0;
  // #endregion
  const missing: string[] = [];
  for (const query of unique) {
    if (remembered.has(query)) {
      places.set(query, remembered.get(query) ?? null);
      // #region agent log
      memoryHits++;
      // #endregion
      continue;
    }
    missing.push(query);
    places.set(query, null);
  }

  if (missing.length > 0 && missing.length <= WAIT_INLINE) {
    for (const query of missing) {
      await rememberOne(query);
      places.set(query, remembered.get(query) ?? null);
    }
  }

  // #region agent log
  const resolved = [...places.values()].filter((place) => place != null).length;
  fetch("http://127.0.0.1:7416/ingest/d6da3325-2e0f-40ba-870a-ac5d82dcc36a", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f3da0c" },
    body: JSON.stringify({
      sessionId: "f3da0c",
      runId: "post-fix-3",
      hypothesisId: "H7",
      location: "lib/geocode.ts:geocodeMany",
      message: "geocode summary",
      data: {
        unique: unique.length,
        memoryHits,
        missing: missing.length,
        resolved,
        skippedNetwork: missing.length > WAIT_INLINE,
        elapsedMs: Date.now() - started,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  return places;
}
