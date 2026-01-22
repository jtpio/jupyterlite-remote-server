// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { PageConfig, URLExt } from '@jupyterlab/coreutils';
import { ServerConnection } from '@jupyterlab/services';

/**
 * Service types that can have separate server configurations.
 *
 * Each service type can have its own base URL and token configuration,
 * falling back to the default `remoteBaseUrl` and `remoteToken` if not specified.
 */
export type ServiceType =
  | 'default'
  | 'contents'
  | 'kernels'
  | 'settings'
  | 'workspaces'
  | 'terminals'
  | 'users'
  | 'events'
  | 'nbconvert'
  | 'configSection';

/**
 * Options for creating RemoteServerSettings.
 */
export interface IRemoteServerSettingsOptions {
  /**
   * The service type for these settings.
   *
   * Determines which PageConfig options to read for base URL and token.
   * Falls back to default options if service-specific options are not set.
   *
   * @default 'default'
   */
  serviceType?: ServiceType;
}

/**
 * A remote server settings implementation that reads baseUrl and token
 * from PageConfig on each access.
 *
 * This class implements the ServerConnection.ISettings interface and is designed
 * for use with JupyterLite or other scenarios where server connection settings
 * need to be determined at runtime rather than at initialization time.
 *
 * Configuration is read from PageConfig using these options:
 *
 * Default (fallback) options:
 * - `remoteBaseUrl`: The base URL of the remote Jupyter server
 * - `remoteToken`: The authentication token for the remote server
 *
 * Service-specific options (optional, fallback to defaults if not set):
 * - `remoteContentsBaseUrl` / `remoteContentsToken`: For contents/files services
 * - `remoteKernelsBaseUrl` / `remoteKernelsToken`: For kernel-related services
 * - `remoteSettingsBaseUrl` / `remoteSettingsToken`: For settings services
 * - `remoteWorkspacesBaseUrl` / `remoteWorkspacesToken`: For workspace services
 * - `remoteTerminalsBaseUrl` / `remoteTerminalsToken`: For terminal services
 * - `remoteUsersBaseUrl` / `remoteUsersToken`: For user services
 * - `remoteEventsBaseUrl` / `remoteEventsToken`: For event services
 * - `remoteNbconvertBaseUrl` / `remoteNbconvertToken`: For nbconvert services
 * - `remoteConfigSectionBaseUrl` / `remoteConfigSectionToken`: For config section services
 *
 * Common options:
 * - `appUrl`: The JupyterLab application URL
 * - `appendToken`: Whether to append token to WebSocket URLs (auto-detected if not set)
 */
export class RemoteServerSettings implements ServerConnection.ISettings {
  constructor(options: IRemoteServerSettingsOptions = {}) {
    this._serviceType = options.serviceType ?? 'default';
    this._defaults = ServerConnection.makeSettings();
  }

  /**
   * The service type for these settings.
   */
  get serviceType(): ServiceType {
    return this._serviceType;
  }

  /**
   * The base url of the server, read dynamically from PageConfig.
   *
   * First checks for a service-specific URL (e.g., `remoteContentsBaseUrl`),
   * then falls back to `remoteBaseUrl`.
   */
  get baseUrl(): string {
    const serviceUrl = this._getServiceOption('BaseUrl');
    if (serviceUrl) {
      return serviceUrl;
    }
    return PageConfig.getOption('remoteBaseUrl');
  }

  /**
   * The app url of the JupyterLab application.
   */
  get appUrl(): string {
    return PageConfig.getOption('appUrl');
  }

  /**
   * The base ws url of the server, derived from baseUrl.
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
   * The authentication token for requests, read dynamically from PageConfig.
   *
   * First checks for a service-specific token (e.g., `remoteContentsToken`),
   * then falls back to `remoteToken`.
   */
  get token(): string {
    const serviceToken = this._getServiceOption('Token');
    if (serviceToken) {
      return serviceToken;
    }
    return PageConfig.getOption('remoteToken');
  }

  /**
   * Whether to append a token to a Websocket url.
   *
   * In cross-origin scenarios (e.g., JupyterLite connecting to a remote server),
   * cookies won't be sent, so we must append the token to WebSocket URLs.
   */
  get appendToken(): boolean {
    const appendTokenConfig = PageConfig.getOption('appendToken').toLowerCase();
    if (appendTokenConfig === '') {
      // If running outside browser, always append token (safe default)
      if (typeof window === 'undefined') {
        return true;
      }
      // In browser: compare remote server hostname against current window location
      // If they differ, we're in a cross-origin scenario and must append the token
      const remoteHost = URLExt.getHostName(this.baseUrl);
      const currentHost = window.location.host;
      return remoteHost !== currentHost;
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

  /**
   * Get a service-specific PageConfig option.
   *
   * @param suffix - The option suffix (e.g., 'BaseUrl', 'Token')
   * @returns The option value, or empty string if not set or service type is 'default'
   */
  private _getServiceOption(suffix: string): string {
    if (this._serviceType === 'default') {
      return '';
    }
    // Build option name: e.g., 'remoteContentsBaseUrl', 'remoteKernelsToken'
    const capitalizedType =
      this._serviceType.charAt(0).toUpperCase() + this._serviceType.slice(1);
    const optionName = `remote${capitalizedType}${suffix}`;
    return PageConfig.getOption(optionName);
  }

  private _serviceType: ServiceType;
  private _defaults: ServerConnection.ISettings;
}
