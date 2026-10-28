export interface GasStationResult {
  id: string;
  name: string;
  brand?: string;
  address: string;
  street?: string;
  houseNumber?: string;
  city?: string;
  postcode?: string;
  lat: number;
  lon: number;
  distanceMeters?: number;
  distanceFormatted?: string;
}

interface CacheEntry {
  timestamp: number;
  data: GasStationResult[];
}

export class StationService {
  private static cache = new Map<string, CacheEntry>();
  private static CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

  /**
   * Calculate distance between two GPS coordinates in meters using the Haversine formula.
   */
  public static calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in meters
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }

  public static formatDistance(meters?: number): string {
    if (meters === undefined || isNaN(meters)) return '';
    if (meters < 1000) return `${meters} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  }

  /**
   * Find gas stations near GPS coordinates via OpenStreetMap Nominatim.
   */
  public static async findNearbyStations(lat: number, lon: number, radiusKm = 7): Promise<GasStationResult[]> {
    // Cache key bucketed to ~1km grid
    const cacheKey = `nearby_${lat.toFixed(2)}_${lon.toFixed(2)}_${radiusKm}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.data;
    }

    // 1 deg lat ~ 111 km. Compute bounding box.
    const delta = (radiusKm / 111) * 1.2;
    const minLat = lat - delta;
    const maxLat = lat + delta;
    const minLon = lon - delta;
    const maxLon = lon + delta;

    const viewbox = `${minLon.toFixed(4)},${maxLat.toFixed(4)},${maxLon.toFixed(4)},${minLat.toFixed(4)}`;
    const url = `https://nominatim.openstreetmap.org/search?q=fuel&format=json&viewbox=${viewbox}&bounded=1&addressdetails=1&limit=25`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);

      const res = await fetch(url, {
        headers: {
          'User-Agent': 'VehicleVaultApp/1.0.4 (https://github.com/TeeCodeDev/VehicleVault)',
          'Accept-Language': 'nl,en;q=0.8',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`Nominatim returned HTTP ${res.status}`);
      }

      const items = (await res.json()) as any[];
      const stations: GasStationResult[] = [];

      for (const item of items) {
        const itemLat = parseFloat(item.lat);
        const itemLon = parseFloat(item.lon);
        if (isNaN(itemLat) || isNaN(itemLon)) continue;

        const dist = this.calculateDistanceMeters(lat, lon, itemLat, itemLon);
        const addr = item.address || {};

        const rawName = item.name || addr.amenity || addr.operator || addr.brand || 'Tankstation';
        const brand = addr.brand || addr.operator;
        const street = addr.road || addr.street;
        const houseNumber = addr.house_number;
        const city = addr.town || addr.city || addr.village || addr.municipality;
        const postcode = addr.postcode;

        // Build a human-friendly address string
        const streetPart = [street, houseNumber].filter(Boolean).join(' ');
        const cityPart = [postcode, city].filter(Boolean).join(' ');
        const fullAddress = [streetPart, cityPart].filter(Boolean).join(', ') || item.display_name;

        stations.push({
          id: String(item.osm_id || Math.random()),
          name: rawName,
          brand,
          address: fullAddress,
          street,
          houseNumber,
          city,
          postcode,
          lat: itemLat,
          lon: itemLon,
          distanceMeters: dist,
          distanceFormatted: this.formatDistance(dist),
        });
      }

      // Sort closest first
      stations.sort((a, b) => (a.distanceMeters || 0) - (b.distanceMeters || 0));

      this.cache.set(cacheKey, { timestamp: Date.now(), data: stations });
      return stations;
    } catch (err: any) {
      console.warn('Failed to query nearby stations from OSM:', err?.message || err);
      return [];
    }
  }

  /**
   * Search gas stations dynamically by text query (e.g. "Fieten Steenwijk", "Shell A28").
   */
  public static async searchStations(
    query: string,
    userLat?: number,
    userLon?: number
  ): Promise<GasStationResult[]> {
    if (!query || query.trim().length < 2) return [];

    const cleanQuery = query.trim();
    const cacheKey = `search_${cleanQuery.toLowerCase()}_${userLat?.toFixed(2) || ''}_${userLon?.toFixed(2) || ''}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.data;
    }

    // Append fuel keyword if not present to ensure petrol stations are prioritized
    const qParam = /fuel|tankstation|pomp|benzine/i.test(cleanQuery)
      ? cleanQuery
      : `${cleanQuery} fuel`;

    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(qParam)}&format=json&addressdetails=1&limit=15`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);

      const res = await fetch(url, {
        headers: {
          'User-Agent': 'VehicleVaultApp/1.0.4 (https://github.com/TeeCodeDev/VehicleVault)',
          'Accept-Language': 'nl,en;q=0.8',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`Nominatim search returned HTTP ${res.status}`);
      }

      const items = (await res.json()) as any[];
      const stations: GasStationResult[] = [];

      for (const item of items) {
        const itemLat = parseFloat(item.lat);
        const itemLon = parseFloat(item.lon);
        if (isNaN(itemLat) || isNaN(itemLon)) continue;

        let dist: number | undefined;
        if (userLat !== undefined && userLon !== undefined) {
          dist = this.calculateDistanceMeters(userLat, userLon, itemLat, itemLon);
        }

        const addr = item.address || {};
        const rawName = item.name || addr.amenity || addr.operator || addr.brand || 'Tankstation';
        const brand = addr.brand || addr.operator;
        const street = addr.road || addr.street;
        const houseNumber = addr.house_number;
        const city = addr.town || addr.city || addr.village || addr.municipality;
        const postcode = addr.postcode;

        const streetPart = [street, houseNumber].filter(Boolean).join(' ');
        const cityPart = [postcode, city].filter(Boolean).join(' ');
        const fullAddress = [streetPart, cityPart].filter(Boolean).join(', ') || item.display_name;

        stations.push({
          id: String(item.osm_id || Math.random()),
          name: rawName,
          brand,
          address: fullAddress,
          street,
          houseNumber,
          city,
          postcode,
          lat: itemLat,
          lon: itemLon,
          distanceMeters: dist,
          distanceFormatted: this.formatDistance(dist),
        });
      }

      if (userLat !== undefined && userLon !== undefined) {
        stations.sort((a, b) => (a.distanceMeters || 0) - (b.distanceMeters || 0));
      }

      this.cache.set(cacheKey, { timestamp: Date.now(), data: stations });
      return stations;
    } catch (err: any) {
      console.warn('Failed to search stations from OSM:', err?.message || err);
      return [];
    }
  }
}

