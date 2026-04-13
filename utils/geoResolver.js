// utils/geoResolver.js
// Menerjemahkan lokasi PC ke koordinat GPS
// Prioritas: 1) Site coordinates dari RegionSiteItem, 2) IP Geolocation via ip-api.com

const axios = require("axios");
const RegionSiteItem = require("../models/RegionSiteItem");

// Cache IP results selama 24 jam agar tidak spam API
const ipCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 jam

/**
 * Resolve koordinat berdasarkan nama site dari master data
 * @param {string} siteName - Nama site (misal: "Anggrek", "Malang")
 * @returns {{ lat, lng, city, source } | null}
 */
async function resolveGeoFromSite(siteName) {
  if (!siteName) return null;

  try {
    // Cari di RegionSiteItem yang punya koordinat
    const siteItem = await RegionSiteItem.findOne({
      site: { $regex: new RegExp(`^${siteName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
      lat: { $ne: null },
      lng: { $ne: null }
    }).lean();

    if (siteItem && siteItem.lat && siteItem.lng) {
      // Tambah sedikit random offset (±0.0003 ~ 30m) agar pin tidak numpuk persis
      const jitter = () => (Math.random() - 0.5) * 0.0006;
      return {
        lat: siteItem.lat + jitter(),
        lng: siteItem.lng + jitter(),
        city: siteItem.site,
        source: "site"
      };
    }
  } catch (err) {
    console.error("⚠️ Gagal resolve geo dari site:", err.message);
  }

  return null;
}

/**
 * Resolve koordinat berdasarkan IP Address via ip-api.com (gratis)
 * @param {string} ipAddress
 * @returns {{ lat, lng, city, source } | null}
 */
async function resolveGeoFromIp(ipAddress) {
  if (!ipAddress) return null;

  // Skip private/loopback IPs
  if (
    ipAddress.startsWith("10.") ||
    ipAddress.startsWith("192.168.") ||
    ipAddress.startsWith("172.") ||
    ipAddress === "127.0.0.1" ||
    ipAddress === "::1"
  ) {
    return null;
  }

  // Cek cache
  const cached = ipCache.get(ipAddress);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const res = await axios.get(`http://ip-api.com/json/${ipAddress}?fields=status,lat,lon,city,regionName,country`, {
      timeout: 5000
    });

    if (res.data && res.data.status === "success") {
      const result = {
        lat: res.data.lat,
        lng: res.data.lon,
        city: `${res.data.city}, ${res.data.regionName}`,
        source: "ip"
      };

      // Simpan ke cache
      ipCache.set(ipAddress, { data: result, timestamp: Date.now() });
      return result;
    }
  } catch (err) {
    console.error("⚠️ Gagal resolve geo dari IP:", err.message);
  }

  return null;
}

/**
 * Resolve koordinat PC — prioritas: Site > IP > null
 * @param {string} siteName
 * @param {string} ipAddress - IP public dari socket connection
 * @returns {{ lat, lng, city, source } | null}
 */
async function resolveGeolocation(siteName, ipAddress) {
  // 1. Coba dari Site master data (presisi level gedung)
  const fromSite = await resolveGeoFromSite(siteName);
  if (fromSite) return fromSite;

  // 2. Fallback ke IP Geolocation (presisi level kota)
  const fromIp = await resolveGeoFromIp(ipAddress);
  if (fromIp) return fromIp;

  return null;
}

module.exports = { resolveGeolocation, resolveGeoFromSite, resolveGeoFromIp };
