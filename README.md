# jupyterlite-remote-server

[![Github Actions Status](https://github.com/jtpio/jupyterlite-remote-server/workflows/Build/badge.svg)](https://github.com/jtpio/jupyterlite-remote-server/actions/workflows/build.yml)

A JupyterLite extension that connects to a remote Jupyter server for all services (kernels, contents, terminals, etc.).

This extension replaces JupyterLite's in-browser service implementations with standard JupyterLab service managers that communicate with a remote Jupyter server. This allows you to run a static JupyterLite frontend while using a real Jupyter server for all backend operations.

## How It Works

The extension provides ServiceManagerPlugins that:

1. Provide standard JupyterLab service managers configured to connect to a remote server
2. Read server connection settings dynamically from PageConfig
3. Provide a vendored theme manager that reads theme assets from a configurable URL

The corresponding JupyterLite in-browser service plugins must be disabled via `jupyter-lite.json` configuration (see [Usage with JupyterLite](#usage-with-jupyterlite)).

## Configuration

Configure the extension by setting these options in `jupyter-lite.json`.

### Default Configuration (All Services)

These options apply to all services unless overridden by service-specific options:

| Option          | Description                                                                                                                              |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `remoteBaseUrl` | The base URL of the remote Jupyter server (e.g., `http://localhost:8888/`)                                                               |
| `remoteToken`   | The authentication token for the remote server                                                                                           |
| `appendToken`   | Whether to append token to WebSocket URLs. If not set, auto-detects based on whether the base URL and WebSocket URL are on the same host |

### Theme Configuration

| Option          | Description                                                                                                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fullThemesUrl` | The full URL to the themes directory (e.g., `http://localhost:8080/build/themes`). Used by the vendored theme manager plugin to load theme CSS from the JupyterLite server instead of joining `baseUrl` with paths. |

### Service-Specific Configuration (Optional)

You can configure different URLs and tokens for specific service groups. If not specified, services fall back to the default `remoteBaseUrl` and `remoteToken`.

| Option                       | Services Affected               | Description                      |
| ---------------------------- | ------------------------------- | -------------------------------- |
| `remoteContentsBaseUrl`      | Contents, Default Drive         | Base URL for file operations     |
| `remoteContentsToken`        | Contents, Default Drive         | Token for file operations        |
| `remoteKernelsBaseUrl`       | Kernels, Kernel Specs, Sessions | Base URL for kernel operations   |
| `remoteKernelsToken`         | Kernels, Kernel Specs, Sessions | Token for kernel operations      |
| `remoteTerminalsBaseUrl`     | Terminals                       | Base URL for terminals           |
| `remoteTerminalsToken`       | Terminals                       | Token for terminals              |
| `remoteEventsBaseUrl`        | Events                          | Base URL for server events       |
| `remoteEventsToken`          | Events                          | Token for server events          |
| `remoteNbconvertBaseUrl`     | NbConvert                       | Base URL for notebook conversion |
| `remoteNbconvertToken`       | NbConvert                       | Token for notebook conversion    |
| `remoteConfigSectionBaseUrl` | Config Sections                 | Base URL for config sections     |
| `remoteConfigSectionToken`   | Config Sections                 | Token for config sections        |

## Usage with JupyterLite

### 1. Start the Jupyter Server

Start a Jupyter server with CORS enabled to allow connections from JupyterLite:

```bash
jupyter server --ServerApp.token=my-token --ServerApp.allow_origin='*'
```

### 2. Create JupyterLite Configuration

Create a `jupyter-lite.json` configuration file.

#### Basic Configuration (Single Server)

Use the default options when all services connect to the same server:

```json
{
  "jupyter-lite-schema-version": 0,
  "jupyter-config-data": {
    "remoteBaseUrl": "http://localhost:8888/",
    "remoteToken": "my-token",
    "fullThemesUrl": "http://localhost:8080/build/themes",
    "disabledExtensions": [
      "@jupyterlite/services-extension:config-section-manager",
      "@jupyterlite/services-extension:default-drive",
      "@jupyterlite/services-extension:event-manager",
      "@jupyterlite/services-extension:exporters",
      "@jupyterlite/services-extension:kernel-manager",
      "@jupyterlite/services-extension:kernel-client",
      "@jupyterlite/services-extension:kernel-spec-client",
      "@jupyterlite/services-extension:kernel-spec-manager",
      "@jupyterlite/services-extension:kernel-specs",
      "@jupyterlite/services-extension:nbconvert-manager",
      "@jupyterlite/services-extension:session-manager",
      "@jupyterlite/application-extension:service-worker-manager",
      "@jupyterlab/apputils-extension:themes"
    ]
  }
}
```

#### Advanced Configuration (Multiple Servers)

Use service-specific options when different services need to connect to different servers:

```json
{
  "jupyter-lite-schema-version": 0,
  "jupyter-config-data": {
    "remoteBaseUrl": "http://localhost:8888/",
    "remoteToken": "default-token",
    "remoteContentsBaseUrl": "http://files-server:8889/",
    "remoteContentsToken": "files-token",
    "remoteKernelsBaseUrl": "http://compute-server:8890/",
    "remoteKernelsToken": "compute-token",
    "fullThemesUrl": "http://localhost:8080/build/themes",
    "disabledExtensions": [
      "@jupyterlite/services-extension:config-section-manager",
      "@jupyterlite/services-extension:default-drive",
      "@jupyterlite/services-extension:event-manager",
      "@jupyterlite/services-extension:exporters",
      "@jupyterlite/services-extension:kernel-manager",
      "@jupyterlite/services-extension:kernel-client",
      "@jupyterlite/services-extension:kernel-spec-client",
      "@jupyterlite/services-extension:kernel-spec-manager",
      "@jupyterlite/services-extension:kernel-specs",
      "@jupyterlite/services-extension:nbconvert-manager",
      "@jupyterlite/services-extension:session-manager",
      "@jupyterlite/application-extension:service-worker-manager",
      "@jupyterlab/apputils-extension:themes"
    ]
  }
}
```

In this example:

- File operations (contents) use `http://files-server:8889/`
- Kernel operations (kernels, sessions, kernel specs) use `http://compute-server:8890/`
- All other services fall back to the default `http://localhost:8888/`

### 3. Build and Serve JupyterLite

```bash
pip install jupyterlite-core jupyterlite-remote-server
jupyter lite build
cd _output
python -m http.server 8080
```

Then open `http://localhost:8080/lab/` in your browser.

## Demo

The `demo/` directory contains a complete working example with separate servers for contents and kernels. To run it locally:

```bash
# Install the demo dependencies
pip install -r demo/requirements.txt

# Build the JupyterLite site
cd demo
jupyter lite build
```

Then start three terminals:

```bash
# Terminal 1 — Jupyter server for contents and other services
jupyter server --port=8888 --ServerApp.token=my-token --ServerApp.allow_origin='*'

# Terminal 2 — Jupyter server for kernels
jupyter server --port=7777 --ServerApp.token=kernels-token --ServerApp.allow_origin='*'

# Terminal 3 — JupyterLite frontend
cd demo/_output
python -m http.server 8080
```

Open `http://localhost:8080/lab/` in your browser.

## Plugins Provided

This extension provides the following ServiceManagerPlugins:

| Plugin                   | Token                   | Service Type    | Description                                                    |
| ------------------------ | ----------------------- | --------------- | -------------------------------------------------------------- |
| `server-settings`        | `IServerSettings`       | `default`       | Remote server connection settings                              |
| `default-drive`          | `IDefaultDrive`         | `contents`      | Server-connected file drive                                    |
| `contents-manager`       | `IContentsManager`      | `contents`      | File contents management                                       |
| `kernel-manager`         | `IKernelManager`        | `kernels`       | Kernel lifecycle management                                    |
| `kernel-spec-manager`    | `IKernelSpecManager`    | `kernels`       | Kernel specifications with URL rewriting                       |
| `session-manager`        | `ISessionManager`       | `kernels`       | Session management                                             |
| `event-manager`          | `IEventManager`         | `events`        | Server events                                                  |
| `config-section-manager` | `IConfigSectionManager` | `configSection` | Config section management                                      |
| `nbconvert-manager`      | `INbConvertManager`     | `nbconvert`     | Notebook conversion                                            |
| `terminal-manager`       | `ITerminalManager`      | `terminals`     | Terminal sessions                                              |
| `themes`                 | `IThemeManager`         | —               | Vendored theme manager reading `fullThemesUrl` from PageConfig |

## Disabled Extensions

The following JupyterLite and JupyterLab plugins must be disabled in `jupyter-lite.json` to avoid conflicts with the plugins provided by this extension:

| Disabled Extension                                          | Reason                                                |
| ----------------------------------------------------------- | ----------------------------------------------------- |
| `@jupyterlite/services-extension:config-section-manager`    | Replaced by this extension's `config-section-manager` |
| `@jupyterlite/services-extension:default-drive`             | Replaced by this extension's `default-drive`          |
| `@jupyterlite/services-extension:event-manager`             | Replaced by this extension's `event-manager`          |
| `@jupyterlite/services-extension:exporters`                 | Not needed with a remote server                       |
| `@jupyterlite/services-extension:kernel-manager`            | Replaced by this extension's `kernel-manager`         |
| `@jupyterlite/services-extension:kernel-client`             | Not needed with a remote server                       |
| `@jupyterlite/services-extension:kernel-spec-client`        | Not needed with a remote server                       |
| `@jupyterlite/services-extension:kernel-spec-manager`       | Replaced by this extension's `kernel-spec-manager`    |
| `@jupyterlite/services-extension:kernel-specs`              | Not needed with a remote server                       |
| `@jupyterlite/services-extension:nbconvert-manager`         | Replaced by this extension's `nbconvert-manager`      |
| `@jupyterlite/services-extension:session-manager`           | Replaced by this extension's `session-manager`        |
| `@jupyterlite/application-extension:service-worker-manager` | Not needed with a remote server                       |
| `@jupyterlab/apputils-extension:themes`                     | Replaced by this extension's vendored `themes` plugin |

## Requirements

- JupyterLab >= 4.0.0
- A running Jupyter server with CORS enabled

## Install

```bash
pip install jupyterlite-remote-server
```

## Uninstall

```bash
pip uninstall jupyterlite-remote-server
```

## Contributing

### Development install

```bash
# Clone the repo and change to the directory
git clone https://github.com/jtpio/jupyterlite-remote-server.git
cd jupyterlite-remote-server

# Set up a virtual environment
python -m venv .venv
source .venv/bin/activate

# Install in development mode
pip install --editable "."
jupyter labextension develop . --overwrite

# Rebuild after making changes
jlpm build
```

### Development with watch mode

```bash
# Watch the source directory (in one terminal)
jlpm watch

# Run JupyterLab (in another terminal)
jupyter lab
```

### Development uninstall

```bash
pip uninstall jupyterlite_remote_server
```

Then remove the symlink from `jupyter labextension list` location named `jupyterlite-remote-server`.

### Packaging

See [RELEASE](RELEASE.md)
