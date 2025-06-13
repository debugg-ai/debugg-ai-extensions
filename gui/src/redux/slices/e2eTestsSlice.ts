import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { E2eTest, PaginatedResponse } from "core/debuggAIServer/types";
import E2eTestHandler from "core/e2es/e2eTestHandler";
import { deleteE2eTest, fetchE2eTests, runE2eTest } from "../thunks/e2eTestsThunks";

// Types for pagination and filters
export interface Pagination {
  page: number;
  pageSize: number;
}

export interface E2eTestsState {
  items: E2eTest[];
  testsList: PaginatedResponse<E2eTest> | null;
  loading: boolean;
  error: string | null;
  currentFilters: Record<string, any>;
  currentPagination: Pagination;
  e2eTestHandler: E2eTestHandler | null;
}

const initialState: E2eTestsState = {
  items: [],
  testsList: null,
  loading: false,
  error: null,
  currentFilters: {},
  currentPagination: { page: 1, pageSize: 10 },
  e2eTestHandler: null,
};

const e2eTestsSlice = createSlice({
  name: "e2eTests",
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
      .addCase(fetchE2eTests.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchE2eTests.fulfilled, (state, action) => {
        state.loading = false;
        state.testsList = action.payload;
        state.items = action.payload?.results ?? [];
      })
      .addCase(fetchE2eTests.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to fetch E2E tests";
      })

      .addCase(runE2eTest.pending, (state) => {
        state.loading = true;
      })
      .addCase(runE2eTest.fulfilled, (state, action) => {
        state.loading = false;
        state.e2eTestHandler = action.payload;
      })
      .addCase(runE2eTest.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to run E2E test";
      })

      .addCase(deleteE2eTest.pending, (state) => {
        state.loading = true;
      })
      .addCase(deleteE2eTest.fulfilled, (state, action) => {
        state.loading = false;
        state.items = state.items.filter((test) => test.uuid !== action.payload);
        if (state.testsList) {
          state.testsList.results = state.testsList.results.filter((test) => test.uuid !== action.payload);
          state.testsList.count -= 1;
        }
      })
      .addCase(deleteE2eTest.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to delete E2E test";
      });
  },
});

export const { setCurrentPagination, setCurrentFilters } = e2eTestsSlice.actions;
export default e2eTestsSlice.reducer;
