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

// Run E2E Suite
export const runE2eSuite = createAsyncThunk<
  void,
  string,
  ThunkApiType
>(
  "e2eSuites/runE2eSuite",
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

// Delete E2E Suite
export const deleteE2eSuite = createAsyncThunk<
  string,
  string,
  ThunkApiType
>(
  "e2eSuites/deleteE2eSuite",
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