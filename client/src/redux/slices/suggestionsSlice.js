import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { fetchAllCities, fetchCountries, fetchCities, searchHotelNames } from '../../services/api';

const TOP_COUNTRIES = ['IN', 'AE', 'US', 'GB', 'SG', 'TH', 'MY', 'FR', 'DE', 'AU', 'SA', 'LK', 'JP'];

export const fetchInitialData = createAsyncThunk(
  'suggestions/fetchInitialData',
  async (_, { getState }) => {
    const state = getState().suggestions;
    if (state.countries.length > 0 && state.cities.length > 0) {
      return { countries: state.countries, cities: state.cities }; // Already fetched
    }

    const [countriesData, citiesData] = await Promise.all([
      fetchCountries(),
      fetchAllCities()
    ]);

    let countries = [];
    if (countriesData && countriesData.CountryList) {
      countries = countriesData.CountryList;
    }

    let cities = [];
    if (citiesData && citiesData.CityList) {
      cities = citiesData.CityList;
      const countryMap = countries.reduce((acc, country) => {
        acc[country.Code] = country.Name;
        return acc;
      }, {});
      
      cities = cities.map(city => ({
        ...city,
        type: 'City',
        countryName: countryMap[city.CountryCode] || city.CountryCode
      }));
    }

    // Also fetch TOP_COUNTRIES cities in parallel to guarantee complete city data across popular destinations
    const fetchPromises = TOP_COUNTRIES.map(async (code) => {
      try {
        const cityData = await fetchCities(code);
        if (cityData?.CityList) {
          const countryName = countries.find(c => c.Code === code)?.Name || code;
          return cityData.CityList.map(city => ({
            ...city,
            type: 'City',
            countryName: countryName,
            CountryCode: code
          }));
        }
      } catch (e) {
        // ignore individual country fetch errors
      }
      return [];
    });

    const extraCityArrays = await Promise.all(fetchPromises);
    const allExtraCities = extraCityArrays.flat();

    // Merge and deduplicate by Code
    const seenCodes = new Set();
    const mergedCities = [];
    for (const city of [...cities, ...allExtraCities]) {
      if (city && city.Code && !seenCodes.has(city.Code)) {
        seenCodes.add(city.Code);
        mergedCities.push(city);
      }
    }

    return { countries, cities: mergedCities };
  }
);

export const fetchHotelSuggestions = createAsyncThunk(
  'suggestions/fetchHotelSuggestions',
  async (query, { getState }) => {
    if (!query || query.length < 2) return { query, prefix: query, suggestions: [] };
    
    const prefix = query.substring(0, 2).toLowerCase();
    const exactKey = query.toLowerCase();
    
    const state = getState().suggestions;
    if (state.hotelCache[exactKey] && state.hotelCache[exactKey].length > 0) {
      return { prefix: exactKey, query, suggestions: state.hotelCache[exactKey], cached: true };
    }
    if (query.length === 2 && state.hotelCache[prefix] && state.hotelCache[prefix].length > 0) {
      return { prefix, query, suggestions: state.hotelCache[prefix], cached: true };
    }

    const hotelData = await searchHotelNames(query);
    let suggestions = [];
    if (hotelData && hotelData.suggestions) {
      suggestions = hotelData.suggestions.map(h => ({
        ...h,
        Code: h.Code || h.hotelCode,
        Name: h.Name || h.hotelName,
        Address: h.Address || h.address || '',
        CityName: h.CityName || h.cityName || '',
        StarRating: h.StarRating || h.starRating || '',
        type: 'Hotel'
      }));
    }

    return { prefix: exactKey, query, suggestions, cached: false };
  }
);

const suggestionsSlice = createSlice({
  name: 'suggestions',
  initialState: {
    countries: [],
    cities: [], // Array of all cities
    hotelCache: {}, // { 'mu': [{...}, {...}], 'du': [...] }
    status: 'idle',
    hotelStatus: 'idle',
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchInitialData.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchInitialData.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.countries = action.payload.countries;
        state.cities = action.payload.cities;
      })
      .addCase(fetchInitialData.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message;
      })
      .addCase(fetchHotelSuggestions.pending, (state) => {
        state.hotelStatus = 'loading';
      })
      .addCase(fetchHotelSuggestions.fulfilled, (state, action) => {
        state.hotelStatus = 'succeeded';
        if (!action.payload.cached) {
          state.hotelCache[action.payload.prefix] = action.payload.suggestions;
        }
      })
      .addCase(fetchHotelSuggestions.rejected, (state, action) => {
        state.hotelStatus = 'failed';
        state.error = action.error.message;
      });
  },
});

export default suggestionsSlice.reducer;
