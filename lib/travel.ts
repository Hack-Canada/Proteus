export const TRAVEL_CAP = 200;

// University of Toronto, St. George campus.
export const VENUE = { lat: 43.6629, lon: -79.3957 };

export const AMOUNT_BUCKETS = [
  { label: "$0–50", min: 0, max: 50 },
  { label: "$51–100", min: 51, max: 100 },
  { label: "$101–150", min: 101, max: 150 },
  { label: "$151–200", min: 151, max: 200 },
] as const;

export const DISTANCE_BANDS = [
  { label: "Local", range: "under 60 km", hint: "Commuting distance by TTC or GO.", maxKm: 60 },
  { label: "Nearby", range: "60–250 km", hint: "A day trip by GO, VIA or bus.", maxKm: 250 },
  { label: "Regional", range: "250–1,000 km", hint: "Train, bus or a short flight.", maxKm: 1000 },
  { label: "Far", range: "1,000–4,000 km", hint: "A flight within North America.", maxKm: 4000 },
  { label: "Very far", range: "4,000 km+", hint: "Long-haul or international flight.", maxKm: Infinity },
  { label: "Unknown", range: "not matched", hint: "Could not place this answer. Check what they typed.", maxKm: NaN },
] as const;

export type DistanceBand = (typeof DISTANCE_BANDS)[number]["label"];

export function bandOf(km: number | null): DistanceBand {
  if (km == null || !Number.isFinite(km)) return "Unknown";
  return DISTANCE_BANDS.find((band) => km < band.maxKm)?.label ?? "Very far";
}

export function kmFromVenue(lat: number, lon: number) {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(lat - VENUE.lat);
  const dLon = rad(lon - VENUE.lon);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(VENUE.lat)) * Math.cos(rad(lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(a)));
}

export function formatKm(km: number | null) {
  return km == null ? "—" : `${km.toLocaleString("en-CA")} km`;
}

export function amountBucket(amount: number) {
  return (
    AMOUNT_BUCKETS.find((bucket) => amount >= bucket.min && amount <= bucket.max)?.label ??
    AMOUNT_BUCKETS[AMOUNT_BUCKETS.length - 1].label
  );
}

export function cad(amount: number) {
  return `$${amount.toLocaleString("en-CA")}`;
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`travel: ${message}`);
}

function selfCheck() {
  assert(kmFromVenue(VENUE.lat, VENUE.lon) === 0, "venue is 0 km");
  const edmonton = kmFromVenue(53.55, -113.49);
  assert(edmonton > 2600 && edmonton < 2800, `edmonton ${edmonton}`);
  assert(bandOf(5) === "Local", "toronto local");
  assert(bandOf(kmFromVenue(43.47, -80.52)) === "Nearby", "waterloo nearby");
  assert(bandOf(kmFromVenue(45.42, -75.69)) === "Regional", "ottawa regional");
  assert(bandOf(edmonton) === "Far", "edmonton far");
  assert(bandOf(kmFromVenue(33.69, 73.07)) === "Very far", "islamabad very far");
  assert(bandOf(null) === "Unknown", "null unknown");
  assert(amountBucket(0) === "$0–50", "bucket 0");
  assert(amountBucket(51) === "$51–100", "bucket 51");
  assert(amountBucket(200) === "$151–200", "bucket 200");
}

selfCheck();
