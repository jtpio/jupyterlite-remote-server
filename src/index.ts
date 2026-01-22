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
  ISettingManager,
  ITerminalManager,
  IUserManager,
  IWorkspaceManager,
  Kernel,
  KernelManager,
  KernelSpec,
  NbConvert,
  NbConvertManager,
  ServerConnection,
  ServiceManagerPlugin,
  Session,
  SessionManager,
  Setting,
  SettingManager,
  Terminal,
  TerminalManager,
  User,
  UserManager,
  Workspace,
  WorkspaceManager
} from '@jupyterlab/services';

import { RemoteKernelSpecManager } from './kernelspec';
import { RemoteServerSettings } from './serversettings';

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
    console.log('Activating remote server settings plugin');
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
  activate: (_: null, defaultDrive: Contents.IDrive): Contents.IManager => {
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
 * The kernel manager plugin.
 *
 * Uses `remoteKernelsBaseUrl` and `remoteKernelsToken` if configured,
 * otherwise falls back to `remoteBaseUrl` and `remoteToken`.
 */
const kernelManagerPlugin: ServiceManagerPlugin<Kernel.IManager> = {
  id: 'jupyterlite-remote-server:kernel-manager',
  description: 'Provides the kernel manager.',
  autoStart: true,
  provides: IKernelManager,
  activate: (): Kernel.IManager => {
    const serverSettings = new RemoteServerSettings({ serviceType: 'kernels' });
    return new KernelManager({ serverSettings });
  }
};

/**
 * The kernel spec manager plugin.
 *
 * Uses RemoteKernelSpecManager to rewrite resource URLs to absolute paths
 * pointing to the remote server, so kernel logos load correctly.
 *
 * Uses `remoteKernelsBaseUrl` and `remoteKernelsToken` if configured,
 * otherwise falls back to `remoteBaseUrl` and `remoteToken`.
 */
const kernelSpecManagerPlugin: ServiceManagerPlugin<KernelSpec.IManager> = {
  id: 'jupyterlite-remote-server:kernel-spec-manager',
  description:
    'Provides the kernel spec manager with remote resource URL rewriting.',
  autoStart: true,
  provides: IKernelSpecManager,
  activate: (): KernelSpec.IManager => {
    const serverSettings = new RemoteServerSettings({ serviceType: 'kernels' });
    return new RemoteKernelSpecManager({ serverSettings });
  }
};

/**
 * The session manager plugin.
 *
 * Uses `remoteKernelsBaseUrl` and `remoteKernelsToken` if configured,
 * otherwise falls back to `remoteBaseUrl` and `remoteToken`.
 */
const sessionManagerPlugin: ServiceManagerPlugin<Session.IManager> = {
  id: 'jupyterlite-remote-server:session-manager',
  description: 'Provides the session manager.',
  autoStart: true,
  provides: ISessionManager,
  requires: [IKernelManager],
  activate: (_: null, kernelManager: Kernel.IManager): Session.IManager => {
    const serverSettings = new RemoteServerSettings({ serviceType: 'kernels' });
    return new SessionManager({
      kernelManager,
      serverSettings
    });
  }
};

/**
 * The setting manager plugin.
 *
 * Uses `remoteSettingsBaseUrl` and `remoteSettingsToken` if configured,
 * otherwise falls back to `remoteBaseUrl` and `remoteToken`.
 */
const settingManagerPlugin: ServiceManagerPlugin<Setting.IManager> = {
  id: 'jupyterlite-remote-server:setting-manager',
  description: 'Provides the setting manager.',
  autoStart: true,
  provides: ISettingManager,
  activate: (): Setting.IManager => {
    const serverSettings = new RemoteServerSettings({
      serviceType: 'settings'
    });
    return new SettingManager({ serverSettings });
  }
};

/**
 * The workspace manager plugin.
 *
 * Uses `remoteWorkspacesBaseUrl` and `remoteWorkspacesToken` if configured,
 * otherwise falls back to `remoteBaseUrl` and `remoteToken`.
 */
const workspaceManagerPlugin: ServiceManagerPlugin<Workspace.IManager> = {
  id: 'jupyterlite-remote-server:workspace-manager',
  description: 'Provides the workspace manager.',
  autoStart: true,
  provides: IWorkspaceManager,
  activate: (): Workspace.IManager => {
    const serverSettings = new RemoteServerSettings({
      serviceType: 'workspaces'
    });
    return new WorkspaceManager({ serverSettings });
  }
};

/**
 * The user manager plugin.
 *
 * Uses `remoteUsersBaseUrl` and `remoteUsersToken` if configured,
 * otherwise falls back to `remoteBaseUrl` and `remoteToken`.
 */
const userManagerPlugin: ServiceManagerPlugin<User.IManager> = {
  id: 'jupyterlite-remote-server:user-manager',
  description: 'Provides the user manager.',
  autoStart: true,
  provides: IUserManager,
  activate: (): User.IManager => {
    const serverSettings = new RemoteServerSettings({ serviceType: 'users' });
    return new UserManager({ serverSettings });
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
 * The terminal manager plugin.
 *
 * Uses `remoteTerminalsBaseUrl` and `remoteTerminalsToken` if configured,
 * otherwise falls back to `remoteBaseUrl` and `remoteToken`.
 */
const terminalManagerPlugin: ServiceManagerPlugin<Terminal.IManager> = {
  id: 'jupyterlite-remote-server:terminal-manager',
  description: 'Provides the terminal manager.',
  autoStart: true,
  provides: ITerminalManager,
  activate: (): Terminal.IManager => {
    const serverSettings = new RemoteServerSettings({
      serviceType: 'terminals'
    });
    return new TerminalManager({ serverSettings });
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
  settingManagerPlugin,
  workspaceManagerPlugin,
  userManagerPlugin,
  eventManagerPlugin,
  configSectionManagerPlugin,
  nbConvertManagerPlugin,
  terminalManagerPlugin
];

export default plugins;

// Re-export types and classes for external use
export {
  RemoteServerSettings,
  ServiceType,
  IRemoteServerSettingsOptions
} from './serversettings';
