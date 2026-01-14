// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { PageConfig, URLExt } from '@jupyterlab/coreutils';
import { ServerConnection } from '@jupyterlab/services';

/**
 * A remote server settings implementation that reads baseUrl and token
 * from PageConfig on each access using the remoteBaseUrl and remoteToken options.
 *
 * This class implements the ServerConnection.ISettings interface and is designed
 * for use with JupyterLite or other scenarios where server connection settings
 * need to be determined at runtime rather than at initialization time.
 *
 * Configuration is read from PageConfig using these options:
 * - `remoteBaseUrl`: The base URL of the remote Jupyter server
 * - `remoteToken`: The authentication token for the remote server
 * - `appUrl`: The JupyterLab application URL
 * - `appendToken`: Whether to append token to WebSocket URLs (auto-detected if not set)
 */
export class RemoteServerSettings implements ServerConnection.ISettings {
  constructor() {
    this._defaults = ServerConnection.makeSettings();
  }

  /**
   * The base url of the server, read dynamically from PageConfig's remoteBaseUrl.
   */
  get baseUrl(): string {
    return PageConfig.getOption('remoteBaseUrl');
  }

  /**
   * The app url of the JupyterLab application.
   */
  get appUrl(): string {
    return PageConfig.getOption('appUrl');
  }

  /**
   * The base ws url of the server, derived from remoteBaseUrl.
   */
  get wsUrl(): string {
    const baseUrl = this.baseUrl;
    if (baseUrl.indexOf('http') === 0) {
      return 'ws' + baseUrl.slice(4);
    }
    // Fallback to page wsUrl
    return PageConfig.getWsUrl();
  }

  /**
   * The default request init options.
   */
  get init(): RequestInit {
    return this._defaults.init;
  }

  /**
   * The authentication token for requests, read dynamically from PageConfig's remoteToken.
   */
  get token(): string {
    return PageConfig.getOption('remoteToken');
  }

  /**
   * Whether to append a token to a Websocket url.
   */
  get appendToken(): boolean {
    const appendTokenConfig = PageConfig.getOption('appendToken').toLowerCase();
    if (appendTokenConfig === '') {
      const baseUrl = this.baseUrl;
      return (
        typeof window === 'undefined' ||
        (typeof process !== 'undefined' &&
          process?.env?.JEST_WORKER_ID !== undefined) ||
        URLExt.getHostName(baseUrl) !== URLExt.getHostName(this.wsUrl)
      );
    }
    return appendTokenConfig === 'true';
  }

  /**
   * The `fetch` method to use.
   */
  get fetch(): ServerConnection.ISettings['fetch'] {
    return this._defaults.fetch;
  }

  /**
   * The `Request` object constructor.
   */
  get Request(): ServerConnection.ISettings['Request'] {
    return this._defaults.Request;
  }

  /**
   * The `Headers` object constructor.
   */
  get Headers(): ServerConnection.ISettings['Headers'] {
    return this._defaults.Headers;
  }

  /**
   * The `WebSocket` object constructor.
   */
  get WebSocket(): ServerConnection.ISettings['WebSocket'] {
    return this._defaults.WebSocket;
  }

  /**
   * Serializer used to serialize/deserialize kernel messages.
   */
  get serializer(): ServerConnection.ISettings['serializer'] {
    return this._defaults.serializer;
  }

  private _defaults: ServerConnection.ISettings;
}
