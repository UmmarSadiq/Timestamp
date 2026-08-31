import { LocationCoordinates, LocationFormat, CoordinateStyle, AddressDetailLevel, CameraSettings } from '../types';

interface ReverseGeocodeCache {
  [key: string]: {
    formatted: string;
    raw?: any;
  };
}

const geoCache: ReverseGeocodeCache = {};

/**
 * Converts decimal degrees to Degrees, Minutes, Seconds (DMS) string
 */
export function toDms(deg: number, isLat: boolean): string {
  const dir = isLat ? (deg >= 0 ? 'N' : 'S') : (deg >= 0 ? 'E' : 'W');
  const abs = Math.abs(deg);
  const d = Math.floor(abs);
  const minFloat = (abs - d) * 60;
  const m = Math.floor(minFloat);
  const s = ((minFloat - m) * 60).toFixed(1);
  return `${d}°${m}'${s}"${dir}`;
}

/**
 * Format coordinates according to chosen style (standard 4-dec, high precision 6-dec, DMS, or raw)
 */
export function formatCoordinates(
  lat: number,
  lng: number,
  style: CoordinateStyle = 'decimal_standard'
): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';

  switch (style) {
    case 'decimal_high_precision':
      return `${Math.abs(lat).toFixed(6)}° ${latDir}, ${Math.abs(lng).toFixed(6)}° ${lngDir}`;
    
    case 'dms':
      return `${toDms(lat, true)}, ${toDms(lng, false)}`;

    case 'raw_decimal':
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

    case 'decimal_standard':
    default:
      return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lng).toFixed(4)}° ${lngDir}`;
  }
}

/**
 * Evaluates GPS accuracy reading quality
 */
export function getGpsAccuracyQuality(accuracy?: number): {
  level: 'excellent' | 'good' | 'fair' | 'coarse';
  label: string;
  color: string;
} {
  if (accuracy === undefined || accuracy === null) {
    return { level: 'fair', label: 'GPS Fixed', color: 'text-amber-400' };
  }
  if (accuracy <= 10) {
    return { level: 'excellent', label: `±${Math.round(accuracy)}m (High Accuracy GPS)`, color: 'text-emerald-400' };
  }
  if (accuracy <= 30) {
    return { level: 'good', label: `±${Math.round(accuracy)}m (Good GPS Lock)`, color: 'text-emerald-300' };
  }
  if (accuracy <= 80) {
    return { level: 'fair', label: `±${Math.round(accuracy)}m (Moderate Accuracy)`, color: 'text-amber-400' };
  }
  return { level: 'coarse', label: `±${Math.round(accuracy)}m (Coarse / WiFi)`, color: 'text-rose-400' };
}

/**
 * Fetch current system GPS coordinates with high accuracy (no stale cache).
 */
export async function getSystemCoordinates(
  highAccuracy: boolean = true,
  maxAgeMs: number = 0,
  timeoutMs: number = 12000
): Promise<LocationCoordinates> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return reject(new Error('Geolocation is not supported by this browser/device'));
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          altitude: pos.coords.altitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          timestamp: pos.timestamp,
        });
      },
      (err) => {
        // If high accuracy timed out, retry once with moderate accuracy
        if (err.code === 3 && highAccuracy) {
          navigator.geolocation.getCurrentPosition(
            (fallbackPos) => {
              resolve({
                latitude: fallbackPos.coords.latitude,
                longitude: fallbackPos.coords.longitude,
                altitude: fallbackPos.coords.altitude,
                accuracy: fallbackPos.coords.accuracy,
                heading: fallbackPos.coords.heading,
                speed: fallbackPos.coords.speed,
                timestamp: fallbackPos.timestamp,
              });
            },
            (fallbackErr) => reject(fallbackErr),
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 10000 }
          );
        } else {
          reject(err);
        }
      },
      {
        enableHighAccuracy: highAccuracy,
        timeout: timeoutMs,
        maximumAge: maxAgeMs,
      }
    );
  });
}

/**
 * Continuous GPS tracker that streams real-time updates as device satellite lock refines.
 */
export function watchSystemCoordinates(
  onUpdate: (coords: LocationCoordinates) => void,
  onError?: (err: GeolocationPositionError) => void
): () => void {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return () => {};
  }

  const watchId = navigator.geolocation.watchPosition(
    (pos) => {
      onUpdate({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        altitude: pos.coords.altitude,
        accuracy: pos.coords.accuracy,
        heading: pos.coords.heading,
        speed: pos.coords.speed,
        timestamp: pos.timestamp,
      });
    },
    (err) => {
      if (onError) onError(err);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 15000,
    }
  );

  return () => {
    navigator.geolocation.clearWatch(watchId);
  };
}

/**
 * Search place or address by text query worldwide using OpenStreetMap Nominatim
 */
export async function searchAddress(query: string): Promise<Array<{
  displayName: string;
  latitude: number;
  longitude: number;
  addressDetails?: any;
}>> {
  if (!query || query.trim().length < 2) return [];

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query.trim())}&format=jsonv2&addressdetails=1&limit=5`;
    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'en',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data.map((item: any) => ({
      displayName: item.display_name,
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
      addressDetails: item.address,
    }));
  } catch {
    return [];
  }
}

/**
 * Format address parts based on detail level
 */
function formatAddressWithDetail(
  addressData: any,
  detailLevel: AddressDetailLevel = 'detailed_street'
): string {
  if (!addressData) return '';

  const houseNumber = addressData.house_number || addressData.building_number || '';
  const road = addressData.road || addressData.street || addressData.pedestrian || addressData.building || addressData.amenity || '';
  const streetFull = [houseNumber, road].filter(Boolean).join(' ');

  const neighbourhood = addressData.neighbourhood || addressData.suburb || addressData.residential || addressData.district || addressData.hamlet || '';
  const city = addressData.city || addressData.town || addressData.village || addressData.municipality || addressData.county || '';
  const state = addressData.state || addressData.province || addressData.region || addressData.principalSubdivision || '';
  const postcode = addressData.postcode || addressData.postalCode || '';
  const country = addressData.country || addressData.countryName || '';

  switch (detailLevel) {
    case 'detailed_street': {
      const parts = [streetFull || neighbourhood, city || state, country].filter(Boolean);
      // Deduplicate consecutive
      return parts.filter((item, idx) => parts.indexOf(item) === idx).join(', ');
    }

    case 'neighborhood_city': {
      const parts = [neighbourhood || streetFull, city, state].filter(Boolean);
      return parts.filter((item, idx) => parts.indexOf(item) === idx).join(', ');
    }

    case 'city_region': {
      const parts = [city || neighbourhood, state || country].filter(Boolean);
      return parts.filter((item, idx) => parts.indexOf(item) === idx).join(', ');
    }

    case 'full_postal': {
      const parts = [
        streetFull,
        neighbourhood,
        city,
        postcode ? `${state} ${postcode}` : state,
        country,
      ].filter(Boolean);
      return parts.filter((item, idx) => parts.indexOf(item) === idx).join(', ');
    }

    default:
      return [streetFull || neighbourhood, city, state || country].filter(Boolean).join(', ');
  }
}

/**
 * High-accuracy reverse geocoding with multi-provider cascade and exact street-level granularity.
 */
export async function reverseGeocodeCoordinates(
  lat: number,
  lng: number,
  detailLevel: AddressDetailLevel = 'detailed_street'
): Promise<string> {
  // Use 4-decimal precision key (~11m resolution) for accurate local caching
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}_${detailLevel}`;
  if (geoCache[cacheKey]?.formatted) {
    return geoCache[cacheKey].formatted;
  }

  // Provider 1: OpenStreetMap Nominatim (High detail: building, road, neighbourhood, city)
  try {
    const osmUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2&addressdetails=1&zoom=18`;
    const res = await fetch(osmUrl, {
      headers: {
        'Accept-Language': 'en',
      },
      signal: AbortSignal.timeout(4500),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.address) {
        const formatted = formatAddressWithDetail(data.address, detailLevel);
        if (formatted) {
          geoCache[cacheKey] = { formatted, raw: data.address };
          return formatted;
        }
      }
      if (data && data.display_name) {
        // Fallback to top components of display name
        const displayParts = data.display_name.split(', ').slice(0, 3).join(', ');
        geoCache[cacheKey] = { formatted: displayParts };
        return displayParts;
      }
    }
  } catch {
    // Proceed to Provider 2
  }

  // Provider 2: BigDataCloud Client Reverse Geocode (Reliable fast fallback)
  try {
    const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
    const res = await fetch(bdcUrl, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      const locality = data.locality || data.city || data.localityInfo?.administrative?.[0]?.name;
      const subAdmin = data.subAdministrativeArea || data.localityInfo?.administrative?.[1]?.name;
      const state = data.principalSubdivision;
      const country = data.countryName || data.countryCode;

      let parts: string[] = [];
      if (detailLevel === 'city_region') {
        parts = [locality || subAdmin, state || country].filter(Boolean);
      } else {
        parts = [locality, subAdmin || state, country].filter(Boolean);
      }

      const cleanParts = parts.filter((item, idx) => parts.indexOf(item) === idx);
      const formatted = cleanParts.slice(0, 3).join(', ');

      if (formatted) {
        geoCache[cacheKey] = { formatted };
        return formatted;
      }
    }
  } catch {
    // Proceed to coordinate fallback
  }

  // Final Fallback: Clean formatted coordinate representation
  const fallback = formatCoordinates(lat, lng, 'decimal_standard');
  geoCache[cacheKey] = { formatted: fallback };
  return fallback;
}

/**
 * Generates the formatted display location line for camera overlay and burning.
 */
export function getFormattedLocationLine(
  settings: CameraSettings,
  resolvedAddress?: string
): string | null {
  if (!settings.showLocation) {
    return null;
  }

  if (settings.locationSource === 'custom') {
    return settings.locationText?.trim() || null;
  }

  const coords = settings.locationCoords;
  if (!coords) {
    return settings.locationText?.trim() || 'Locating GPS...';
  }

  const coordStyle = settings.coordinateStyle || 'decimal_standard';
  const coordsStr = formatCoordinates(coords.latitude, coords.longitude, coordStyle);
  const addressStr = resolvedAddress || settings.locationText || '';

  // Append altitude or accuracy if configured
  const extraBadges: string[] = [];
  if (settings.includeAltitude && coords.altitude !== null && coords.altitude !== undefined) {
    extraBadges.push(`Alt: ${Math.round(coords.altitude)}m`);
  }
  if (settings.includeAccuracy && coords.accuracy !== null && coords.accuracy !== undefined) {
    extraBadges.push(`±${Math.round(coords.accuracy)}m`);
  }
  const extraSuffix = extraBadges.length > 0 ? ` (${extraBadges.join(', ')})` : '';

  switch (settings.locationFormat) {
    case 'coords_address':
      if (addressStr && addressStr !== coordsStr && addressStr !== 'Locating GPS...') {
        return `${coordsStr}${extraSuffix} • ${addressStr}`;
      }
      return `${coordsStr}${extraSuffix}`;

    case 'coords_only':
      return `${coordsStr}${extraSuffix}`;

    case 'address_only':
      return addressStr ? `${addressStr}${extraSuffix}` : `${coordsStr}${extraSuffix}`;

    case 'custom':
      return settings.locationText?.trim() || `${coordsStr}${extraSuffix}`;

    default:
      return addressStr ? `${coordsStr}${extraSuffix} • ${addressStr}` : `${coordsStr}${extraSuffix}`;
  }
}
