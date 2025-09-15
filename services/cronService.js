const cron = require('node-cron');
const { markAbsencesForToday } = require('../routes/attendanceSettings.js');
const AttendanceSettings = require('../models/AttendanceSettings.js');

class CronService {
  constructor() {
    this.absenceMarkingJob = null;
    this.isInitialized = false;
    this.lastRun = null;
    this.lastRunResult = null;
    this.nextRun = null;
    this.runCount = 0;
    this.errorCount = 0;
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
        this.lastRun = new Date();
        this.runCount++;
        
        try {
          const result = await markAbsencesForToday();
          this.lastRunResult = {
            success: true,
            result: result,
            timestamp: this.lastRun
          };
          console.log('✅ Scheduled absence marking completed:', result);
        } catch (error) {
          this.errorCount++;
          this.lastRunResult = {
            success: false,
            error: error.message,
            timestamp: this.lastRun
          };
          console.error('❌ Error in scheduled absence marking:', error);
        }
      }, {
        scheduled: true,
        timezone: "Asia/Kolkata" // IST
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
  async getStatus() {
    // Check if auto absence marking is enabled
    const settings = await AttendanceSettings.findOne();
    const isAutoAbsenceEnabled = settings && settings.autoAbsenceEnabled;
    
    const isJobRunning = this.absenceMarkingJob && 
                        this.absenceMarkingJob.running !== false && 
                        this.isInitialized &&
                        isAutoAbsenceEnabled;
    
    return {
      isInitialized: this.isInitialized,
      autoAbsenceEnabled: isAutoAbsenceEnabled,
      absenceMarkingJob: {
        running: Boolean(isJobRunning),
        lastRun: this.lastRun,
        lastRunResult: this.lastRunResult,
        nextRun: isAutoAbsenceEnabled ? this.getNextRunTime() : null,
        runCount: this.runCount,
        errorCount: this.errorCount,
        successRate: this.runCount > 0 ? ((this.runCount - this.errorCount) / this.runCount * 100).toFixed(1) : 0
      }
    };
  }

  // Get next run time
  getNextRunTime() {
    if (!this.absenceMarkingJob || !this.absenceMarkingJob.running) {
      return null;
    }
    
    // Calculate next run time based on current schedule
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // For now, return a basic calculation
    // In a real implementation, you'd need to get settings synchronously or cache them
    const nextRun = new Date(tomorrow);
    nextRun.setHours(12, 0, 0, 0); // Default to 12:00 PM
    return nextRun;
  }

  // Get detailed cron statistics
  async getDetailedStatus() {
    const status = await this.getStatus();
    const now = new Date();
    
    return {
      ...status,
      uptime: this.isInitialized ? this.getUptime() : 0,
      timeSinceLastRun: this.lastRun ? Math.floor((now - this.lastRun) / (1000 * 60)) : null, // minutes
      nextRunIn: status.absenceMarkingJob.nextRun ? Math.floor((new Date(status.absenceMarkingJob.nextRun) - now) / (1000 * 60)) : null, // minutes
      healthStatus: await this.getHealthStatus()
    };
  }

  // Get uptime in minutes
  getUptime() {
    if (!this.isInitialized) return 0;
    // This is a simplified uptime calculation
    // In a real implementation, you'd track the start time
    return Math.floor((Date.now() - (this.lastRun || Date.now())) / (1000 * 60));
  }

  // Get health status
  async getHealthStatus() {
    if (!this.isInitialized) return 'stopped';
    
    // Check if auto absence marking is enabled
    const settings = await AttendanceSettings.findOne();
    const isAutoAbsenceEnabled = settings && settings.autoAbsenceEnabled;
    
    if (!isAutoAbsenceEnabled) return 'disabled';
    
    const isJobRunning = this.absenceMarkingJob && 
                        this.absenceMarkingJob.running !== false && 
                        this.isInitialized;
    
    if (!isJobRunning) return 'stopped';
    if (this.errorCount > this.runCount * 0.5) return 'unhealthy';
    if (this.errorCount > 0) return 'warning';
    return 'healthy';
  }
}

// Create singleton instance
const cronService = new CronService();

module.exports = cronService;
