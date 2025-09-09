/**
 * Timezone Utilities for US Central Time
 * Handles conversion between UTC and US Central Time (America/Chicago)
 * Supports both Central Standard Time (CST) and Central Daylight Time (CDT)
 */

const US_CENTRAL_TIMEZONE = 'America/Chicago';

/**
 * Convert a date to US Central Time
 * @param {Date|string} date - The date to convert
 * @returns {Date} - Date converted to US Central Time
 */
function toUSCentralTime(date) {
  if (!date) return null;
  
  const inputDate = new Date(date);
  if (isNaN(inputDate.getTime())) return null;
  
  // Convert to US Central Time
  return new Date(inputDate.toLocaleString("en-US", { timeZone: US_CENTRAL_TIMEZONE }));
}

/**
 * Get current time in US Central Time
 * @returns {Date} - Current time in US Central Time
 */
function getCurrentUSCentralTime() {
  // Get current time in UTC
  const now = new Date();
  
  // Get the timezone offset for US Central Time
  // We need to find what UTC time corresponds to the current time in US Central Time
  const centralTimeString = now.toLocaleString("en-US", { timeZone: US_CENTRAL_TIMEZONE });
  
  // Parse the central time string to get the components
  const [datePart, timePart] = centralTimeString.split(', ');
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
  
  // Create a date object for the central time
  const centralDate = new Date(year, month - 1, day, hour24, parseInt(minutes), parseInt(seconds || 0), 0);
  
  // Calculate the offset between this central time and UTC
  const utcTime = new Date(centralDate.toISOString());
  const offset = centralDate.getTime() - utcTime.getTime();
  
  // Apply the offset to get the correct UTC time that represents current Central Time
  return new Date(now.getTime() + offset);
}

/**
 * Format a date to US Central Time string
 * @param {Date|string} date - The date to format
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} - Formatted date string in US Central Time
 */
function formatToUSCentralTime(date, options = {}) {
  if (!date) return '';
  
  const inputDate = new Date(date);
  if (isNaN(inputDate.getTime())) return '';
  
  const defaultOptions = {
    timeZone: US_CENTRAL_TIMEZONE,
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
 * Format time only in US Central Time
 * @param {Date|string} date - The date to format
 * @param {boolean} use24Hour - Whether to use 24-hour format
 * @returns {string} - Formatted time string in US Central Time
 */
function formatTimeToUSCentral(date, use24Hour = false) {
  if (!date) return '';
  
  const inputDate = new Date(date);
  if (isNaN(inputDate.getTime())) return '';
  
  return inputDate.toLocaleTimeString('en-US', {
    timeZone: US_CENTRAL_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: !use24Hour
  });
}

/**
 * Format date only in US Central Time
 * @param {Date|string} date - The date to format
 * @param {Object} options - Additional formatting options
 * @returns {string} - Formatted date string in US Central Time
 */
function formatDateToUSCentral(date, options = {}) {
  if (!date) return '';
  
  const inputDate = new Date(date);
  if (isNaN(inputDate.getTime())) return '';
  
  const defaultOptions = {
    timeZone: US_CENTRAL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  };
  
  const formatOptions = { ...defaultOptions, ...options };
  
  return inputDate.toLocaleDateString('en-US', formatOptions);
}

/**
 * Get start of day in US Central Time
 * @param {Date|string} date - The date to get start of day for
 * @returns {Date} - Start of day in US Central Time
 */
function getStartOfDayUSCentral(date) {
  if (!date) return null;
  
  const inputDate = new Date(date);
  if (isNaN(inputDate.getTime())) return null;
  
  // Get the date string in US Central Time
  const centralDateString = inputDate.toLocaleDateString("en-US", { timeZone: US_CENTRAL_TIMEZONE });
  const [month, day, year] = centralDateString.split('/');
  
  // Create a date object for midnight in US Central Time
  // We need to create this as if it were in US Central Time, then convert to UTC
  const centralMidnight = new Date(year, month - 1, day, 0, 0, 0, 0);
  
  // Get the timezone offset for US Central Time on this date
  // We'll use a known time to calculate the offset
  const testTime = new Date(year, month - 1, day, 12, 0, 0, 0); // Noon
  const centralTime = new Date(testTime.toLocaleString("en-US", { timeZone: US_CENTRAL_TIMEZONE }));
  const utcTime = new Date(testTime.toISOString());
  const offset = utcTime.getTime() - centralTime.getTime();
  
  // Apply the offset to get the correct UTC time for midnight in US Central Time
  return new Date(centralMidnight.getTime() + offset);
}

/**
 * Get end of day in US Central Time
 * @param {Date|string} date - The date to get end of day for
 * @returns {Date} - End of day in US Central Time
 */
function getEndOfDayUSCentral(date) {
  if (!date) return null;
  
  const inputDate = new Date(date);
  if (isNaN(inputDate.getTime())) return null;
  
  // Get the date string in US Central Time
  const centralDateString = inputDate.toLocaleDateString("en-US", { timeZone: US_CENTRAL_TIMEZONE });
  const [month, day, year] = centralDateString.split('/');
  
  // Create a date object for end of day in US Central Time
  const centralEndOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);
  
  // Get the timezone offset for US Central Time on this date
  const testTime = new Date(year, month - 1, day, 12, 0, 0, 0); // Noon
  const centralTime = new Date(testTime.toLocaleString("en-US", { timeZone: US_CENTRAL_TIMEZONE }));
  const utcTime = new Date(testTime.toISOString());
  const offset = utcTime.getTime() - centralTime.getTime();
  
  // Apply the offset to get the correct UTC time for end of day in US Central Time
  return new Date(centralEndOfDay.getTime() + offset);
}

/**
 * Check if a date is today in US Central Time
 * @param {Date|string} date - The date to check
 * @returns {boolean} - True if the date is today in US Central Time
 */
function isTodayUSCentral(date) {
  if (!date) return false;
  
  const inputDate = new Date(date);
  if (isNaN(inputDate.getTime())) return false;
  
  const today = getCurrentUSCentralTime();
  const inputDateCentral = new Date(inputDate.toLocaleString("en-US", { timeZone: US_CENTRAL_TIMEZONE }));
  
  return inputDateCentral.toDateString() === today.toDateString();
}

/**
 * Get timezone offset for US Central Time
 * @returns {number} - Timezone offset in minutes
 */
function getUSCentralTimezoneOffset() {
  const now = new Date();
  const utc = new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
  const central = new Date(utc.toLocaleString("en-US", { timeZone: US_CENTRAL_TIMEZONE }));
  return (central.getTime() - utc.getTime()) / 60000;
}

/**
 * Convert US Central Time to UTC
 * @param {Date|string} centralDate - The date in US Central Time
 * @returns {Date} - Date converted to UTC
 */
function centralToUTC(centralDate) {
  if (!centralDate) return null;
  
  const inputDate = new Date(centralDate);
  if (isNaN(inputDate.getTime())) return null;
  
  // Get the timezone offset
  const offset = getUSCentralTimezoneOffset();
  
  // Convert to UTC by subtracting the offset
  return new Date(inputDate.getTime() - (offset * 60000));
}

/**
 * Convert UTC to US Central Time
 * @param {Date|string} utcDate - The date in UTC
 * @returns {Date} - Date converted to US Central Time
 */
function utcToCentral(utcDate) {
  if (!utcDate) return null;
  
  const inputDate = new Date(utcDate);
  if (isNaN(inputDate.getTime())) return null;
  
  // Get the timezone offset
  const offset = getUSCentralTimezoneOffset();
  
  // Convert to Central by adding the offset
  return new Date(inputDate.getTime() + (offset * 60000));
}

/**
 * Get formatted date range for US Central Time
 * @param {Date|string} startDate - Start date
 * @param {Date|string} endDate - End date
 * @returns {Object} - Object with formatted start and end dates
 */
function getFormattedDateRangeUSCentral(startDate, endDate) {
  return {
    start: formatToUSCentralTime(startDate, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }),
    end: formatToUSCentralTime(endDate, {
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
  toUSCentralTime,
  getCurrentUSCentralTime,
  formatToUSCentralTime,
  formatTimeToUSCentral,
  formatDateToUSCentral,
  getStartOfDayUSCentral,
  getEndOfDayUSCentral,
  isTodayUSCentral,
  getUSCentralTimezoneOffset,
  centralToUTC,
  utcToCentral,
  getFormattedDateRangeUSCentral,
  US_CENTRAL_TIMEZONE
};
