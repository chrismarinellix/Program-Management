// Debug logger that writes to both console and localStorage
export class DebugLogger {
  private static logs: string[] = [];
  
  static log(message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}${data ? ': ' + JSON.stringify(data) : ''}`;
    
    // Store in array
    this.logs.push(logEntry);
    
    // Try console
    try {
      console.log(logEntry);
    } catch (e) {}
    
    // Try localStorage
    try {
      localStorage.setItem('debug-logs', JSON.stringify(this.logs));
    } catch (e) {}
    
    // Try to update DOM directly
    try {
      const debugDiv = document.getElementById('debug-output');
      if (debugDiv) {
        debugDiv.innerHTML += logEntry + '<br>';
      }
    } catch (e) {}
  }
  
  static getLogs(): string[] {
    return this.logs;
  }
  
  static clear() {
    this.logs = [];
    try {
      localStorage.removeItem('debug-logs');
    } catch (e) {}
  }
}