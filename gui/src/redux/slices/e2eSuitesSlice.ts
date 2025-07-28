import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { E2eTestSuite, PaginatedResponse } from "core/debuggAIServer/types";
import { deleteE2eSuite, fetchE2eSuites, runE2eSuite } from "../thunks/e2eSuitesThunks";

// Types for pagination and filters
export interface Pagination {
  page: number;
  pageSize: number;
}

export interface E2eSuitesState {
  items: E2eTestSuite[];
  suitesList: PaginatedResponse<E2eTestSuite> | null;
  loading: boolean;
  error: string | null;
  currentFilters: Record<string, any>;
  currentPagination: Pagination;
}

const initialState: E2eSuitesState = {
  items: [],
  suitesList: null,
  loading: false,
  error: null,
  currentFilters: {},
  currentPagination: { page: 1, pageSize: 10 },
};

const e2eSuitesSlice = createSlice({
  name: "e2eSuites",
  initialState,
  reducers: {
    setCurrentPagination(state, action: PayloadAction<Pagination>) {
      state.currentPagination = action.payload;
    },
    setCurrentFilters(state, action: PayloadAction<Record<string, any>>) {
      state.currentFilters = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchE2eSuites.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchE2eSuites.fulfilled, (state, action) => {
        state.loading = false;
        state.suitesList = action.payload;
        state.items = action.payload?.results ?? [];
      })
      .addCase(fetchE2eSuites.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to fetch E2E suites";
      })

      .addCase(runE2eSuite.pending, (state) => {
        state.loading = true;
      })
      .addCase(runE2eSuite.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(runE2eSuite.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to run E2E suite";
      })

      .addCase(deleteE2eSuite.pending, (state) => {
        state.loading = true;
      })
      .addCase(deleteE2eSuite.fulfilled, (state, action) => {
        state.loading = false;
        state.items = state.items.filter((suite) => suite.uuid !== action.payload);
        if (state.suitesList) {
          state.suitesList.results = state.suitesList.results.filter((suite) => suite.uuid !== action.payload);
          state.suitesList.count -= 1;
        }
      })
      .addCase(deleteE2eSuite.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to delete E2E suite";
      });
  },
});

export const { setCurrentPagination, setCurrentFilters } = e2eSuitesSlice.actions;
export default e2eSuitesSlice.reducer; 