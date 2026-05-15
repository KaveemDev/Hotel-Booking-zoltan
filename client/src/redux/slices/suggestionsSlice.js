import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { fetchAllCities, fetchCountries, searchHotelNames } from '../../services/api';

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
      // Map country names to cities for easier display
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

    return { countries, cities };
  }
);

export const fetchHotelSuggestions = createAsyncThunk(
  'suggestions/fetchHotelSuggestions',
  async (query, { getState }) => {
    if (!query || query.length < 2) return { query, suggestions: [] };
    
    // We cache by the first 2 characters to get a large pool, then filter locally
    const prefix = query.substring(0, 2).toLowerCase();
    
    const state = getState().suggestions;
    if (state.hotelCache[prefix]) {
      return { prefix, query, suggestions: state.hotelCache[prefix], cached: true };
    }

    const hotelData = await searchHotelNames(prefix);
    let suggestions = [];
    if (hotelData && hotelData.suggestions) {
      suggestions = hotelData.suggestions.map(h => ({ ...h, type: 'Hotel' }));
    }

    return { prefix, query, suggestions, cached: false };
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
