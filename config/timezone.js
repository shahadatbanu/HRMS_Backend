/**
 * Timezone Configuration for HRMS
 * Centralized timezone settings for Indian Standard Time (IST)
 */

const IST_TIMEZONE = 'Asia/Kolkata';

// Timezone configuration
const timezoneConfig = {
  // Primary timezone for the application
  primary: IST_TIMEZONE,
  
  // Display timezone (same as primary for consistency)
  display: IST_TIMEZONE,
  
  // Database timezone (UTC for storage, converted for display)
  database: 'UTC',
  
  // Cron job timezone
  cron: IST_TIMEZONE,
  
  // API response timezone
  api: IST_TIMEZONE,
  
  // Frontend display timezone
  frontend: IST_TIMEZONE
};

// Timezone utilities
const timezoneUtils = {
  /**
   * Get current time in Indian Standard Time (IST)
   */
  getCurrentTime() {
    return new Date(new Date().toLocaleString("en-US", { timeZone: IST_TIMEZONE }));
  },

  /**
   * Convert any date to Indian Standard Time (IST)
   */
  toISTTime(date) {
    if (!date) return null;
    const inputDate = new Date(date);
    if (isNaN(inputDate.getTime())) return null;
    return new Date(inputDate.toLocaleString("en-US", { timeZone: IST_TIMEZONE }));
  },

  /**
   * Get start of day in Indian Standard Time (IST)
   */
  getStartOfDay(date = null) {
    const targetDate = date ? new Date(date) : new Date();
    const istDate = new Date(targetDate.toLocaleString("en-US", { timeZone: IST_TIMEZONE }));
    istDate.setHours(0, 0, 0, 0);
    return istDate;
  },

  /**
   * Get end of day in Indian Standard Time (IST)
   */
  getEndOfDay(date = null) {
    const targetDate = date ? new Date(date) : new Date();
    const istDate = new Date(targetDate.toLocaleString("en-US", { timeZone: IST_TIMEZONE }));
    istDate.setHours(23, 59, 59, 999);
    return istDate;
  },

  /**
   * Format date for display in Indian Standard Time (IST)
   */
  formatDate(date, options = {}) {
    if (!date) return '';
    const inputDate = new Date(date);
    if (isNaN(inputDate.getTime())) return '';
    
    const defaultOptions = {
      timeZone: IST_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    };
    
    return inputDate.toLocaleDateString('en-US', { ...defaultOptions, ...options });
  },

  /**
   * Format time for display in Indian Standard Time (IST)
   */
  formatTime(date, options = {}) {
    if (!date) return '';
    const inputDate = new Date(date);
    if (isNaN(inputDate.getTime())) return '';
    
    const defaultOptions = {
      timeZone: IST_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    };
    
    return inputDate.toLocaleTimeString('en-US', { ...defaultOptions, ...options });
  },

  /**
   * Format datetime for display in Indian Standard Time (IST)
   */
  formatDateTime(date, options = {}) {
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
    
    return inputDate.toLocaleString('en-US', { ...defaultOptions, ...options });
  },

  /**
   * Check if a date is today in Indian Standard Time (IST)
   */
  isToday(date) {
    if (!date) return false;
    const inputDate = new Date(date);
    if (isNaN(inputDate.getTime())) return false;
    
    const today = this.getCurrentTime();
    const inputDateIST = new Date(inputDate.toLocaleString("en-US", { timeZone: IST_TIMEZONE }));
    
    return inputDateIST.toDateString() === today.toDateString();
  },

  /**
   * Get timezone offset for Indian Standard Time (IST)
   */
  getTimezoneOffset() {
    const now = new Date();
    const utc = new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
    const ist = new Date(utc.toLocaleString("en-US", { timeZone: IST_TIMEZONE }));
    return (ist.getTime() - utc.getTime()) / 60000;
  }
};

module.exports = {
  timezoneConfig,
  timezoneUtils,
  IST_TIMEZONE
};
