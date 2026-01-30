// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import type { Kernel, ServerConnection } from '@jupyterlab/services';
import { BaseManager, KernelManager } from '@jupyterlab/services';

import { Poll } from '@lumino/polling';
import type { ISignal } from '@lumino/signaling';

/**
 * A kernel manager that handles graceful degradation when the remote server
 * is not yet available.
 *
 * This manager:
 * - Returns empty running kernels until the server responds
 * - Polls periodically to check for server availability and refresh running kernels
 * - Emits runningChanged when kernels become available
 * - Does not block initialization on server availability
 */
export class RemoteKernelManager
  extends BaseManager
  implements Kernel.IManager
{
  constructor(options: RemoteKernelManager.IOptions = {}) {
    super(options);
    const { serverSettings } = options;

    // Create the internal manager
    this._kernelManager = new KernelManager({
      serverSettings
    });

    // Set up polling for running kernels refresh
    const pollInterval = options.pollInterval ?? 10000; // 10 seconds default
    const maxPollInterval = options.maxPollInterval ?? 300000; // 5 minutes max

    this._poll = new Poll({
      auto: false,
      factory: () => this._pollRunning(),
      frequency: {
        interval: pollInterval,
        backoff: true,
        max: maxPollInterval
      },
      name: '@jupyterlite-remote-server:KernelManager#running',
      standby: options.standby ?? 'when-hidden'
    });

    // Initialize without blocking
    this._ready = this._initialize();
  }

  /**
   * A signal emitted when the running kernels change.
   */
  get runningChanged(): ISignal<this, Kernel.IModel[]> {
    return this._kernelManager.runningChanged as unknown as ISignal<
      this,
      Kernel.IModel[]
    >;
  }

  /**
   * A signal emitted when there is a connection failure.
   */
  get connectionFailure(): ISignal<this, Error> {
    return this._kernelManager.connectionFailure as unknown as ISignal<
      this,
      Error
    >;
  }

  /**
   * Test whether the manager is ready.
   */
  get isReady(): boolean {
    return this._isReady;
  }

  /**
   * A promise that fulfills when the manager is ready.
   */
  get ready(): Promise<void> {
    return this._ready;
  }

  /**
   * Create an iterator over the known running kernels.
   */
  running(): IterableIterator<Kernel.IModel> {
    return this._kernelManager.running();
  }

  /**
   * The number of running kernels.
   */
  get runningCount(): number {
    return Array.from(this.running()).length;
  }

  /**
   * Force a refresh of the running kernels.
   */
  async refreshRunning(): Promise<void> {
    try {
      await this._kernelManager.refreshRunning();
    } catch {
      // Server not available - will retry on next poll
    }
  }

  /**
   * Start a new kernel.
   */
  async startNew(
    createOptions?: Kernel.IKernelOptions,
    connectOptions?: Omit<
      Kernel.IKernelConnection.IOptions,
      'model' | 'serverSettings'
    >
  ): Promise<Kernel.IKernelConnection> {
    return this._kernelManager.startNew(createOptions, connectOptions);
  }

  /**
   * Connect to an existing kernel.
   */
  connectTo(
    options: Kernel.IKernelConnection.IOptions
  ): Kernel.IKernelConnection {
    return this._kernelManager.connectTo(options);
  }

  /**
   * Shut down a kernel by id.
   */
  async shutdown(id: string): Promise<void> {
    return this._kernelManager.shutdown(id);
  }

  /**
   * Shut down all kernels.
   */
  async shutdownAll(): Promise<void> {
    return this._kernelManager.shutdownAll();
  }

  /**
   * Find a kernel by id.
   */
  async findById(id: string): Promise<Kernel.IModel | undefined> {
    return this._kernelManager.findById(id);
  }

  /**
   * Dispose of the resources used by the manager.
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._poll.dispose();
    this._kernelManager.dispose();
    super.dispose();
  }

  /**
   * Initialize the manager.
   */
  private async _initialize(): Promise<void> {
    try {
      await this._kernelManager.refreshRunning();
    } catch {
      // Server not available yet - that's okay, polling will retry
    }

    // Mark as ready regardless of whether we could connect
    this._isReady = true;

    // Start polling for updates
    void this._poll.start();
  }

  /**
   * Poll for running kernels.
   */
  private async _pollRunning(): Promise<void> {
    try {
      await this._kernelManager.refreshRunning();
    } catch {
      // Server not available - will retry on next poll
    }
  }

  private _kernelManager: KernelManager;
  private _poll: Poll;
  private _isReady = false;
  private _ready: Promise<void>;
}

export namespace RemoteKernelManager {
  /**
   * The options used to initialize a remote kernel manager.
   */
  export interface IOptions extends BaseManager.IOptions {
    /**
     * The server settings for connecting to the remote server.
     */
    serverSettings?: ServerConnection.ISettings;

    /**
     * The initial polling interval in milliseconds.
     * Defaults to 10000 (10 seconds).
     */
    pollInterval?: number;

    /**
     * The maximum polling interval in milliseconds after backoff.
     * Defaults to 300000 (5 minutes).
     */
    maxPollInterval?: number;

    /**
     * When the manager stops polling the API.
     * Defaults to 'when-hidden'.
     */
    standby?: Poll.Standby | (() => boolean | Poll.Standby);
  }
}
