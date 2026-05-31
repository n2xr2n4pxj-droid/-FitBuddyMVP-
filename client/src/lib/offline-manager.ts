import { logger } from './logger';

/**
 * 離線隊列系統
 * 當用戶離線時，存儲請求；當重新上線時，自動重試
 */

interface QueuedRequest {
  id: string;
  method: string;
  url: string;
  data?: any;
  timestamp: number;
  retryCount: number;
}

class OfflineManager {
  private queue: QueuedRequest[] = [];
  private readonly STORAGE_KEY = 'fitbuddy_offline_queue';
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  constructor() {
    if (typeof window !== 'undefined') {
      this.loadQueue();
      this.setupListeners();
    }
  }

  private setupListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      logger.info('OFFLINE', 'User is now online');
      this.isOnline = true;
      this.processQueue();
    });

    window.addEventListener('offline', () => {
      logger.info('OFFLINE', 'User is now offline');
      this.isOnline = false;
    });
  }

  private loadQueue(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
        logger.info('OFFLINE', 'Loaded queued requests', { count: this.queue.length });
      }
    } catch (error) {
      logger.error('OFFLINE', 'Failed to load queue', { error });
    }
  }

  private saveQueue(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      logger.error('OFFLINE', 'Failed to save queue', { error });
    }
  }

  /**
   * 添加請求到隊列（在離線時調用）
   */
  addToQueue(method: string, url: string, data?: any): void {
    if (this.isOnline) return; // 如果在線，不需要隊列

    const request: QueuedRequest = {
      id: `${Date.now()}-${Math.random()}`,
      method,
      url,
      data,
      timestamp: Date.now(),
      retryCount: 0,
    };

    this.queue.push(request);
    this.saveQueue();

    logger.info('OFFLINE', 'Request queued', {
      method,
      url,
      queueSize: this.queue.length,
    });
  }

  /**
   * 處理隊列中的請求
   */
  private async processQueue(): Promise<void> {
    if (this.queue.length === 0) return;

    logger.info('OFFLINE', 'Processing offline queue', { count: this.queue.length });

    const requestsToProcess = [...this.queue]; // 創建副本以避免在迭代時修改數組

    for (const request of requestsToProcess) {
      try {
        // 使用 apiClient 重試請求
        const { apiClient } = await import('./api-client');

        await apiClient({
          method: request.method as any,
          url: request.url,
          data: request.data,
        });

        // 成功，從隊列中移除
        this.queue = this.queue.filter((r) => r.id !== request.id);
        this.saveQueue();

        logger.info('OFFLINE', 'Queued request processed', {
          id: request.id,
          method: request.method,
          url: request.url,
        });
      } catch (error) {
        request.retryCount++;

        if (request.retryCount > 3) {
          // 重試超過 3 次，放棄
          this.queue = this.queue.filter((r) => r.id !== request.id);
          logger.error('OFFLINE', 'Request failed after 3 retries', {
            id: request.id,
            error,
          });
        } else {
          logger.warn('OFFLINE', 'Request retry', {
            id: request.id,
            retryCount: request.retryCount,
          });
        }

        this.saveQueue();
      }
    }
  }

  /**
   * 檢查是否在線
   */
  getIsOnline(): boolean {
    return this.isOnline;
  }

  /**
   * 獲取隊列大小
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * 清除隊列
   */
  clearQueue(): void {
    this.queue = [];
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.STORAGE_KEY);
    }
    logger.info('OFFLINE', 'Queue cleared');
  }
}

export const offlineManager = new OfflineManager();
export default offlineManager;

