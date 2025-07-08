/**
 * Mock transport for testing MCP server without actual stdio communication
 */
export class MockStdioTransport {
  private messageQueue: any[] = [];
  private responseHandlers: Map<string, (msg: any) => void> = new Map();
  private connected = false;

  async connect(): Promise<void> {
    this.connected = true;
  }

  async close(): Promise<void> {
    this.connected = false;
    this.messageQueue = [];
    this.responseHandlers.clear();
  }

  async send(message: any): Promise<void> {
    if (!this.connected) {
      throw new Error('Transport not connected');
    }
    this.messageQueue.push(message);
  }

  onMessage(handler: (msg: any) => void): void {
    this.responseHandlers.set('message', handler);
  }

  // Test helper methods
  simulateIncomingMessage(message: any): void {
    const handler = this.responseHandlers.get('message');
    if (handler) handler(message);
  }

  getLastMessage(): any {
    return this.messageQueue[this.messageQueue.length - 1];
  }

  getAllMessages(): any[] {
    return [...this.messageQueue];
  }

  clearMessages(): void {
    this.messageQueue = [];
  }

  isConnected(): boolean {
    return this.connected;
  }
}