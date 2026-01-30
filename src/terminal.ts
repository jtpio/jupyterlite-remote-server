// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import type { ServerConnection, Terminal } from '@jupyterlab/services';
import { BaseManager, TerminalManager } from '@jupyterlab/services';

import { Poll } from '@lumino/polling';
import type { ISignal } from '@lumino/signaling';

/**
 * A terminal manager that handles graceful degradation when the remote server
 * is not yet available.
 *
 * This manager:
 * - Returns empty running terminals until the server responds
 * - Polls periodically to check for server availability and refresh running terminals
 * - Emits runningChanged when terminals become available
 * - Does not block initialization on server availability
 */
export class RemoteTerminalManager
  extends BaseManager
  implements Terminal.IManager
{
  constructor(options: RemoteTerminalManager.IOptions = {}) {
    super(options);
    const { serverSettings } = options;

    // Create the internal manager
    this._terminalManager = new TerminalManager({
      serverSettings
    });

    // Set up polling for running terminals refresh
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
      name: '@jupyterlite-remote-server:TerminalManager#running',
      standby: options.standby ?? 'when-hidden'
    });

    // Initialize without blocking
    this._ready = this._initialize();
  }

  /**
   * A signal emitted when the running terminals change.
   */
  get runningChanged(): ISignal<this, Terminal.IModel[]> {
    return this._terminalManager.runningChanged as unknown as ISignal<
      this,
      Terminal.IModel[]
    >;
  }

  /**
   * A signal emitted when there is a connection failure.
   */
  get connectionFailure(): ISignal<this, Error> {
    return this._terminalManager.connectionFailure as unknown as ISignal<
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
   * Whether the terminal service is available.
   */
  isAvailable(): boolean {
    return this._terminalManager.isAvailable();
  }

  /**
   * Create an iterator over the known running terminals.
   */
  running(): IterableIterator<Terminal.IModel> {
    return this._terminalManager.running();
  }

  /**
   * The number of running terminals.
   */
  get runningCount(): number {
    return Array.from(this.running()).length;
  }

  /**
   * Force a refresh of the running terminals.
   */
  async refreshRunning(): Promise<void> {
    try {
      await this._terminalManager.refreshRunning();
    } catch {
      // Server not available - will retry on next poll
    }
  }

  /**
   * Start a new terminal session.
   */
  async startNew(
    options?: Terminal.ITerminal.IOptions
  ): Promise<Terminal.ITerminalConnection> {
    return this._terminalManager.startNew(options);
  }

  /**
   * Connect to an existing terminal.
   */
  connectTo(
    options: Terminal.ITerminalConnection.IOptions
  ): Terminal.ITerminalConnection {
    return this._terminalManager.connectTo(options);
  }

  /**
   * Shut down a terminal session by name.
   */
  async shutdown(name: string): Promise<void> {
    return this._terminalManager.shutdown(name);
  }

  /**
   * Shut down all terminal sessions.
   */
  async shutdownAll(): Promise<void> {
    return this._terminalManager.shutdownAll();
  }

  /**
   * Dispose of the resources used by the manager.
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._poll.dispose();
    this._terminalManager.dispose();
    super.dispose();
  }

  /**
   * Initialize the manager.
   */
  private async _initialize(): Promise<void> {
    try {
      await this._terminalManager.refreshRunning();
    } catch {
      // Server not available yet - that's okay, polling will retry
    }

    // Mark as ready regardless of whether we could connect
    this._isReady = true;

    // Start polling for updates
    void this._poll.start();
  }

  /**
   * Poll for running terminals.
   */
  private async _pollRunning(): Promise<void> {
    try {
      await this._terminalManager.refreshRunning();
    } catch {
      // Server not available - will retry on next poll
    }
  }

  private _terminalManager: TerminalManager;
  private _poll: Poll;
  private _isReady = false;
  private _ready: Promise<void>;
}

export namespace RemoteTerminalManager {
  /**
   * The options used to initialize a remote terminal manager.
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
