import { ConfigHandler } from "../config/ConfigHandler";
import { ControlPlaneClient } from "../control-plane/client";
import { DebuggAIServerClient } from "../debuggAIServer/stubs/client";
import Mock from "../llm/llms/Mock";
import FileSystemIde from "../util/filesystem";

import { TEST_DIR } from "./testDir";

export const testIde = new FileSystemIde(TEST_DIR);

export const ideSettingsPromise = testIde.getIdeSettings();

export const testControlPlaneClient = new ControlPlaneClient(
  Promise.resolve(undefined),
  ideSettingsPromise,
);


let debuggAIServerClientResolve: (_: any) => void | undefined;
export const debuggAIServerClientPromise: Promise<DebuggAIServerClient> = new Promise(
  (resolve) => (debuggAIServerClientResolve = resolve),
);

export const testConfigHandler = new ConfigHandler(
  testIde,
  ideSettingsPromise,
  async (text) => {},
  Promise.resolve(undefined),
  debuggAIServerClientPromise,
);

export const testLLM = new Mock({
  model: "mock-model",
  title: "Mock LLM",
  uniqueId: "not-unique",
});
