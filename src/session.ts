// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import type { Kernel, ServerConnection, Session } from '@jupyterlab/services';
import { BaseManager, SessionManager } from '@jupyterlab/services';

import { Poll } from '@lumino/polling';
import type { ISignal } from '@lumino/signaling';

/**
 * A session manager that handles graceful degradation when the remote server
 * is not yet available.
 *
 * This manager:
 * - Returns empty running sessions until the server responds
 * - Polls periodically to check for server availability and refresh running sessions
 * - Emits runningChanged when sessions become available
 * - Does not block initialization on server availability
 */
export class RemoteSessionManager
  extends BaseManager
  implements Session.IManager
{
  constructor(options: RemoteSessionManager.IOptions) {
    super(options);
    const { serverSettings, kernelManager } = options;

    // Create the internal manager
    this._sessionManager = new SessionManager({
      serverSettings,
      kernelManager
    });

    // Set up polling for running sessions refresh
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
      name: '@jupyterlite-remote-server:SessionManager#running',
      standby: options.standby ?? 'when-hidden'
    });

    // Initialize without blocking
    this._ready = this._initialize();
  }

  /**
   * A signal emitted when the running sessions change.
   */
  get runningChanged(): ISignal<this, Session.IModel[]> {
    return this._sessionManager.runningChanged as unknown as ISignal<
      this,
      Session.IModel[]
    >;
  }

  /**
   * A signal emitted when there is a connection failure.
   */
  get connectionFailure(): ISignal<this, Error> {
    return this._sessionManager.connectionFailure as unknown as ISignal<
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
   * Create an iterator over the known running sessions.
   */
  running(): IterableIterator<Session.IModel> {
    return this._sessionManager.running();
  }

  /**
   * The number of running sessions.
   */
  get runningCount(): number {
    return Array.from(this.running()).length;
  }

  /**
   * Force a refresh of the running sessions.
   */
  async refreshRunning(): Promise<void> {
    try {
      await this._sessionManager.refreshRunning();
    } catch {
      // Server not available - will retry on next poll
    }
  }

  /**
   * Start a new session.
   */
  async startNew(
    createOptions: Session.ISessionOptions,
    connectOptions?: Omit<
      Session.ISessionConnection.IOptions,
      'model' | 'serverSettings'
    >
  ): Promise<Session.ISessionConnection> {
    return this._sessionManager.startNew(createOptions, connectOptions);
  }

  /**
   * Connect to an existing session.
   */
  connectTo(
    options: Session.ISessionConnection.IOptions
  ): Session.ISessionConnection {
    return this._sessionManager.connectTo(options);
  }

  /**
   * Shut down a session by id.
   */
  async shutdown(id: string): Promise<void> {
    return this._sessionManager.shutdown(id);
  }

  /**
   * Shut down all sessions.
   */
  async shutdownAll(): Promise<void> {
    return this._sessionManager.shutdownAll();
  }

  /**
   * Find a session by id.
   */
  async findById(id: string): Promise<Session.IModel | undefined> {
    return this._sessionManager.findById(id);
  }

  /**
   * Find a session by path.
   */
  async findByPath(path: string): Promise<Session.IModel | undefined> {
    return this._sessionManager.findByPath(path);
  }

  /**
   * Stop the active session if there is one.
   */
  async stopIfNeeded(path: string): Promise<void> {
    return this._sessionManager.stopIfNeeded(path);
  }

  /**
   * Dispose of the resources used by the manager.
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._poll.dispose();
    this._sessionManager.dispose();
    super.dispose();
  }

  /**
   * Initialize the manager.
   */
  private async _initialize(): Promise<void> {
    try {
      await this._sessionManager.refreshRunning();
    } catch {
      // Server not available yet - that's okay, polling will retry
    }

    // Mark as ready regardless of whether we could connect
    this._isReady = true;

    // Start polling for updates
    void this._poll.start();
  }

  /**
   * Poll for running sessions.
   */
  private async _pollRunning(): Promise<void> {
    try {
      await this._sessionManager.refreshRunning();
    } catch {
      // Server not available - will retry on next poll
    }
  }

  private _sessionManager: SessionManager;
  private _poll: Poll;
  private _isReady = false;
  private _ready: Promise<void>;
}

export namespace RemoteSessionManager {
  /**
   * The options used to initialize a remote session manager.
   */
  export interface IOptions extends BaseManager.IOptions {
    /**
     * The server settings for connecting to the remote server.
     */
    serverSettings?: ServerConnection.ISettings;

    /**
     * The kernel manager to use for session kernels.
     */
    kernelManager: Kernel.IManager;

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
