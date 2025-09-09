/**
 * Timezone Configuration for HRMS
 * Centralized timezone settings for US Central Time
 */

const US_CENTRAL_TIMEZONE = 'America/Chicago';

// Timezone configuration
const timezoneConfig = {
  // Primary timezone for the application
  primary: US_CENTRAL_TIMEZONE,
  
  // Display timezone (same as primary for consistency)
  display: US_CENTRAL_TIMEZONE,
  
  // Database timezone (UTC for storage, converted for display)
  database: 'UTC',
  
  // Cron job timezone
  cron: US_CENTRAL_TIMEZONE,
  
  // API response timezone
  api: US_CENTRAL_TIMEZONE,
  
  // Frontend display timezone
  frontend: US_CENTRAL_TIMEZONE
};

// Timezone utilities
const timezoneUtils = {
  /**
   * Get current time in US Central Time
   */
  getCurrentTime() {
    return new Date(new Date().toLocaleString("en-US", { timeZone: US_CENTRAL_TIMEZONE }));
  },

  /**
   * Convert any date to US Central Time
   */
  toCentralTime(date) {
    if (!date) return null;
    const inputDate = new Date(date);
    if (isNaN(inputDate.getTime())) return null;
    return new Date(inputDate.toLocaleString("en-US", { timeZone: US_CENTRAL_TIMEZONE }));
  },

  /**
   * Get start of day in US Central Time
   */
  getStartOfDay(date = null) {
    const targetDate = date ? new Date(date) : new Date();
    const centralDate = new Date(targetDate.toLocaleString("en-US", { timeZone: US_CENTRAL_TIMEZONE }));
    centralDate.setHours(0, 0, 0, 0);
    return centralDate;
  },

  /**
   * Get end of day in US Central Time
   */
  getEndOfDay(date = null) {
    const targetDate = date ? new Date(date) : new Date();
    const centralDate = new Date(targetDate.toLocaleString("en-US", { timeZone: US_CENTRAL_TIMEZONE }));
    centralDate.setHours(23, 59, 59, 999);
    return centralDate;
  },

  /**
   * Format date for display in US Central Time
   */
  formatDate(date, options = {}) {
    if (!date) return '';
    const inputDate = new Date(date);
    if (isNaN(inputDate.getTime())) return '';
    
    const defaultOptions = {
      timeZone: US_CENTRAL_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    };
    
    return inputDate.toLocaleDateString('en-US', { ...defaultOptions, ...options });
  },

  /**
   * Format time for display in US Central Time
   */
  formatTime(date, options = {}) {
    if (!date) return '';
    const inputDate = new Date(date);
    if (isNaN(inputDate.getTime())) return '';
    
    const defaultOptions = {
      timeZone: US_CENTRAL_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    };
    
    return inputDate.toLocaleTimeString('en-US', { ...defaultOptions, ...options });
  },

  /**
   * Format datetime for display in US Central Time
   */
  formatDateTime(date, options = {}) {
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
    
    return inputDate.toLocaleString('en-US', { ...defaultOptions, ...options });
  },

  /**
   * Check if a date is today in US Central Time
   */
  isToday(date) {
    if (!date) return false;
    const inputDate = new Date(date);
    if (isNaN(inputDate.getTime())) return false;
    
    const today = this.getCurrentTime();
    const inputDateCentral = new Date(inputDate.toLocaleString("en-US", { timeZone: US_CENTRAL_TIMEZONE }));
    
    return inputDateCentral.toDateString() === today.toDateString();
  },

  /**
   * Get timezone offset for US Central Time
   */
  getTimezoneOffset() {
    const now = new Date();
    const utc = new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
    const central = new Date(utc.toLocaleString("en-US", { timeZone: US_CENTRAL_TIMEZONE }));
    return (central.getTime() - utc.getTime()) / 60000;
  }
};

module.exports = {
  timezoneConfig,
  timezoneUtils,
  US_CENTRAL_TIMEZONE
};
