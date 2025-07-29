import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { E2eTestCommitSuite, PaginatedResponse } from "core/debuggAIServer/types";
import { deleteE2eCommitSuite, fetchE2eCommitSuites, getE2eCommitSuite, runE2eCommitSuite } from "../thunks/e2eCommitSuitesThunks";

// Types for pagination and filters
export interface Pagination {
  page: number;
  pageSize: number;
}

export interface E2eCommitSuitesState {
  items: E2eTestCommitSuite[];
  commitSuitesList: PaginatedResponse<E2eTestCommitSuite> | null;
  commitSuiteDetail: E2eTestCommitSuite | null;
  loading: boolean;
  error: string | null;
  currentFilters: Record<string, any>;
  currentPagination: Pagination;
}

const initialState: E2eCommitSuitesState = {
  items: [],
  commitSuitesList: null,
  commitSuiteDetail: null,
  loading: false,
  error: null,
  currentFilters: {},
  currentPagination: { page: 1, pageSize: 10 },
};

const e2eCommitSuitesSlice = createSlice({
  name: "e2eCommitSuites",
  initialState,
  reducers: {
    setCurrentPagination(state, action: PayloadAction<Pagination>) {
      state.currentPagination = action.payload;
    },
    setCurrentFilters(state, action: PayloadAction<Record<string, any>>) {
      state.currentFilters = action.payload;
    },
    setCommitSuiteDetail(state, action: PayloadAction<E2eTestCommitSuite | null>) {
      state.commitSuiteDetail = action.payload;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchE2eCommitSuites.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchE2eCommitSuites.fulfilled, (state, action) => {
        state.loading = false;
        state.commitSuitesList = action.payload;
        state.items = action.payload?.results ?? [];
      })
      .addCase(fetchE2eCommitSuites.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to fetch E2E commit suites";
      })
      .addCase(getE2eCommitSuite.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getE2eCommitSuite.fulfilled, (state, action) => {
        state.loading = false;
        state.commitSuiteDetail = action.payload;
      })
      .addCase(getE2eCommitSuite.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to get E2E commit suite";
      })
      .addCase(runE2eCommitSuite.pending, (state) => {
        state.loading = true;
      })
      .addCase(runE2eCommitSuite.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(runE2eCommitSuite.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to run E2E commit suite";
      })

      .addCase(deleteE2eCommitSuite.pending, (state) => {
        state.loading = true;
      })
      .addCase(deleteE2eCommitSuite.fulfilled, (state, action) => {
        state.loading = false;
        state.items = state.items.filter((suite) => suite.uuid !== action.payload);
        if (state.commitSuitesList) {
          state.commitSuitesList.results = state.commitSuitesList.results.filter((suite) => suite.uuid !== action.payload);
          state.commitSuitesList.count -= 1;
        }
      })
      .addCase(deleteE2eCommitSuite.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to delete E2E commit suite";
      });
  },
});

export const { setCurrentPagination, setCurrentFilters, setCommitSuiteDetail, setLoading, setError } = e2eCommitSuitesSlice.actions;
export default e2eCommitSuitesSlice.reducer; 