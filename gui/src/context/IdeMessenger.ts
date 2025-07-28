import { ChatMessage, IDE, LLMFullCompletionOptions, PromptLog } from "core";
import type { FromWebviewProtocol, ToWebviewProtocol } from "core/protocol";
import { Message } from "core/protocol/messenger";
import { MessageIde } from "core/protocol/messenger/messageIde";
import {
    GeneratorReturnType,
    GeneratorYieldType,
    WebviewProtocolGeneratorMessage,
    WebviewSingleMessage,
    WebviewSingleProtocolMessage
} from "core/protocol/util";
import { createContext } from "react";
import { v4 as uuidv4 } from "uuid";
import "vscode-webview";
import { isJetBrains } from "../util";

interface vscode {
  postMessage(message: any): vscode;
}

declare const vscode: any;

export interface IIdeMessenger {
  post<T extends keyof FromWebviewProtocol>(
    messageType: T,
    data: FromWebviewProtocol[T][0],
    messageId?: string,
    attempt?: number,
  ): void;

  respond<T extends keyof ToWebviewProtocol>(
    messageType: T,
    data: ToWebviewProtocol[T][1],
    messageId: string,
  ): void;

  request<T extends keyof FromWebviewProtocol>(
    messageType: T,
    data: FromWebviewProtocol[T][0],
  ): Promise<WebviewSingleProtocolMessage<T>>;

  streamRequest<T extends keyof FromWebviewProtocol>(
    messageType: T,
    data: FromWebviewProtocol[T][0],
    cancelToken?: AbortSignal,
  ): AsyncGenerator<
    GeneratorYieldType<FromWebviewProtocol[T][1]>[],
    GeneratorReturnType<FromWebviewProtocol[T][1]> | undefined
  >;

  llmStreamChat(
    modelTitle: string,
    cancelToken: AbortSignal | undefined,
    messages: ChatMessage[],
    options?: LLMFullCompletionOptions,
  ): AsyncGenerator<ChatMessage[], PromptLog | undefined>;

  // E2E Tests convenience methods
  fetchE2eTests(filters: Record<string, any>, pagination: Record<string, any>, search: string): Promise<any>;
  createE2eTest(data: { description: string; filePath?: string; repoName?: string; branchName?: string }): Promise<any>;
  runE2eTest(uuid: string): Promise<any>;
  deleteE2eTest(uuid: string): Promise<void>;

  // E2E Test Suites convenience methods
  fetchE2eSuites(filters: Record<string, any>, pagination: Record<string, any>, search: string): Promise<any>;
  createE2eSuite(data: { description: string; filePath?: string; repoName?: string; branchName?: string }): Promise<any>;
  runE2eSuite(suiteId: string): Promise<void>;
  deleteE2eSuite(suiteId: string): Promise<string>;

  // E2E Commit Suites convenience methods
  fetchE2eCommitSuites(filters: Record<string, any>, pagination: Record<string, any>, search: string): Promise<any>;
  getE2eCommitSuite(uuid: string): Promise<any>;
  createE2eCommitSuite(data: { description: string; commitHash?: string; branchName?: string; filePath?: string; repoName?: string }): Promise<any>;
  runE2eCommitSuite(commitSuiteId: string): Promise<void>;
  deleteE2eCommitSuite(commitSuiteId: string): Promise<string>;

  ide: IDE;
}

export class IdeMessenger implements IIdeMessenger {
  ide: IDE;

  constructor() {
    this.ide = new MessageIde(
      async (messageType, data) => {
        const result = await this.request(messageType, data);
        if (result.status === "error") {
          throw new Error(result.error);
        }
        return result.content;
      },
      () => {},
    );
  }

  private _postToIde(
    messageType: string,
    data: any,
    messageId: string = uuidv4(),
  ) {
    if (typeof vscode === "undefined") {
      if (isJetBrains()) {
        if (window.postIntellijMessage === undefined) {
          console.log(
            "Unable to send message: postIntellijMessage is undefined. ",
            messageType,
            data,
          );
          throw new Error("postIntellijMessage is undefined");
        }
        window.postIntellijMessage?.(messageType, data, messageId);
        return;
      } else {
        console.log(
          "Unable to send message: vscode is undefined",
          messageType,
          data,
        );
        return;
      }
    }

    const msg: Message = {
      messageId,
      messageType,
      data,
    };

    vscode.postMessage(msg);
  }

  post<T extends keyof FromWebviewProtocol>(
    messageType: T,
    data: FromWebviewProtocol[T][0],
    messageId?: string,
    attempt: number = 0,
  ) {
    try {
      this._postToIde(messageType, data, messageId);
    } catch (error) {
      if (attempt < 5) {
        console.log(`Attempt ${attempt} failed. Retrying...`);
        setTimeout(
          () => this.post(messageType, data, messageId, attempt + 1),
          Math.pow(2, attempt) * 1000,
        );
      } else {
        console.error(
          "Max attempts reached. Message could not be sent.",
          error,
        );
      }
    }
  }

  respond<T extends keyof ToWebviewProtocol>(
    messageType: T,
    data: ToWebviewProtocol[T][1],
    messageId: string,
  ) {
    this._postToIde(messageType, data, messageId);
  }

  request<T extends keyof FromWebviewProtocol>(
    messageType: T,
    data: FromWebviewProtocol[T][0],
  ): Promise<WebviewSingleMessage<T>> {
    const messageId = uuidv4();

    return new Promise((resolve) => {
      const handler = (event: any) => {
        if (event.data.messageId === messageId) {
          window.removeEventListener("message", handler);
          resolve(event.data.data as WebviewSingleMessage<T>);
        }
      };
      window.addEventListener("message", handler);

      this.post(messageType, data, messageId);
    });
  }

  /**
   * Because of weird type stuff, we're actually yielding an array of the things
   * that are streamed. For example, if the return type here says
   * AsyncGenerator<ChatMessage>, then it's actually AsyncGenerator<ChatMessage[]>.
   * This needs to be handled by the caller.
   *
   * Using unknown for now to make this more explicit
   */
  async *streamRequest<T extends keyof FromWebviewProtocol>(
    messageType: T,
    data: FromWebviewProtocol[T][0],
    cancelToken?: AbortSignal,
  ): AsyncGenerator<
    GeneratorYieldType<FromWebviewProtocol[T][1]>[],
    GeneratorReturnType<FromWebviewProtocol[T][1]> | undefined
  > {
    const messageId = uuidv4();

    this.post(messageType, data, messageId);

    const buffer: GeneratorYieldType<FromWebviewProtocol[T][1]>[] = [];
    let index = 0;
    let done = false;
    let returnVal: GeneratorReturnType<FromWebviewProtocol[T][1]> | undefined =
      undefined;
    let error: string | null = null;

    // This handler receieves individual WebviewMessengerResults
    // And pushes them to buffer
    const handler = (event: {
      data: Message<WebviewProtocolGeneratorMessage<T>>;
    }) => {
      if (event.data.messageId === messageId) {
        const responseData = event.data.data;
        if ("error" in responseData) {
          error = responseData.error;
          return;
          // throw new Error(responseData.error);
        }
        if (responseData.done) {
          window.removeEventListener("message", handler);
          done = true;
          returnVal = responseData.content;
        } else {
          buffer.push(responseData.content);
        }
      }
    };
    window.addEventListener("message", handler);

    const handleAbort = () => {
      this.post("abort", undefined, messageId);
    };
    cancelToken?.addEventListener("abort", handleAbort);

    try {
      while (!done) {
        if (error) {
          throw error;
        }
        if (buffer.length > index) {
          const chunks = buffer.slice(index);
          index = buffer.length;
          yield chunks;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      if (buffer.length > index) {
        const chunks = buffer.slice(index);
        yield chunks;
      }

      if (!returnVal) {
        return undefined;
      }
      return returnVal;
    } catch (e) {
      throw e;
    } finally {
      cancelToken?.removeEventListener("abort", handleAbort);
    }
  }

  async *llmStreamChat(
    modelTitle: string,
    cancelToken: AbortSignal | undefined,
    messages: ChatMessage[],
    options: LLMFullCompletionOptions = {},
  ): AsyncGenerator<ChatMessage[], PromptLog | undefined> {
    const gen = this.streamRequest(
      "llm/streamChat",
      {
        messages,
        title: modelTitle,
        completionOptions: options,
      },
      cancelToken,
    );

    let next = await gen.next();
    while (!next.done) {
      yield next.value;
      next = await gen.next();
    }
    return next.value;
  }

  // E2E Tests convenience methods
  async fetchE2eTests(filters: Record<string, any>, pagination: Record<string, any>, search: string) {
    const result = await this.request("e2eTests/fetchE2eTests", { filters, pagination, search });
    if (result.status === "error") throw new Error(result.error);
    return result.content;
  }

  async createE2eTest(data: { description: string; filePath?: string; repoName?: string; branchName?: string }) {
    const result = await this.request("e2eTests/create", data);
    if (result.status === "error") throw new Error(result.error);
    return result.content;
  }

  async runE2eTest(uuid: string) {
    const result = await this.request("e2eTests/runE2eTest", { uuid });
    if (result.status === "error") throw new Error(result.error);
    return result.content;
  }

  async deleteE2eTest(uuid: string): Promise<void> {
    const result = await this.request("e2eTests/deleteE2eTest", { uuid });
    if (result.status === "error") throw new Error(result.error);
    return;
  }

  // E2E Test Suites convenience methods
  async fetchE2eSuites(filters: Record<string, any>, pagination: Record<string, any>, search: string) {
    const result = await this.request("e2eSuites/fetchE2eSuites", { filters, pagination, search });
    if (result.status === "error") throw new Error(result.error);
    return result.content;
  }

  async createE2eSuite(data: { description: string; filePath?: string; repoName?: string; branchName?: string }) {
    const result = await this.request("e2eSuites/create", data);
    if (result.status === "error") throw new Error(result.error);
    return result.content;
  }

  async runE2eSuite(suiteId: string): Promise<void> {
    const result = await this.request("e2eSuites/run", { suiteId });
    if (result.status === "error") throw new Error(result.error);
    return;
  }

  async deleteE2eSuite(suiteId: string) {
    const result = await this.request("e2eSuites/delete", { suiteId });
    if (result.status === "error") throw new Error(result.error);
    return result.content;
  }

  // E2E Commit Suites convenience methods
  async fetchE2eCommitSuites(filters: Record<string, any>, pagination: Record<string, any>, search: string) {
    const result = await this.request("e2eCommitSuites/fetchE2eCommitSuites", { filters, pagination, search });
    if (result.status === "error") throw new Error(result.error);
    return result.content;
  }

  async getE2eCommitSuite(uuid: string) {
    const result = await this.request("e2eCommitSuites/getE2eCommitSuite", { uuid });
    if (result.status === "error") throw new Error(result.error);
    return result.content;
  }

  async createE2eCommitSuite(data: { description: string; commitHash?: string; branchName?: string; filePath?: string; repoName?: string }) {
    const result = await this.request("e2eCommitSuites/create", data);
    if (result.status === "error") throw new Error(result.error);
    return result.content;
  }

  async runE2eCommitSuite(commitSuiteId: string): Promise<void> {
    const result = await this.request("e2eCommitSuites/run", { commitSuiteId });
    if (result.status === "error") throw new Error(result.error);
    return;
  }

  async deleteE2eCommitSuite(commitSuiteId: string) {
    const result = await this.request("e2eCommitSuites/delete", { commitSuiteId });
    if (result.status === "error") throw new Error(result.error);
    return result.content;
  }
}

export const IdeMessengerContext = createContext<IIdeMessenger>(
  new IdeMessenger(),
);
