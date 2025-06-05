// ProfileHandlers manage the loading of a config, allowing us to abstract over different ways of getting to a DebuggAiConfig

import { ConfigResult } from "@continuedev/config-yaml";

import { DebuggAiConfig } from "../../index.js";
import { ProfileDescription } from "../ProfileLifecycleManager.js";

// After we have the DebuggAiConfig, the ConfigHandler takes care of everything else (loading models, lifecycle, etc.)
export interface IProfileLoader {
  description: ProfileDescription;
  doLoadConfig(): Promise<ConfigResult<DebuggAiConfig>>;
  setIsActive(isActive: boolean): void;
}
