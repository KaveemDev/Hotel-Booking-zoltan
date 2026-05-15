require('dotenv').config();

module.exports = {
  port: process.env.PORT || 5000,
  tboApi: {
    baseUrl: process.env.TBO_API_BASE_URL || 'http://affiliate.travelboutiqueonline.com/TBOHolidays_HotelAPI',
    authenticateUrl: process.env.TBO_AUTHENTICATE_URL || 'https://api.travelboutiqueonline.com/SharedAPI/SharedData.svc/rest/Authenticate',
    clientId: process.env.TBO_CLIENT_ID || 'tboprod',
    searchUrl: process.env.TBO_SEARCH_URL || 'https://affiliate.travelboutiqueonline.com/HotelAPI/Search',
    preBookUrl: process.env.TBO_PREBOOK_URL || 'https://affiliate.travelboutiqueonline.com/HotelAPI/PreBook',
    bookUrl: process.env.TBO_BOOK_URL || 'https://hotelbooking.travelboutiqueonline.com/HotelAPI_V10/HotelService.svc/rest/book/',
    sendChangeRequestUrl: process.env.TBO_SEND_CHANGE_REQUEST_URL || 'https://hotelbooking.travelboutiqueonline.com/HotelAPI_V10/HotelService.svc/rest/SendChangeRequest',
    getChangeRequestStatusUrl: process.env.TBO_GET_CHANGE_REQUEST_STATUS_URL || 'https://hotelbooking.travelboutiqueonline.com/HotelAPI_V10/HotelService.svc/rest/GetChangeRequestStatus',
    generateVoucherUrl: process.env.TBO_GENERATE_VOUCHER_URL || 'https://hotelbooking.travelboutiqueonline.com/HotelAPI_V10/HotelService.svc/rest/GenerateVoucher',
    getAgencyBalanceUrl: process.env.TBO_GET_AGENCY_BALANCE_URL || 'https://api.travelboutiqueonline.com/SharedAPI/SharedData.svc/rest/GetAgencyBalance',
    // Static data endpoints credentials
    staticAuth: {
      username: process.env.TBO_STATIC_USERNAME || 'TBOStaticAPITest',
      password: process.env.TBO_STATIC_PASSWORD || 'Tbo@11530818'
    },
    // Search/Prebook/Book endpoints credentials
    apiAuth: {
      username: process.env.TBO_API_USERNAME,
      password: process.env.TBO_API_PASSWORD
    }
  },
  // Razorpay payment gateway configuration
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET
  }
};
