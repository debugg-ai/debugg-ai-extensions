import { createAsyncThunk } from "@reduxjs/toolkit";
import type { E2eTestCommitSuite, PaginatedResponse } from "core/debuggAIServer/types";
import type { ThunkApiType } from "../store";

// Fetch E2E Commit Suites list
export const fetchE2eCommitSuites = createAsyncThunk<
  PaginatedResponse<E2eTestCommitSuite>,
  { filters: Record<string, any>; pagination: { page: number; pageSize: number }; search?: string },
  ThunkApiType
>(
  "e2eCommitSuites/fetchE2eCommitSuites",
  async ({ filters, pagination, search = "" }, { extra }) => {
    console.log("fetching E2eCommitSuites...", { filters, pagination, search });

    const result = await extra.ideMessenger.request("e2eCommitSuites/fetchE2eCommitSuites", {
      filters,
      pagination,
      search,
    });

    if (result?.status === "error") {
      throw new Error(result.error);
    }

    return (
      result?.content ?? { count: 0, next: null, previous: null, results: [] }
    );
  }
);

// Get E2E Commit Suite
export const getE2eCommitSuite = createAsyncThunk<
  E2eTestCommitSuite | null,
  string,
  ThunkApiType
>(
  "e2eCommitSuites/getE2eCommitSuite",
  async (uuid, { extra }) => {
    const result = await extra.ideMessenger.request("e2eCommitSuites/getE2eCommitSuite", { uuid });

    if (result?.status === "error") {
      throw new Error(result.error);
    } 

    return result?.content;
  }
);

// Run E2E Commit Suite
export const runE2eCommitSuite = createAsyncThunk<
  void,
  string,
  ThunkApiType
>(
  "e2eCommitSuites/run",
  async (commitSuiteId, { extra }) => {
    console.log("running E2eCommitSuite...", commitSuiteId);

    const result = await extra.ideMessenger.request("e2eCommitSuites/run", {
      commitSuiteId,
    });

    if (result?.status === "error") {
      throw new Error(result.error);
    }

    return result?.content;
  }
);

// Create E2E Commit Suite
export const createE2eCommitSuite = createAsyncThunk<
  E2eTestCommitSuite | null,
  { description: string; commitHash?: string; branchName?: string; filePath?: string; repoName?: string },
  ThunkApiType
>(
  "e2eCommitSuites/create",
  async ({ description, commitHash, branchName, filePath, repoName }, { extra }) => {
    const result = await extra.ideMessenger.request("e2eCommitSuites/create", {
      description,
      commitHash,
      branchName,
      filePath,
      repoName,
    });

    if (result?.status === "error") {
      throw new Error(result.error);
    }

    return result.content;
  }
);

// Delete E2E Commit Suite
export const deleteE2eCommitSuite = createAsyncThunk<
  string,
  string,
  ThunkApiType
>(
  "e2eCommitSuites/delete",
  async (commitSuiteId, { extra }) => {
    console.log("deleting E2eCommitSuite...", commitSuiteId);

    const result = await extra.ideMessenger.request("e2eCommitSuites/delete", {
      commitSuiteId,
    });

    if (result?.status === "error") {
      throw new Error(result.error);
    }

    return commitSuiteId;
  }
); 