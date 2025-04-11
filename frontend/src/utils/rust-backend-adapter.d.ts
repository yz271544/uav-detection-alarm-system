/**
 * Rust后端适配器类型定义
 */

/**
 * 创建一个模拟的socket.io客户端，实际使用WebSocket连接到Rust后端
 */
export function createRustSocketClient(): {
  on: (event: string, callback: (data?: any) => void) => void;
  disconnect: () => void;
  emit: () => void;
  id: string;
}; 