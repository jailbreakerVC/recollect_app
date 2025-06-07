type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class Logger {
  private static isDevelopment = process.env.NODE_ENV === 'development';

  private static formatMessage(level: LogLevel, component: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const emoji = this.getEmoji(level);
    return `${emoji} [${timestamp}] ${component}: ${message}`;
  }

  private static getEmoji(level: LogLevel): string {
    switch (level) {
      case 'debug': return '🔍';
      case 'info': return 'ℹ️';
      case 'warn': return '⚠️';
      case 'error': return '❌';
      default: return '📝';
    }
  }

  static debug(component: string, message: string, data?: any): void {
    if (this.isDevelopment) {
      console.debug(this.formatMessage('debug', component, message), data);
    }
  }

  static info(component: string, message: string, data?: any): void {
    console.info(this.formatMessage('info', component, message), data);
  }

  static warn(component: string, message: string, data?: any): void {
    console.warn(this.formatMessage('warn', component, message), data);
  }

  static error(component: string, message: string, error?: any): void {
    console.error(this.formatMessage('error', component, message), error);
  }

  static group(label: string, fn: () => void): void {
    if (this.isDevelopment) {
      console.group(label);
      fn();
      console.groupEnd();
    } else {
      fn();
    }
  }
}