import { configureStore } from '@reduxjs/toolkit';
import { act, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../util/test/render';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../context/Auth';
import { IdeMessengerContext } from '../context/IdeMessenger';
import { AccountButton } from '../pages/config/AccountButton';

// Mock the webview listener hook
const mockWebviewListeners: Map<string, Function[]> = new Map();
let mockUseWebviewListener: any;

vi.mock('../hooks/useWebviewListener', () => ({
  useWebviewListener: vi.fn(),
}));

// Mock window.addEventListener for webview messages
const originalAddEventListener = window.addEventListener;
const originalRemoveEventListener = window.removeEventListener;

// Create a comprehensive mock for the full auth flow
class ExtensionGUICommunicationMock {
  private messageHandlers: Map<string, Function[]> = new Map();
  private requestHandlers: Map<string, any> = new Map();
  private postHandlers: Map<string, any> = new Map();
  
  constructor() {
    // Mock window message handling
    window.addEventListener = vi.fn().mockImplementation((event, handler) => {
      if (event === 'message') {
        const messageType = 'webview-message';
        if (!this.messageHandlers.has(messageType)) {
          this.messageHandlers.set(messageType, []);
        }
        this.messageHandlers.get(messageType)!.push(handler);
      }
      return originalAddEventListener.call(window, event, handler);
    });

    window.removeEventListener = vi.fn().mockImplementation((event, handler) => {
      if (event === 'message') {
        const messageType = 'webview-message';
        const handlers = this.messageHandlers.get(messageType) || [];
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
      return originalRemoveEventListener.call(window, event, handler);
    });
  }

  // IdeMessenger mock methods
  request = vi.fn().mockImplementation((messageType: string, data: any) => {
    const handler = this.requestHandlers.get(messageType);
    if (handler) {
      return Promise.resolve(handler(data));
    }
    return Promise.resolve({ status: 'error', error: 'No handler for ' + messageType });
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

  // Extension simulation methods
  setRequestHandler(messageType: string, handler: Function) {
    this.requestHandlers.set(messageType, handler);
  }

  setPostHandler(messageType: string, handler: Function) {
    if (!this.postHandlers.has(messageType)) {
      this.postHandlers.set(messageType, []);
    }
    this.postHandlers.get(messageType)!.push(handler);
  }

  // Simulate webview messages from extension to GUI
  simulateWebviewMessage(messageType: string, data: any, messageId?: string) {
    const message = {
      data: {
        messageType,
        data,
        messageId: messageId || Math.random().toString(36)
      }
    };

    const handlers = this.messageHandlers.get('webview-message') || [];
    handlers.forEach(handler => {
      act(() => {
        handler(message);
      });
    });
  }

  // Simulate auth state changes from extension
  simulateAuthStateChange(sessionInfo: any) {
    this.simulateWebviewMessage('didChangeControlPlaneSessionInfo', { sessionInfo });
  }

  // Simulate profile changes from extension
  simulateProfileChange(profiles: any[], selectedProfileId: string | null) {
    this.simulateWebviewMessage('didChangeAvailableProfiles', {
      profiles,
      selectedProfileId
    });
  }

  // Simulate IDE settings changes from extension
  simulateIdeSettingsChange(settings: any) {
    this.simulateWebviewMessage('didChangeIdeSettings', { settings });
  }

  // Cleanup
  cleanup() {
    window.addEventListener = originalAddEventListener;
    window.removeEventListener = originalRemoveEventListener;
  }
}

describe('Auth Integration Tests', () => {
  let extensionMock: ExtensionGUICommunicationMock;
  let store: any;

  const renderAuthIntegration = (component: React.ReactElement) => {
    return renderWithProviders(
      <Provider store={store}>
        <IdeMessengerContext.Provider value={extensionMock as any}>
          <AuthProvider>
            {component}
          </AuthProvider>
        </IdeMessengerContext.Provider>
      </Provider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up mock for useWebviewListener
    mockUseWebviewListener = require('../hooks/useWebviewListener').useWebviewListener;
    mockUseWebviewListener.mockImplementation((messageType: string, handler: Function) => {
      if (!mockWebviewListeners.has(messageType)) {
        mockWebviewListeners.set(messageType, []);
      }
      mockWebviewListeners.get(messageType)!.push(handler);
    });

    extensionMock = new ExtensionGUICommunicationMock();

    // Create Redux store with mock reducers
    store = configureStore({
      reducer: {
        session: (state = {}, action: any) => state,
        config: (state = {}, action: any) => state,
        ui: (state = {}, action: any) => state,
        misc: (state = {}, action: any) => state
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

  afterEach(() => {
    extensionMock.cleanup();
    mockWebviewListeners.clear();
  });

  describe('Complete Login Flow', () => {
    it('should handle complete login flow from GUI to extension and back', async () => {
      const user = userEvent.setup();

      // 1. Initial state: no session
      extensionMock.setRequestHandler('getControlPlaneSessionInfo', (params: any) => {
        if (params?.silent === true) {
          return { status: 'success', content: null };
        } else {
          // Simulate successful login
          return {
            status: 'success',
            content: {
              account: { id: 'login-user', label: 'login@example.com' },
              accessToken: 'login-token',
              workspaceId: 'workspace-123'
            }
          };
        }
      });

      // Render the AccountButton component
      renderAuthIntegration(<AccountButton />);

      // 2. Should show "Sign in" button initially
      await waitFor(() => {
        expect(screen.getByText('Sign in')).toBeInTheDocument();
      });

      // 3. Click sign in button
      await user.click(screen.getByText('Sign in'));

      // 4. Verify extension was called
      expect(extensionMock.request).toHaveBeenCalledWith('getControlPlaneSessionInfo', {
        silent: false,
        useOnboarding: false
      });

      // 5. Should now show authenticated state
      await waitFor(() => {
        expect(screen.queryByText('Sign in')).not.toBeInTheDocument();
        expect(screen.getByRole('button')).toBeInTheDocument();
      });

      // 6. Open account menu to verify user data
      await user.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('login@example.com')).toBeInTheDocument();
        expect(screen.getByText('login-user')).toBeInTheDocument();
        expect(screen.getByText('Sign out')).toBeInTheDocument();
      });
    });

    it('should handle login failure gracefully', async () => {
      const user = userEvent.setup();

      // Mock failed login
      extensionMock.setRequestHandler('getControlPlaneSessionInfo', (params: any) => {
        if (params?.silent === false) {
          return { status: 'error', error: 'Authentication failed' };
        }
        return { status: 'success', content: null };
      });

      renderAuthIntegration(<AccountButton />);

      await waitFor(() => {
        expect(screen.getByText('Sign in')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Sign in'));

      // Should remain unauthenticated
      await waitFor(() => {
        expect(screen.getByText('Sign in')).toBeInTheDocument();
      });
    });
  });

  describe('Complete Logout Flow', () => {
    it('should handle complete logout flow with confirmation', async () => {
      const user = userEvent.setup();

      // Start with authenticated session
      const initialSession = {
        account: { id: 'logout-user', label: 'logout@example.com' },
        accessToken: 'logout-token'
      };

      extensionMock.setRequestHandler('getControlPlaneSessionInfo', () => ({
        status: 'success',
        content: initialSession
      }));

      renderAuthIntegration(<AccountButton />);

      // Should be authenticated
      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument();
        expect(screen.queryByText('Sign in')).not.toBeInTheDocument();
      });

      // Open account menu
      await user.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('Sign out')).toBeInTheDocument();
      });

      // Click sign out
      await user.click(screen.getByText('Sign out'));

      // Should show confirmation dialog
      expect(store.getState().ui.showDialog).toBe(true);
      expect(store.getState().ui.dialogMessage).toBeDefined();

      // Simulate extension processing logout and sending webview message
      act(() => {
        extensionMock.simulateAuthStateChange(null);
      });

      // Should now be unauthenticated
      await waitFor(() => {
        expect(screen.getByText('Sign in')).toBeInTheDocument();
      });
    });
  });

  describe('Real-time Auth State Synchronization', () => {
    it('should sync auth state changes from extension to GUI in real-time', async () => {
      // Start unauthenticated
      extensionMock.setRequestHandler('getControlPlaneSessionInfo', () => ({
        status: 'success',
        content: null
      }));

      const TestComponent = () => {
        const { useAuth } = require('../context/Auth');
        const { session } = useAuth();
        
        return (
          <div>
            <div data-testid="auth-status">
              {session ? `authenticated:${session.account.label}` : 'unauthenticated'}
            </div>
            <AccountButton />
          </div>
        );
      };

      renderAuthIntegration(<TestComponent />);

      // Initially unauthenticated
      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
        expect(screen.getByText('Sign in')).toBeInTheDocument();
      });

      // Simulate auth state change from extension (e.g., user logged in elsewhere)
      const newSession = {
        account: { id: 'external-user', label: 'external@example.com' },
        accessToken: 'external-token'
      };

      extensionMock.simulateAuthStateChange(newSession);

      // GUI should update immediately
      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated:external@example.com');
        expect(screen.queryByText('Sign in')).not.toBeInTheDocument();
      });

      // Simulate logout from extension
      extensionMock.simulateAuthStateChange(null);

      // Should immediately show unauthenticated state
      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
        expect(screen.getByText('Sign in')).toBeInTheDocument();
      });
    });

    it('should handle multiple rapid auth state changes', async () => {
      const TestComponent = () => {
        const { useAuth } = require('../context/Auth');
        const { session } = useAuth();
        
        return (
          <div data-testid="auth-status">
            {session ? `authenticated:${session.account.id}` : 'unauthenticated'}
          </div>
        );
      };

      renderAuthIntegration(<TestComponent />);

      // Rapid auth state changes
      const sessions = [
        { account: { id: 'user1', label: 'user1@example.com' }, accessToken: 'token1' },
        { account: { id: 'user2', label: 'user2@example.com' }, accessToken: 'token2' },
        null,
        { account: { id: 'user3', label: 'user3@example.com' }, accessToken: 'token3' }
      ];

      for (let i = 0; i < sessions.length; i++) {
        act(() => {
          extensionMock.simulateAuthStateChange(sessions[i]);
        });

        if (sessions[i]) {
          await waitFor(() => {
            expect(screen.getByTestId('auth-status')).toHaveTextContent(`authenticated:${sessions[i]?.account?.id}`);
          });
        } else {
          await waitFor(() => {
            expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
          });
        }
      }
    });
  });

  describe('Profile and Organization Synchronization', () => {
    it('should sync profile changes from extension to GUI', async () => {
      // Start with authenticated session
      const session = {
        account: { id: 'profile-user', label: 'profile@example.com' },
        accessToken: 'profile-token'
      };

      extensionMock.setRequestHandler('getControlPlaneSessionInfo', () => ({
        status: 'success',
        content: session
      }));

      extensionMock.setRequestHandler('config/listProfiles', () => ({
        status: 'success',
        content: {
          profiles: [{ id: 'initial', title: 'Initial Profile' }],
          selectedProfileId: 'initial'
        }
      }));

      const ProfileTestComponent = () => {
        const { useAuth } = require('../context/Auth');
        const { selectedProfile, profiles } = useAuth();
        
        return (
          <div>
            <div data-testid="selected-profile">
              {selectedProfile?.title || 'no-profile'}
            </div>
            <div data-testid="profiles-count">
              {profiles?.length || 0}
            </div>
          </div>
        );
      };

      renderAuthIntegration(<ProfileTestComponent />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByTestId('profiles-count')).toHaveTextContent('0');
      });

      // Simulate profile change from extension
      const newProfiles = [
        { id: 'dev', title: 'Development' },
        { id: 'prod', title: 'Production' }
      ];

      act(() => {
        extensionMock.simulateProfileChange(newProfiles, 'dev');
      });

      // GUI should update with new profiles
      await waitFor(() => {
        expect(screen.getByTestId('profiles-count')).toHaveTextContent('2');
      });

      // Also set the selected profile in the store to test display
      store.dispatch({
        type: 'session/setSelectedProfile',
        payload: newProfiles[0]
      });

      await waitFor(() => {
        expect(screen.getByTestId('selected-profile')).toHaveTextContent('Development');
      });
    });

    it('should sync organization data on authentication', async () => {
      const session = {
        account: { id: 'org-user', label: 'org@example.com' },
        accessToken: 'org-token'
      };

      const organizations = [
        { id: 'org1', name: 'ACME Corporation' },
        { id: 'org2', name: 'Tech Solutions Inc' }
      ];

      extensionMock.setRequestHandler('getControlPlaneSessionInfo', () => ({
        status: 'success',
        content: session
      }));

      extensionMock.setRequestHandler('controlPlane/listOrganizations', () => ({
        status: 'success',
        content: organizations
      }));

      const OrgTestComponent = () => {
        const { useAuth } = require('../context/Auth');
        const { organizations, selectedOrganization } = useAuth();
        
        return (
          <div>
            <div data-testid="orgs-count">{organizations.length}</div>
            <div data-testid="selected-org">
              {selectedOrganization?.name || 'no-org'}
            </div>
          </div>
        );
      };

      renderAuthIntegration(<OrgTestComponent />);

      // Should eventually load organizations
      await waitFor(() => {
        expect(extensionMock.request).toHaveBeenCalledWith('controlPlane/listOrganizations', undefined);
      });

      // Simulate organizations being loaded in the store
      store.dispatch({
        type: 'session/updateOrganizations',
        payload: organizations
      });

      store.dispatch({
        type: 'session/setSelectedOrganizationId',
        payload: 'org1'
      });

      await waitFor(() => {
        expect(screen.getByTestId('orgs-count')).toHaveTextContent('2');
        expect(screen.getByTestId('selected-org')).toHaveTextContent('ACME Corporation');
      });
    });

    it('should clear organization data on logout', async () => {
      // Start with organizations
      const initialOrganizations = [
        { id: 'org1', name: 'ACME Corp' }
      ];

      store.dispatch({
        type: 'session/updateOrganizations',
        payload: initialOrganizations
      });

      const OrgTestComponent = () => {
        const { useAuth } = require('../context/Auth');
        const { organizations } = useAuth();
        
        return <div data-testid="orgs-count">{organizations.length}</div>;
      };

      renderAuthIntegration(<OrgTestComponent />);

      expect(screen.getByTestId('orgs-count')).toHaveTextContent('1');

      // Simulate logout
      act(() => {
        extensionMock.simulateAuthStateChange(null);
      });

      // Organizations should be cleared
      await waitFor(() => {
        expect(screen.getByTestId('orgs-count')).toHaveTextContent('0');
      });
    });
  });

  describe('IDE Settings Synchronization', () => {
    it('should sync IDE settings changes from extension', async () => {
      const SettingsTestComponent = () => {
        const { useAuth } = require('../context/Auth');
        const { controlServerBetaEnabled } = useAuth();
        
        return (
          <div data-testid="beta-status">
            {controlServerBetaEnabled ? 'enabled' : 'disabled'}
          </div>
        );
      };

      renderAuthIntegration(<SettingsTestComponent />);

      // Initially disabled
      await waitFor(() => {
        expect(screen.getByTestId('beta-status')).toHaveTextContent('disabled');
      });

      // Simulate settings change from extension
      act(() => {
        extensionMock.simulateIdeSettingsChange({
          enableControlServerBeta: true,
          debuggAiTestEnvironment: 'production'
        });
      });

      // Should update immediately
      await waitFor(() => {
        expect(screen.getByTestId('beta-status')).toHaveTextContent('enabled');
      });

      // Change back
      act(() => {
        extensionMock.simulateIdeSettingsChange({
          enableControlServerBeta: false,
          debuggAiTestEnvironment: 'test'
        });
      });

      await waitFor(() => {
        expect(screen.getByTestId('beta-status')).toHaveTextContent('disabled');
      });
    });
  });

  describe('Error Scenarios and Edge Cases', () => {
    it('should handle webview communication errors gracefully', async () => {
      const TestComponent = () => {
        const { useAuth } = require('../context/Auth');
        const { session } = useAuth();
        
        return (
          <div data-testid="auth-status">
            {session ? 'authenticated' : 'unauthenticated'}
          </div>
        );
      };

      renderAuthIntegration(<TestComponent />);

      // Simulate malformed webview messages
      act(() => {
        extensionMock.simulateWebviewMessage('didChangeControlPlaneSessionInfo', {
          // Missing sessionInfo property
        });
      });

      // Should not crash
      expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');

      // Simulate message with invalid data
      act(() => {
        extensionMock.simulateWebviewMessage('didChangeControlPlaneSessionInfo', {
          sessionInfo: "invalid-data"
        });
      });

      // Should still not crash
      expect(screen.getByTestId('auth-status')).toBeInTheDocument();
    });

    it('should handle concurrent login/logout operations', async () => {
      const user = userEvent.setup();

      extensionMock.setRequestHandler('getControlPlaneSessionInfo', (params: any) => {
        if (params?.silent === false) {
          return {
            status: 'success',
            content: {
              account: { id: 'concurrent-user', label: 'concurrent@example.com' },
              accessToken: 'concurrent-token'
            }
          };
        }
        return { status: 'success', content: null };
      });

      renderAuthIntegration(<AccountButton />);

      // Start multiple login attempts concurrently
      const loginPromises = [
        user.click(screen.getByText('Sign in')),
        user.click(screen.getByText('Sign in')),
        user.click(screen.getByText('Sign in'))
      ];

      await Promise.all(loginPromises);

      // Should eventually be authenticated
      await waitFor(() => {
        expect(screen.queryByText('Sign in')).not.toBeInTheDocument();
      });

      // Verify only reasonable number of extension calls were made
      expect(extensionMock.request).toHaveBeenCalledWith('getControlPlaneSessionInfo', {
        silent: false,
        useOnboarding: false
      });
    });

    it('should handle session data with missing properties', async () => {
      const TestComponent = () => {
        const { useAuth } = require('../context/Auth');
        const { session } = useAuth();
        
        return (
          <div>
            <div data-testid="auth-status">
              {session ? 'authenticated' : 'unauthenticated'}
            </div>
            <div data-testid="user-email">
              {session?.account?.label || 'no-email'}
            </div>
            <div data-testid="user-id">
              {session?.account?.id || 'no-id'}
            </div>
          </div>
        );
      };

      renderAuthIntegration(<TestComponent />);

      // Simulate session with missing account
      act(() => {
        extensionMock.simulateAuthStateChange({
          accessToken: 'token-without-account'
        });
      });

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
        expect(screen.getByTestId('user-email')).toHaveTextContent('no-email');
        expect(screen.getByTestId('user-id')).toHaveTextContent('no-id');
      });

      // Simulate session with partial account
      act(() => {
        extensionMock.simulateAuthStateChange({
          accessToken: 'token-with-partial-account',
          account: {
            id: 'user-id-only'
            // Missing label
          }
        });
      });

      await waitFor(() => {
        expect(screen.getByTestId('user-id')).toHaveTextContent('user-id-only');
        expect(screen.getByTestId('user-email')).toHaveTextContent('no-email');
      });
    });
  });
}); 