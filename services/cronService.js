const cron = require('node-cron');
const { markAbsencesForToday } = require('../routes/attendanceSettings.js');
const AttendanceSettings = require('../models/AttendanceSettings.js');

class CronService {
  constructor() {
    this.absenceMarkingJob = null;
    this.isInitialized = false;
  }

  // Initialize cron jobs
  async initialize() {
    if (this.isInitialized) {
      console.log('🔄 Cron service already initialized');
      return;
    }

    try {
      console.log('🚀 Initializing cron service...');
      
      // Schedule absence marking job
      await this.scheduleAbsenceMarking();
      
      this.isInitialized = true;
      console.log('✅ Cron service initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing cron service:', error);
    }
  }

  // Schedule absence marking job
  async scheduleAbsenceMarking() {
    try {
      // Stop existing job if running
      if (this.absenceMarkingJob) {
        this.absenceMarkingJob.stop();
      }

      // Get attendance settings
      const settings = await AttendanceSettings.findOne();
      if (!settings || !settings.autoAbsenceEnabled) {
        console.log('⏸️ Automatic absence marking is disabled');
        return;
      }

      // Parse absence marking time
      const [hour, minute] = settings.absenceMarkingTime.split(':').map(Number);
      
      // Schedule job to run daily at the configured time
      // Cron format: minute hour day month day-of-week
      const cronExpression = `${minute} ${hour} * * *`;
      
      console.log(`⏰ Scheduling absence marking job for ${settings.formattedAbsenceMarkingTime} daily (${cronExpression})`);
      
      this.absenceMarkingJob = cron.schedule(cronExpression, async () => {
        console.log('🔄 Running scheduled absence marking...');
        try {
          const result = await markAbsencesForToday();
          console.log('✅ Scheduled absence marking completed:', result);
        } catch (error) {
          console.error('❌ Error in scheduled absence marking:', error);
        }
      }, {
        scheduled: true,
        timezone: "America/Chicago" // US Central Time
      });

      console.log('✅ Absence marking job scheduled successfully');
    } catch (error) {
      console.error('❌ Error scheduling absence marking job:', error);
    }
  }

  // Update absence marking schedule (called when settings are updated)
  async updateAbsenceMarkingSchedule() {
    console.log('🔄 Updating absence marking schedule...');
    await this.scheduleAbsenceMarking();
  }

  // Stop all cron jobs
  stop() {
    if (this.absenceMarkingJob) {
      this.absenceMarkingJob.stop();
      console.log('⏹️ Absence marking job stopped');
    }
    this.isInitialized = false;
    console.log('⏹️ Cron service stopped');
  }

  // Get job status
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      absenceMarkingJob: {
        running: this.absenceMarkingJob ? this.absenceMarkingJob.running : false
      }
    };
  }
}

// Create singleton instance
const cronService = new CronService();

module.exports = cronService;
