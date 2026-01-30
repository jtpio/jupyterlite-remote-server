// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

// TODO: Remove this vendored theme manager plugin once JupyterLab supports
// reading the full themes URL from PageConfig natively (i.e., without joining
// baseUrl with paths.urls.themes). This file is a copy of
// @jupyterlab/apputils-extension:themes with the URL construction changed to
// read `fullThemesUrl` from PageConfig.

import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import {
  ISplashScreen,
  IThemeManager,
  ThemeManager
} from '@jupyterlab/apputils';
import { PageConfig } from '@jupyterlab/coreutils';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ITranslator } from '@jupyterlab/translation';

const scrollbarStyleText = `/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

/*
 * Webkit scrollbar styling.
 * Separate file which is dynamically loaded based on user/theme settings.
 */

/* use standard opaque scrollbars for most nodes */

::-webkit-scrollbar,
::-webkit-scrollbar-corner {
  background: var(--jp-scrollbar-background-color);
}

::-webkit-scrollbar-thumb {
  background: rgb(var(--jp-scrollbar-thumb-color));
  border: var(--jp-scrollbar-thumb-margin) solid transparent;
  background-clip: content-box;
  border-radius: var(--jp-scrollbar-thumb-radius);
}

::-webkit-scrollbar-track:horizontal {
  border-left: var(--jp-scrollbar-endpad) solid
    var(--jp-scrollbar-background-color);
  border-right: var(--jp-scrollbar-endpad) solid
    var(--jp-scrollbar-background-color);
}

::-webkit-scrollbar-track:vertical {
  border-top: var(--jp-scrollbar-endpad) solid
    var(--jp-scrollbar-background-color);
  border-bottom: var(--jp-scrollbar-endpad) solid
    var(--jp-scrollbar-background-color);
}

/* for code nodes, use a transparent style of scrollbar */

.CodeMirror-hscrollbar::-webkit-scrollbar,
.CodeMirror-vscrollbar::-webkit-scrollbar,
.CodeMirror-hscrollbar::-webkit-scrollbar-corner,
.CodeMirror-vscrollbar::-webkit-scrollbar-corner {
  background-color: transparent;
}

.CodeMirror-hscrollbar::-webkit-scrollbar-thumb,
.CodeMirror-vscrollbar::-webkit-scrollbar-thumb {
  background: rgba(var(--jp-scrollbar-thumb-color), 0.5);
  border: var(--jp-scrollbar-thumb-margin) solid transparent;
  background-clip: content-box;
  border-radius: var(--jp-scrollbar-thumb-radius);
}

.CodeMirror-hscrollbar::-webkit-scrollbar-track:horizontal {
  border-left: var(--jp-scrollbar-endpad) solid transparent;
  border-right: var(--jp-scrollbar-endpad) solid transparent;
}

.CodeMirror-vscrollbar::-webkit-scrollbar-track:vertical {
  border-top: var(--jp-scrollbar-endpad) solid transparent;
  border-bottom: var(--jp-scrollbar-endpad) solid transparent;
}`;

namespace CommandIDs {
  export const changeTheme = 'apputils:change-theme';

  export const changePreferredLightTheme = 'apputils:change-light-theme';

  export const changePreferredDarkTheme = 'apputils:change-dark-theme';

  export const toggleAdaptiveTheme = 'apputils:adaptive-theme';

  export const themeScrollbars = 'apputils:theme-scrollbars';

  export const changeFont = 'apputils:change-font';

  export const incrFontSize = 'apputils:incr-font-size';

  export const decrFontSize = 'apputils:decr-font-size';
}

function createStyleSheet(text: string): HTMLStyleElement {
  const style = document.createElement('style');
  style.setAttribute('type', 'text/css');
  style.appendChild(document.createTextNode(text));
  return style;
}

/**
 * The vendored theme manager provider.
 *
 * This is a copy of @jupyterlab/apputils-extension:themes that reads
 * `fullThemesUrl` from PageConfig instead of joining baseUrl with
 * paths.urls.themes.
 */
export const themesPlugin: JupyterFrontEndPlugin<IThemeManager> = {
  id: 'jupyterlite-remote-server:themes',
  description: 'Provides the theme manager.',
  requires: [ISettingRegistry, JupyterFrontEnd.IPaths, ITranslator],
  optional: [ISplashScreen],
  activate: (
    app: JupyterFrontEnd,
    settings: ISettingRegistry,
    paths: JupyterFrontEnd.IPaths,
    translator: ITranslator,
    splash: ISplashScreen | null
  ): IThemeManager => {
    const trans = translator.load('jupyterlab');
    const host = app.shell;
    const commands = app.commands;
    // Read the full themes URL directly from PageConfig instead of joining
    // baseUrl with paths.urls.themes. This allows serving themes from a
    // different URL than the base server URL.
    const url = PageConfig.getOption('fullThemesUrl');
    const key = '@jupyterlab/apputils-extension:themes';
    const manager = new ThemeManager({
      key,
      host,
      settings,
      splash: splash ?? undefined,
      url
    });
    let scrollbarsStyleElement: HTMLStyleElement | null = null;

    // Keep a synchronously set reference to the current theme,
    // since the asynchronous setting of the theme in `changeTheme`
    // can lead to an incorrect toggle on the currently used theme.
    let currentTheme: string;

    manager.themeChanged.connect((sender, args) => {
      // Set data attributes on the application shell for the current theme.
      currentTheme = args.newValue;
      document.body.dataset.jpThemeLight = String(
        manager.isLight(currentTheme)
      );
      document.body.dataset.jpThemeName = currentTheme;
      document.body.style.colorScheme = manager.isLight(currentTheme)
        ? 'light'
        : 'dark';
      if (
        document.body.dataset.jpThemeScrollbars !==
        String(manager.themeScrollbars(currentTheme))
      ) {
        document.body.dataset.jpThemeScrollbars = String(
          manager.themeScrollbars(currentTheme)
        );
        if (manager.themeScrollbars(currentTheme)) {
          if (!scrollbarsStyleElement) {
            scrollbarsStyleElement = createStyleSheet(scrollbarStyleText);
          }
          if (!scrollbarsStyleElement.parentElement) {
            document.body.appendChild(scrollbarsStyleElement);
          }
        } else {
          if (scrollbarsStyleElement && scrollbarsStyleElement.parentElement) {
            scrollbarsStyleElement.parentElement.removeChild(
              scrollbarsStyleElement
            );
          }
        }
      }

      commands.notifyCommandChanged(CommandIDs.changeTheme);
    });

    commands.addCommand(CommandIDs.changeTheme, {
      label: args => {
        if (args.theme === undefined) {
          return trans.__('Switch to the provided `theme`.');
        }
        const theme = args['theme'] as string;
        const displayName = manager.getDisplayName(theme);
        return args['isPalette']
          ? trans.__('Use Theme: %1', displayName)
          : displayName;
      },
      describedBy: {
        args: {
          type: 'object',
          properties: {
            theme: {
              type: 'string',
              description: trans.__('The theme name to switch to')
            },
            isPalette: {
              type: 'boolean',
              description: trans.__(
                'Whether the command is being called from the palette'
              )
            }
          },
          required: ['theme']
        }
      },
      isToggled: args => args['theme'] === currentTheme,
      execute: args => {
        const theme = args['theme'] as string;
        if (theme === manager.theme) {
          return;
        }
        // Disable adaptive theme if users decide to change the theme when adaptive theme is on
        if (manager.isToggledAdaptiveTheme()) {
          return manager.toggleAdaptiveTheme();
        }
        return manager.setTheme(theme);
      }
    });

    commands.addCommand(CommandIDs.changePreferredLightTheme, {
      label: args => {
        if (args.theme === undefined) {
          return trans.__('Switch to the provided light `theme`.');
        }
        const theme = args['theme'] as string;
        const displayName = manager.getDisplayName(theme);
        return args['isPalette']
          ? trans.__('Set Preferred Light Theme: %1', displayName)
          : displayName;
      },
      describedBy: {
        args: {
          type: 'object',
          properties: {
            theme: {
              type: 'string',
              description: trans.__('The preferred light theme name')
            },
            isPalette: {
              type: 'boolean',
              description: trans.__(
                'Whether the command is being called from the palette'
              )
            }
          },
          required: ['theme']
        }
      },
      isToggled: args => args['theme'] === manager.preferredLightTheme,
      execute: args => {
        const theme = args['theme'] as string;
        if (theme === manager.preferredLightTheme) {
          return;
        }
        return manager.setPreferredLightTheme(theme);
      }
    });

    commands.addCommand(CommandIDs.changePreferredDarkTheme, {
      label: args => {
        if (args.theme === undefined) {
          return trans.__('Switch to the provided dark `theme`.');
        }
        const theme = args['theme'] as string;
        const displayName = manager.getDisplayName(theme);
        return args['isPalette']
          ? trans.__('Set Preferred Dark Theme: %1', displayName)
          : displayName;
      },
      describedBy: {
        args: {
          type: 'object',
          properties: {
            theme: {
              type: 'string',
              description: trans.__('The preferred dark theme name')
            },
            isPalette: {
              type: 'boolean',
              description: trans.__(
                'Whether the command is being called from the palette'
              )
            }
          },
          required: ['theme']
        }
      },
      isToggled: args => args['theme'] === manager.preferredDarkTheme,
      execute: args => {
        const theme = args['theme'] as string;
        if (theme === manager.preferredDarkTheme) {
          return;
        }
        return manager.setPreferredDarkTheme(theme);
      }
    });

    commands.addCommand(CommandIDs.toggleAdaptiveTheme, {
      // Avoid lengthy option text in menu
      label: args =>
        args['isPalette']
          ? trans.__('Synchronize Styling Theme with System Settings')
          : trans.__('Synchronize with System Settings'),
      describedBy: {
        args: {
          type: 'object',
          properties: {
            isPalette: {
              type: 'boolean',
              description: trans.__(
                'Whether the command is being called from the palette'
              )
            }
          }
        }
      },
      isToggled: () => manager.isToggledAdaptiveTheme(),
      execute: () => {
        manager.toggleAdaptiveTheme().catch(console.warn);
      }
    });

    commands.addCommand(CommandIDs.themeScrollbars, {
      label: trans.__('Theme Scrollbars'),
      describedBy: {
        args: {
          type: 'object',
          properties: {}
        }
      },
      isToggled: () => manager.isToggledThemeScrollbars(),
      execute: () => manager.toggleThemeScrollbars()
    });

    commands.addCommand(CommandIDs.changeFont, {
      label: args =>
        args['enabled'] ? `${args['font']}` : trans.__('waiting for fonts'),
      describedBy: {
        args: {
          type: 'object',
          properties: {
            enabled: {
              type: 'boolean',
              description: trans.__('Whether the font is available and enabled')
            },
            font: {
              type: 'string',
              description: trans.__('The font name')
            },
            key: {
              type: 'string',
              description: trans.__('The CSS property key to modify')
            }
          },
          required: ['enabled', 'font', 'key']
        }
      },
      isEnabled: args => args['enabled'] as boolean,
      isToggled: args => manager.getCSS(args['key'] as string) === args['font'],
      execute: args =>
        manager.setCSSOverride(args['key'] as string, args['font'] as string)
    });

    commands.addCommand(CommandIDs.incrFontSize, {
      label: args => {
        switch (args.key) {
          case 'code-font-size':
            return trans.__('Increase Code Font Size');
          case 'content-font-size1':
            return trans.__('Increase Content Font Size');
          case 'ui-font-size1':
            return trans.__('Increase UI Font Size');
          default:
            return trans.__('Increase Font Size');
        }
      },
      describedBy: {
        args: {
          type: 'object',
          properties: {
            key: {
              type: 'string',
              description: trans.__(
                'The font size key to increase (e.g., "code-font-size", "content-font-size1", "ui-font-size1")'
              )
            }
          },
          required: ['key']
        }
      },
      execute: args => manager.incrFontSize(args['key'] as string)
    });

    commands.addCommand(CommandIDs.decrFontSize, {
      label: args => {
        switch (args.key) {
          case 'code-font-size':
            return trans.__('Decrease Code Font Size');
          case 'content-font-size1':
            return trans.__('Decrease Content Font Size');
          case 'ui-font-size1':
            return trans.__('Decrease UI Font Size');
          default:
            return trans.__('Decrease Font Size');
        }
      },
      describedBy: {
        args: {
          type: 'object',
          properties: {
            key: {
              type: 'string',
              description: trans.__(
                'The font size key to decrease (e.g., "code-font-size", "content-font-size1", "ui-font-size1")'
              )
            }
          },
          required: ['key']
        }
      },
      execute: args => manager.decrFontSize(args['key'] as string)
    });

    const darkModeMediaQuery = window.matchMedia(
      '(prefers-color-scheme: dark)'
    );

    const syncThemeOnSystemChange = (event: MediaQueryListEvent) => {
      // Only act if the "Synchronize with System Settings" option is enabled.
      if (manager.isToggledAdaptiveTheme()) {
        const newTheme = event.matches
          ? manager.preferredDarkTheme
          : manager.preferredLightTheme;

        // Switch the theme if it's not already the correct one.
        if (manager.theme !== newTheme) {
          void manager.setTheme(newTheme);
        }
      }
    };

    darkModeMediaQuery.addEventListener('change', syncThemeOnSystemChange);

    return manager;
  },
  autoStart: true,
  provides: IThemeManager
};
