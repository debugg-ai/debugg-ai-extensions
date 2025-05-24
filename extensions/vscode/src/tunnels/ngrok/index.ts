import { existsSync, promises } from 'fs';
import { join } from 'path';

import { isError } from './error';
import { hideStatusBarItem, showStatusBarItem } from './statusBarItem';

const { readFile } = promises;

import { mkdirp } from 'mkdirp';
import {
  authtoken,
  connect,
  disconnect,
  getApi,
  getUrl,
  kill,
  Ngrok,
  NgrokClient,
} from 'ngrok';
import download from 'ngrok/download';
import {
  env,
  ProgressLocation,
  Uri,
  WebviewPanel,
  window,
  workspace,
  WorkspaceEdit
} from 'vscode';
import { parse } from 'yaml';

const basePath = join(__dirname, 'bin');

export const binPath = () => basePath;

let webviewPanel: WebviewPanel | undefined;

import { NgrokConfig, TunnelQuickPickItem } from './types';

const DEFAULT_CONFIG_PATH = join(__dirname, 'ngrok-config.yml');

const getConfigPath = (): string => {
  return DEFAULT_CONFIG_PATH;
};

const getConfig: () => Promise<NgrokConfig | undefined> = async () => {
  const configPath = getConfigPath();
  try {
    const config = parse(await readFile(configPath, 'utf8'));
    if (config && typeof config.authtoken !== 'undefined') {
      await authtoken({ authtoken: config.authtoken, binPath });
    }
    return config;
  } catch (error) {
    if (isError(error) && error.code === 'ENOENT') {
      if (configPath !== DEFAULT_CONFIG_PATH) {
        window.showErrorMessage(`Could not find config file at ${configPath}.`);
      }
    } else {
      window.showErrorMessage(`Could not parse config file at ${configPath}.`);
    }
  }
};

const tunnelsFromConfig = (tunnels: { [key: string]: Ngrok.Options }) => {
  return Object.keys(tunnels).map((tunnelName) => {
    return {
      label: tunnelName,
      tunnelOptions: { name: tunnelName, ...tunnels[tunnelName] },
    };
  });
};

const getActiveTunnels: (api: NgrokClient) => Promise<Ngrok.Tunnel[]> = async (
  api: NgrokClient
) => {
  const response = await api.listTunnels();
  return response.tunnels;
};

const getTunnelToStart: (
  config: NgrokConfig | undefined
) => Promise<Ngrok.Options | undefined> = (config) =>
  new Promise((resolve) => {
    const quickPick = window.createQuickPick();
    let items: TunnelQuickPickItem[];
    if (config && config.tunnels) {
      items = tunnelsFromConfig(config.tunnels);
      quickPick.title = 'Choose tunnel from options or enter a port number.';
    } else {
      items = [];
      quickPick.title = 'Enter a port number.';
    }
    quickPick.items = items;
    quickPick.onDidChangeValue(() => {
      const addr = parseInt(quickPick.value, 10);
      if (
        !Number.isNaN(addr) &&
        !items.map((item) => item.label).includes(quickPick.value)
      ) {
        const newItems: TunnelQuickPickItem[] = [
          { label: quickPick.value, tunnelOptions: { addr, proto: 'http' } },
          ...items,
        ];
        quickPick.items = newItems;
      }
    });
    quickPick.onDidHide(() => {
      quickPick.dispose();
      resolve(undefined);
    });
    quickPick.onDidAccept(() => {
      const selection = quickPick.activeItems[0] as TunnelQuickPickItem;
      resolve(selection.tunnelOptions);
      quickPick.hide();
    });
    quickPick.show();
  });

export const start = async (options?: Ngrok.Options) => {
  const config = await getConfig();
  const tunnel = options || (await getTunnelToStart(config));
  if (typeof tunnel !== 'undefined') {
    const configPath = getConfigPath();
    if (existsSync(configPath)) {
      tunnel.configPath = configPath;
    }
    try {
      tunnel.binPath = binPath;
      try {
        const url = await connect(tunnel);
        showStatusBarItem();
        const action = await window.showInformationMessage(
          `ngrok is forwarding ${url}.`,
          'Copy to clipboard',
          'Open in browser',
          'Show QR code'
        );
        switch (action) {
          case 'Copy to clipboard':
            await env.clipboard.writeText(url);
            window.showInformationMessage(`Copied "${url}" to your clipboard.`);
            break;
          case 'Open in browser':
            env.openExternal(Uri.parse(url));
            break;
        }
      } catch (error) {
        window.showErrorMessage(`There was an error starting your tunnel.`);
        console.error(error);
      }
    } catch (error) {
      window.showErrorMessage(`There was an error starting your tunnel.`);
      console.error(error);
    }
  }
};

export const stop = async (tunnel?: string) => {
  const api = getApi();
  if (!api) {
    return window.showErrorMessage('ngrok is not currently running.');
  }
  try {
    const tunnels = await getActiveTunnels(api);
    if (tunnels.length > 0) {
      tunnel =
        tunnel ||
        (await window.showQuickPick(
          ['All', ...tunnels.map((t) => t.public_url)],
          { placeHolder: 'Choose a tunnel to stop' }
        ));

      if (tunnel === 'All') {
        await closeAllTunnels();
      } else if (typeof tunnel !== 'undefined') {
        await closeTunnel(tunnel, api);
      }
    } else {
      window.showInformationMessage('There are no active ngrok tunnels.');
    }
  } catch (error) {
    window.showErrorMessage('Could not get active tunnels from ngrok.');
    console.error(error);
  }
};

const closeTunnel = async (tunnel: string, api: NgrokClient) => {
  try {
    await disconnect(tunnel);
    let message = `ngrok tunnel ${tunnel} disconnected.`;
    if ((await getActiveTunnels(api)).length === 0) {
      await kill();
      message = `${message} ngrok has been shutdown.`;
      hideStatusBarItem();
    }
    window.showInformationMessage(message);
  } catch (error) {
    window.showErrorMessage(
      `There was a problem stopping the tunnel ${tunnel}, see the log for details.`
    );
    console.error(error);
  }
};

const closeAllTunnels = async () => {
  try {
    await disconnect();
    await kill();
    window.showInformationMessage(
      'All ngrok tunnels disconnected. ngrok has been shutdown.'
    );
    hideStatusBarItem();
  } catch (error) {
    window.showErrorMessage(
      'There was an issue closing the ngrok tunnels, check the log for details.'
    );
    console.error(error);
  }
};

export const dashboard = () => {
  const api = getApi();
  const url = getUrl();
  if (api && typeof url !== 'undefined' && url !== null) {
    return env.openExternal(Uri.parse(url));
  } else {
    return window.showErrorMessage(
      'ngrok is not currently running, please start a tunnel before accessing the dashboard'
    );
  }
};

export const editSettings = async () => {
  const configPath = Uri.file(getConfigPath());
  try {
    await window.showTextDocument(configPath);
  } catch (error) {
    try {
      const wsedit = new WorkspaceEdit();
      wsedit.createFile(configPath);
      await workspace.applyEdit(wsedit);
      return window.showTextDocument(configPath);
    } catch (error) {
      console.error(error);
      return window.showErrorMessage(
        'Could not open your ngrok settings file.'
      );
    }
  }
};

export const setAuthToken = async () => {
  const newAuthToken = await window.showInputBox({
    prompt: 'Enter your ngrok auth token.',
  });
  if (typeof newAuthToken !== 'undefined') {
    await authtoken({
      authtoken: newAuthToken,
      configPath: getConfigPath(),
    });
    return window.showInformationMessage(
      'Your auth token has been saved to your ngrok settings.'
    );
  }
};

export const downloadBinary = () => {
  const binaryLocations = [
    join(basePath, 'ngrok'),
    join(basePath, 'ngrok.exe'),
  ];
  if (binaryLocations.some((path) => existsSync(path))) {
    console.info('ngrok binary is already downloaded');
  } else {
    return window.withProgress(
      {
        location: ProgressLocation.Notification,
        cancellable: false,
        title: 'Debugg AI is configuring test pipeline...',
      },
      async () => {
        await mkdirp(basePath);
        try {
          await new Promise<void>((resolve, reject) =>
            download((error) => (error ? reject(error) : resolve()))
          );
        } catch (error) {
          window.showErrorMessage(
            `Can't update ngrok binary. The extension may not work correctly.`
          );
          console.error(error);
        }
      }
    );
  }
};
