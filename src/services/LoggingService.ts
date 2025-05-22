class LoggingService {
  private static instance: LoggingService;
  private isDevelopment: boolean;

  private constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  public static getInstance(): LoggingService {
    if (!LoggingService.instance) {
      LoggingService.instance = new LoggingService();
    }
    return LoggingService.instance;
  }

  private formatMessage(component: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${component}] ${message}`;
  }

  public log(component: string, message: string, data?: any): void {
    if (this.isDevelopment) {
      console.log(this.formatMessage(component, message), data || '');
    }
    // In production, you could send logs to a logging service
  }

  public error(component: string, message: string, error?: any): void {
    console.error(this.formatMessage(component, message), error || '');
    // In production, you could send errors to an error tracking service
  }

  public warn(component: string, message: string, data?: any): void {
    console.warn(this.formatMessage(component, message), data || '');
  }

  public info(component: string, message: string, data?: any): void {
    console.info(this.formatMessage(component, message), data || '');
  }
}

export default LoggingService; 