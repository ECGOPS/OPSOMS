class LoggingService {
  private static instance: LoggingService;
  private isDevelopment: boolean;
  private isLoggingEnabled: boolean;

  private constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.isLoggingEnabled = this.isDevelopment;
  }

  public static getInstance(): LoggingService {
    if (!LoggingService.instance) {
      LoggingService.instance = new LoggingService();
    }
    return LoggingService.instance;
  }

  public disableLogging(): void {
    this.isLoggingEnabled = false;
  }

  public enableLogging(): void {
    this.isLoggingEnabled = this.isDevelopment;
  }

  private formatMessage(component: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${component}] ${message}`;
  }

  public log(component: string, message: string, data?: any): void {
    if (this.isLoggingEnabled) {
      console.log(this.formatMessage(component, message), data || '');
    }
  }

  public error(component: string, message: string, error?: any): void {
    if (this.isLoggingEnabled) {
      console.error(this.formatMessage(component, message), error || '');
    }
  }

  public warn(component: string, message: string, data?: any): void {
    if (this.isLoggingEnabled) {
      console.warn(this.formatMessage(component, message), data || '');
    }
  }

  public info(component: string, message: string, data?: any): void {
    if (this.isLoggingEnabled) {
      console.info(this.formatMessage(component, message), data || '');
    }
  }
}

export default LoggingService; 