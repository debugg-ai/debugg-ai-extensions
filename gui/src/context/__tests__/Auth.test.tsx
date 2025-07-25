import { configureStore } from '@reduxjs/toolkit';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import configSlice from '../../redux/slices/configSlice';
import miscSlice from '../../redux/slices/miscSlice';
import sessionSlice from '../../redux/slices/sessionSlice';
import uiSlice from '../../redux/slices/uiSlice';
import { AuthProvider, useAuth } from '../Auth';
import { IdeMessengerContext } from '../IdeMessenger';

// Mock the webview listener hook
vi.mock('../../hooks/useWebviewListener', () => ({
  useWebviewListener: vi.fn(),
}));

// Create a test component that uses the Auth context
const TestAuthComponent: React.FC = () => {
  const auth = useAuth();
  
  return (
    <div>
      <div data-testid="session-status">
        {auth.session ? 'authenticated' : 'unauthenticated'}
      </div>
      <div data-testid="user-email">
        {auth.session?.account?.label || 'no-email'}
      </div>
      <div data-testid="user-id">
        {auth.session?.account?.id || 'no-id'}
      </div>
      <div data-testid="selected-profile">
        {auth.selectedProfile?.title || 'no-profile'}
      </div>
      <div data-testid="organizations-count">
        {auth.organizations.length}
      </div>
      <div data-testid="selected-organization">
        {auth.selectedOrganization?.name || 'no-organization'}
      </div>
      <button data-testid="login-btn" onClick={() => auth.login(false)}>
        Login
      </button>
      <button data-testid="logout-btn" onClick={auth.logout}>
        Logout
      </button>
      <button data-testid="refresh-profiles-btn" onClick={auth.refreshProfiles}>
        Refresh Profiles
      </button>
      <div data-testid="control-server-beta">
        {auth.controlServerBetaEnabled ? 'enabled' : 'disabled'}
      </div>
    </div>
  );
};

// Mock IdeMessenger
class MockIdeMessenger {
  public requestHandlers: Map<string, any> = new Map();
  public postHandlers: Map<string, any> = new Map();
  public webviewListeners: Map<string, Function[]> = new Map();

  request = vi.fn().mockImplementation((messageType: string, data: any) => {
    const handler = this.requestHandlers.get(messageType);
    if (handler) {
      return Promise.resolve(handler(data));
    }
    return Promise.resolve({ status: 'error', error: 'No handler' });
  });

  post = vi.fn().mockImplementation((messageType: string, data: any) => {
    const handlers = this.postHandlers.get(messageType);
    if (handlers) {
      handlers.forEach((handler: Function) => handler(data));
    }
  });

  ide = {
    getIdeSettings: vi.fn().mockResolvedValue({
      enableControlServerBeta: false,
      debuggAiTestEnvironment: 'test'
    })
  };

  respond = vi.fn();

  // Helper to simulate webview messages
  simulateWebviewMessage(messageType: string, data: any) {
    const listeners = this.webviewListeners.get(messageType) || [];
    listeners.forEach(listener => listener(data));
  }

  // Helper to set up request handlers
  setRequestHandler(messageType: string, handler: Function) {
    this.requestHandlers.set(messageType, handler);
  }

  // Helper to set up post handlers
  setPostHandler(messageType: string, handler: Function) {
    if (!this.postHandlers.has(messageType)) {
      this.postHandlers.set(messageType, []);
    }
    this.postHandlers.get(messageType)!.push(handler);
  }

  // Helper to register webview listeners
  addWebviewListener(messageType: string, listener: Function) {
    if (!this.webviewListeners.has(messageType)) {
      this.webviewListeners.set(messageType, []);
    }
    this.webviewListeners.get(messageType)!.push(listener);
  }
}

describe('Auth Context', () => {
  let mockIdeMessenger: MockIdeMessenger;
  let store: any;
  let mockUseWebviewListener: any;

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <Provider store={store}>
        <IdeMessengerContext.Provider value={mockIdeMessenger as any}>
          <AuthProvider>
            {component}
          </AuthProvider>
        </IdeMessengerContext.Provider>
      </Provider>
    );
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Set up mock for useWebviewListener
    mockUseWebviewListener = require('../../hooks/useWebviewListener').useWebviewListener;
    mockUseWebviewListener.mockImplementation((messageType: string, handler: Function) => {
      mockIdeMessenger.addWebviewListener(messageType, handler);
    });

    // Create mock IDE messenger
    mockIdeMessenger = new MockIdeMessenger();

    // Create Redux store with required slices
    store = configureStore({
      reducer: {
        session: sessionSlice,
        config: configSlice,
        ui: uiSlice,
        misc: miscSlice
      },
      preloadedState: {
        session: {
          organizations: [],
          selectedOrganizationId: null,
          availableProfiles: [],
          selectedProfile: null,
          history: [],
          contextItems: [],
          isStreaming: false,
          lastSessionId: null,
          codeToEdit: undefined,
          codeBlockApplyStates: { states: [] }
        },
        config: {
          config: {},
          profileId: null
        },
        ui: {
          showDialog: false,
          dialogMessage: undefined,
          hasDismissedExploreDialog: false,
          ttsActive: false
        },
        misc: {
          lastControlServerBetaEnabledStatus: false
        }
      }
    });
  });

  describe('initialization', () => {
    it('should start with no session', () => {
      mockIdeMessenger.setRequestHandler('getControlPlaneSessionInfo', () => ({
        status: 'success',
        content: null
      }));

      renderWithProviders(<TestAuthComponent />);

      expect(screen.getByTestId('session-status')).toHaveTextContent('unauthenticated');
      expect(screen.getByTestId('user-email')).toHaveTextContent('no-email');
      expect(screen.getByTestId('user-id')).toHaveTextContent('no-id');
    });

    it('should load existing session on initialization', async () => {
      const mockSession = {
        account: {
          id: 'test-user-id',
          label: 'test@example.com'
        },
        accessToken: 'mock-access-token',
        workspaceId: 'workspace-123'
      };

      mockIdeMessenger.setRequestHandler('getControlPlaneSessionInfo', () => ({
        status: 'success',
        content: mockSession
      }));

      renderWithProviders(<TestAuthComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('session-status')).toHaveTextContent('authenticated');
        expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
        expect(screen.getByTestId('user-id')).toHaveTextContent('test-user-id');
      });
    });

    it('should load IDE settings and set control server beta status', async () => {
      mockIdeMessenger.ide.getIdeSettings.mockResolvedValue({
        enableControlServerBeta: true,
        debuggAiTestEnvironment: 'production'
      });

      renderWithProviders(<TestAuthComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('control-server-beta')).toHaveTextContent('enabled');
      });
    });

    it('should load profiles on initialization', async () => {
      const mockProfiles = [
        { id: 'profile1', title: 'Profile 1' },
        { id: 'profile2', title: 'Profile 2' }
      ];

      mockIdeMessenger.setRequestHandler('config/listProfiles', () => ({
        status: 'success',
        content: {
          profiles: mockProfiles,
          selectedProfileId: 'profile1'
        }
      }));

      // Set up the store to have a selected profile
      store.dispatch({
        type: 'session/updateAvailableProfiles',
        payload: {
          profiles: mockProfiles,
          selectedProfileId: 'profile1'
        }
      });

      store.dispatch({
        type: 'session/setSelectedProfile',
        payload: mockProfiles[0]
      });

      renderWithProviders(<TestAuthComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('selected-profile')).toHaveTextContent('Profile 1');
      });
    });
  });

  describe('authentication flow', () => {
    it('should handle successful login', async () => {
      const user = userEvent.setup();
      const mockSession = {
        account: {
          id: 'new-user-id',
          label: 'newuser@example.com'
        },
        accessToken: 'new-access-token',
        workspaceId: 'new-workspace'
      };

      mockIdeMessenger.setRequestHandler('getControlPlaneSessionInfo', (params) => {
        if (params.silent === false) {
          return {
            status: 'success',
            content: mockSession
          };
        }
        return {
          status: 'success',
          content: null
        };
      });

      renderWithProviders(<TestAuthComponent />);

      // Initially unauthenticated
      expect(screen.getByTestId('session-status')).toHaveTextContent('unauthenticated');

      // Click login
      await user.click(screen.getByTestId('login-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('session-status')).toHaveTextContent('authenticated');
        expect(screen.getByTestId('user-email')).toHaveTextContent('newuser@example.com');
        expect(screen.getByTestId('user-id')).toHaveTextContent('new-user-id');
      });

      expect(mockIdeMessenger.request).toHaveBeenCalledWith('getControlPlaneSessionInfo', {
        silent: false,
        useOnboarding: false
      });
    });

    it('should handle login with onboarding', async () => {
      const TestOnboardingComponent: React.FC = () => {
        const auth = useAuth();
        return (
          <button 
            data-testid="onboarding-login-btn" 
            onClick={() => auth.login(true)}
          >
            Onboarding Login
          </button>
        );
      };

      const user = userEvent.setup();
      
      mockIdeMessenger.setRequestHandler('getControlPlaneSessionInfo', (params) => ({
        status: 'success',
        content: {
          account: { id: 'onboard-user', label: 'onboard@example.com' },
          accessToken: 'onboard-token'
        }
      }));

      renderWithProviders(<TestOnboardingComponent />);

      await user.click(screen.getByTestId('onboarding-login-btn'));

      expect(mockIdeMessenger.request).toHaveBeenCalledWith('getControlPlaneSessionInfo', {
        silent: false,
        useOnboarding: true
      });
    });

    it('should handle login failure', async () => {
      const user = userEvent.setup();

      mockIdeMessenger.setRequestHandler('getControlPlaneSessionInfo', () => ({
        status: 'error',
        error: 'Authentication failed'
      }));

      renderWithProviders(<TestAuthComponent />);

      await user.click(screen.getByTestId('login-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('session-status')).toHaveTextContent('unauthenticated');
      });
    });

    it('should handle logout flow', async () => {
      const user = userEvent.setup();
      
      // Start with authenticated session
      const mockSession = {
        account: { id: 'user-id', label: 'user@example.com' },
        accessToken: 'access-token'
      };

      mockIdeMessenger.setRequestHandler('getControlPlaneSessionInfo', () => ({
        status: 'success',
        content: mockSession
      }));

      renderWithProviders(<TestAuthComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('session-status')).toHaveTextContent('authenticated');
      });

      // Click logout - this should show confirmation dialog
      await user.click(screen.getByTestId('logout-btn'));

      expect(store.getState().ui.showDialog).toBe(true);
      expect(store.getState().ui.dialogMessage).toBeDefined();
    });
  });

  describe('webview message handling', () => {
    it('should update session when receiving didChangeControlPlaneSessionInfo', async () => {
      renderWithProviders(<TestAuthComponent />);

      // Initially unauthenticated
      expect(screen.getByTestId('session-status')).toHaveTextContent('unauthenticated');

      // Simulate session change from extension
      const newSession = {
        account: { id: 'webview-user', label: 'webview@example.com' },
        accessToken: 'webview-token'
      };

      act(() => {
        mockIdeMessenger.simulateWebviewMessage('didChangeControlPlaneSessionInfo', {
          sessionInfo: newSession
        });
      });

      await waitFor(() => {
        expect(screen.getByTestId('session-status')).toHaveTextContent('authenticated');
        expect(screen.getByTestId('user-email')).toHaveTextContent('webview@example.com');
      });
    });

    it('should clear organizations on logout via webview', async () => {
      // Start with session and organizations
      store.dispatch({
        type: 'session/updateOrganizations',
        payload: [
          { id: 'org1', name: 'Organization 1' },
          { id: 'org2', name: 'Organization 2' }
        ]
      });

      renderWithProviders(<TestAuthComponent />);

      expect(screen.getByTestId('organizations-count')).toHaveTextContent('2');

      // Simulate logout via webview
      act(() => {
        mockIdeMessenger.simulateWebviewMessage('didChangeControlPlaneSessionInfo', {
          sessionInfo: null
        });
      });

      await waitFor(() => {
        expect(screen.getByTestId('session-status')).toHaveTextContent('unauthenticated');
        expect(screen.getByTestId('organizations-count')).toHaveTextContent('0');
      });
    });

    it('should update profiles when receiving didChangeAvailableProfiles', async () => {
      renderWithProviders(<TestAuthComponent />);

      const newProfiles = [
        { id: 'profile1', title: 'Updated Profile 1' },
        { id: 'profile2', title: 'Updated Profile 2' }
      ];

      // Simulate profile update from extension
      act(() => {
        mockIdeMessenger.simulateWebviewMessage('didChangeAvailableProfiles', {
          profiles: newProfiles,
          selectedProfileId: 'profile1'
        });
      });

      await waitFor(() => {
        expect(store.getState().session.availableProfiles).toEqual(newProfiles);
      });
    });

    it('should update IDE settings when receiving didChangeIdeSettings', async () => {
      renderWithProviders(<TestAuthComponent />);

      // Initially disabled
      expect(screen.getByTestId('control-server-beta')).toHaveTextContent('disabled');

      // Simulate settings change from extension
      act(() => {
        mockIdeMessenger.simulateWebviewMessage('didChangeIdeSettings', {
          settings: {
            enableControlServerBeta: true,
            debuggAiTestEnvironment: 'production'
          }
        });
      });

      await waitFor(() => {
        expect(screen.getByTestId('control-server-beta')).toHaveTextContent('enabled');
      });
    });
  });

  describe('organizations management', () => {
    it('should load organizations when session is available', async () => {
      const mockSession = {
        account: { id: 'user-id', label: 'user@example.com' },
        accessToken: 'access-token'
      };

      const mockOrganizations = [
        { id: 'org1', name: 'Organization 1' },
        { id: 'org2', name: 'Organization 2' }
      ];

      mockIdeMessenger.setRequestHandler('getControlPlaneSessionInfo', () => ({
        status: 'success',
        content: mockSession
      }));

      mockIdeMessenger.setRequestHandler('controlPlane/listOrganizations', () => ({
        status: 'success',
        content: mockOrganizations
      }));

      renderWithProviders(<TestAuthComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('session-status')).toHaveTextContent('authenticated');
      });

      await waitFor(() => {
        expect(mockIdeMessenger.request).toHaveBeenCalledWith('controlPlane/listOrganizations', undefined);
      });
    });

    it('should handle organization loading failure', async () => {
      const mockSession = {
        account: { id: 'user-id', label: 'user@example.com' },
        accessToken: 'access-token'
      };

      mockIdeMessenger.setRequestHandler('getControlPlaneSessionInfo', () => ({
        status: 'success',
        content: mockSession
      }));

      mockIdeMessenger.setRequestHandler('controlPlane/listOrganizations', () => ({
        status: 'error',
        error: 'Failed to load organizations'
      }));

      renderWithProviders(<TestAuthComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('session-status')).toHaveTextContent('authenticated');
      });

      await waitFor(() => {
        expect(screen.getByTestId('organizations-count')).toHaveTextContent('0');
      });
    });

    it('should properly select organization from store', async () => {
      const mockOrganizations = [
        { id: 'org1', name: 'Organization 1' },
        { id: 'org2', name: 'Organization 2' }
      ];

      store.dispatch({
        type: 'session/updateOrganizations',
        payload: mockOrganizations
      });

      store.dispatch({
        type: 'session/setSelectedOrganizationId',
        payload: 'org2'
      });

      renderWithProviders(<TestAuthComponent />);

      expect(screen.getByTestId('selected-organization')).toHaveTextContent('Organization 2');
    });
  });

  describe('profile management', () => {
    it('should refresh profiles successfully', async () => {
      const user = userEvent.setup();

      mockIdeMessenger.setRequestHandler('config/refreshProfiles', () => ({
        status: 'success',
        content: 'Profiles refreshed'
      }));

      renderWithProviders(<TestAuthComponent />);

      await user.click(screen.getByTestId('refresh-profiles-btn'));

      expect(mockIdeMessenger.request).toHaveBeenCalledWith('config/refreshProfiles', undefined);
      expect(mockIdeMessenger.post).toHaveBeenCalledWith('showToast', ['info', 'Config refreshed']);
    });

    it('should handle profile refresh failure', async () => {
      const user = userEvent.setup();
      const consoleError = vi.spyOn(console, 'error').mockImplementation();

      mockIdeMessenger.setRequestHandler('config/refreshProfiles', () => {
        throw new Error('Refresh failed');
      });

      renderWithProviders(<TestAuthComponent />);

      await user.click(screen.getByTestId('refresh-profiles-btn'));

      expect(consoleError).toHaveBeenCalledWith('Failed to refresh profiles', expect.any(Error));
      expect(mockIdeMessenger.post).toHaveBeenCalledWith('showToast', ['error', 'Failed to refresh config']);

      consoleError.mockRestore();
    });
  });

  describe('error handling', () => {
    it('should throw error when useAuth is used outside AuthProvider', () => {
      const TestErrorComponent = () => {
        const auth = useAuth();
        return <div>{auth.session ? 'authenticated' : 'unauthenticated'}</div>;
      };

      // Mock console.error to avoid noise in test output
      const consoleError = vi.spyOn(console, 'error').mockImplementation();

      expect(() => {
        render(<TestErrorComponent />);
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleError.mockRestore();
    });

    it('should handle network errors gracefully during login', async () => {
      const user = userEvent.setup();

      mockIdeMessenger.request.mockRejectedValue(new Error('Network error'));

      renderWithProviders(<TestAuthComponent />);

      await user.click(screen.getByTestId('login-btn'));

      // Should remain unauthenticated despite the error
      expect(screen.getByTestId('session-status')).toHaveTextContent('unauthenticated');
    });
  });

  describe('session state edge cases', () => {
    it('should handle session with missing account data', async () => {
      const incompleteSession = {
        accessToken: 'access-token',
        // Missing account object
      };

      mockIdeMessenger.setRequestHandler('getControlPlaneSessionInfo', () => ({
        status: 'success',
        content: incompleteSession
      }));

      renderWithProviders(<TestAuthComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('session-status')).toHaveTextContent('authenticated');
        expect(screen.getByTestId('user-email')).toHaveTextContent('no-email');
        expect(screen.getByTestId('user-id')).toHaveTextContent('no-id');
      });
    });

    it('should handle session with partial account data', async () => {
      const partialSession = {
        account: {
          id: 'user-id'
          // Missing label
        },
        accessToken: 'access-token'
      };

      mockIdeMessenger.setRequestHandler('getControlPlaneSessionInfo', () => ({
        status: 'success',
        content: partialSession
      }));

      renderWithProviders(<TestAuthComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('session-status')).toHaveTextContent('authenticated');
        expect(screen.getByTestId('user-id')).toHaveTextContent('user-id');
        expect(screen.getByTestId('user-email')).toHaveTextContent('no-email');
      });
    });
  });
}); 