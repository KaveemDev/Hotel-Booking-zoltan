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

        // Automatically ingest into hotels table for name search
        if (Array.isArray(data) && data.length > 0) {
            saveHotelNameMappingsBulk(data).catch(err =>
                console.error(`Auto save hotel names error for city ${cityCode}:`, err.message)
            );
        }

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

// ─── Ensure hotels table exists ──────────────────────────────
let isHotelsTableInitialized = false;

const ensureHotelsTable = async () => {
    if (isHotelsTableInitialized) return;
    try {
        const query = `
            CREATE TABLE IF NOT EXISTS hotels (
                hotel_code VARCHAR(50) NOT NULL PRIMARY KEY,
                hotel_name VARCHAR(255) NOT NULL,
                address TEXT,
                city_name VARCHAR(100),
                country_code VARCHAR(10),
                country_name VARCHAR(100),
                hotel_rating VARCHAR(50),
                star_rating VARCHAR(50),
                latitude VARCHAR(50),
                longitude VARCHAR(50),
                hotel_picture TEXT,
                last_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_hotel_name (hotel_name(191)),
                INDEX idx_city_name (city_name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `;
        await db.execute(query);
        isHotelsTableInitialized = true;
    } catch (error) {
        console.error('Error ensuring hotels table exists:', error.message);
    }
};

// Auto-run table creation in background on module load
ensureHotelsTable().catch(err => console.error('Failed to init hotels table:', err.message));

// Helper: Format a hotel row/object into a standardized suggestion object
const formatHotelSuggestion = (h) => {
    const code = String(h.hotel_code || h.HotelCode || h.hotelCode || h.Code || '');
    const name = h.hotel_name || h.HotelName || h.hotelName || h.Name || '';
    const address = h.address || h.Address || h.HotelAddress || '';
    const cityName = h.city_name || h.CityName || h.cityName || '';
    const countryCode = h.country_code || h.CountryCode || h.countryCode || '';
    const countryName = h.country_name || h.CountryName || h.countryName || '';
    const starRating = h.star_rating || h.StarRating || h.hotel_rating || h.HotelRating || '';
    const latitude = h.latitude ? String(h.latitude) : (h.Latitude ? String(h.Latitude) : '');
    const longitude = h.longitude ? String(h.longitude) : (h.Longitude ? String(h.Longitude) : '');
    const picture = h.hotel_picture || h.HotelPicture || h.ImageUrl || '';

    return {
        hotelCode: code,
        Code: code,
        hotelName: name,
        Name: name,
        address: address,
        Address: address,
        cityName: cityName,
        CityName: cityName,
        countryCode: countryCode,
        CountryCode: countryCode,
        countryName: countryName,
        CountryName: countryName,
        starRating: starRating,
        StarRating: starRating,
        hotelRating: starRating,
        HotelRating: starRating,
        latitude: latitude,
        Latitude: latitude,
        longitude: longitude,
        Longitude: longitude,
        hotelPicture: picture,
        HotelPicture: picture,
        type: 'Hotel',
        Type: 'Hotel'
    };
};

// ─── Hotel Name Mapping (for autocomplete) ────────────────────
const saveHotelNameMapping = async (hotelName, hotelCode, address = '', cityName = '', extra = {}) => {
    try {
        if (!hotelCode || !hotelName) return false;
        await ensureHotelsTable();

        const query = `
            INSERT INTO hotels (
                hotel_code, hotel_name, address, city_name, country_code,
                country_name, hotel_rating, star_rating, latitude, longitude, hotel_picture
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            hotel_name = COALESCE(VALUES(hotel_name), hotel_name),
            address = COALESCE(VALUES(address), address),
            city_name = COALESCE(VALUES(city_name), city_name),
            country_code = COALESCE(VALUES(country_code), country_code),
            country_name = COALESCE(VALUES(country_name), country_name),
            hotel_rating = COALESCE(VALUES(hotel_rating), hotel_rating),
            star_rating = COALESCE(VALUES(star_rating), star_rating),
            latitude = COALESCE(VALUES(latitude), latitude),
            longitude = COALESCE(VALUES(longitude), longitude),
            hotel_picture = COALESCE(VALUES(hotel_picture), hotel_picture),
            last_updated = NOW()
        `;

        await db.execute(query, [
            String(hotelCode),
            String(hotelName).trim(),
            address || null,
            cityName || null,
            extra.countryCode || null,
            extra.countryName || null,
            extra.hotelRating || null,
            extra.starRating || null,
            extra.latitude ? String(extra.latitude) : null,
            extra.longitude ? String(extra.longitude) : null,
            extra.hotelPicture || null
        ]);
        return true;
    } catch (error) {
        console.error('Error saving hotel name mapping:', error.message);
        return false;
    }
};

const saveHotelNameMappingsBulk = async (hotels = []) => {
    try {
        if (!Array.isArray(hotels) || hotels.length === 0) return 0;
        await ensureHotelsTable();

        const uniqueHotels = [];
        const seenCodes = new Set();

        for (const hotel of hotels) {
            const hotelCode = hotel?.HotelCode || hotel?.hotelCode || hotel?.Code;
            const hotelName = hotel?.HotelName || hotel?.hotelName || hotel?.Name;

            if (!hotelCode || !hotelName || seenCodes.has(String(hotelCode))) continue;

            seenCodes.add(String(hotelCode));
            uniqueHotels.push({
                hotelCode: String(hotelCode),
                hotelName: String(hotelName).trim(),
                address: hotel?.Address || hotel?.HotelAddress || hotel?.address || '',
                cityName: hotel?.CityName || hotel?.cityName || hotel?.city || '',
                countryCode: hotel?.CountryCode || hotel?.countryCode || '',
                countryName: hotel?.CountryName || hotel?.countryName || '',
                hotelRating: hotel?.HotelRating || hotel?.hotelRating || '',
                starRating: hotel?.StarRating || hotel?.starRating || hotel?.HotelRating || '',
                latitude: hotel?.Latitude ? String(hotel.Latitude) : (hotel?.latitude ? String(hotel.latitude) : ''),
                longitude: hotel?.Longitude ? String(hotel.Longitude) : (hotel?.longitude ? String(hotel.longitude) : ''),
                hotelPicture: hotel?.HotelPicture || hotel?.hotelPicture || hotel?.ImageUrl || hotel?.imageUrl || ''
            });
        }

        if (uniqueHotels.length === 0) return 0;

        const BATCH_SIZE = 100;
        let totalInserted = 0;

        for (let i = 0; i < uniqueHotels.length; i += BATCH_SIZE) {
            const batch = uniqueHotels.slice(i, i + BATCH_SIZE);
            const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
            const values = batch.flatMap(h => [
                h.hotelCode,
                h.hotelName,
                h.address || null,
                h.cityName || null,
                h.countryCode || null,
                h.countryName || null,
                h.hotelRating || null,
                h.starRating || null,
                h.latitude || null,
                h.longitude || null,
                h.hotelPicture || null
            ]);

            const query = `
                INSERT INTO hotels (
                    hotel_code, hotel_name, address, city_name, country_code,
                    country_name, hotel_rating, star_rating, latitude, longitude, hotel_picture
                )
                VALUES ${placeholders}
                ON DUPLICATE KEY UPDATE
                hotel_name = COALESCE(VALUES(hotel_name), hotel_name),
                address = COALESCE(VALUES(address), address),
                city_name = COALESCE(VALUES(city_name), city_name),
                country_code = COALESCE(VALUES(country_code), country_code),
                country_name = COALESCE(VALUES(country_name), country_name),
                hotel_rating = COALESCE(VALUES(hotel_rating), hotel_rating),
                star_rating = COALESCE(VALUES(star_rating), star_rating),
                latitude = COALESCE(VALUES(latitude), latitude),
                longitude = COALESCE(VALUES(longitude), longitude),
                hotel_picture = COALESCE(VALUES(hotel_picture), hotel_picture),
                last_updated = NOW()
            `;

            await db.execute(query, values);
            totalInserted += batch.length;
        }

        return totalInserted;
    } catch (error) {
        console.error('Error saving hotel name mappings in bulk:', error.message);
        return 0;
    }
};

// ─── Backfill hotels table from static_cache ──────────────────
const backfillFromStaticCache = async () => {
    try {
        await ensureHotelsTable();
        const [rows] = await db.execute(
            `SELECT cache_key, cache_data FROM static_cache WHERE cache_key LIKE 'hotels_%'`
        );

        if (!rows || rows.length === 0) return 0;

        let totalBackfilled = 0;
        for (const row of rows) {
            try {
                const data = typeof row.cache_data === 'string'
                    ? JSON.parse(row.cache_data) : row.cache_data;
                if (Array.isArray(data) && data.length > 0) {
                    const inserted = await saveHotelNameMappingsBulk(data);
                    totalBackfilled += inserted;
                }
            } catch (parseErr) {
                console.error(`Error parsing cache data for ${row.cache_key}:`, parseErr.message);
            }
        }

        if (totalBackfilled > 0) {
            console.log(`✅ Backfilled ${totalBackfilled} hotels from static_cache into hotels table`);
        }
        return totalBackfilled;
    } catch (error) {
        console.error('Error backfilling hotels from static_cache:', error.message);
        return 0;
    }
};

// ─── Search Hotel Names ───────────────────────────────────────
const searchHotelNames = async (query) => {
    try {
        if (!query || query.trim().length < 2) return [];
        const cleanQuery = query.trim();
        await ensureHotelsTable();

        const searchTerm = `%${cleanQuery}%`;
        const startsWith = `${cleanQuery}%`;

        // 1. Try relational hotels table first (indexed, fast, relevance-sorted)
        let rows = [];
        try {
            const [queryRows] = await db.execute(
                `SELECT hotel_code, hotel_name, address, city_name, country_code,
                        country_name, hotel_rating, star_rating, latitude, longitude, hotel_picture
                 FROM hotels
                 WHERE hotel_name LIKE ?
                 ORDER BY (
                     CASE
                         WHEN hotel_name = ? THEN 1
                         WHEN hotel_name LIKE ? THEN 2
                         ELSE 3
                     END
                 ), hotel_name ASC
                 LIMIT 50`,
                [searchTerm, cleanQuery, startsWith]
            );
            rows = queryRows || [];
        } catch (dbErr) {
            console.error('Hotels table query failed:', dbErr.message);
        }

        if (rows.length > 0) {
            return rows.map(formatHotelSuggestion);
        }

        // 2. Fallback: Search inside static_cache (where all previously searched cities are stored)
        console.log(`No hotels in hotels table for "${cleanQuery}", falling back to static_cache...`);
        const queryLower = cleanQuery.toLowerCase();
        const fallbackResults = [];

        try {
            const [cacheRows] = await db.execute(
                `SELECT cache_key, cache_data FROM static_cache WHERE cache_key LIKE 'hotels_%'`
            );

            if (cacheRows && cacheRows.length > 0) {
                const allMatchingHotels = [];
                for (const row of cacheRows) {
                    const data = typeof row.cache_data === 'string'
                        ? JSON.parse(row.cache_data) : row.cache_data;
                    if (Array.isArray(data)) {
                        for (const hotel of data) {
                            const name = hotel?.HotelName || hotel?.hotelName || hotel?.Name || '';
                            if (name.toLowerCase().includes(queryLower)) {
                                allMatchingHotels.push(hotel);
                                fallbackResults.push(formatHotelSuggestion(hotel));
                                if (fallbackResults.length >= 50) break;
                            }
                        }
                    }
                    if (fallbackResults.length >= 50) break;
                }

                // Background backfill into hotels table so future queries hit the index
                if (allMatchingHotels.length > 0) {
                    saveHotelNameMappingsBulk(allMatchingHotels).catch(err =>
                        console.error('Async backfill error:', err.message)
                    );
                } else {
                    // Trigger a general backfill if table was completely empty
                    backfillFromStaticCache().catch(() => {});
                }
            }
        } catch (cacheErr) {
            console.error('Static cache fallback search error:', cacheErr.message);
        }

        return fallbackResults;
    } catch (error) {
        console.error('Error searching hotel names:', error.message);
        return [];
    }
};

module.exports = {
    ensureHotelsTable,
    backfillFromStaticCache,
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
    saveHotelNameMappingsBulk,
    searchHotelNames
};

