// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { URLExt } from '@jupyterlab/coreutils';
import type { KernelSpec, ServerConnection } from '@jupyterlab/services';
import { BaseManager, KernelSpecManager } from '@jupyterlab/services';

import { Poll } from '@lumino/polling';
import type { ISignal } from '@lumino/signaling';
import { Signal } from '@lumino/signaling';

/**
 * A kernel spec manager that rewrites resource URLs to use absolute paths
 * pointing to the remote Jupyter server.
 *
 * This manager also handles graceful degradation when the remote server
 * is not yet available:
 * - Returns empty specs until the server responds
 * - Polls periodically to check for server availability
 * - Emits specsChanged when specs become available
 *
 * This is necessary because when running in JupyterLite, relative resource URLs
 * like `/kernelspecs/python3/logo-svg.svg` resolve to the JupyterLite origin
 * instead of the remote Jupyter server. This manager rewrites those URLs to
 * absolute URLs so the logos and other resources load correctly.
 */
export class RemoteKernelSpecManager
  extends BaseManager
  implements KernelSpec.IManager
{
  constructor(options: RemoteKernelSpecManager.IOptions = {}) {
    super(options);
    const { serverSettings } = options;
    this._serverSettings = serverSettings;

    // Create the internal manager but don't let it block our initialization
    this._kernelSpecManager = new KernelSpecManager({
      serverSettings
    });

    // Listen for specs changes on the internal manager and rewrite URLs
    this._kernelSpecManager.specsChanged.connect(this._onSpecsChanged, this);

    // Listen for connection failures
    this._kernelSpecManager.connectionFailure.connect((sender, error) => {
      this._connectionFailure.emit(error);
    });

    // Set up polling for specs refresh
    const pollInterval = options.pollInterval ?? 10000; // 10 seconds default
    const maxPollInterval = options.maxPollInterval ?? 300000; // 5 minutes max

    this._poll = new Poll({
      auto: false, // Don't auto-start, we'll start after initial attempt
      factory: () => this._pollSpecs(),
      frequency: {
        interval: pollInterval,
        backoff: true,
        max: maxPollInterval
      },
      name: '@jupyterlite-remote-server:KernelSpecManager#specs',
      standby: options.standby ?? 'when-hidden'
    });

    // Initialize: try to get specs, but don't block
    this._ready = this._initialize();
  }

  /**
   * A signal emitted when there is a connection failure.
   */
  get connectionFailure(): ISignal<this, Error> {
    return this._connectionFailure;
  }

  /**
   * Test whether the manager is ready.
   *
   * The manager is considered ready even if the server is not available,
   * to support graceful degradation.
   */
  get isReady(): boolean {
    return this._isReady;
  }

  /**
   * A promise that fulfills when the manager is ready.
   *
   * This resolves quickly even if the server is not available,
   * to avoid blocking JupyterLite startup.
   */
  get ready(): Promise<void> {
    return this._ready;
  }

  /**
   * Get the kernel specs with rewritten resource URLs.
   *
   * Returns null if the server has not yet responded.
   */
  get specs(): KernelSpec.ISpecModels | null {
    return this._specs;
  }

  /**
   * A signal emitted when the specs change.
   */
  get specsChanged(): ISignal<this, KernelSpec.ISpecModels> {
    return this._specsChanged;
  }

  /**
   * Force a refresh of the specs from the server.
   *
   * This fetches specs from the remote server and rewrites resource URLs
   * to use absolute paths pointing to the remote server.
   */
  async refreshSpecs(): Promise<void> {
    await this._fetchSpecs();
  }

  /**
   * Dispose of the resources used by the manager.
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._poll.dispose();
    this._kernelSpecManager.dispose();
    super.dispose();
  }

  /**
   * Initialize the manager.
   *
   * Attempts to fetch specs but doesn't fail if server is unavailable.
   */
  private async _initialize(): Promise<void> {
    try {
      await this._fetchSpecs();
    } catch {
      // Server not available yet - that's okay, polling will retry
    }

    // Mark as ready regardless of whether we got specs
    this._isReady = true;

    // Start polling for updates
    void this._poll.start();
  }

  /**
   * Poll for specs - called periodically by the Poll instance.
   */
  private async _pollSpecs(): Promise<void> {
    await this._fetchSpecs();
  }

  /**
   * Fetch specs from the server.
   */
  private async _fetchSpecs(): Promise<void> {
    const baseUrl = this._serverSettings?.baseUrl;
    if (!baseUrl) {
      return;
    }

    try {
      await this._kernelSpecManager.refreshSpecs();
      this._rewriteSpecs();
    } catch {
      // Server not available - will retry on next poll
    }
  }

  /**
   * Handle specs changed signal from the internal manager.
   */
  private _onSpecsChanged(): void {
    this._rewriteSpecs();
  }

  /**
   * Rewrite resource URLs in the current specs from the internal manager.
   *
   * This rewrites relative resource URLs to absolute URLs pointing to the
   * remote server so resources like kernel logos load correctly.
   */
  private _rewriteSpecs(): void {
    const newSpecs = this._kernelSpecManager.specs;
    if (!newSpecs) {
      return;
    }

    // Rewrite resource URLs for remote kernel specs to use absolute URLs
    // so they resolve to the remote server instead of the local JupyterLite origin
    const rewrittenKernelSpecs: Record<string, KernelSpec.ISpecModel> = {};
    if (newSpecs.kernelspecs) {
      const baseUrl = this._serverSettings?.baseUrl ?? '';
      const token = this._serverSettings?.token ?? '';
      for (const [name, spec] of Object.entries(newSpecs.kernelspecs)) {
        if (spec) {
          const resources: Record<string, string> = {};
          for (const [resourceName, resourcePath] of Object.entries(
            spec.resources
          )) {
            // Make the resource URL absolute by joining with the base URL
            let url = URLExt.join(baseUrl, resourcePath);
            // Append token if available for authentication
            if (token) {
              url += `?token=${encodeURIComponent(token)}`;
            }
            resources[resourceName] = url;
          }
          rewrittenKernelSpecs[name] = {
            ...spec,
            resources
          };
        }
      }
    }

    const specs: KernelSpec.ISpecModels = {
      default: newSpecs.default,
      kernelspecs: rewrittenKernelSpecs
    };
    this._specs = specs;
    this._specsChanged.emit(specs);
  }

  private _serverSettings: ServerConnection.ISettings | undefined;
  private _kernelSpecManager: KernelSpec.IManager;
  private _poll: Poll;
  private _isReady = false;
  private _ready: Promise<void>;
  private _connectionFailure = new Signal<this, Error>(this);
  private _specsChanged = new Signal<this, KernelSpec.ISpecModels>(this);
  private _specs: KernelSpec.ISpecModels | null = null;
}

export namespace RemoteKernelSpecManager {
  /**
   * The options used to initialize a remote kernel spec manager.
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
