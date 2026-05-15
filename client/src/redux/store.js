import { configureStore } from '@reduxjs/toolkit';
import suggestionsReducer from './slices/suggestionsSlice';
import staticDataReducer from './slices/staticDataSlice';

export const store = configureStore({
  reducer: {
    suggestions: suggestionsReducer,
    staticData: staticDataReducer,
  },
});

export default store;
