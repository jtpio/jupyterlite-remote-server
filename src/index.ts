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
import { DynamicServerSettings } from './serversettings';

/**
 * The server settings plugin providing dynamic settings
 * that read baseUrl and token from PageConfig.
 *
 * This plugin reads configuration from PageConfig at runtime:
 * - `remoteBaseUrl`: The base URL of the remote Jupyter server
 * - `remoteToken`: The authentication token for the remote server
 * - `appUrl`: The JupyterLab application URL
 * - `appendToken`: Whether to append token to WebSocket URLs
 */
const serverSettingsPlugin: ServiceManagerPlugin<ServerConnection.ISettings> = {
  id: 'jupyterlite-remote-server:server-settings',
  description: 'Provides dynamic server settings from PageConfig.',
  autoStart: true,
  provides: IServerSettings,
  activate: (): ServerConnection.ISettings => {
    console.log('Activating dynamic server settings plugin');
    return new DynamicServerSettings();
  }
};

/**
 * The default drive plugin that connects to the remote Jupyter server.
 */
const defaultDrivePlugin: ServiceManagerPlugin<Contents.IDrive> = {
  id: 'jupyterlite-remote-server:default-drive',
  description: 'Provides a default drive that connects to the remote server.',
  autoStart: true,
  provides: IDefaultDrive,
  optional: [IServerSettings],
  activate: (
    _: null,
    serverSettings: ServerConnection.ISettings | null
  ): Contents.IDrive => {
    return new Drive({ serverSettings: serverSettings ?? undefined });
  }
};

/**
 * The contents manager plugin.
 */
const contentsManagerPlugin: ServiceManagerPlugin<Contents.IManager> = {
  id: 'jupyterlite-remote-server:contents-manager',
  description: 'Provides the contents manager.',
  autoStart: true,
  provides: IContentsManager,
  requires: [IDefaultDrive, IServerSettings],
  activate: (
    _: null,
    defaultDrive: Contents.IDrive,
    serverSettings: ServerConnection.ISettings
  ): Contents.IManager => {
    return new ContentsManager({
      defaultDrive,
      serverSettings
    });
  }
};

/**
 * The kernel manager plugin.
 */
const kernelManagerPlugin: ServiceManagerPlugin<Kernel.IManager> = {
  id: 'jupyterlite-remote-server:kernel-manager',
  description: 'Provides the kernel manager.',
  autoStart: true,
  provides: IKernelManager,
  optional: [IServerSettings],
  activate: (
    _: null,
    serverSettings: ServerConnection.ISettings | undefined
  ): Kernel.IManager => {
    return new KernelManager({ serverSettings });
  }
};

/**
 * The kernel spec manager plugin.
 *
 * Uses RemoteKernelSpecManager to rewrite resource URLs to absolute paths
 * pointing to the remote server, so kernel logos load correctly.
 */
const kernelSpecManagerPlugin: ServiceManagerPlugin<KernelSpec.IManager> = {
  id: 'jupyterlite-remote-server:kernel-spec-manager',
  description:
    'Provides the kernel spec manager with remote resource URL rewriting.',
  autoStart: true,
  provides: IKernelSpecManager,
  optional: [IServerSettings],
  activate: (
    _: null,
    serverSettings: ServerConnection.ISettings | undefined
  ): KernelSpec.IManager => {
    return new RemoteKernelSpecManager({ serverSettings });
  }
};

/**
 * The session manager plugin.
 */
const sessionManagerPlugin: ServiceManagerPlugin<Session.IManager> = {
  id: 'jupyterlite-remote-server:session-manager',
  description: 'Provides the session manager.',
  autoStart: true,
  provides: ISessionManager,
  requires: [IKernelManager],
  optional: [IServerSettings],
  activate: (
    _: null,
    kernelManager: Kernel.IManager,
    serverSettings: ServerConnection.ISettings | undefined
  ): Session.IManager => {
    return new SessionManager({
      kernelManager,
      serverSettings
    });
  }
};

/**
 * The setting manager plugin.
 */
const settingManagerPlugin: ServiceManagerPlugin<Setting.IManager> = {
  id: 'jupyterlite-remote-server:setting-manager',
  description: 'Provides the setting manager.',
  autoStart: true,
  provides: ISettingManager,
  optional: [IServerSettings],
  activate: (
    _: null,
    serverSettings: ServerConnection.ISettings | undefined
  ): Setting.IManager => {
    return new SettingManager({ serverSettings });
  }
};

/**
 * The workspace manager plugin.
 */
const workspaceManagerPlugin: ServiceManagerPlugin<Workspace.IManager> = {
  id: 'jupyterlite-remote-server:workspace-manager',
  description: 'Provides the workspace manager.',
  autoStart: true,
  provides: IWorkspaceManager,
  optional: [IServerSettings],
  activate: (
    _: null,
    serverSettings: ServerConnection.ISettings | undefined
  ): Workspace.IManager => {
    return new WorkspaceManager({ serverSettings });
  }
};

/**
 * The user manager plugin.
 */
const userManagerPlugin: ServiceManagerPlugin<User.IManager> = {
  id: 'jupyterlite-remote-server:user-manager',
  description: 'Provides the user manager.',
  autoStart: true,
  provides: IUserManager,
  optional: [IServerSettings],
  activate: (
    _: null,
    serverSettings: ServerConnection.ISettings | undefined
  ): User.IManager => {
    return new UserManager({ serverSettings });
  }
};

/**
 * The event manager plugin.
 */
const eventManagerPlugin: ServiceManagerPlugin<Event.IManager> = {
  id: 'jupyterlite-remote-server:event-manager',
  description: 'Provides the event manager.',
  autoStart: true,
  provides: IEventManager,
  optional: [IServerSettings],
  activate: (
    _: null,
    serverSettings: ServerConnection.ISettings | undefined
  ): Event.IManager => {
    return new EventManager({ serverSettings });
  }
};

/**
 * The config section manager plugin.
 */
const configSectionManagerPlugin: ServiceManagerPlugin<ConfigSection.IManager> =
  {
    id: 'jupyterlite-remote-server:config-section-manager',
    description: 'Provides the config section manager.',
    autoStart: true,
    provides: IConfigSectionManager,
    optional: [IServerSettings],
    activate: (
      _: null,
      serverSettings: ServerConnection.ISettings | undefined
    ): ConfigSection.IManager => {
      const manager = new ConfigSectionManager({ serverSettings });
      // Set the config section manager for the global ConfigSection.
      ConfigSection._setConfigSectionManager(manager);
      return manager;
    }
  };

/**
 * The nbconvert manager plugin.
 */
const nbConvertManagerPlugin: ServiceManagerPlugin<NbConvert.IManager> = {
  id: 'jupyterlite-remote-server:nbconvert-manager',
  description: 'Provides the nbconvert manager.',
  autoStart: true,
  provides: INbConvertManager,
  optional: [IServerSettings],
  activate: (
    _: null,
    serverSettings: ServerConnection.ISettings | undefined
  ): NbConvert.IManager => {
    return new NbConvertManager({ serverSettings });
  }
};

/**
 * The terminal manager plugin.
 */
const terminalManagerPlugin: ServiceManagerPlugin<Terminal.IManager> = {
  id: 'jupyterlite-remote-server:terminal-manager',
  description: 'Provides the terminal manager.',
  autoStart: true,
  provides: ITerminalManager,
  optional: [IServerSettings],
  activate: (
    _: null,
    serverSettings: ServerConnection.ISettings | undefined
  ): Terminal.IManager => {
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

// Re-export the DynamicServerSettings class for direct use
export { DynamicServerSettings } from './serversettings';
