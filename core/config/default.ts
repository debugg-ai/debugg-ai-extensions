import {
  CollectionVectorMetric,
  ContextProviderWithParams,
  ModelDescription,
  SerializedDebuggAiConfig,
  SlashCommandDescription,
} from "../";

export const FREE_TRIAL_MODELS: ModelDescription[] = [
  {
    title: "Claude 3.5 Sonnet (Free Trial)",
    provider: "free-trial",
    model: "claude-3-5-sonnet-latest",
    systemMessage:
      "You are an expert software developer. You give helpful and concise responses.",
  },
  {
    title: "GPT-4o (Free Trial)",
    provider: "free-trial",
    model: "gpt-4o",
    systemMessage:
      "You are an expert software developer. You give helpful and concise responses.",
  },
  {
    title: "Llama3.1 70b (Free Trial)",
    provider: "free-trial",
    model: "llama3.1-70b",
    systemMessage:
      "You are an expert software developer. You give helpful and concise responses.",
  },
  {
    title: "Codestral (Free Trial)",
    provider: "free-trial",
    model: "codestral-latest",
    systemMessage:
      "You are an expert software developer. You give helpful and concise responses.",
  },
];

export const defaultContextProvidersVsCode: ContextProviderWithParams[] = [
  { name: "code", params: {} },
  { name: "docs", params: {} },
  { name: "diff", params: {} },
  { name: "terminal", params: {} },
  { name: "problems", params: {} },
  { name: "folder", params: {} },
  { name: "codebase", params: {} },
];

export const defaultContextProvidersJetBrains: ContextProviderWithParams[] = [
  { name: "diff", params: {} },
  { name: "folder", params: {} },
  { name: "codebase", params: {} },
];

export const defaultSlashCommandsVscode: SlashCommandDescription[] = [
  {
    name: "share",
    description: "Export the current chat session to markdown",
  },
  {
    name: "cmd",
    description: "Generate a shell command",
  },
  {
    name: "commit",
    description: "Generate a git commit message",
  },
];

export const defaultSlashCommandsJetBrains = [
  {
    name: "share",
    description: "Export the current chat session to markdown",
  },
  {
    name: "commit",
    description: "Generate a git commit message",
  },
];

const defaultVectorDatabaseOpts = {
  provider: "astradb",
  apiKey: "",
  keyspace: "default_keyspace",
  endpoint: "",
  metric: "cosine" as CollectionVectorMetric,
};

const defaultEmbeddingsProvider = {
  provider: "openai",
  apiKey: "",
  model: "text-embedding-3-small",
  maxEmbeddingChunkSize: 512,
};

export const defaultConfig: SerializedDebuggAiConfig = {
  debuggAiServerPort: 3000,
  models: [],
  contextProviders: defaultContextProvidersVsCode,
  slashCommands: defaultSlashCommandsVscode,
  embeddingsProvider: defaultEmbeddingsProvider,
  vectorDatabaseOpts: defaultVectorDatabaseOpts,
  data: [],
};

export const defaultConfigJetBrains: SerializedDebuggAiConfig = {
  debuggAiServerPort: 3000,
  models: [],
  contextProviders: defaultContextProvidersJetBrains,
  slashCommands: defaultSlashCommandsJetBrains,
  vectorDatabaseOpts: defaultVectorDatabaseOpts,
  data: [],
};
