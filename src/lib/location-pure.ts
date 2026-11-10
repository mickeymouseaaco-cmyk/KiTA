/** Find my partner: pure helpers (no Firebase), easy to test. */

export type Fix = { lat: number; lng: number; accuracy: number };

/** Distance in metres between two points (haversine). */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function distanceWords(m: number): string {
  if (m < 150) return 'right next to each other';
  if (m < 1000) return `${Math.round(m / 10) * 10} m apart`;
  return `${m < 10000 ? (m / 1000).toFixed(1) : Math.round(m / 1000)} km apart`;
}

/** Only send a new location when it matters: moved a little, or a few minutes passed. */
export function worthSending(prev: { fix: Fix; at: number } | null, next: Fix, now: number): boolean {
  if (!prev) return true;
  return distanceM(prev.fix, next) > 75 || now - prev.at > 3 * 60_000;
}

/** Links to open the place in a maps app (Waze is popular in Malaysia). */
export function mapLinks(lat: number, lng: number) {
  return {
    waze: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
    google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    apple: `https://maps.apple.com/?daddr=${lat},${lng}`,
  };
}

/** The OpenStreetMap embed used on the web. */
export function osmEmbed(lat: number, lng: number, span = 0.008): string {
  const b = [lng - span, lat - span * 0.6, lng + span, lat + span * 0.6].map((n) => n.toFixed(5)).join(',');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${b}&layer=mapnik&marker=${lat},${lng}`;
}
