
import { DebuggAIServerClient } from "core/debuggAIServer/stubs/client";

import { RemoteConfigSync } from "./remoteConfig";

export async function setupRemoteConfigSync(reloadConfig: () => void, debuggAIServerClientPromise: Promise<DebuggAIServerClient>) {
  const debuggAIServerClient = await debuggAIServerClientPromise;
  // await vscode.workspace
  //   .getConfiguration(EXTENSION_NAME)
  //   .update("userToken", token, vscode.ConfigurationTarget.Global);
  try {
    const configSync = new RemoteConfigSync(reloadConfig, null, debuggAIServerClient);
    await configSync.setup();
  } catch (e) {
    console.warn(`Failed to sync remote config: ${e}`);
  }
}
