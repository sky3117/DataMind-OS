/**
 * Upload Queue - Manages sequential file uploads to prevent race conditions
 * and concurrent state updates that could corrupt global state.
 */

type UploadTask = {
  id: string;
  file: File;
  priority: number;
  createdAt: number;
  execute: () => Promise<void>;
};

type QueueListener = (state: QueueState) => void;

export interface QueueState {
  isProcessing: boolean;
  queueSize: number;
  currentUploadId: string | null;
  completedUploads: number;
  failedUploads: number;
}

class UploadQueue {
  private queue: UploadTask[] = [];
  private processing = false;
  private currentUploadId: string | null = null;
  private completedUploads = 0;
  private failedUploads = 0;
  private listeners: Set<QueueListener> = new Set();
  private uploadTimeout: NodeJS.Timeout | null = null;

  /**
   * Add a file upload task to the queue
   */
  addTask(
    file: File,
    execute: () => Promise<void>,
    priority: number = 0
  ): string {
    const id = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const task: UploadTask = {
      id,
      file,
      priority,
      createdAt: Date.now(),
      execute,
    };

    this.queue.push(task);
    // Sort by priority (higher first), then by creation time (earlier first)
    this.queue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.createdAt - b.createdAt;
    });

    this.notifyListeners();
    this.processNext();

    return id;
  }

  /**
   * Get the current queue state
   */
  getState(): QueueState {
    return {
      isProcessing: this.processing,
      queueSize: this.queue.length,
      currentUploadId: this.currentUploadId,
      completedUploads: this.completedUploads,
      failedUploads: this.failedUploads,
    };
  }

  /**
   * Subscribe to queue state changes
   */
  subscribe(listener: QueueListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Process the next task in the queue
   */
  private async processNext(): Promise<void> {
    // Prevent concurrent processing
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    const task = this.queue.shift();

    if (!task) {
      this.processing = false;
      return;
    }

    this.currentUploadId = task.id;
    this.notifyListeners();

    try {
      // Set a timeout for the upload (default 5 minutes)
      await Promise.race([
        task.execute(),
        new Promise<void>((_, reject) =>
          setTimeout(
            () => reject(new Error('Upload queue task timeout')),
            5 * 60 * 1000
          )
        ),
      ]);
      this.completedUploads++;
    } catch (error) {
      this.failedUploads++;
      console.error(`Upload task ${task.id} failed:`, error);
    } finally {
      this.currentUploadId = null;
      this.processing = false;
      this.notifyListeners();

      // Process next task
      if (this.queue.length > 0) {
        // Small delay between uploads to avoid thundering herd
        this.uploadTimeout = setTimeout(() => this.processNext(), 500);
      }
    }
  }

  /**
   * Notify all subscribers of state changes
   */
  private notifyListeners(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (error) {
        console.error('Error in upload queue listener:', error);
      }
    }
  }

  /**
   * Cancel a specific upload task
   */
  cancelTask(id: string): boolean {
    const index = this.queue.findIndex((task) => task.id === id);
    if (index !== -1) {
      this.queue.splice(index, 1);
      this.notifyListeners();
      return true;
    }
    return false;
  }

  /**
   * Clear all pending tasks
   */
  clearQueue(): void {
    this.queue = [];
    // Clear the pending timeout
    if (this.uploadTimeout) {
      clearTimeout(this.uploadTimeout);
      this.uploadTimeout = null;
    }
    this.notifyListeners();
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Check if currently processing
   */
  isProcessing(): boolean {
    return this.processing;
  }
}

// Export singleton instance
export const uploadQueue = new UploadQueue();
