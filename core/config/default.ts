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
  apiKey: "AstraCS:kAnWaLElxFqnZOYTTbKzFguI:d30a895f46d7ff5c52eccf9aa74def9e3aeaebc2e200a591e416a516b4e595e1",
  endpoint: "https://1e17d4f9-5e55-499f-9fab-9a6834f1bf65-us-east-2.apps.astra.datastax.com",
  keyspace: "default_keyspace",
  metric: "cosine" as CollectionVectorMetric,
};

const defaultEmbeddingsProvider = {
  provider: "openai",
  apiKey: "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",
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
