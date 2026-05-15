const axios = require('axios');
const config = require('../config/config');
const mysqlDataService = require('../services/mysqlDataService');
const authService = require('../services/authService');
const pricingEngine = require('../services/pricingEngine');
const db = require('../config/db');
const { sendEmail } = require('../services/emailService');
const { getBookingConfirmationTemplate, getBookingCancellationTemplate } = require('../services/emailTemplates');
const bookingService = require('./bookingController');

// Create axios instance with basic auth for static data endpoints
const createStaticAxiosInstance = () => {
  return axios.create({
    headers: {
      'Content-Type': 'application/json'
    },
    auth: config.tboApi.staticAuth
  });
};

// Create axios instance with basic auth for search/booking endpoints
const createSearchAxiosInstance = () => {
  return axios.create({
    headers: {
      'Content-Type': 'application/json'
    },
    auth: config.tboApi.apiAuth
  });
};

/**
 * Helper: Get current active markup percentage from Firebase
 */
async function getActiveMarkupPercentage() {
  try {
    const [rows] = await db.execute(
      `SELECT cache_data FROM static_cache WHERE cache_key = 'settings_markup'`
    );
    if (rows.length > 0 && rows[0].cache_data) {
      const settings = typeof rows[0].cache_data === 'string'
        ? JSON.parse(rows[0].cache_data) : rows[0].cache_data;
      if (settings && settings.isActive && settings.percentage > 0) {
        return settings.percentage;
      }
    }
    return 0;
  } catch (err) {
    console.error('Error reading markup settings:', err.message);
    return 0;
  }
}

/**
 * Helper: Apply markup to a hotel search result
 */
function applyMarkupToResults(hotelResults, markupPct) {
  if (!hotelResults || markupPct <= 0) return hotelResults;
  const multiplier = 1 + (markupPct / 100);

  return hotelResults.map(hotel => {
    if (hotel.Rooms && Array.isArray(hotel.Rooms)) {
      hotel.Rooms = hotel.Rooms.map(room => {
        // Store original prices
        room.OriginalTotalFare = room.TotalFare;
        room.OriginalTotalTax = room.TotalTax;

        // Apply markup to the fare
        room.TotalFare = parseFloat((room.TotalFare * multiplier).toFixed(2));
        room.TotalTax = parseFloat((room.TotalTax * multiplier).toFixed(2));

        if (room.RoomPromotion) {
          room.OriginalRoomPromotion = room.RoomPromotion;
          room.RoomPromotion = parseFloat((room.RoomPromotion * multiplier).toFixed(2));
        }
        room.MarkupPercentage = markupPct;

        // Also mark DayRates if present
        if (room.DayRates && Array.isArray(room.DayRates)) {
          room.DayRates = room.DayRates.map(dayGroup => {
            if (Array.isArray(dayGroup)) {
              return dayGroup.map(d => ({
                ...d,
                OriginalBasePrice: d.BasePrice,
                BasePrice: parseFloat((d.BasePrice * multiplier).toFixed(2))
              }));
            }
            return dayGroup;
          });
        }

        return room;
      });
    }

    // Apply markup to hotel-level published price if present
    if (hotel.MinPrice) {
      hotel.OriginalMinPrice = hotel.MinPrice;
      hotel.MinPrice = parseFloat((hotel.MinPrice * multiplier).toFixed(2));
    }
    if (hotel.PublishedPrice) {
      hotel.OriginalPublishedPrice = hotel.PublishedPrice;
      hotel.PublishedPrice = parseFloat((hotel.PublishedPrice * multiplier).toFixed(2));
    }

    return hotel;
  });
}

// Get city list by country code - Firebase first, then TBO API
exports.getCityList = async (req, res) => {
  try {
    const { countryCode } = req.body;

    if (!countryCode) {
      return res.status(400).json({ error: 'Country code is required' });
    }

    console.log(`Fetching cities for country: ${countryCode}`);

    // Check cache first
    const cachedCities = await mysqlDataService.getCities(countryCode);
    if (cachedCities) {
      console.log(`Returning ${cachedCities.length} cities from cache`);
      return res.json({ CityList: cachedCities, source: 'cache' });
    }

    // If not in cache, fetch from TBO API
    console.log('Cities not in cache, fetching from TBO API...');
    const axiosInstance = createStaticAxiosInstance();
    const response = await axiosInstance.post(
      `${config.tboApi.baseUrl}/CityList`,
      { CountryCode: countryCode }
    );

    // Save to cache
    if (response.data.CityList && response.data.CityList.length > 0) {
      await mysqlDataService.saveCities(countryCode, response.data.CityList);
    }

    console.log(`Cities fetched: ${response.data.CityList?.length || 0} cities`);
    res.json({ ...response.data, source: 'api' });
  } catch (error) {
    console.error('City list error:', error.message);
    console.error('Error response:', error.response?.data);
    res.status(500).json({
      error: 'Failed to fetch city list',
      message: error.message,
      details: error.response?.data || null
    });
  }
};

exports.getAllCities = async (req, res) => {
  try {
    console.log('Fetching all cities from cache...');
    const allCities = await mysqlDataService.getAllCities();
    res.json({ CityList: allCities, source: 'cache' });
  } catch (error) {
    console.error('All cities list error:', error.message);
    res.status(500).json({
      error: 'Failed to fetch all cities list',
      message: error.message
    });
  }
};

// Get hotel code list by city code - Firebase first, then TBO API
exports.getHotelCodeList = async (req, res) => {
  try {
    const { cityCode } = req.body;

    if (!cityCode) {
      return res.status(400).json({ error: 'City code is required' });
    }

    console.log(`Fetching hotels for city code: ${cityCode}`);

    // Check cache first
    const cachedHotels = await mysqlDataService.getHotels(cityCode);
    if (cachedHotels) {
      console.log(`Returning ${cachedHotels.length} hotels from cache`);
      return res.json({ Hotels: cachedHotels, source: 'cache' });
    }

    // If not in cache, fetch from TBO API
    console.log('Hotels not in cache, fetching from TBO API...');
    const axiosInstance = createStaticAxiosInstance();
    const response = await axiosInstance.post(
      `${config.tboApi.baseUrl}/TBOHotelCodeList`,
      { CityCode: cityCode }
    );

    // Save to cache
    if (response.data.Hotels && response.data.Hotels.length > 0) {
      await mysqlDataService.saveHotels(cityCode, response.data.Hotels);
    }

    console.log(`Hotels fetched: ${response.data.Hotels?.length || 0} hotels`);
    res.json({ ...response.data, source: 'api' });
  } catch (error) {
    console.error('Hotel code list error:', error.message);
    console.error('Error response:', error.response?.data);
    res.status(500).json({
      error: 'Failed to fetch hotel list',
      message: error.message,
      details: error.response?.data || null
    });
  }
};

// Get hotel details by hotel code - Firebase first, then TBO API
exports.getHotelDetails = async (req, res) => {
  try {
    const { hotelCode, language = 'EN', isRoomDetailRequired = true } = req.body;

    if (!hotelCode) {
      return res.status(400).json({ error: 'Hotel code is required' });
    }

    console.log(`Fetching details for hotel code: ${hotelCode}`);

    // Check cache first
    const cachedDetails = await mysqlDataService.getHotelDetails(hotelCode);
    if (cachedDetails) {
      console.log(`Returning hotel details from cache`);
      return res.json({ HotelDetails: [cachedDetails], source: 'cache' });
    }

    // If not in cache, fetch from TBO API
    console.log('Hotel details not in cache, fetching from TBO API...');
    const axiosInstance = createStaticAxiosInstance();
    const response = await axiosInstance.post(
      `${config.tboApi.baseUrl}/Hoteldetails`,
      {
        Hotelcodes: hotelCode,
        Language: language,
        IsRoomDetailRequired: isRoomDetailRequired
      }
    );

    // Save to cache
    if (response.data.HotelDetails && response.data.HotelDetails.length > 0) {
      for (const hotel of response.data.HotelDetails) {
        await mysqlDataService.saveHotelDetails(hotel.HotelCode, hotel);
      }
    }

    console.log(`Hotel details fetched for: ${hotelCode}`);
    res.json({ ...response.data, source: 'api' });
  } catch (error) {
    console.error('Hotel details error:', error.message);
    console.error('Error response:', error.response?.data);
    res.status(500).json({
      error: 'Failed to fetch hotel details',
      message: error.message,
      details: error.response?.data || null
    });
  }
};

// Get basic hotel info from cached hotel lists (fallback when details API fails)
exports.getBasicHotelInfo = async (req, res) => {
  try {
    const { hotelCode } = req.body;

    if (!hotelCode) {
      return res.status(400).json({ error: 'Hotel code is required' });
    }

    console.log(`Looking up basic hotel info for: ${hotelCode}`);

    // Search for hotel in cached city hotel lists
    const hotelInfo = await mysqlDataService.findHotelByCode(hotelCode);

    if (hotelInfo) {
      console.log(`Found basic hotel info for ${hotelCode}`);
      return res.json({
        HotelInfo: hotelInfo,
        source: 'cache',
        isBasicInfo: true
      });
    }

    // If not found in cache
    console.log(`Hotel ${hotelCode} not found in cached hotel lists`);
    res.status(404).json({
      error: 'Hotel not found in cache',
      message: 'This hotel is not available in our cached data'
    });
  } catch (error) {
    console.error('Basic hotel info error:', error.message);
    res.status(500).json({
      error: 'Failed to fetch basic hotel info',
      message: error.message
    });
  }
};

// Search hotel availability with pricing - ALWAYS hits TBO API (dynamic data)
exports.searchHotel = async (req, res) => {
  try {
    const {
      checkIn,
      checkOut,
      hotelCodes,
      guestNationality = 'IN',
      noOfRooms = 0,
      paxRooms = [{ Adults: 2, Children: 0, ChildrenAges: [] }],
      isDetailedResponse = true
    } = req.body;

    // Validation
    if (!checkIn || !checkOut || !hotelCodes) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['checkIn', 'checkOut', 'hotelCodes']
      });
    }

    // Certification Pax Validation
    if (noOfRooms > 6 || paxRooms.length > 6) {
      return res.status(400).json({ error: 'Certification Rule: Max 6 rooms allowed' });
    }
    for (const room of paxRooms) {
      if (room.Adults > 8) {
        return res.status(400).json({ error: 'Certification Rule: Max 8 adults per room' });
      }
      if (room.Children > 4) {
        return res.status(400).json({ error: 'Certification Rule: Max 4 children per room' });
      }
      if (room.ChildrenAges && room.ChildrenAges.length > 0) {
        for (const age of room.ChildrenAges) {
          if (age < 0 || age > 18) {
             return res.status(400).json({ error: 'Certification Rule: Children ages must be between 0 and 18' });
          }
        }
      }
    }

    console.log(`\n=== Hotel Search Request (LIVE - No Cache) ===`);
    console.log(`Hotel Codes: ${hotelCodes}`);
    console.log(`Check-in: ${checkIn}, Check-out: ${checkOut}`);
    console.log(`Rooms: ${noOfRooms}, Guests: ${JSON.stringify(paxRooms)}`);

    const hotelCodesArray = typeof hotelCodes === 'string' ? hotelCodes.split(',') : (Array.isArray(hotelCodes) ? hotelCodes : []);
    const requestResponseTime = 15; // Set to 15 for TBO Certification

    const CHUNK_SIZE = 100;
    const hotelCodeChunks = [];
    for (let i = 0; i < hotelCodesArray.length; i += CHUNK_SIZE) {
      hotelCodeChunks.push(hotelCodesArray.slice(i, i + CHUNK_SIZE).join(','));
    }

    const axiosInstance = createSearchAxiosInstance();
    console.log(`Using credentials: ${config.tboApi.apiAuth.username}`);
    console.log(`Splitting ${hotelCodesArray.length} hotel codes into ${hotelCodeChunks.length} parallel requests of size ${CHUNK_SIZE}...`);

    let mergedHotelResult = [];
    let baseResponseTemplate = null;

    // Fire parallel requests for all chunks at once, without delay
    const chunkResults = [];
    const searchPromises = hotelCodeChunks.map(async (chunk, index) => {
      const searchRequest = {
        CheckIn: checkIn,
        CheckOut: checkOut,
        HotelCodes: chunk,
        GuestNationality: guestNationality || 'IN', 
        PaxRooms: paxRooms.map(room => ({
          Adults: room.Adults,
          Children: room.Children || 0,
          ChildrenAges: room.ChildrenAges || []
        })),
        ResponseTime: requestResponseTime,
        IsDetailedResponse: isDetailedResponse,
        Filters: {
          Refundable: false,
          NoOfRooms: 0,
          MealType: 'All'
        }
      };

      try {
        const response = await axiosInstance.post(
          config.tboApi.searchUrl,
          searchRequest
        );
        
        if (response.data && response.data.HotelResult) {
            mergedHotelResult.push(...response.data.HotelResult);
        }
        
        if (!baseResponseTemplate && response.data) {
            baseResponseTemplate = JSON.parse(JSON.stringify(response.data));
        }
        
        return { status: 'success', data: response.data };
      } catch (err) {
        console.error(`Chunk ${index} failed:`, err.message);
        return { status: 'failed', error: err };
      }
    });

    const finalResults = await Promise.all(searchPromises);
    chunkResults.push(...finalResults);

    // If every single chunk failed, error out using the first error's signature
    if (chunkResults.every(res => res.status === 'failed') && chunkResults.length > 0) {
        throw chunkResults[0].error; 
    }

    // Build the synthesized response matching local variables downstream
    const response = {
        data: {
             ...(baseResponseTemplate || {}),
             HotelResult: mergedHotelResult,
             Status: baseResponseTemplate?.Status || { Code: 200, Description: "Successful" }
        }
    };

    console.log('Search Response Status:', response.data.Status);
    console.log('Hotels in response:', response.data.HotelResult?.length || 0);

    if (response.data.HotelResult && response.data.HotelResult.length > 0) {
      console.log('Hotels found:', response.data.HotelResult.length);

      // Async: Save hotel names for search suggestions
      try {
        response.data.HotelResult.forEach(hotel => {
          if (hotel.HotelName && hotel.HotelCode) {
            mysqlDataService.saveHotelNameMapping(
              hotel.HotelName,
              hotel.HotelCode,
              hotel.Address || ''
            ).catch(err => console.error('Bg save name error:', err.message));
          }
        });
      } catch (err) {
        console.error('Error initiating bg save:', err);
      }

      const hotel = response.data.HotelResult[0];
      console.log('Rooms found:', hotel.Rooms?.length || 0);
    }

    // Apply markup if active
    const markupPct = await getActiveMarkupPercentage();
    if (markupPct > 0 && response.data.HotelResult) {
      console.log(`Applying base markup: ${markupPct}%`);
      response.data.HotelResult = applyMarkupToResults(response.data.HotelResult, markupPct);
      response.data.AppliedMarkup = markupPct;
    }

    // Apply Dynamic Pricing Engine Strategies
    if (response.data.HotelResult) {
       console.log('Applying advanced dynamic pricing strategies');
       const pricingContext = {
          checkIn,
          checkOut,
          clientIp: req.ip || '127.0.0.1',
          deviceType: req.headers['x-device-type'] || 'desktop',
          channel: req.headers['x-channel'] || 'website',
          userCountry: req.headers['x-user-country'] || guestNationality,
          userVisits: req.headers['x-user-visits'] || 1,
          userBookingsCount: parseInt(req.headers['x-user-bookings'] || 0)
       };
       response.data.HotelResult = await pricingEngine.applyPricingStrategies(response.data.HotelResult, pricingContext);
    }

    res.json(response.data);
  } catch (error) {
    console.error('\n=== Search Error ===');
    console.error('Error Message:', error.message);

    if (error.response) {
      console.error('Status Code:', error.response.status);
      console.error('Status Text:', error.response.statusText);
      console.error('Error Data:', JSON.stringify(error.response.data, null, 2));

      // Return the actual error from TBO
      return res.status(error.response.status).json({
        error: 'Hotel search failed',
        message: error.response.data?.Status?.Description || error.message,
        statusCode: error.response.data?.Status?.Code,
        details: error.response.data
      });
    }

    res.status(500).json({
      error: 'Failed to search hotel availability',
      message: error.message
    });
  }
};

// Get country list - Firebase first, then TBO API
exports.getCountryList = async (req, res) => {
  try {
    console.log('Fetching country list');

    // Check cache first
    const cachedCountries = await mysqlDataService.getCountries();
    if (cachedCountries) {
      console.log(`Returning ${cachedCountries.length} countries from cache`);
      return res.json({ CountryList: cachedCountries, source: 'cache' });
    }

    // If not in cache, fetch from TBO API
    console.log('Countries not in cache, fetching from TBO API...');
    const axiosInstance = createStaticAxiosInstance();
    const response = await axiosInstance.get(`${config.tboApi.baseUrl}/CountryList`);

    // Save to cache
    if (response.data.CountryList && response.data.CountryList.length > 0) {
      await mysqlDataService.saveCountries(response.data.CountryList);
    }

    console.log('Country list fetched');
    res.json({ ...response.data, source: 'api' });
  } catch (error) {
    console.error('Country list error:', error.message);
    console.error('Error response:', error.response?.data);
    res.status(500).json({
      error: 'Failed to fetch country list',
      message: error.message,
      details: error.response?.data || null
    });
  }
};

// PreBook hotel - Validates availability and returns final pricing
exports.preBookHotel = async (req, res) => {
  try {
    const { BookingCode } = req.body;

    if (!BookingCode) {
      return res.status(400).json({ error: 'BookingCode is required' });
    }

    console.log(`\n=== Hotel PreBook Request ===`);
    console.log(`BookingCode: ${BookingCode}`);

    const axiosInstance = createSearchAxiosInstance();

    const response = await axiosInstance.post(
      config.tboApi.preBookUrl,
      { BookingCode }
    );

    console.log('PreBook Response Status:', response.data.Status);

    if (response.data.Status && response.data.Status.Code !== 200) {
      return res.status(400).json({
        error: 'PreBook failed',
        message: response.data.Status.Description,
        details: response.data
      });
    }

    // Apply RSP Logic if present
    if (response.data.HotelResult && response.data.HotelResult.length > 0) {
      response.data.HotelResult.forEach(hotelResult => {
        if (hotelResult.RoomOptions) {
          hotelResult.RoomOptions.forEach(room => {
            if (room.Price) {
              let apiPrice = room.Price.PublishedPrice || room.Price.OfferedPriceRoundedOff;
              let RSP = room.Price.RoomSRPOffered || 0;
              room.Price.FinalPrice = Math.max(apiPrice, RSP);
            }
          });
        }
      });
    }

    res.json(response.data);
  } catch (error) {
    console.error('\n=== PreBook Error ===');
    console.error('Error Message:', error.message);

    if (error.response) {
      console.error('Status Code:', error.response.status);
      console.error('Error Data:', JSON.stringify(error.response.data, null, 2));

      return res.status(error.response.status).json({
        error: 'Hotel prebook failed',
        message: error.response.data?.Status?.Description || error.message,
        details: error.response.data
      });
    }

    res.status(500).json({
      error: 'Failed to prebook hotel',
      message: error.message
    });
  }
};

// Book hotel - Finalizes the booking with guest details
exports.bookHotel = async (req, res) => {
  try {
    const {
      EndUserIp,
      TokenId,
      TraceId,
      ResultIndex,
      HotelCode,
      BookingCode,
      GuestNationality,
      IsVoucherBooking = true,
      NetAmount,
      HotelRoomsDetails,
      IsPackageFare = false,
      IsPackageDetailsMandatory = false,
      ArrivalTransport
    } = req.body;

    // Validation
    if (!GuestNationality || !HotelRoomsDetails) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['GuestNationality', 'HotelRoomsDetails']
      });
    }

    console.log(`\n=== Hotel Book Request ===`);
    console.log(`GuestNationality: ${GuestNationality}`);
    console.log(`Rooms: ${HotelRoomsDetails.length}`);

    const bookPayload = {
      EndUserIp: EndUserIp || req.ip || '127.0.0.1',
      TokenId,
      TraceId,
      ResultIndex,
      HotelCode,
      GuestNationality: GuestNationality || 'IN',
      NoOfRooms: HotelRoomsDetails.length,
      IsVoucherBooking,
      HotelRoomsDetails: HotelRoomsDetails.map(room => ({
        ...room,
        HotelPassenger: room.HotelPassenger.map(guest => ({
          ...guest,
          PassportNo: undefined,
          PassportIssueDate: undefined,
          PassportExpDate: undefined
        }))
      }))
    };

    // Keep backwards compatibility for BookingCode
    if (BookingCode) bookPayload.BookingCode = BookingCode;

    // Add arrival transport if provided
    if (ArrivalTransport) {
      bookPayload.ArrivalTransport = ArrivalTransport;
    }

    console.log('BOOK PAYLOAD:', JSON.stringify(bookPayload, null, 2));

    const axiosInstance = createSearchAxiosInstance();

    const response = await axiosInstance.post(
      config.tboApi.bookUrl,
      bookPayload,
      { timeout: 30000 } // 30 seconds timeout
    );

    console.log('BOOK RESPONSE:', JSON.stringify(response.data, null, 2));

    if (response.data.Status && response.data.Status.Code !== 200) {
      return res.status(400).json({
        error: 'Booking failed',
        message: response.data.Status.Description,
        details: response.data
      });
    }

    res.json(response.data);

    // 🔔 Send booking confirmation email (non-blocking)
    const bookResult = response.data.BookResult || response.data;
    const isBookSuccess = bookResult.Status === 1 ||
        bookResult.HotelBookingStatus === 'Confirmed';

    if (isBookSuccess && HotelRoomsDetails?.[0]?.HotelPassenger?.[0]) {
        const guest = HotelRoomsDetails[0].HotelPassenger[0];
        const guestEmail = guest.Email;
        if (guestEmail) {
            const emailData = {
                customerName: `${guest.FirstName || ''} ${guest.LastName || ''}`.trim() || 'Guest',
                hotelName: bookResult.HotelName || 'Your Hotel',
                checkIn: bookResult.CheckIn || '',
                checkOut: bookResult.CheckOut || '',
                bookingId: bookResult.BookingId || bookResult.BookingRefNo || BookingCode,
                amount: NetAmount,
            };

            sendEmail({
                to: guestEmail,
                subject: `Booking Confirmed – ${emailData.hotelName} | Zovotel`,
                html: getBookingConfirmationTemplate(emailData),
            }).catch(err => console.error('Non-blocking confirmation email error:', err.message));
        }
    }
  } catch (error) {
    console.error('\n=== Book Error ===');
    console.error('Error Message:', error.message);

    if (error.code === 'ECONNABORTED' || (error.message && error.message.includes('timeout'))) {
      console.log('Book API timeout detected! Triggering GetBookingDetail fallback...');
      try {
        const axiosInstance = createSearchAxiosInstance();
        const getBookingDetailUrl = config.tboApi.bookUrl.replace('/book/', '/GetBookingDetail');
        const detailResponse = await axiosInstance.post(
          getBookingDetailUrl,
          { EndUserIp: req.body.EndUserIp || req.ip || '127.0.0.1', BookingCode: req.body.BookingCode }
        );
        if (detailResponse.data && detailResponse.data.BookingStatus) {
           console.log(`Fallback getBookingDetail status: ${detailResponse.data.BookingStatus}`);
           return res.json(detailResponse.data);
        }
      } catch (fallbackError) {
         console.error('Fallback GetBookingDetail failed:', fallbackError.message);
      }
    }

    if (error.response) {
      console.error('Status Code:', error.response.status);
      console.error('Error Data:', JSON.stringify(error.response.data, null, 2));

      return res.status(error.response.status).json({
        error: 'Hotel booking failed',
        message: error.response.data?.Status?.Description || error.message,
        details: error.response.data
      });
    }

    res.status(500).json({
      error: 'Failed to book hotel',
      message: error.message
    });
  }
};

// Fetch and cache hotel card info for search results
// This fetches images, amenities, rating, reviews from TBO Hotel Details API for hotels missing cached info
exports.fetchAndCacheHotelCardInfo = async (req, res) => {
  try {
    const { hotelCodes } = req.body;

    if (!hotelCodes || !Array.isArray(hotelCodes) || hotelCodes.length === 0) {
      return res.status(400).json({ error: 'hotelCodes array is required' });
    }

    console.log(`\n=== Fetch Hotel Card Info Request ===`);
    console.log(`Requested info for ${hotelCodes.length} hotels`);

    // Step 1: Get already cached hotel card info
    const cachedInfo = await mysqlDataService.getHotelCardInfoBatch(hotelCodes);

    // Step 2: Find which hotels are missing info
    const missingCodes = await mysqlDataService.getMissingHotelCardInfoCodes(hotelCodes);

    if (missingCodes.length === 0) {
      console.log('All hotel card info found in cache');
      return res.json({
        hotelInfo: cachedInfo,
        source: 'cache',
        fetchedCount: 0
      });
    }

    console.log(`Fetching info for ${missingCodes.length} hotels from TBO API`);

    // Step 3: Fetch info in batches to avoid rate limiting
    const BATCH_SIZE = 5;
    const DELAY_MS = 100;
    const newInfo = {};

    for (let i = 0; i < missingCodes.length; i += BATCH_SIZE) {
      const batch = missingCodes.slice(i, i + BATCH_SIZE);
      const hotelCodesString = batch.join(',');

      try {
        console.log(`Fetching batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} hotels`);

        const axiosInstance = createStaticAxiosInstance();
        const response = await axiosInstance.post(
          `${config.tboApi.baseUrl}/Hoteldetails`,
          {
            Hotelcodes: hotelCodesString,
            Language: 'EN',
            IsRoomDetailRequired: false
          }
        );

        // Extract full hotel card info from response
        if (response.data.HotelDetails && Array.isArray(response.data.HotelDetails)) {
          for (const hotel of response.data.HotelDetails) {
            const hotelCode = hotel.HotelCode;

            // Extract image
            let imageUrl = null;
            if (hotel.Images && Array.isArray(hotel.Images) && hotel.Images.length > 0) {
              imageUrl = hotel.Images[0];
            } else if (hotel.HotelPicture) {
              imageUrl = hotel.HotelPicture;
            }

            // Extract amenities/facilities
            let amenities = [];
            if (hotel.HotelFacilities && Array.isArray(hotel.HotelFacilities)) {
              amenities = hotel.HotelFacilities.slice(0, 10); // Limit to 10 amenities
            } else if (hotel.Facilities && Array.isArray(hotel.Facilities)) {
              amenities = hotel.Facilities.slice(0, 10);
            }

            // Extract rating info
            const rating = hotel.HotelRating || hotel.Rating || null;
            const reviews = hotel.ReviewCount || hotel.Reviews || 0;
            const ratingText = hotel.RatingText || (rating >= 4.5 ? 'Excellent' : rating >= 4 ? 'Very Good' : rating >= 3.5 ? 'Good' : rating ? 'Fair' : null);

            // Extract description
            const description = hotel.Description || hotel.HotelDescription || null;

            // Build hotel card info object
            const hotelCardInfo = {
              imageUrl,
              amenities,
              rating,
              reviews,
              ratingText,
              description
            };

            newInfo[hotelCode] = hotelCardInfo;

            // Save to cache asynchronously
            mysqlDataService.saveHotelCardInfo(hotelCode, hotelCardInfo).catch(err => {
              console.error(`Failed to cache info for ${hotelCode}:`, err.message);
            });
          }
        }

        // Small delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < missingCodes.length) {
          await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
      } catch (batchError) {
        console.error(`Error fetching batch starting at ${i}:`, batchError.message);
        // Continue with next batch even if one fails
      }
    }

    // Merge cached info with newly fetched info
    const allInfo = { ...cachedInfo, ...newInfo };

    console.log(`Fetch complete. Cached: ${Object.keys(cachedInfo).length}, New: ${Object.keys(newInfo).length}`);

    res.json({
      hotelInfo: allInfo,
      source: 'mixed',
      cachedCount: Object.keys(cachedInfo).length,
      fetchedCount: Object.keys(newInfo).length
    });
  } catch (error) {
    console.error('Fetch hotel card info error:', error.message);
    res.status(500).json({
      error: 'Failed to fetch hotel card info',
      message: error.message
    });
  }
};

// Search hotel names (Auto-complete)
exports.searchHotelNames = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.length < 2) {
      return res.json({ suggestions: [] });
    }

    const suggestions = await mysqlDataService.searchHotelNames(query);
    res.json({ suggestions });
  } catch (error) {
    console.error('Search hotel names error:', error.message);
    res.status(500).json({
      error: 'Failed to search hotel names',
      message: error.message
    });
  }
};

// GenerateVoucher - Confirm a hold booking via TBO API
exports.generateVoucher = async (req, res) => {
  try {
    const { BookingId, EndUserIp } = req.body;

    if (!BookingId) {
      return res.status(400).json({ error: 'Missing required field', required: ['BookingId'] });
    }

    console.log(`\n=== GenerateVoucher Request ===`);
    console.log(`BookingId: ${BookingId}`);

    const tokenId = await authService.getTokenId();

    const voucherRequest = {
      BookingId,
      EndUserIp: EndUserIp || process.env.TBO_END_USER_IP || req.ip || '127.0.0.1',
      TokenId: tokenId
    };

    const axiosInstance = createSearchAxiosInstance();
    const response = await axiosInstance.post(
      config.tboApi.generateVoucherUrl,
      voucherRequest
    );

    console.log('GenerateVoucher Response:', JSON.stringify(response.data, null, 2));

    let result = response.data.HotelBookingDetails || response.data;

    // TBO responses often wrap data in different elements, check if error exists inside result
    if (response.data.Status && response.data.Status.Code !== 200) {
        return res.status(400).json({
          error: 'Voucher generation failed',
          message: response.data.Status.Description,
          details: response.data
        });
    }

    if (result.Error && result.Error.ErrorCode !== 0) {
      return res.status(400).json({
        error: 'Voucher generation failed',
        message: result.Error.ErrorMessage,
        details: result
      });
    }

    // Attempt to update database to reflect vouchered status
    try {
        await db.execute(
            `UPDATE bookings SET booking_status = 'Vouchered' WHERE tbo_booking_id = ? LIMIT 1`,
            [String(BookingId)]
        );
        console.log(`[SQL UPDATE] Booking ${BookingId} successfully marked as Vouchered.`);
    } catch (dbError) {
        console.error(`[SQL UPDATE] Warning: Successfully hit GenerateVoucher, but failed to update status locally: ${dbError.message}`);
    }

    res.json(response.data);
  } catch (error) {
    console.error('\n=== GenerateVoucher Error ===');
    console.error('Error Message:', error.message);
    
    if (error.response) {
      return res.status(error.response.status).json({
        error: 'Voucher generation failed',
        message: error.response.data?.Status?.Description || error.message,
        details: error.response.data
      });
    }
    
    res.status(500).json({
      error: 'Failed to generate voucher',
      message: error.message
    });
  }
};

// SendChangeRequest - Cancel a hold or vouchered booking via TBO API
exports.sendChangeRequest = async (req, res) => {
  try {
    const { BookingId, Remarks, EndUserIp } = req.body;

    // Validation
    if (!BookingId || !Remarks) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['BookingId', 'Remarks']
      });
    }

    console.log(`\n=== SendChangeRequest (Cancel Booking) ===`);
    console.log(`BookingId: ${BookingId}`);
    console.log(`Remarks: ${Remarks}`);

    // Get a valid TokenId from the Authenticate API
    const tokenId = await authService.getTokenId();

    const changeRequest = {
      BookingMode: 5,
      RequestType: 4, // HotelCancel
      Remarks,
      BookingId,
      EndUserIp: EndUserIp || process.env.TBO_END_USER_IP || req.ip || '127.0.0.1',
      TokenId: tokenId
    };

    console.log('SendChangeRequest Body:', JSON.stringify(changeRequest, null, 2));

    const axiosInstance = createSearchAxiosInstance();

    const response = await axiosInstance.post(
      config.tboApi.sendChangeRequestUrl,
      changeRequest
    );

    console.log('SendChangeRequest Response:', JSON.stringify(response.data, null, 2));

    const result = response.data.HotelChangeRequestResult || response.data;

    // Check for errors
    if (result.Error && result.Error.ErrorCode !== 0) {
      return res.status(400).json({
        error: 'Cancellation request failed',
        message: result.Error.ErrorMessage,
        details: result
      });
    }

    // Check response status
    if (result.ResponseStatus !== 1) {
      return res.status(400).json({
        error: 'Cancellation request failed',
        message: `Response status: ${result.ResponseStatus}`,
        details: result
      });
    }

    // 📝 Update booking status to 'cancelled' in database
    let orderIdToUse = null;
    let refundedAmount = null;
    let cancellationCharge = null;
    try {
      console.log(`[SQL UPDATE] Looking up booking by tbo_booking_id: ${BookingId}`);
      // Use the dedicated tbo_booking_id column for reliable lookup
      const [rows] = await db.execute(
        `SELECT order_id FROM bookings WHERE tbo_booking_id = ? LIMIT 1`,
        [String(BookingId)]
      );
      console.log(`[SQL UPDATE] Found ${rows.length} order(s) for tbo_booking_id: ${BookingId}`);

      if (rows.length > 0) {
        orderIdToUse = rows[0].order_id;

        // Fetch cancellation status for refund details before updating
        try {
          const statusRequest = {
            BookingMode: 5,
            ChangeRequestId: result.ChangeRequestId,
            EndUserIp: EndUserIp || process.env.TBO_END_USER_IP || req.ip || '127.0.0.1',
            TokenId: tokenId
          };
          const axiosInstance = createSearchAxiosInstance();
          const statusResponse = await axiosInstance.post(
            config.tboApi.getChangeRequestStatusUrl,
            statusRequest
          );
          const statusResult = statusResponse.data.HotelChangeRequestStatusResult || statusResponse.data;
          if (statusResult.Error?.ErrorCode === 0 || statusResult.ResponseStatus === 1) {
            refundedAmount = statusResult.RefundedAmount !== undefined ? statusResult.RefundedAmount : null;
            cancellationCharge = statusResult.CancellationCharge !== undefined ? statusResult.CancellationCharge : null;
          }
        } catch (statusErr) {
          console.error('[SQL UPDATE] Failed to fetch cancellation status for refund details:', statusErr.message);
        }

        // Update the booking status to 'cancelled' and store cancellation details
        const cancellationDetails = {
          changeRequestId: result.ChangeRequestId,
          changeRequestStatus: result.ChangeRequestStatus,
          cancelledAt: new Date().toISOString(),
          remarks: Remarks,
          refundedAmount,
          cancellationCharge
        };

        await db.execute(
          `UPDATE bookings SET status = 'cancelled', booking_status = 'Cancelled' WHERE order_id = ?`,
          [orderIdToUse]
        );
        console.log(`[SQL UPDATE] ✅ Booking status updated to 'cancelled' for order_id: ${orderIdToUse}`);
      }
    } catch (dbErr) {
      console.error('[SQL UPDATE] Failed to update booking status:', dbErr.message);
      // Continue - TBO cancellation succeeded, DB update is secondary
    }

    res.json({
      success: true,
      changeRequestId: result.ChangeRequestId,
      changeRequestStatus: result.ChangeRequestStatus,
      refundedAmount,
      cancellationCharge
    });

    // 🔔 Send cancellation email (non-blocking)
    // Attempt to fetch booking details from MySQL to get guest email
    try {
      if (orderIdToUse) {
        const booking = await bookingService.getBookingData(orderIdToUse);
        const email = booking?.contactDetails?.email;
        if (email) {
          const guestName = booking.hotelRoomsDetails?.[0]?.HotelPassenger?.[0];
          const fullName = guestName
              ? `${guestName.FirstName || ''} ${guestName.LastName || ''}`.trim()
              : 'Guest';

          const emailData = {
            customerName: fullName,
            hotelName: booking.hotelInfo?.hotelName || booking.hotelInfo?.HotelName || 'Your Hotel',
            bookingId: BookingId,
            amount: refundedAmount
          };

          sendEmail({
            to: email,
            subject: `Booking Cancelled – ${emailData.hotelName} | Zovotel`,
            html: getBookingCancellationTemplate(emailData),
          }).catch(err => console.error('Non-blocking cancellation email error:', err.message));
        }
      }
    } catch (emailLookupErr) {
      console.error('Non-blocking cancellation email lookup error:', emailLookupErr.message);
    }
  } catch (error) {
    console.error('\n=== SendChangeRequest Error ===');
    console.error('Error Message:', error.message);

    if (error.response) {
      console.error('Status Code:', error.response.status);
      console.error('Error Data:', JSON.stringify(error.response.data, null, 2));

      return res.status(error.response.status).json({
        error: 'Cancellation request failed',
        message: error.response.data?.Error?.ErrorMessage || error.message,
        details: error.response.data
      });
    }

    res.status(500).json({
      error: 'Failed to send cancellation request',
      message: error.message
    });
  }
};

// GetChangeRequestStatus - Check cancellation status and refund details
exports.getChangeRequestStatus = async (req, res) => {
  try {
    const { ChangeRequestId, EndUserIp } = req.body;

    // Validation
    if (!ChangeRequestId) {
      return res.status(400).json({
        error: 'Missing required field',
        required: ['ChangeRequestId']
      });
    }

    console.log(`\n=== GetChangeRequestStatus ===`);
    console.log(`ChangeRequestId: ${ChangeRequestId}`);

    // Get a valid TokenId from the Authenticate API
    const tokenId = await authService.getTokenId();

    const statusRequest = {
      BookingMode: 5,
      ChangeRequestId,
      EndUserIp: EndUserIp || process.env.TBO_END_USER_IP || req.ip || '127.0.0.1',
      TokenId: tokenId
    };

    console.log('GetChangeRequestStatus Body:', JSON.stringify(statusRequest, null, 2));

    const axiosInstance = createSearchAxiosInstance();

    const response = await axiosInstance.post(
      config.tboApi.getChangeRequestStatusUrl,
      statusRequest
    );

    console.log('GetChangeRequestStatus Response:', JSON.stringify(response.data, null, 2));

    const result = response.data.HotelChangeRequestStatusResult || response.data;

    // Check for errors
    if (result.Error && result.Error.ErrorCode !== 0) {
      return res.status(400).json({
        error: 'Failed to get cancellation status',
        message: result.Error.ErrorMessage,
        details: result
      });
    }

    res.json({
      success: true,
      changeRequestId: result.ChangeRequestId,
      changeRequestStatus: result.ChangeRequestStatus,
      cancellationCharge: result.CancellationCharge !== undefined ? result.CancellationCharge : null,
      refundedAmount: result.RefundedAmount !== undefined ? result.RefundedAmount : null,
      responseStatus: result.ResponseStatus,
      traceId: result.TraceId
    });
  } catch (error) {
    console.error('\n=== GetChangeRequestStatus Error ===');
    console.error('Error Message:', error.message);

    if (error.response) {
      console.error('Status Code:', error.response.status);
      console.error('Error Data:', JSON.stringify(error.response.data, null, 2));

      return res.status(error.response.status).json({
        error: 'Failed to get cancellation status',
        message: error.response.data?.Error?.ErrorMessage || error.message,
        details: error.response.data
      });
    }

    res.status(500).json({
      error: 'Failed to get cancellation status',
      message: error.message
    });
  }
};

// Authenticate - Get a TokenId from TBO (for testing/debugging)
exports.authenticate = async (req, res) => {
  try {
    console.log('\n=== Manual Authenticate Request ===');
    const result = await authService.authenticate();
    res.json({
      success: true,
      tokenId: result.tokenId,
      member: result.member,
      status: result.status
    });
  } catch (error) {
    console.error('Authenticate Error:', error.message);
    res.status(500).json({
      error: 'Authentication failed',
      message: error.message
    });
  }
};

// GetBookingDetails API
exports.getBookingDetails = async (req, res) => {
  try {
    const { BookingId, EndUserIp, TokenId } = req.body;
    
    if (!BookingId) {
      return res.status(400).json({ error: 'BookingId is required' });
    }

    const detailsPayload = {
      EndUserIp: EndUserIp || req.ip || '127.0.0.1',
      TokenId: TokenId,
      BookingId: BookingId // bookingreferenceid OR clientreferenceid
    };

    console.log(`\n=== GetBookingDetails Request ===`);
    console.log(`BookingId: ${BookingId}`);

    const axiosInstance = createSearchAxiosInstance();
    const response = await axiosInstance.post(
      config.tboApi.bookUrl.replace('/book/', '/GetBookingDetail'),
      detailsPayload
    );
    
    res.json(response.data);
  } catch (error) {
    console.error('GetBookingDetails Error:', error.message);
    res.status(500).json({
      error: 'Failed to fetch booking details',
      message: error.message
    });
  }
};
