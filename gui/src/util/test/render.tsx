import type { RenderOptions } from "@testing-library/react";
import { render, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PropsWithChildren } from "react";
import { Provider } from "react-redux";
import { MemoryRouter, RouterProps } from "react-router-dom";
import { configureStore } from "@reduxjs/toolkit";
import { AuthProvider } from "../../context/Auth";
import { setupStore } from "../../redux/store";
import type { IIdeMessenger } from "../../context/IdeMessenger";
import configReducer from "../../redux/slices/configSlice";
import e2eCommitSuitesReducer from "../../redux/slices/e2eCommitSuitesSlice";
import e2eSuitesReducer from "../../redux/slices/e2eSuitesSlice";
import e2eTestsReducer from "../../redux/slices/e2eTestsSlice";
import editModeStateReducer from "../../redux/slices/editModeState";
import indexingReducer from "../../redux/slices/indexingSlice";
import miscReducer from "../../redux/slices/miscSlice";
import sessionReducer from "../../redux/slices/sessionSlice";
import tabsReducer from "../../redux/slices/tabsSlice";
import uiReducer from "../../redux/slices/uiSlice";
import { combineReducers } from "@reduxjs/toolkit";

const rootReducer = combineReducers({
  session: sessionReducer,
  e2eTests: e2eTestsReducer,
  e2eSuites: e2eSuitesReducer,
  e2eCommitSuites: e2eCommitSuitesReducer,
  misc: miscReducer,
  ui: uiReducer,
  editModeState: editModeStateReducer,
  config: configReducer,
  indexing: indexingReducer,
  tabs: tabsReducer,
});

// Create comprehensive mock IDE messenger
export function createMockIdeMessenger(overrides: Partial<IIdeMessenger> = {}): IIdeMessenger {
  const defaultMockMessenger = {
    request: vi.fn().mockImplementation((messageType: string) => {
      switch (messageType) {
        case 'getControlPlaneSessionInfo':
          return Promise.resolve({ 
            content: null,
            status: 'success'
          });
        case 'getIdeSettings':
          return Promise.resolve({ content: {}, status: 'success' });
        case 'config/listProfiles':
          return Promise.resolve({ content: [], status: 'success' });
        case 'e2eTests/fetchE2eTests':
        case 'e2eSuites/fetchE2eSuites':
        case 'e2eCommitSuites/fetchE2eCommitSuites':
          return Promise.resolve({ 
            content: { count: 0, next: null, previous: null, results: [] },
            status: 'success'
          });
        default:
          return Promise.resolve({ content: [], status: 'success' });
      }
    }),
    post: vi.fn(),
    respond: vi.fn(),
    streamRequest: vi.fn().mockReturnValue((async function*() { yield []; })()),
    llmStreamChat: vi.fn().mockReturnValue((async function*() { yield []; })()),
    
    // E2E Tests methods
    fetchE2eTests: vi.fn().mockResolvedValue({ count: 0, next: null, previous: null, results: [] }),
    createE2eTest: vi.fn().mockResolvedValue({ success: true }),
    runE2eTest: vi.fn().mockResolvedValue({ success: true }),
    deleteE2eTest: vi.fn().mockResolvedValue(undefined),
    
    // E2E Test Suites methods
    fetchE2eSuites: vi.fn().mockResolvedValue({ count: 0, next: null, previous: null, results: [] }),
    createE2eSuite: vi.fn().mockResolvedValue({ success: true }),
    runE2eSuite: vi.fn().mockResolvedValue(undefined),
    deleteE2eSuite: vi.fn().mockResolvedValue("deleted"),
    
    // E2E Commit Suites methods
    fetchE2eCommitSuites: vi.fn().mockResolvedValue({ count: 0, next: null, previous: null, results: [] }),
    getE2eCommitSuite: vi.fn().mockResolvedValue(null),
    createE2eCommitSuite: vi.fn().mockResolvedValue({ success: true }),
    runE2eCommitSuite: vi.fn().mockResolvedValue(undefined),
    deleteE2eCommitSuite: vi.fn().mockResolvedValue("deleted"),
    
    ide: {} as any,
    ...overrides,
  };

  return defaultMockMessenger;
}

// Function to create a test store with mock IDE messenger
function setupTestStore(mockIdeMessenger?: IIdeMessenger) {
  const defaultMockMessenger = mockIdeMessenger || createMockIdeMessenger();

  return configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
        thunk: {
          extraArgument: {
            ideMessenger: defaultMockMessenger,
          },
        },
      }),
  });
}

// This type interface extends the default options for render from RTL, as well
// as allows the user to specify other things such as initialState, store.
type ExtendedRenderOptions = Omit<RenderOptions, "queries"> & {
  store?: ReturnType<typeof setupTestStore>;
  routerProps?: RouterProps;
  mockIdeMessenger?: IIdeMessenger;
};

export function renderWithProviders(
  ui: React.ReactElement,
  extendedRenderOptions: ExtendedRenderOptions = {},
) {
  const {
    // Allow passing a mock IDE messenger
    mockIdeMessenger,
    // Automatically create a store instance if no store was passed in
    store = setupTestStore(mockIdeMessenger),
    routerProps = {},
    ...renderOptions
  } = extendedRenderOptions;

  const user = userEvent.setup();

  const Wrapper = ({ children }: PropsWithChildren) => (
    <MemoryRouter {...routerProps}>
      <Provider store={store}>
        <AuthProvider>{children}</AuthProvider>
      </Provider>
    </MemoryRouter>
  );

  // Wrap render in act to handle async operations
  let result: any;
  act(() => {
    result = render(ui, { wrapper: Wrapper, ...renderOptions });
  });

  // Return an object with the store and all of RTL's query functions
  return {
    user,
    store,
    mockIdeMessenger: mockIdeMessenger || createMockIdeMessenger(),
    ...result,
  };
}
