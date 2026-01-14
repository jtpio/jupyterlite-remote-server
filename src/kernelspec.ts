// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { URLExt } from '@jupyterlab/coreutils';
import type { KernelSpec, ServerConnection } from '@jupyterlab/services';
import { BaseManager, KernelSpecManager } from '@jupyterlab/services';

import type { ISignal } from '@lumino/signaling';
import { Signal } from '@lumino/signaling';

/**
 * A kernel spec manager that rewrites resource URLs to use absolute paths
 * pointing to the remote Jupyter server.
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
    this._kernelSpecManager = new KernelSpecManager({
      serverSettings
    });

    // Listen for specs changes on the internal manager and rewrite URLs
    this._kernelSpecManager.specsChanged.connect(this._onSpecsChanged, this);

    // Initialize specs when the internal manager becomes ready
    this._kernelSpecManager.ready.then(() => {
      this._rewriteSpecs();
    });
  }

  /**
   * A signal emitted when there is a connection failure.
   */
  get connectionFailure(): ISignal<this, Error> {
    return this._connectionFailure;
  }

  /**
   * Test whether the manager is ready.
   */
  get isReady(): boolean {
    return this._kernelSpecManager.isReady;
  }

  /**
   * A promise that fulfills when the manager is ready.
   */
  get ready(): Promise<void> {
    return this._kernelSpecManager.ready;
  }

  /**
   * Get the kernel specs with rewritten resource URLs.
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
    await this._kernelSpecManager.refreshSpecs();
    this._rewriteSpecs();
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
  private _connectionFailure = new Signal<this, Error>(this);
  private _specsChanged = new Signal<this, KernelSpec.ISpecModels>(this);
  private _specs: KernelSpec.ISpecModels | null = null;
}

export namespace RemoteKernelSpecManager {
  /**
   * The options used to initialize a remote kernel spec manager.
   */
  export interface IOptions {
    /**
     * The server settings for connecting to the remote server.
     */
    serverSettings?: ServerConnection.ISettings;
  }
}
