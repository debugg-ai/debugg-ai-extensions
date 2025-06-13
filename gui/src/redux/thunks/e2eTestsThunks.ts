import { createAsyncThunk } from "@reduxjs/toolkit";
import type { E2eRun, E2eTest, PaginatedResponse } from "core/debuggAIServer/types";
import type { ThunkApiType } from "../store";

// Fetch E2E Tests list
export const fetchE2eTests = createAsyncThunk<
  PaginatedResponse<E2eTest>,
  { filters: Record<string, any>; pagination: { page: number; pageSize: number }; search?: string },
  ThunkApiType
>(
  "e2eTests/fetchE2eTests",
  async ({ filters, pagination, search = "" }, { extra }) => {
    console.log("fetching E2eTests...", { filters, pagination, search });

    const result = await extra.ideMessenger.request("e2eTests/fetchE2eTests", {
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

// Run E2E Test
export const runE2eTest = createAsyncThunk<
  E2eRun,
  { uuid: string },
  ThunkApiType
>(
  "e2eTests/runE2eTest",
  async ({ uuid }, { extra }) => {
    const result = await extra.ideMessenger.request("e2eTests/runE2eTest", { uuid });

    if (result?.status === "error") {
      throw new Error(result.error);
    }

    return result as unknown as E2eRun;
  }
);

// Delete E2E Test
export const deleteE2eTest = createAsyncThunk<
  string,
  { uuid: string },
  ThunkApiType
>(
  "e2eTests/deleteE2eTest",
  async ({ uuid }, { extra }) => {
    const result = await extra.ideMessenger.request("e2eTests/deleteE2eTest", { uuid });

    if (result?.status === "error") {
      throw new Error(result.error);
    }

    return uuid;
  }
);
