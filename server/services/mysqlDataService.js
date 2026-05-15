/**
 * MySQL Data Service
 * Drop-in replacement for firebaseDataService.js
 * Handles all MySQL operations for TBO static data caching
 */

const db = require('../config/db');

// ─── In-memory TTL cache for hot lookups ───────────────────────
const memCache = {};
const MEM_TTL_MS = 10 * 60 * 1000; // 10 minutes

function memGet(key) {
    const entry = memCache[key];
    if (entry && Date.now() - entry.ts < MEM_TTL_MS) return entry.data;
    delete memCache[key];
    return null;
}
function memSet(key, data) {
    memCache[key] = { data, ts: Date.now() };
}

// ─── Countries (stored as JSON blob in a generic cache table) ──
const saveCountries = async (data) => {
    try {
        const query = `
            INSERT INTO static_cache (cache_key, cache_data, updated_at)
            VALUES ('countries', ?, NOW())
            ON DUPLICATE KEY UPDATE cache_data = VALUES(cache_data), updated_at = NOW()
        `;
        await db.execute(query, [JSON.stringify(data)]);
        memSet('countries', data);
        console.log('Countries saved to MySQL cache');
        return true;
    } catch (error) {
        console.error('Error saving countries to MySQL:', error.message);
        throw error;
    }
};

const getCountries = async () => {
    try {
        const mem = memGet('countries');
        if (mem) return mem;

        const [rows] = await db.execute(
            `SELECT cache_data FROM static_cache WHERE cache_key = 'countries'`
        );
        if (rows.length > 0 && rows[0].cache_data) {
            const data = typeof rows[0].cache_data === 'string'
                ? JSON.parse(rows[0].cache_data) : rows[0].cache_data;
            memSet('countries', data);
            console.log('Countries fetched from MySQL cache');
            return data;
        }
        return null;
    } catch (error) {
        console.error('Error getting countries from MySQL:', error.message);
        return null;
    }
};

// ─── Cities ────────────────────────────────────────────────────
const saveCities = async (countryCode, data) => {
    try {
        const key = `cities_${countryCode}`;
        const query = `
            INSERT INTO static_cache (cache_key, cache_data, updated_at)
            VALUES (?, ?, NOW())
            ON DUPLICATE KEY UPDATE cache_data = VALUES(cache_data), updated_at = NOW()
        `;
        await db.execute(query, [key, JSON.stringify(data)]);
        memSet(key, data);
        console.log(`Cities for ${countryCode} saved to MySQL cache`);
        return true;
    } catch (error) {
        console.error('Error saving cities to MySQL:', error.message);
        throw error;
    }
};

const getCities = async (countryCode) => {
    try {
        const key = `cities_${countryCode}`;
        const mem = memGet(key);
        if (mem) return mem;

        const [rows] = await db.execute(
            `SELECT cache_data FROM static_cache WHERE cache_key = ?`, [key]
        );
        if (rows.length > 0 && rows[0].cache_data) {
            const data = typeof rows[0].cache_data === 'string'
                ? JSON.parse(rows[0].cache_data) : rows[0].cache_data;
            memSet(key, data);
            console.log(`Cities for ${countryCode} fetched from MySQL cache`);
            return data;
        }
        return null;
    } catch (error) {
        console.error('Error getting cities from MySQL:', error.message);
        return null;
    }
};

const getAllCities = async () => {
    try {
        const mem = memGet('all_cities');
        if (mem) return mem;

        const [rows] = await db.execute(
            `SELECT cache_data FROM static_cache WHERE cache_key LIKE 'cities_%'`
        );
        let allCities = [];
        if (rows.length > 0) {
            for (const row of rows) {
                const data = typeof row.cache_data === 'string'
                    ? JSON.parse(row.cache_data) : row.cache_data;
                if (Array.isArray(data)) {
                    allCities = allCities.concat(data);
                }
            }
            memSet('all_cities', allCities);
            console.log(`All cities fetched from MySQL cache (${allCities.length} total)`);
            return allCities;
        }
        return [];
    } catch (error) {
        console.error('Error getting all cities from MySQL:', error.message);
        return [];
    }
};

// ─── Hotels (hotel code lists per city) ────────────────────────
const saveHotels = async (cityCode, data) => {
    try {
        const key = `hotels_${cityCode}`;
        const query = `
            INSERT INTO static_cache (cache_key, cache_data, updated_at)
            VALUES (?, ?, NOW())
            ON DUPLICATE KEY UPDATE cache_data = VALUES(cache_data), updated_at = NOW()
        `;
        await db.execute(query, [key, JSON.stringify(data)]);
        memSet(key, data);
        console.log(`Hotels for city ${cityCode} saved to MySQL cache`);
        return true;
    } catch (error) {
        console.error('Error saving hotels to MySQL:', error.message);
        throw error;
    }
};

const getHotels = async (cityCode) => {
    try {
        const key = `hotels_${cityCode}`;
        const mem = memGet(key);
        if (mem) return mem;

        const [rows] = await db.execute(
            `SELECT cache_data FROM static_cache WHERE cache_key = ?`, [key]
        );
        if (rows.length > 0 && rows[0].cache_data) {
            const data = typeof rows[0].cache_data === 'string'
                ? JSON.parse(rows[0].cache_data) : rows[0].cache_data;
            memSet(key, data);
            console.log(`Hotels for city ${cityCode} fetched from MySQL cache`);
            return data;
        }
        return null;
    } catch (error) {
        console.error('Error getting hotels from MySQL:', error.message);
        return null;
    }
};

// ─── Hotel Details ─────────────────────────────────────────────
const saveHotelDetails = async (hotelCode, data) => {
    try {
        const key = `hotel_details_${hotelCode}`;
        const query = `
            INSERT INTO static_cache (cache_key, cache_data, updated_at)
            VALUES (?, ?, NOW())
            ON DUPLICATE KEY UPDATE cache_data = VALUES(cache_data), updated_at = NOW()
        `;
        await db.execute(query, [key, JSON.stringify(data)]);
        memSet(key, data);
        console.log(`Hotel details for ${hotelCode} saved to MySQL cache`);
        return true;
    } catch (error) {
        console.error('Error saving hotel details to MySQL:', error.message);
        throw error;
    }
};

const getHotelDetails = async (hotelCode) => {
    try {
        const key = `hotel_details_${hotelCode}`;
        const mem = memGet(key);
        if (mem) return mem;

        const [rows] = await db.execute(
            `SELECT cache_data FROM static_cache WHERE cache_key = ?`, [key]
        );
        if (rows.length > 0 && rows[0].cache_data) {
            const data = typeof rows[0].cache_data === 'string'
                ? JSON.parse(rows[0].cache_data) : rows[0].cache_data;
            memSet(key, data);
            console.log(`Hotel details for ${hotelCode} fetched from MySQL cache`);
            return data;
        }
        return null;
    } catch (error) {
        console.error('Error getting hotel details from MySQL:', error.message);
        return null;
    }
};

// ─── Find hotel by code (searches cached hotel lists) ──────────
const findHotelByCode = async (hotelCode) => {
    try {
        // First try the hotels table (structured data)
        const [rows] = await db.execute(
            `SELECT * FROM hotels WHERE hotel_code = ? LIMIT 1`, [hotelCode]
        );
        if (rows.length > 0) {
            return {
                HotelCode: rows[0].hotel_code,
                HotelName: rows[0].hotel_name,
                Address: rows[0].address,
                CityName: rows[0].city_name,
                CountryCode: rows[0].country_code,
                CountryName: rows[0].country_name,
                HotelRating: rows[0].hotel_rating,
                StarRating: rows[0].star_rating,
                Latitude: rows[0].latitude,
                Longitude: rows[0].longitude,
                HotelPicture: rows[0].hotel_picture,
            };
        }

        // Fallback: search the cached hotel_details blobs
        const details = await getHotelDetails(hotelCode);
        if (details) return details;

        return null;
    } catch (error) {
        console.error('Error finding hotel by code:', error.message);
        return null;
    }
};

// ─── Cache metadata ────────────────────────────────────────────
const getCacheMetadata = async () => {
    try {
        const [rows] = await db.execute(
            `SELECT cache_key, LENGTH(cache_data) as size, updated_at FROM static_cache ORDER BY updated_at DESC LIMIT 50`
        );
        return rows.map(r => ({
            key: r.cache_key,
            size: r.size,
            lastUpdated: r.updated_at
        }));
    } catch (error) {
        console.error('Error getting cache metadata:', error.message);
        return [];
    }
};

// ─── Clear all cache ───────────────────────────────────────────
const clearAllCache = async () => {
    try {
        await db.execute(`DELETE FROM static_cache`);
        // Clear mem cache too
        Object.keys(memCache).forEach(k => delete memCache[k]);
        console.log('All MySQL cache cleared');
        return true;
    } catch (error) {
        console.error('Error clearing cache:', error.message);
        throw error;
    }
};

// ─── Hotel Card Info ───────────────────────────────────────────
const saveHotelCardInfo = async (hotelCode, hotelInfo) => {
    try {
        const key = `hotel_card_${hotelCode}`;
        const query = `
            INSERT INTO static_cache (cache_key, cache_data, updated_at)
            VALUES (?, ?, NOW())
            ON DUPLICATE KEY UPDATE cache_data = VALUES(cache_data), updated_at = NOW()
        `;
        await db.execute(query, [key, JSON.stringify(hotelInfo)]);
        memSet(key, hotelInfo);
        return true;
    } catch (error) {
        console.error(`Error saving hotel card info for ${hotelCode}:`, error.message);
        throw error;
    }
};

const getHotelCardInfo = async (hotelCode) => {
    try {
        const key = `hotel_card_${hotelCode}`;
        const mem = memGet(key);
        if (mem) return mem;

        const [rows] = await db.execute(
            `SELECT cache_data FROM static_cache WHERE cache_key = ?`, [key]
        );
        if (rows.length > 0 && rows[0].cache_data) {
            const data = typeof rows[0].cache_data === 'string'
                ? JSON.parse(rows[0].cache_data) : rows[0].cache_data;
            memSet(key, data);
            return data;
        }
        return null;
    } catch (error) {
        console.error(`Error getting hotel card info for ${hotelCode}:`, error.message);
        return null;
    }
};

const getHotelCardInfoBatch = async (hotelCodes) => {
    try {
        const result = {};
        if (!hotelCodes || hotelCodes.length === 0) return result;

        // Check mem cache first
        const uncachedKeys = [];
        for (const code of hotelCodes) {
            const key = `hotel_card_${code}`;
            const mem = memGet(key);
            if (mem) {
                result[code] = mem;
            } else {
                uncachedKeys.push(code);
            }
        }

        if (uncachedKeys.length === 0) return result;

        // Batch query the rest from MySQL
        const placeholders = uncachedKeys.map(c => `'hotel_card_${c}'`).join(',');
        const [rows] = await db.execute(
            `SELECT cache_key, cache_data FROM static_cache WHERE cache_key IN (${placeholders})`
        );

        for (const row of rows) {
            const hotelCode = row.cache_key.replace('hotel_card_', '');
            const data = typeof row.cache_data === 'string'
                ? JSON.parse(row.cache_data) : row.cache_data;
            result[hotelCode] = data;
            memSet(row.cache_key, data);
        }

        return result;
    } catch (error) {
        console.error('Error getting hotel card info batch:', error.message);
        return {};
    }
};

const getMissingHotelCardInfoCodes = async (hotelCodes) => {
    try {
        if (!hotelCodes || hotelCodes.length === 0) return [];

        const existing = await getHotelCardInfoBatch(hotelCodes);
        return hotelCodes.filter(code => !existing[code]);
    } catch (error) {
        console.error('Error getting missing hotel card info codes:', error.message);
        return hotelCodes; // treat all as missing on error
    }
};

// ─── Hotel Name Mapping (for autocomplete) ────────────────────
const saveHotelNameMapping = async (hotelName, hotelCode, address = '') => {
    try {
        // Use the hotels table for structured name data
        const query = `
            INSERT INTO hotels (hotel_code, hotel_name, address)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE
            hotel_name = COALESCE(VALUES(hotel_name), hotel_name),
            address = COALESCE(VALUES(address), address),
            last_updated = NOW()
        `;
        await db.execute(query, [hotelCode, hotelName, address || null]);
        return true;
    } catch (error) {
        console.error('Error saving hotel name mapping:', error.message);
        return false;
    }
};

const searchHotelNames = async (query) => {
    try {
        if (!query || query.length < 2) return [];

        const searchTerm = `%${query}%`;
        const [rows] = await db.execute(
            `SELECT hotel_code, hotel_name, address FROM hotels WHERE hotel_name LIKE ? LIMIT 100`,
            [searchTerm]
        );

        return rows.map(row => ({
            hotelCode: row.hotel_code,
            hotelName: row.hotel_name,
            address: row.address || ''
        }));
    } catch (error) {
        console.error('Error searching hotel names:', error.message);
        return [];
    }
};

module.exports = {
    saveCountries,
    getCountries,
    saveCities,
    getCities,
    getAllCities,
    saveHotels,
    getHotels,
    saveHotelDetails,
    getHotelDetails,
    findHotelByCode,
    getCacheMetadata,
    clearAllCache,
    saveHotelCardInfo,
    getHotelCardInfo,
    getHotelCardInfoBatch,
    getMissingHotelCardInfoCodes,
    saveHotelNameMapping,
    searchHotelNames
};
