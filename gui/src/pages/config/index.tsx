import { ModelRole } from "@continuedev/config-yaml";
import { ModelDescription } from "core";
import {
  SharedConfigSchema,
  modifyAnyConfigWithSharedConfig,
} from "core/config/sharedConfig";
import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../../components/PageHeader";
import { useAuth } from "../../context/Auth";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useNavigationListener } from "../../hooks/useNavigationListener";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import {
  selectDefaultModel,
  setDefaultModel,
  updateConfig,
} from "../../redux/slices/configSlice";
import { selectProfileThunk } from "../../redux/thunks/profileAndOrg";
import { getFontSize, isJetBrains } from "../../util";

function ConfigPage() {
  useNavigationListener();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const ideMessenger = useContext(IdeMessengerContext);

  const {
    session,
    logout,
    login,
    profiles,
    selectedProfile,
    controlServerBetaEnabled,
    selectedOrganization,
  } = useAuth();

  const changeProfileId = (id: string) => {
    dispatch(selectProfileThunk(id));
  };

  const [hubEnabled, setHubEnabled] = useState(false);
  useEffect(() => {
    ideMessenger.ide.getIdeSettings().then(({ debuggAiTestEnvironment }) => {
      setHubEnabled(debuggAiTestEnvironment === "production");
    });
  }, [ideMessenger]);

  function handleOpenConfig() {
    if (!selectedProfile) {
      return;
    }
    ideMessenger.post("config/openProfile", {
      profileId: selectedProfile.id,
    });
  }

  // NOTE Hub takes priority over Continue for Teams
  // Since teams will be moving to hub, not vice versa

  /////// User settings section //////
  const config = useAppSelector((state) => state.config.config);
  const selectedChatModel = useAppSelector(selectDefaultModel);

  function handleUpdate(sharedConfig: SharedConfigSchema) {
    // Optimistic update
    const updatedConfig = modifyAnyConfigWithSharedConfig(config, sharedConfig);
    dispatch(updateConfig(updatedConfig));
    // IMPORTANT no need for model role updates (separate logic for selected model roles)
    // simply because this function won't be used to update model roles

    // Actual update to core which propagates back with config update event
    ideMessenger.post("config/updateSharedConfig", sharedConfig);
  }

  function handleRoleUpdate(role: ModelRole, model: ModelDescription | null) {
    if (!selectedProfile) {
      return;
    }
    // Optimistic update
    dispatch(
      updateConfig({
        ...config,
        selectedModelByRole: {
          ...config.selectedModelByRole,
          [role]: model,
        },
      }),
    );
    ideMessenger.post("config/updateSelectedModel", {
      profileId: selectedProfile.id,
      role,
      title: model?.title ?? null,
    });
  }

  // TODO use handleRoleUpdate for chat
  function handleChatModelSelection(model: ModelDescription | null) {
    if (!model) {
      return;
    }
    dispatch(setDefaultModel({ title: model.title }));
  }

  // TODO defaults are in multiple places, should be consolidated and probably not explicit here
  const showSessionTabs = config.ui?.showSessionTabs ?? false;
  const codeWrap = config.ui?.codeWrap ?? false;
  const showChatScrollbar = config.ui?.showChatScrollbar ?? false;
  const displayRawMarkdown = config.ui?.displayRawMarkdown ?? false;
  const disableSessionTitles = config.disableSessionTitles ?? false;
  const readResponseTTS = config.experimental?.readResponseTTS ?? false;

  const allowAnonymousTelemetry = config.allowAnonymousTelemetry ?? true;
  const disableIndexing = config.disableIndexing ?? false;

  const useAutocompleteCache = config.tabAutocompleteOptions?.useCache ?? false;
  const useChromiumForDocsCrawling =
    config.experimental?.useChromiumForDocsCrawling ?? false;
  const codeBlockToolbarPosition = config.ui?.codeBlockToolbarPosition ?? "top";
  const useAutocompleteMultilineCompletions =
    config.tabAutocompleteOptions?.multilineCompletions ?? "auto";
  const fontSize = getFontSize();

  // Disable autocomplete
  const disableAutocompleteInFiles = (
    config.tabAutocompleteOptions?.disableInFiles ?? []
  ).join(", ");
  const [formDisableAutocomplete, setFormDisableAutocomplete] = useState(
    disableAutocompleteInFiles,
  );
  const cancelChangeDisableAutocomplete = () => {
    setFormDisableAutocomplete(disableAutocompleteInFiles);
  };
  const handleDisableAutocompleteSubmit = () => {
    handleUpdate({
      disableAutocompleteInFiles: formDisableAutocomplete
        .split(",")
        .map((val) => val.trim())
        .filter((val) => !!val),
    });
  };

  useEffect(() => {
    // Necessary so that reformatted/trimmed values don't cause dirty state
    setFormDisableAutocomplete(disableAutocompleteInFiles);
  }, [disableAutocompleteInFiles]);

  // Workspace prompts
  const promptPath = config.experimental?.promptPath || "";
  const [formPromptPath, setFormPromptPath] = useState(promptPath);
  const cancelChangePromptPath = () => {
    setFormPromptPath(promptPath);
  };
  const handleSubmitPromptPath = () => {
    handleUpdate({
      promptPath: formPromptPath || "",
    });
  };

  useEffect(() => {
    // Necessary so that reformatted/trimmed values don't cause dirty state
    setFormPromptPath(promptPath);
  }, [promptPath]);

  const jetbrains = isJetBrains();

  return (
    <div className="overflow-y-scroll">
      <PageHeader showBorder onTitleClick={() => navigate("/")} title="E2E Tests" />

      <div className="divide-x-0 divide-y-2 divide-solid divide-zinc-700 px-4">
        <div className="flex flex-col">
          <div className="flex max-w-[400px] flex-col gap-4 py-6">
            <h2 className="mb-1 mt-0">Configuration</h2>
          </div>
          <div className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-[auto_1fr] py-2">

          </div>
        </div>

        <div className="flex flex-col gap-4 py-6">
          <div className="flex max-w-[400px] flex-col">

            <div>
              <h2 className="mb-6 mt-0">Testing Configuration</h2>
            </div>

            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-4 my-4">
              <span>Local Server Port</span>
              <div className="border-vsc-input-border bg-vsc-input-background text-right rounded-md border border-solid min-w-0">
                <input
                  type="number"
                  value={config.debuggAiServerPort}
                  className="text-vsc-foreground border-none bg-inherit pr-1.5 text-right outline-none ring-0 w-full"
                  style={{
                    appearance: "none",
                    WebkitAppearance: "none",
                    MozAppearance: "none",
                  }}
                  onChange={(e) =>
                    handleUpdate({
                      debuggAiServerPort: parseInt(e.target.value),
                    })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-4 my-4">
              <span>Testing Directory</span>
              <div className="border-vsc-input-border bg-vsc-input-background text-right rounded-md border border-solid min-w-0">
                <input
                  type="text"
                  value={config.debuggAiTestOutputDir}
                  className="text-vsc-foreground border-none bg-inherit pr-1.5 text-right outline-none ring-0 w-full"
                  style={{
                    appearance: "none",
                    WebkitAppearance: "none",
                    MozAppearance: "none",
                  }}
                  onChange={(e) =>
                    handleUpdate({
                      debuggAiTestOutputDir: e.target.value,
                    })
                  }
                />
              </div>
              <div className="text-vsc-foreground-muted text-lightgray self-end text-xs">
                Relative to workspace
                <br />
                (default: tests/debugg-ai)
              </div>
            </div>

          </div>
        </div>

        {/* Model Roles as a separate section */}
        <div className="flex flex-col">
          <div className="flex max-w-[400px] flex-col gap-4 py-6">
            <h2 className="mb-1 mt-0">Project Settings</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
              <span>Primary Language</span>
              <div className="hidden display-none md:block"></div>
              <select 
                value={config.debuggAiRepoSettings?.primaryLanguage ?? "javascript"}
                onChange={(e) =>
                  handleUpdate({
                    debuggAiRepoSettings: {
                      ...config.debuggAiRepoSettings,
                      primaryLanguage: e.target.value,
                    },
                  })
                }
              >
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="csharp">C#</option>
                <option value="go">Go</option>
                <option value="rust">Rust</option>
              </select>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
              <span>Main Framework</span>
              <div className="hidden md:block"></div>
              <select 
                value={config.debuggAiRepoSettings?.framework ?? "node"}
                onChange={(e) =>
                  handleUpdate({
                    debuggAiRepoSettings: {
                      ...config.debuggAiRepoSettings,
                      framework: e.target.value,
                    },
                  })
                }
              >
                <option value="angular">Angular</option>
                <option value="svelte">Svelte</option>
                <option value="next">Next</option>
                <option value="node">Node</option>
                <option value="nuxt">Nuxt</option>
                <option value="remix">Remix</option>
                <option value=".net_maui">.NET MAUI</option>
                <option value="android">Android</option>
                <option value="angular">Angular</option>
                <option value="aspnet_core">ASP.NET Core</option>
                <option value="astro">Astro</option>
                <option value="browser_js">Browser JavaScript</option>
                <option value="django">Django</option>
                <option value="express">Express</option>
                <option value="fastapi">FastAPI</option>
                <option value="flask">Flask</option>
                <option value="flutter">Flutter</option>
                <option value="ios">iOS</option>
                <option value="laravel">Laravel</option>
                <option value="nestjs">Nest.js</option>
                <option value="nextjs">Next.js</option>
                <option value="nodejs">Node.js</option>
                <option value="nuxt">Nuxt</option>
                <option value="php">PHP</option>
                <option value="python">Python</option>
                <option value="rails">Rails</option>
                <option value="react">React</option>
                <option value="react_native">React Native</option>
                <option value="remix">Remix</option>
                <option value="spring_boot">Spring Boot</option>
                <option value="sveltekit">SvelteKit</option>
                <option value="symfony">Symfony</option>
                <option value="unity">Unity</option>
                <option value="vite">Vite</option>
                <option value="vue">Vue</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
              <span>Testing Framework</span>
              <div className="hidden md:block"></div>
              <select 
                value={config.debuggAiRepoSettings?.testingFramework ?? "playwright"}
                onChange={(e) =>
                  handleUpdate({
                    debuggAiRepoSettings: {
                      ...config.debuggAiRepoSettings,
                      testingFramework: e.target.value,
                    },
                  })
                }
              >
                <option value="ava">Ava</option>
                <option value="cypress">Cypress</option>
                <option value="mocha">Mocha</option>
                <option value="jasmine">Jasmine</option>
                <option value="jest">Jest</option>
                <option value="qunit">QUnit</option>
                <option value="playwright">Playwright</option>
                <option value="puppeteer">Puppeteer</option>
                <option value="selenium">Selenium</option>
                <option value="testcafe">TestCafe</option>
                <option value="vitest">Vitest</option>
              </select>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
              <span>Testing Language</span>
              <div className="hidden md:block"></div>
              <select 
                value={config.debuggAiRepoSettings?.testingLanguage ?? "javascript"}
                onChange={(e) =>
                  handleUpdate({
                    debuggAiRepoSettings: {
                      ...config.debuggAiRepoSettings,
                      testingLanguage: e.target.value,
                    },
                  })
                }
              >
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="csharp">C#</option>
                <option value="go">Go</option>
                <option value="rust">Rust</option>
              </select>
            </div>
          </div>
        </div>
        {/* <div className="flex flex-col">
          <div className="flex max-w-[400px] flex-col">
            <div className="flex flex-col gap-4 py-6">
              <div>
                <h2 className="mb-2 mt-0">User settings</h2>
              </div>

              <div className="flex flex-col gap-4">
                <ToggleSwitch
                  isToggled={showSessionTabs}
                  onToggle={() =>
                    handleUpdate({
                      showSessionTabs: !showSessionTabs,
                    })
                  }
                  text="Show Session Tabs"
                />
                <ToggleSwitch
                  isToggled={codeWrap}
                  onToggle={() =>
                    handleUpdate({
                      codeWrap: !codeWrap,
                    })
                  }
                  text="Wrap Codeblocks"
                />
                <ToggleSwitch
                  isToggled={displayRawMarkdown}
                  onToggle={() =>
                    handleUpdate({
                      displayRawMarkdown: !displayRawMarkdown,
                    })
                  }
                  text="Display Raw Markdown"
                />
                <ToggleSwitch
                  isToggled={allowAnonymousTelemetry}
                  onToggle={() =>
                    handleUpdate({
                      allowAnonymousTelemetry: !allowAnonymousTelemetry,
                    })
                  }
                  text="Allow Anonymous Telemetry"
                />

                <ToggleSwitch
                  isToggled={disableSessionTitles}
                  onToggle={() =>
                    handleUpdate({
                      disableSessionTitles: !disableSessionTitles,
                    })
                  }
                  text="Disable Session Titles"
                />
                <ToggleSwitch
                  isToggled={readResponseTTS}
                  onToggle={() =>
                    handleUpdate({
                      readResponseTTS: !readResponseTTS,
                    })
                  }
                  text="Response Text to Speech"
                />

                <ToggleSwitch
                  isToggled={showChatScrollbar}
                  onToggle={() =>
                    handleUpdate({
                      showChatScrollbar: !showChatScrollbar,
                    })
                  }
                  text="Show Chat Scrollbar"
                />

                <ToggleSwitch
                  isToggled={useAutocompleteCache}
                  onToggle={() =>
                    handleUpdate({
                      useAutocompleteCache: !useAutocompleteCache,
                    })
                  }
                  text="Use Autocomplete Cache"
                />

                <ToggleSwitch
                  isToggled={useChromiumForDocsCrawling}
                  onToggle={() =>
                    handleUpdate({
                      useChromiumForDocsCrawling: !useChromiumForDocsCrawling,
                    })
                  }
                  text="Use Chromium for Docs Crawling"
                />

                <label className="flex items-center justify-between gap-3">
                  <span className="lines lines-1 text-left">
                    Multiline Autocompletions
                  </span>
                  <Select
                    value={useAutocompleteMultilineCompletions}
                    onChange={(e) =>
                      handleUpdate({
                        useAutocompleteMultilineCompletions: e.target
                          .value as "auto" | "always" | "never",
                      })
                    }
                  >
                    <option value="auto">Auto</option>
                    <option value="always">Always</option>
                    <option value="never">Never</option>
                  </Select>
                </label>

                <label className="flex items-center justify-between gap-3">
                  <span className="text-left">Font Size</span>
                  <NumberInput
                    value={fontSize}
                    onChange={(val) =>
                      handleUpdate({
                        fontSize: val,
                      })
                    }
                    min={7}
                    max={50}
                  />
                </label>

                <form
                  className="flex flex-col gap-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleDisableAutocompleteSubmit();
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span>Disable autocomplete in files</span>
                    <div className="flex items-center gap-2">
                      <Input
                        value={formDisableAutocomplete}
                        className="max-w-[100px]"
                        onChange={(e) => {
                          setFormDisableAutocomplete(e.target.value);
                        }}
                      />
                      <div className="flex h-full flex-col">
                        {formDisableAutocomplete !==
                          disableAutocompleteInFiles ? (
                          <>
                            <div
                              onClick={handleDisableAutocompleteSubmit}
                              className="cursor-pointer"
                            >
                              <CheckIcon className="h-4 w-4 text-green-500 hover:opacity-80" />
                            </div>
                            <div
                              onClick={cancelChangeDisableAutocomplete}
                              className="cursor-pointer"
                            >
                              <XMarkIcon className="h-4 w-4 text-red-500 hover:opacity-80" />
                            </div>
                          </>
                        ) : (
                          <div>
                            <CheckIcon className="text-vsc-foreground-muted h-4 w-4" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="text-vsc-foreground-muted text-lightgray self-end text-xs">
                    Comma-separated list of path matchers
                  </span>
                </form>
              </div>
            </div>
          </div>
        </div> */}
      </div>
    </div >
  );
}

export default ConfigPage;
