import * as fs from "node:fs";

import { IdeSettings } from "..";
import {
  getLocalEnvironmentDotFilePath,
  getStagingEnvironmentDotFilePath,
  getTestEnvironmentDotFilePath,
} from "../util/paths";

export interface ControlPlaneEnv {
  DEFAULT_CONTROL_PLANE_PROXY_URL: string;
  CONTROL_PLANE_URL: string;
  AUTH_TYPE: string;
  OUATH_URL: string;
  OAUTH_CLIENT_ID: string;
  OAUTH_CLIENT_SECRET: string;
  APP_URL: string;
}

export const EXTENSION_NAME = "debugg-ai";

// const OAUTH_CLIENT_ID_PRODUCTION = "client_01J0FW6XN8N2XJAECF7NE0Y65J";
// const OAUTH_CLIENT_ID_STAGING = "client_01J0FW6XCPMJMQ3CG51RB4HBZQ";
const CLIENT_ID = "itQpxtiloI1uvgMilBrRKyCN3ppQol2wH1TP7184";    
const CLIENT_SECRET_DEV = "AiHgQ1XukD3UEgsnqkI7BjjRN5fIoKiH0KolMLJsXB2rXUaXrZNJ5aPYUzBIMPBByRJIj6ZZQ2A1FLRLan55qcEVgBeHzpKcHtUtnxSjiiaqi3pPX5uBn7nBvN1Zxp66";

const CLIENT_ID_PROD = "XfS4XO9r3r5Ms8vgEJNgf5Vs8FnaNjvGbdM7z7NO";
const CLIENT_SECRET_PROD = "Wakd5cqEpHJcGHmLNjQ4w07N3AZNZhGG2Wlm3PmwmLGS4A0uQLekSb7WBdvM5fVynE0JNbJvElVQ18vkJWmRInQsQb1yGVDtknCcwbYy7dLZOVCdOnBrP7QurrcqeCjk";

const OUATH_ENV_ID = "debugg-ai";
const OUATH_ENV_ID_STAGING = "debugg-ai-staging";
const OUATH_ENV_ID_TEST = "debugg-ai-test";


export const PRODUCTION_ENV: ControlPlaneEnv = {
  DEFAULT_CONTROL_PLANE_PROXY_URL:
  "https://api.debugg.ai",
  CONTROL_PLANE_URL:
  "https://api.debugg.ai",
  AUTH_TYPE: OUATH_ENV_ID,
  OUATH_URL: "https://auth.debugg.ai",
  OAUTH_CLIENT_ID: CLIENT_ID_PROD,
  OAUTH_CLIENT_SECRET: CLIENT_SECRET_PROD,
  APP_URL: "https://app.debugg.ai",
};

const PRODUCTION_HUB_ENV: ControlPlaneEnv = {
  DEFAULT_CONTROL_PLANE_PROXY_URL: "https://api.debugg.ai",
  CONTROL_PLANE_URL: "https://api.debugg.ai",
  AUTH_TYPE: OUATH_ENV_ID,
  OUATH_URL: "https://auth.debugg.ai",
  OAUTH_CLIENT_ID: CLIENT_ID_PROD,
  OAUTH_CLIENT_SECRET: CLIENT_SECRET_PROD,
  APP_URL: "https://app.debugg.ai",
};

const STAGING_ENV: ControlPlaneEnv = {
  DEFAULT_CONTROL_PLANE_PROXY_URL: "https://api.st.debugg.ai",
  CONTROL_PLANE_URL: "https://api.st.debugg.ai",
  AUTH_TYPE: OUATH_ENV_ID_STAGING,
  OUATH_URL: "https://auth.st.debugg.ai",
  OAUTH_CLIENT_ID: CLIENT_ID,
  OAUTH_CLIENT_SECRET: CLIENT_SECRET_DEV,
  APP_URL: "https://hub.st.debugg.ai",
};

const TEST_ENV: ControlPlaneEnv = {
  DEFAULT_CONTROL_PLANE_PROXY_URL: "https://debuggai-backend.ngrok.app",
  CONTROL_PLANE_URL: "https://debuggai-backend.ngrok.app",
  AUTH_TYPE: OUATH_ENV_ID_TEST,
  OUATH_URL: "https://auth.dev.debugg.ai",
  OAUTH_CLIENT_ID: CLIENT_ID,
  OAUTH_CLIENT_SECRET: CLIENT_SECRET_DEV,
  APP_URL: "https://app-test.debugg.ai",
};

const LOCAL_ENV: ControlPlaneEnv = {
  DEFAULT_CONTROL_PLANE_PROXY_URL: "http://localhost:80",
  CONTROL_PLANE_URL: "http://localhost:80",
  AUTH_TYPE: OUATH_ENV_ID_TEST,
  OUATH_URL: "https://auth.dev.debugg.ai",
  OAUTH_CLIENT_ID: CLIENT_ID,
  OAUTH_CLIENT_SECRET: CLIENT_SECRET_DEV,
  APP_URL: "http://localhost:80",
};

export async function enableHubContinueDev() {
  return true;
}

export async function getControlPlaneEnv(
  ideSettingsPromise: Promise<IdeSettings>,
): Promise<ControlPlaneEnv> {
  const ideSettings = await ideSettingsPromise;
  return getControlPlaneEnvSync(
    'production',  // ideSettings.debuggAiTestEnvironment,
    ideSettings.enableControlServerBeta,
  );
}

export function getControlPlaneEnvSync(
  ideTestEnvironment: IdeSettings["debuggAiTestEnvironment"],
  enableControlServerBeta: IdeSettings["enableControlServerBeta"],
): ControlPlaneEnv {
  // Note .local overrides .staging
  if (fs.existsSync(getLocalEnvironmentDotFilePath())) {
    return LOCAL_ENV;
  }
  if (fs.existsSync(getTestEnvironmentDotFilePath())) {
    return TEST_ENV;
  }
  if (fs.existsSync(getStagingEnvironmentDotFilePath())) {
    return STAGING_ENV;
  }

  if (enableControlServerBeta === true) {
    return PRODUCTION_ENV;
  }

  const env =
    ideTestEnvironment === "production"
      ? "hub"
      : ideTestEnvironment === "staging"
        ? "staging"
        : ideTestEnvironment === "local"
          ? "local"
          : process.env.CONTROL_PLANE_ENV;

  return env === "local"
    ? LOCAL_ENV
    : env === "staging"
      ? STAGING_ENV
      : env === "test"
        ? TEST_ENV
        : env === "hub"
          ? PRODUCTION_ENV
          : PRODUCTION_ENV;
}

export async function useHub(
  ideSettingsPromise: Promise<IdeSettings>,
): Promise<boolean> {
  const ideSettings = await ideSettingsPromise;
  if (ideSettings.enableControlServerBeta) {
    return false;
  }
  return ideSettings.debuggAiTestEnvironment !== "none";
}
