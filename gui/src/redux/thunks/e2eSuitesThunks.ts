import { createAsyncThunk } from "@reduxjs/toolkit";
import type { E2eTestSuite, PaginatedResponse } from "core/debuggAIServer/types";
import type { ThunkApiType } from "../store";

// Fetch E2E Suites list
export const fetchE2eSuites = createAsyncThunk<
  PaginatedResponse<E2eTestSuite>,
  { filters: Record<string, any>; pagination: { page: number; pageSize: number }; search?: string },
  ThunkApiType
>(
  "e2eSuites/fetchE2eSuites",
  async ({ filters, pagination, search = "" }, { extra }) => {
    console.log("fetching E2eSuites...", { filters, pagination, search });

    const result = await extra.ideMessenger.request("e2eSuites/fetchE2eSuites", {
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

// Get E2E Suite
export const getE2eSuite = createAsyncThunk<
  E2eTestSuite | null,
  string,
  ThunkApiType
>(
  "e2eSuites/getE2eSuite",
  async (uuid, { extra }) => {
    const result = await extra.ideMessenger.request("e2eSuites/getE2eSuite", { uuid });

    if (result?.status === "error") {
      throw new Error(result.error);
    } 

    return result?.content;
  }
);

// Run E2E Suite
export const runE2eSuite = createAsyncThunk<
  void,
  string,
  ThunkApiType
>(
  "e2eSuites/run",
  async (suiteId, { extra }) => {
    console.log("running E2eSuite...", suiteId);

    const result = await extra.ideMessenger.request("e2eSuites/run", {
      suiteId,
    });

    if (result?.status === "error") {
      throw new Error(result.error);
    }

    return result?.content;
  }
);

// Create E2E Suite - IDE handles user input
export const createE2eSuiteWithIdeInput = createAsyncThunk<
  E2eTestSuite | null,
  void,
  ThunkApiType
>(
  "e2eSuites/createWithIdeInput",
  async (_, { extra }) => {
    console.log("requesting IDE to create E2E suite...");

    const result = await extra.ideMessenger.request("e2eSuites/create", {
      description: "", // Empty description signals IDE to prompt for input
      filePath: undefined,
      repoName: undefined,
      branchName: undefined
    });

    if (result?.status === "error") {
      throw new Error(result.error);
    }

    return result?.content;
  }
);

// Create E2E Suite - with provided data
export const createE2eSuite = createAsyncThunk<
  E2eTestSuite | null,
  { description: string; filePath?: string; repoName?: string; branchName?: string },
  ThunkApiType
>(
  "e2eSuites/create",
  async ({ description, filePath, repoName, branchName }, { extra }) => {
    const result = await extra.ideMessenger.request("e2eSuites/create", {
      description,
      filePath,
      repoName,
      branchName,
    });

    if (result?.status === "error") {
      throw new Error(result.error);
    }

    return result.content;
  }
);

// Delete E2E Suite
export const deleteE2eSuite = createAsyncThunk<
  string,
  string,
  ThunkApiType
>(
  "e2eSuites/delete",
  async (suiteId, { extra }) => {
    console.log("deleting E2eSuite...", suiteId);

    const result = await extra.ideMessenger.request("e2eSuites/delete", {
      suiteId,
    });

    if (result?.status === "error") {
      throw new Error(result.error);
    }

    return suiteId;
  }
); 