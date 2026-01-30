// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  ConfigSection,
  ConfigSectionManager,
  Contents,
  ContentsManager,
  Drive,
  Event,
  EventManager,
  IConfigSectionManager,
  IContentsManager,
  IDefaultDrive,
  IEventManager,
  IKernelManager,
  IKernelSpecManager,
  INbConvertManager,
  IServerSettings,
  ISessionManager,
  ITerminalManager,
  Kernel,
  KernelSpec,
  NbConvert,
  NbConvertManager,
  ServerConnection,
  ServiceManagerPlugin,
  Session,
  Terminal
} from '@jupyterlab/services';

import { RemoteKernelManager } from './kernel';
import { RemoteKernelSpecManager } from './kernelspec';
import { RemoteServerSettings } from './serversettings';
import { RemoteSessionManager } from './session';
import { RemoteTerminalManager } from './terminal';
import { themesPlugin } from './themes';

/**
 * The server settings plugin providing remote server settings
 * that read baseUrl and token from PageConfig.
 *
 * This plugin provides the default server settings. Individual service plugins
 * create their own settings instances with service-specific configuration,
 * falling back to the default remoteBaseUrl/remoteToken if not specified.
 *
 * This plugin reads configuration from PageConfig at runtime:
 * - `remoteBaseUrl`: The base URL of the remote Jupyter server
 * - `remoteToken`: The authentication token for the remote server
 * - `appUrl`: The JupyterLab application URL
 * - `appendToken`: Whether to append token to WebSocket URLs
 */
const serverSettingsPlugin: ServiceManagerPlugin<ServerConnection.ISettings> = {
  id: 'jupyterlite-remote-server:server-settings',
  description: 'Provides remote server settings from PageConfig.',
  autoStart: true,
  provides: IServerSettings,
  activate: (): ServerConnection.ISettings => {
    return new RemoteServerSettings({ serviceType: 'default' });
  }
};

/**
 * The default drive plugin that connects to the remote Jupyter server.
 *
 * Uses `remoteContentsBaseUrl` and `remoteContentsToken` if configured,
 * otherwise falls back to `remoteBaseUrl` and `remoteToken`.
 */
const defaultDrivePlugin: ServiceManagerPlugin<Contents.IDrive> = {
  id: 'jupyterlite-remote-server:default-drive',
  description: 'Provides a default drive that connects to the remote server.',
  autoStart: true,
  provides: IDefaultDrive,
  activate: (): Contents.IDrive => {
    const serverSettings = new RemoteServerSettings({
      serviceType: 'contents'
    });
    return new Drive({ serverSettings });
  }
};

/**
 * The contents manager plugin.
 *
 * Uses `remoteContentsBaseUrl` and `remoteContentsToken` if configured,
 * otherwise falls back to `remoteBaseUrl` and `remoteToken`.
 */
const contentsManagerPlugin: ServiceManagerPlugin<Contents.IManager> = {
  id: 'jupyterlite-remote-server:contents-manager',
  description: 'Provides the contents manager.',
  autoStart: true,
  provides: IContentsManager,
  requires: [IDefaultDrive],
  activate: (app: null, defaultDrive: Contents.IDrive): Contents.IManager => {
    const serverSettings = new RemoteServerSettings({
      serviceType: 'contents'
    });
    return new ContentsManager({
      defaultDrive,
      serverSettings
    });
  }
};

/**
 * The kernel manager plugin with polling support.
 *
 * This manager handles graceful degradation when the remote server
 * is not yet available:
 * - Returns empty running kernels until the server responds
 * - Polls periodically to refresh running kernels
 * - Does not block initialization on server availability
 *
 * Uses `remoteKernelsBaseUrl` and `remoteKernelsToken` if configured,
 * otherwise falls back to `remoteBaseUrl` and `remoteToken`.
 */
const kernelManagerPlugin: ServiceManagerPlugin<Kernel.IManager> = {
  id: 'jupyterlite-remote-server:kernel-manager',
  description: 'Provides the kernel manager with polling support.',
  autoStart: true,
  provides: IKernelManager,
  activate: (): Kernel.IManager => {
    const serverSettings = new RemoteServerSettings({ serviceType: 'kernels' });
    return new RemoteKernelManager({ serverSettings });
  }
};

/**
 * The kernel spec manager plugin with polling support.
 *
 * This manager handles graceful degradation when the remote server
 * is not yet available:
 * - Returns empty specs until the server responds
 * - Polls periodically to check for server availability
 * - Rewrites resource URLs to absolute paths pointing to the remote server
 *
 * Uses `remoteKernelsBaseUrl` and `remoteKernelsToken` if configured,
 * otherwise falls back to `remoteBaseUrl` and `remoteToken`.
 */
const kernelSpecManagerPlugin: ServiceManagerPlugin<KernelSpec.IManager> = {
  id: 'jupyterlite-remote-server:kernel-spec-manager',
  description:
    'Provides the kernel spec manager with polling and remote resource URL rewriting.',
  autoStart: true,
  provides: IKernelSpecManager,
  activate: (): KernelSpec.IManager => {
    const serverSettings = new RemoteServerSettings({ serviceType: 'kernels' });
    return new RemoteKernelSpecManager({ serverSettings });
  }
};

/**
 * The session manager plugin with polling support.
 *
 * This manager handles graceful degradation when the remote server
 * is not yet available:
 * - Returns empty running sessions until the server responds
 * - Polls periodically to refresh running sessions
 * - Does not block initialization on server availability
 *
 * Uses `remoteKernelsBaseUrl` and `remoteKernelsToken` if configured,
 * otherwise falls back to `remoteBaseUrl` and `remoteToken`.
 */
const sessionManagerPlugin: ServiceManagerPlugin<Session.IManager> = {
  id: 'jupyterlite-remote-server:session-manager',
  description: 'Provides the session manager with polling support.',
  autoStart: true,
  provides: ISessionManager,
  requires: [IKernelManager],
  activate: (app: null, kernelManager: Kernel.IManager): Session.IManager => {
    const serverSettings = new RemoteServerSettings({ serviceType: 'kernels' });
    return new RemoteSessionManager({
      kernelManager,
      serverSettings
    });
  }
};




/**
 * The event manager plugin.
 *
 * Uses `remoteEventsBaseUrl` and `remoteEventsToken` if configured,
 * otherwise falls back to `remoteBaseUrl` and `remoteToken`.
 */
const eventManagerPlugin: ServiceManagerPlugin<Event.IManager> = {
  id: 'jupyterlite-remote-server:event-manager',
  description: 'Provides the event manager.',
  autoStart: true,
  provides: IEventManager,
  activate: (): Event.IManager => {
    const serverSettings = new RemoteServerSettings({ serviceType: 'events' });
    return new EventManager({ serverSettings });
  }
};

/**
 * The config section manager plugin.
 *
 * Uses `remoteConfigSectionBaseUrl` and `remoteConfigSectionToken` if configured,
 * otherwise falls back to `remoteBaseUrl` and `remoteToken`.
 */
const configSectionManagerPlugin: ServiceManagerPlugin<ConfigSection.IManager> =
  {
    id: 'jupyterlite-remote-server:config-section-manager',
    description: 'Provides the config section manager.',
    autoStart: true,
    provides: IConfigSectionManager,
    activate: (): ConfigSection.IManager => {
      const serverSettings = new RemoteServerSettings({
        serviceType: 'configSection'
      });
      const manager = new ConfigSectionManager({ serverSettings });
      // Set the config section manager for the global ConfigSection.
      ConfigSection._setConfigSectionManager(manager);
      return manager;
    }
  };

/**
 * The nbconvert manager plugin.
 *
 * Uses `remoteNbconvertBaseUrl` and `remoteNbconvertToken` if configured,
 * otherwise falls back to `remoteBaseUrl` and `remoteToken`.
 */
const nbConvertManagerPlugin: ServiceManagerPlugin<NbConvert.IManager> = {
  id: 'jupyterlite-remote-server:nbconvert-manager',
  description: 'Provides the nbconvert manager.',
  autoStart: true,
  provides: INbConvertManager,
  activate: (): NbConvert.IManager => {
    const serverSettings = new RemoteServerSettings({
      serviceType: 'nbconvert'
    });
    return new NbConvertManager({ serverSettings });
  }
};

/**
 * The terminal manager plugin with polling support.
 *
 * This manager handles graceful degradation when the remote server
 * is not yet available:
 * - Returns empty running terminals until the server responds
 * - Polls periodically to refresh running terminals
 * - Does not block initialization on server availability
 *
 * Uses `remoteTerminalsBaseUrl` and `remoteTerminalsToken` if configured,
 * otherwise falls back to `remoteBaseUrl` and `remoteToken`.
 */
const terminalManagerPlugin: ServiceManagerPlugin<Terminal.IManager> = {
  id: 'jupyterlite-remote-server:terminal-manager',
  description: 'Provides the terminal manager with polling support.',
  autoStart: true,
  provides: ITerminalManager,
  activate: (): Terminal.IManager => {
    const serverSettings = new RemoteServerSettings({
      serviceType: 'terminals'
    });
    return new RemoteTerminalManager({ serverSettings });
  }
};

/**
 * All plugins provided by this extension.
 */
const plugins = [
  serverSettingsPlugin,
  defaultDrivePlugin,
  contentsManagerPlugin,
  kernelManagerPlugin,
  kernelSpecManagerPlugin,
  sessionManagerPlugin,
  eventManagerPlugin,
  configSectionManagerPlugin,
  nbConvertManagerPlugin,
  terminalManagerPlugin,
  themesPlugin
];

export default plugins;

// Re-export types and classes for external use
export {
  RemoteServerSettings,
  ServiceType,
  IRemoteServerSettingsOptions
} from './serversettings';

// Export the polling managers
export { RemoteKernelManager } from './kernel';
export { RemoteKernelSpecManager } from './kernelspec';
export { RemoteSessionManager } from './session';
export { RemoteTerminalManager } from './terminal';
