import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { fetchHotels, fetchHotelCardInfo } from '../../services/api';

export const fetchCityHotelsData = createAsyncThunk(
  'staticData/fetchCityHotelsData',
  async (cityCode, { getState }) => {
    const state = getState().staticData;
    // Check if we already have hotels for this city
    if (state.cityHotels[cityCode]) {
      return { cityCode, hotels: state.cityHotels[cityCode], cached: true };
    }

    const response = await fetchHotels(cityCode);
    if (response && response.Hotels && Array.isArray(response.Hotels)) {
      return { cityCode, hotels: response.Hotels, cached: false };
    }
    return { cityCode, hotels: [], cached: false };
  }
);

export const fetchHotelCardInfoData = createAsyncThunk(
  'staticData/fetchHotelCardInfoData',
  async (hotelCodes, { getState }) => {
    const state = getState().staticData;
    
    // Find which codes we don't have yet
    const missingCodes = hotelCodes.filter(code => !state.hotelCardInfo[String(code)]);
    
    if (missingCodes.length === 0) {
      return { newInfo: {}, cached: true };
    }

    const response = await fetchHotelCardInfo(missingCodes);
    if (response && response.hotelInfo) {
      return { newInfo: response.hotelInfo, cached: false };
    }
    return { newInfo: {}, cached: false };
  }
);

const staticDataSlice = createSlice({
  name: 'staticData',
  initialState: {
    cityHotels: {}, // { 'BOM': [{ HotelCode, HotelName, ... }] }
    hotelCardInfo: {}, // { '12345': { imageUrl, rating, amenities, ... } }
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCityHotelsData.fulfilled, (state, action) => {
        if (!action.payload.cached) {
          state.cityHotels[action.payload.cityCode] = action.payload.hotels;
        }
      })
      .addCase(fetchHotelCardInfoData.fulfilled, (state, action) => {
        if (!action.payload.cached) {
          // Merge the newly fetched card info into the existing cache
          state.hotelCardInfo = { ...state.hotelCardInfo, ...action.payload.newInfo };
        }
      });
  },
});

export default staticDataSlice.reducer;
