/**
 * Timezone Utilities for Indian Standard Time (IST)
 * Handles conversion between UTC and Indian Standard Time (Asia/Kolkata)
 * IST is UTC+5:30 and does not observe daylight saving time
 */

const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Convert a date to Indian Standard Time (IST)
 * @param {Date|string} date - The date to convert
 * @returns {Date} - Date converted to IST
 */
function toISTTime(date) {
  if (!date) return null;
  
  const inputDate = new Date(date);
  if (isNaN(inputDate.getTime())) return null;
  
  // Convert to IST
  return new Date(inputDate.toLocaleString("en-US", { timeZone: IST_TIMEZONE }));
}

/**
 * Get current time in Indian Standard Time (IST)
 * @returns {Date} - Current time in IST
 */
function getCurrentISTTime() {
  // Get current time in UTC
  const now = new Date();
  
  // Get the timezone offset for IST
  // IST is UTC+5:30, so we need to add 5 hours and 30 minutes
  const istTimeString = now.toLocaleString("en-US", { timeZone: IST_TIMEZONE });
  
  // Parse the IST time string to get the components
  const [datePart, timePart] = istTimeString.split(', ');
  const [month, day, year] = datePart.split('/');
  const [time, period] = timePart.split(' ');
  const [hours, minutes, seconds] = time.split(':');
  
  // Convert to 24-hour format
  let hour24 = parseInt(hours);
  if (period === 'PM' && hour24 !== 12) {
    hour24 += 12;
  } else if (period === 'AM' && hour24 === 12) {
    hour24 = 0;
  }
  
  // Create a date object for the IST time
  const istDate = new Date(year, month - 1, day, hour24, parseInt(minutes), parseInt(seconds || 0), 0);
  
  // Calculate the offset between this IST time and UTC
  const utcTime = new Date(istDate.toISOString());
  const offset = istDate.getTime() - utcTime.getTime();
  
  // Apply the offset to get the correct UTC time that represents current IST
  return new Date(now.getTime() + offset);
}

/**
 * Format a date to IST string
 * @param {Date|string} date - The date to format
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} - Formatted date string in IST
 */
function formatToISTTime(date, options = {}) {
  if (!date) return '';
  
  const inputDate = new Date(date);
  if (isNaN(inputDate.getTime())) return '';
  
  const defaultOptions = {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  };
  
  const formatOptions = { ...defaultOptions, ...options };
  
  return inputDate.toLocaleString('en-US', formatOptions);
}

/**
 * Format time only in IST
 * @param {Date|string} date - The date to format
 * @param {boolean} use24Hour - Whether to use 24-hour format
 * @returns {string} - Formatted time string in IST
 */
function formatTimeToIST(date, use24Hour = false) {
  if (!date) return '';
  
  const inputDate = new Date(date);
  if (isNaN(inputDate.getTime())) return '';
  
  return inputDate.toLocaleTimeString('en-US', {
    timeZone: IST_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: !use24Hour
  });
}

/**
 * Format date only in IST
 * @param {Date|string} date - The date to format
 * @param {Object} options - Additional formatting options
 * @returns {string} - Formatted date string in IST
 */
function formatDateToIST(date, options = {}) {
  if (!date) return '';
  
  const inputDate = new Date(date);
  if (isNaN(inputDate.getTime())) return '';
  
  const defaultOptions = {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  };
  
  const formatOptions = { ...defaultOptions, ...options };
  
  return inputDate.toLocaleDateString('en-US', formatOptions);
}

/**
 * Get start of day in IST
 * @param {Date|string} date - The date to get start of day for
 * @returns {Date} - Start of day in IST
 */
function getStartOfDayIST(date) {
  if (!date) return null;
  
  const inputDate = new Date(date);
  if (isNaN(inputDate.getTime())) return null;
  
  // Get the date string in IST
  const istDateString = inputDate.toLocaleDateString("en-US", { timeZone: IST_TIMEZONE });
  const [month, day, year] = istDateString.split('/');
  
  // Create a date object for midnight in IST
  // We need to create this as if it were in IST, then convert to UTC
  const istMidnight = new Date(year, month - 1, day, 0, 0, 0, 0);
  
  // Get the timezone offset for IST on this date
  // We'll use a known time to calculate the offset
  const testTime = new Date(year, month - 1, day, 12, 0, 0, 0); // Noon
  const istTime = new Date(testTime.toLocaleString("en-US", { timeZone: IST_TIMEZONE }));
  const utcTime = new Date(testTime.toISOString());
  const offset = utcTime.getTime() - istTime.getTime();
  
  // Apply the offset to get the correct UTC time for midnight in IST
  return new Date(istMidnight.getTime() + offset);
}

/**
 * Get end of day in IST
 * @param {Date|string} date - The date to get end of day for
 * @returns {Date} - End of day in IST
 */
function getEndOfDayIST(date) {
  if (!date) return null;
  
  const inputDate = new Date(date);
  if (isNaN(inputDate.getTime())) return null;
  
  // Get the date string in IST
  const istDateString = inputDate.toLocaleDateString("en-US", { timeZone: IST_TIMEZONE });
  const [month, day, year] = istDateString.split('/');
  
  // Create a date object for end of day in IST
  const istEndOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);
  
  // Get the timezone offset for IST on this date
  const testTime = new Date(year, month - 1, day, 12, 0, 0, 0); // Noon
  const istTime = new Date(testTime.toLocaleString("en-US", { timeZone: IST_TIMEZONE }));
  const utcTime = new Date(testTime.toISOString());
  const offset = utcTime.getTime() - istTime.getTime();
  
  // Apply the offset to get the correct UTC time for end of day in IST
  return new Date(istEndOfDay.getTime() + offset);
}

/**
 * Check if a date is today in IST
 * @param {Date|string} date - The date to check
 * @returns {boolean} - True if the date is today in IST
 */
function isTodayIST(date) {
  if (!date) return false;
  
  const inputDate = new Date(date);
  if (isNaN(inputDate.getTime())) return false;
  
  const today = getCurrentISTTime();
  const inputDateIST = new Date(inputDate.toLocaleString("en-US", { timeZone: IST_TIMEZONE }));
  
  return inputDateIST.toDateString() === today.toDateString();
}

/**
 * Get timezone offset for IST
 * @returns {number} - Timezone offset in minutes
 */
function getISTTimezoneOffset() {
  const now = new Date();
  const utc = new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
  const ist = new Date(utc.toLocaleString("en-US", { timeZone: IST_TIMEZONE }));
  return (ist.getTime() - utc.getTime()) / 60000;
}

/**
 * Convert IST to UTC
 * @param {Date|string} istDate - The date in IST
 * @returns {Date} - Date converted to UTC
 */
function istToUTC(istDate) {
  if (!istDate) return null;
  
  const inputDate = new Date(istDate);
  if (isNaN(inputDate.getTime())) return null;
  
  // Get the timezone offset
  const offset = getISTTimezoneOffset();
  
  // Convert to UTC by subtracting the offset
  return new Date(inputDate.getTime() - (offset * 60000));
}

/**
 * Convert UTC to IST
 * @param {Date|string} utcDate - The date in UTC
 * @returns {Date} - Date converted to IST
 */
function utcToIST(utcDate) {
  if (!utcDate) return null;
  
  const inputDate = new Date(utcDate);
  if (isNaN(inputDate.getTime())) return null;
  
  // Get the timezone offset
  const offset = getISTTimezoneOffset();
  
  // Convert to IST by adding the offset
  return new Date(inputDate.getTime() + (offset * 60000));
}

/**
 * Get formatted date range for IST
 * @param {Date|string} startDate - Start date
 * @param {Date|string} endDate - End date
 * @returns {Object} - Object with formatted start and end dates
 */
function getFormattedDateRangeIST(startDate, endDate) {
  return {
    start: formatToISTTime(startDate, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }),
    end: formatToISTTime(endDate, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  };
}

module.exports = {
  toISTTime,
  getCurrentISTTime,
  formatToISTTime,
  formatTimeToIST,
  formatDateToIST,
  getStartOfDayIST,
  getEndOfDayIST,
  isTodayIST,
  getISTTimezoneOffset,
  istToUTC,
  utcToIST,
  getFormattedDateRangeIST,
  IST_TIMEZONE
};
