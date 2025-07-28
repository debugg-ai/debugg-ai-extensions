import { ConfigResult, DevDataLogEvent, ModelRole } from "@continuedev/config-yaml";

import { AutocompleteInput } from "../autocomplete/util/types";
import { ProfileDescription } from "../config/ConfigHandler";
import { OrganizationDescription } from "../config/ProfileLifecycleManager";
import { SharedConfigSchema } from "../config/sharedConfig";
import { GlobalContextModelSelections } from "../util/GlobalContext";

import type {
    BrowserSerializedDebuggAiConfig,
    ChatMessage,
    ContextItem,
    ContextItemWithId,
    ContextProviderWithParams,
    ContextSubmenuItem,
    DiffLine,
    DocsIndexingDetails,
    ExperimentalModelRoles,
    FileSymbolMap,
    IdeSettings,
    LLMFullCompletionOptions,
    ModelDescription,
    PromptLog,
    RangeInFile,
    SerializedDebuggAiConfig,
    Session,
    SessionMetadata,
    SiteIndexingConfig,
    ToolCall,
} from "../";
import { E2eTest, E2eTestCommitSuite, E2eTestSuite, PaginatedResponse } from "../debuggAIServer/types";
import E2eTestHandler from "../e2es/e2eTestHandler";


export type OnboardingModes = "Local" | "Best" | "Custom" | "Quickstart";

export interface ListHistoryOptions {
  offset?: number;
  limit?: number;
}

export type ToCoreFromIdeOrWebviewProtocol = {
  // Special
  ping: [string, string];
  abort: [undefined, void];

  // History
  "history/list": [ListHistoryOptions, SessionMetadata[]];
  "history/delete": [{ id: string }, void];
  "history/load": [{ id: string }, Session];
  "history/save": [Session, void];
  "devdata/log": [DevDataLogEvent, void];
  "config/addOpenAiKey": [string, void];
  "config/addModel": [
    {
      model: SerializedDebuggAiConfig["models"][number];
      role?: keyof ExperimentalModelRoles;
    },
    void,
  ];
  "config/newPromptFile": [undefined, void];
  "config/ideSettingsUpdate": [IdeSettings, void];
  "config/getSerializedProfileInfo": [
    undefined,
    {
      result: ConfigResult<BrowserSerializedDebuggAiConfig>;
      profileId: string | null;
    },
  ];
  "config/deleteModel": [{ title: string }, void];
  "config/addContextProvider": [ContextProviderWithParams, void];
  "config/reload": [undefined, ConfigResult<BrowserSerializedDebuggAiConfig>];
  "config/listProfiles": [
    undefined,
    { profiles: ProfileDescription[] | null; selectedProfileId: string | null },
  ];
  "config/refreshProfiles": [undefined, void];
  "config/openProfile": [{ profileId: string | undefined }, void];
  "config/updateSharedConfig": [SharedConfigSchema, SharedConfigSchema];
  "config/updateSelectedModel": [
    {
      profileId: string;
      role: ModelRole;
      title: string | null;
    },
    GlobalContextModelSelections,
  ];
  "context/getContextItems": [
    {
      name: string;
      query: string;
      fullInput: string;
      selectedCode: RangeInFile[];
      selectedModelTitle: string;
    },
    ContextItemWithId[],
  ];
  "context/getSymbolsForFiles": [{ uris: string[] }, FileSymbolMap];
  "context/loadSubmenuItems": [{ title: string }, ContextSubmenuItem[]];
  "autocomplete/complete": [AutocompleteInput, string[]];
  "context/addDocs": [SiteIndexingConfig, void];
  "context/removeDocs": [Pick<SiteIndexingConfig, "startUrl">, void];
  "context/indexDocs": [{ reIndex: boolean }, void];
  "autocomplete/cancel": [undefined, void];
  "autocomplete/accept": [{ completionId: string }, void];
  "command/run": [
    {
      input: string;
      history: ChatMessage[];
      modelTitle: string;
      slashCommandName: string;
      contextItems: ContextItemWithId[];
      params: any;
      historyIndex: number;
      selectedCode: RangeInFile[];
      completionOptions?: LLMFullCompletionOptions;
    },
    AsyncGenerator<string>,
  ];
  "llm/complete": [
    {
      prompt: string;
      completionOptions: LLMFullCompletionOptions;
      title: string;
    },
    string,
  ];
  "llm/listModels": [{ title: string }, string[] | undefined];
  "llm/streamComplete": [
    {
      prompt: string;
      completionOptions: LLMFullCompletionOptions;
      title: string;
    },
    AsyncGenerator<string>,
  ];
  "llm/streamChat": [
    {
      messages: ChatMessage[];
      completionOptions: LLMFullCompletionOptions;
      title: string;
    },
    AsyncGenerator<ChatMessage, PromptLog>,
  ];
  streamDiffLines: [
    {
      prefix: string;
      highlighted: string;
      suffix: string;
      input: string;
      language: string | undefined;
      modelTitle: string | undefined;
    },
    AsyncGenerator<DiffLine>,
  ];
  "chatDescriber/describe": [
    {
      selectedModelTitle: string;
      text: string;
    },
    string | undefined,
  ];
  "stats/getTokensPerDay": [
    undefined,
    { day: string; promptTokens: number; generatedTokens: number }[],
  ];
  "stats/getTokensPerModel": [
    undefined,
    { model: string; promptTokens: number; generatedTokens: number }[],
  ];
  "tts/kill": [undefined, void];

  // Codebase indexing
  "index/setPaused": [boolean, void];
  "index/forceReIndex": [
    undefined | { dirs?: string[]; shouldClearIndexes?: boolean },
    void,
  ];
  "index/indexingProgressBarInitialized": [undefined, void];
  completeOnboarding: [
    {
      mode: OnboardingModes;
    },
    void,
  ];

  // File changes
  "files/changed": [{ uris?: string[] }, void];
  "files/opened": [{ uris?: string[] }, void];
  "files/created": [{ uris?: string[] }, void];
  "files/deleted": [{ uris?: string[] }, void];
  "files/closed": [{ uris?: string[] }, void];

  // Docs etc. Indexing. TODO move codebase to this
  "indexing/reindex": [{ type: string; id: string }, void];
  "indexing/abort": [{ type: string; id: string }, void];
  "indexing/setPaused": [{ type: string; id: string; paused: boolean }, void];
  "docs/getSuggestedDocs": [undefined, void];
  "docs/initStatuses": [undefined, void];
  "docs/getDetails": [{ startUrl: string }, DocsIndexingDetails];
  addAutocompleteModel: [{ model: ModelDescription }, void];

  "auth/getAuthUrl": [{ useOnboarding: boolean }, { url: string }];
  "tools/call": [
    { toolCall: ToolCall; selectedModelTitle: string },
    { contextItems: ContextItem[] },
  ];
  "e2eTests/fetchE2eTests": [
    {filters: Record<string, any>, pagination: Record<string, any>, search: string}, 
    PaginatedResponse<E2eTest> | null
  ];
  "e2eTests/runE2eTest": [{ uuid: string }, E2eTestHandler];
  "e2eTests/deleteE2eTest": [{ uuid: string }, void];
  "e2eTests/create": [
    { description: string; filePath?: string; repoName?: string; branchName?: string }, 
    E2eTest | null
  ];
  
  // E2E Test Suites
  "e2eSuites/fetchE2eSuites": [
    {filters: Record<string, any>, pagination: Record<string, any>, search: string}, 
    PaginatedResponse<E2eTestSuite> | null
  ];
  "e2eSuites/run": [{ suiteId: string }, void];
  "e2eSuites/delete": [{ suiteId: string }, string];
  "e2eSuites/create": [
    { description: string; filePath?: string; repoName?: string; branchName?: string }, 
    E2eTestSuite | null
  ];
  
  // E2E Commit Suites
  "e2eCommitSuites/fetchE2eCommitSuites": [
    {filters: Record<string, any>, pagination: Record<string, any>, search: string}, 
    PaginatedResponse<E2eTestCommitSuite> | null
  ];
  "e2eCommitSuites/run": [{ commitSuiteId: string }, void];
  "e2eCommitSuites/delete": [{ commitSuiteId: string }, string];
  "e2eCommitSuites/create": [
    { description: string; commitHash?: string; branchName?: string; filePath?: string; repoName?: string }, 
    E2eTestCommitSuite | null
  ];
  "ideCommand/run": [{
    slashCommandName: string;
    params: any;
  }, void];
  "executeVSCodeCommand": [{ command: string; args?: any[] }, void];
  "clipboardCache/add": [{ content: string }, void];
  "controlPlane/openUrl": [{ path: string; orgSlug: string | undefined }, void];
  "controlPlane/listOrganizations": [undefined, OrganizationDescription[]];
};
