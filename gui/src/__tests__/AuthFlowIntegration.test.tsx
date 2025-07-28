import { configureStore } from '@reduxjs/toolkit';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../context/Auth';
import { IdeMessengerContext } from '../context/IdeMessenger';
import { AccountButton } from '../pages/config/AccountButton';

// Mock the webview listener hook
vi.mock('../hooks/useWebviewListener', () => ({
  useWebviewListener: vi.fn(),
}));

// Mock OnboardingCard component
const MockOnboardingCard = ({ onRemainLocal, isDialog }: any) => {
  const { useAuth } = require('../context/Auth');
  const auth = useAuth();
  
  return (
    <div data-testid="onboarding-card">
      <div data-testid="onboarding-auth-status">
        {auth.session ? 'authenticated' : 'unauthenticated'}
      </div>
      <div data-testid="onboarding-message">
        {auth.session ? 'Welcome back!' : 'Please login to start using Debugg AI'}
      </div>
      <button 
        data-testid="onboarding-login" 
        onClick={() => auth.login(true)}
        disabled={!!auth.session}
      >
        Get started
      </button>
      <button 
        data-testid="onboarding-remain-local" 
        onClick={onRemainLocal}
      >
        Remain local
      </button>
    </div>
  );
};

// Create a comprehensive auth flow test harness
class AuthFlowTestHarness {
  private requestHandlers: Map<string, any> = new Map();
  private webviewListeners: Map<string, Function[]> = new Map();
  private authState: any = null;
  private profiles: any[] = [];
  private organizations: any[] = [];
  private ideSettings = {
    enableControlServerBeta: false,
    debuggAiTestEnvironment: 'test'
  };

  // IdeMessenger mock
  request = vi.fn().mockImplementation((messageType: string, data: any) => {
    const handler = this.requestHandlers.get(messageType);
    if (handler) {
      return Promise.resolve(handler(data));
    }
    return Promise.resolve({ status: 'error', error: 'No handler for ' + messageType });
  });

  post = vi.fn();
  respond = vi.fn();
  ide = {
    getIdeSettings: vi.fn().mockImplementation(() => Promise.resolve(this.ideSettings))
  };

  // Test control methods
  setAuthState(sessionInfo: any) {
    this.authState = sessionInfo;
    this.requestHandlers.set('getControlPlaneSessionInfo', (params: any) => ({
      status: 'success',
      content: params?.silent === false ? sessionInfo : sessionInfo
    }));
  }

  setProfiles(profiles: any[], selectedProfileId?: string) {
    this.profiles = profiles;
    this.requestHandlers.set('config/listProfiles', () => ({
      status: 'success',
      content: { profiles, selectedProfileId }
    }));
  }

  setOrganizations(organizations: any[]) {
    this.organizations = organizations;
    this.requestHandlers.set('controlPlane/listOrganizations', () => ({
      status: 'success',
      content: organizations
    }));
  }

  setIdeSettings(settings: any) {
    this.ideSettings = { ...this.ideSettings, ...settings };
    this.ide.getIdeSettings.mockResolvedValue(this.ideSettings);
  }

  // Simulate external auth state changes
  simulateAuthStateChange(sessionInfo: any) {
    this.authState = sessionInfo;
    this.broadcastWebviewMessage('didChangeControlPlaneSessionInfo', { sessionInfo });
  }

  simulateProfileChange(profiles: any[], selectedProfileId: string | null) {
    this.profiles = profiles;
    this.broadcastWebviewMessage('didChangeAvailableProfiles', { profiles, selectedProfileId });
  }

  simulateIdeSettingsChange(settings: any) {
    this.ideSettings = { ...this.ideSettings, ...settings };
    this.broadcastWebviewMessage('didChangeIdeSettings', { settings });
  }

  // Simulate auth failures
  simulateAuthFailure(errorMessage: string = 'Authentication failed') {
    this.requestHandlers.set('getControlPlaneSessionInfo', (params: any) => {
      if (params?.silent === false) {
        return { status: 'error', error: errorMessage };
      }
      return { status: 'success', content: null };
    });
  }

  simulateNetworkError() {
    this.request.mockRejectedValue(new Error('Network error'));
  }

  // Private helper methods
  private broadcastWebviewMessage(messageType: string, data: any) {
    const listeners = this.webviewListeners.get(messageType) || [];
    listeners.forEach(listener => {
      act(() => {
        listener(data);
      });
    });
  }

  // Set up webview listener mock
  setupWebviewListeners() {
    const mockUseWebviewListener = require('../hooks/useWebviewListener').useWebviewListener;
    mockUseWebviewListener.mockImplementation((messageType: string, handler: Function) => {
      if (!this.webviewListeners.has(messageType)) {
        this.webviewListeners.set(messageType, []);
      }
      this.webviewListeners.get(messageType)!.push(handler);
    });
  }

  // Clean up
  reset() {
    this.authState = null;
    this.profiles = [];
    this.organizations = [];
    this.ideSettings = { enableControlServerBeta: false, debuggAiTestEnvironment: 'test' };
    this.requestHandlers.clear();
    this.webviewListeners.clear();
    vi.clearAllMocks();
  }
}

describe('Complete Auth Flow Integration Tests', () => {
  let authHarness: AuthFlowTestHarness;
  let store: any;

  const renderAuthFlow = (component: React.ReactElement) => {
    return render(
      <Provider store={store}>
        <IdeMessengerContext.Provider value={authHarness as any}>
          <AuthProvider>
            {component}
          </AuthProvider>
        </IdeMessengerContext.Provider>
      </Provider>
    );
  };

  beforeEach(() => {
    authHarness = new AuthFlowTestHarness();
    authHarness.setupWebviewListeners();

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
        config: { config: {}, profileId: null },
        ui: { showDialog: false, dialogMessage: undefined, hasDismissedExploreDialog: false, ttsActive: false },
        misc: { lastControlServerBetaEnabledStatus: false }
      }
    });
  });

  afterEach(() => {
    authHarness.reset();
  });

  describe('New User Onboarding Flow', () => {
    it('should complete full onboarding flow for new user', async () => {
      const user = userEvent.setup();

      // Start with no auth
      authHarness.setAuthState(null);

      const FullOnboardingComponent = () => (
        <div>
          <AccountButton />
          <MockOnboardingCard onRemainLocal={() => {}} isDialog={false} />
        </div>
      );

      renderAuthFlow(<FullOnboardingComponent />);

      // 1. Initially unauthenticated
      await waitFor(() => {
        expect(screen.getByText('Sign in')).toBeInTheDocument();
        expect(screen.getByTestId('onboarding-auth-status')).toHaveTextContent('unauthenticated');
        expect(screen.getByTestId('onboarding-message')).toHaveTextContent('Please login to start using Debugg AI');
      });

      // 2. Set up successful authentication
      const newUserSession = {
        account: { id: 'new-user-123', label: 'newuser@example.com' },
        accessToken: 'new-user-token',
        workspaceId: 'workspace-abc'
      };

      authHarness.setAuthState(newUserSession);

      // 3. Click onboarding login button
      await user.click(screen.getByTestId('onboarding-login'));

      // 4. Should authenticate via onboarding flow
      expect(authHarness.request).toHaveBeenCalledWith('getControlPlaneSessionInfo', {
        silent: false,
        useOnboarding: true
      });

      // 5. UI should update to authenticated state
      await waitFor(() => {
        expect(screen.queryByText('Sign in')).not.toBeInTheDocument();
        expect(screen.getByTestId('onboarding-auth-status')).toHaveTextContent('authenticated');
        expect(screen.getByTestId('onboarding-message')).toHaveTextContent('Welcome back!');
      });

      // 6. Account button should show user info
      await user.click(screen.getByRole('button'));
      await waitFor(() => {
        expect(screen.getByText('newuser@example.com')).toBeInTheDocument();
        expect(screen.getByText('new-user-123')).toBeInTheDocument();
      });
    });

    it('should handle onboarding authentication failure', async () => {
      const user = userEvent.setup();

      // Simulate auth failure
      authHarness.simulateAuthFailure('Onboarding authentication failed');

      renderAuthFlow(<MockOnboardingCard onRemainLocal={() => {}} isDialog={false} />);

      await waitFor(() => {
        expect(screen.getByTestId('onboarding-auth-status')).toHaveTextContent('unauthenticated');
      });

      await user.click(screen.getByTestId('onboarding-login'));

      // Should remain unauthenticated
      await waitFor(() => {
        expect(screen.getByTestId('onboarding-auth-status')).toHaveTextContent('unauthenticated');
        expect(screen.getByTestId('onboarding-message')).toHaveTextContent('Please login to start using Debugg AI');
      });
    });

    it('should handle "remain local" option', async () => {
      const user = userEvent.setup();
      const mockRemainLocal = vi.fn();

      renderAuthFlow(
        <MockOnboardingCard onRemainLocal={mockRemainLocal} isDialog={false} />
      );

      await user.click(screen.getByTestId('onboarding-remain-local'));

      expect(mockRemainLocal).toHaveBeenCalled();
    });
  });

  describe('Existing User Login Flow', () => {
    it('should handle returning user login via account button', async () => {
      const user = userEvent.setup();

      // Start unauthenticated
      authHarness.setAuthState(null);

      renderAuthFlow(<AccountButton />);

      await waitFor(() => {
        expect(screen.getByText('Sign in')).toBeInTheDocument();
      });

      // Set up authentication for returning user
      const returningUserSession = {
        account: { id: 'returning-user', label: 'returning@example.com' },
        accessToken: 'returning-token'
      };

      authHarness.setAuthState(returningUserSession);

      // Click account button sign in
      await user.click(screen.getByText('Sign in'));

      // Should use non-onboarding flow
      expect(authHarness.request).toHaveBeenCalledWith('getControlPlaneSessionInfo', {
        silent: false,
        useOnboarding: false
      });

      // Should be authenticated
      await waitFor(() => {
        expect(screen.queryByText('Sign in')).not.toBeInTheDocument();
      });
    });

    it('should auto-authenticate user with existing session on app start', async () => {
      // Set up existing session
      const existingSession = {
        account: { id: 'existing-user', label: 'existing@example.com' },
        accessToken: 'existing-token'
      };

      authHarness.setAuthState(existingSession);

      renderAuthFlow(<AccountButton />);

      // Should automatically load existing session
      await waitFor(() => {
        expect(authHarness.request).toHaveBeenCalledWith('getControlPlaneSessionInfo', {
          silent: true,
          useOnboarding: false
        });
        expect(screen.queryByText('Sign in')).not.toBeInTheDocument();
      });

      // Should show user profile when clicked
      const user = userEvent.setup();
      await user.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('existing@example.com')).toBeInTheDocument();
        expect(screen.getByText('existing-user')).toBeInTheDocument();
      });
    });
  });

  describe('Full Profile and Organization Flow', () => {
    it('should load and display profile and organization data after authentication', async () => {
      const user = userEvent.setup();

      // Set up authenticated user with profiles and organizations
      const authenticatedSession = {
        account: { id: 'profile-user', label: 'profile@example.com' },
        accessToken: 'profile-token'
      };

      const userProfiles = [
        { id: 'dev-profile', title: 'Development Environment' },
        { id: 'prod-profile', title: 'Production Environment' }
      ];

      const userOrganizations = [
        { id: 'acme-corp', name: 'ACME Corporation' },
        { id: 'tech-startup', name: 'Tech Startup Inc' }
      ];

      authHarness.setAuthState(authenticatedSession);
      authHarness.setProfiles(userProfiles, 'dev-profile');
      authHarness.setOrganizations(userOrganizations);

      // Component that displays all auth-related data
      const FullDataComponent = () => {
        const { useAuth } = require('../context/Auth');
        const { session, selectedProfile, profiles, organizations, selectedOrganization } = useAuth();
        
        return (
          <div>
            <div data-testid="user-email">{session?.account?.label || 'no-user'}</div>
            <div data-testid="selected-profile">{selectedProfile?.title || 'no-profile'}</div>
            <div data-testid="profiles-count">{profiles?.length || 0}</div>
            <div data-testid="orgs-count">{organizations.length}</div>
            <div data-testid="selected-org">{selectedOrganization?.name || 'no-org'}</div>
            <AccountButton />
          </div>
        );
      };

      renderAuthFlow(<FullDataComponent />);

      // Should authenticate and load data
      await waitFor(() => {
        expect(screen.getByTestId('user-email')).toHaveTextContent('profile@example.com');
      });

      // Simulate profiles being loaded
      store.dispatch({
        type: 'session/updateAvailableProfiles',
        payload: { profiles: userProfiles, selectedProfileId: 'dev-profile' }
      });
      store.dispatch({
        type: 'session/setSelectedProfile',
        payload: userProfiles[0]
      });

      // Simulate organizations being loaded
      store.dispatch({
        type: 'session/updateOrganizations',
        payload: userOrganizations
      });
      store.dispatch({
        type: 'session/setSelectedOrganizationId',
        payload: 'acme-corp'
      });

      await waitFor(() => {
        expect(screen.getByTestId('selected-profile')).toHaveTextContent('Development Environment');
        expect(screen.getByTestId('profiles-count')).toHaveTextContent('2');
        expect(screen.getByTestId('orgs-count')).toHaveTextContent('2');
        expect(screen.getByTestId('selected-org')).toHaveTextContent('ACME Corporation');
      });
    });

    it('should handle dynamic profile switching', async () => {
      // Start with authenticated user
      const session = {
        account: { id: 'switch-user', label: 'switch@example.com' },
        accessToken: 'switch-token'
      };

      authHarness.setAuthState(session);

      const ProfileSwitchComponent = () => {
        const { useAuth } = require('../context/Auth');
        const { selectedProfile } = useAuth();
        
        return (
          <div data-testid="current-profile">
            {selectedProfile?.title || 'no-profile'}
          </div>
        );
      };

      renderAuthFlow(<ProfileSwitchComponent />);

      // Initially no profile
      expect(screen.getByTestId('current-profile')).toHaveTextContent('no-profile');

      // Simulate profile switch from extension
      const newProfiles = [
        { id: 'new-dev', title: 'New Development' },
        { id: 'new-prod', title: 'New Production' }
      ];

      authHarness.simulateProfileChange(newProfiles, 'new-prod');

      // Also update the store to reflect selection
      store.dispatch({
        type: 'session/setSelectedProfile',
        payload: newProfiles[1]
      });

      await waitFor(() => {
        expect(screen.getByTestId('current-profile')).toHaveTextContent('New Production');
      });
    });
  });

  describe('Complete Logout Flow', () => {
    it('should handle full logout flow with data cleanup', async () => {
      const user = userEvent.setup();

      // Start with full authenticated state
      const authenticatedSession = {
        account: { id: 'logout-user', label: 'logout@example.com' },
        accessToken: 'logout-token'
      };

      authHarness.setAuthState(authenticatedSession);

      // Set up initial data
      store.dispatch({
        type: 'session/updateOrganizations',
        payload: [{ id: 'org1', name: 'Test Org' }]
      });

      const FullLogoutComponent = () => {
        const { useAuth } = require('../context/Auth');
        const { session, organizations } = useAuth();
        
        return (
          <div>
            <div data-testid="auth-status">{session ? 'authenticated' : 'unauthenticated'}</div>
            <div data-testid="orgs-count">{organizations.length}</div>
            <AccountButton />
          </div>
        );
      };

      renderAuthFlow(<FullLogoutComponent />);

      // Should be authenticated with data
      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
        expect(screen.getByTestId('orgs-count')).toHaveTextContent('1');
      });

      // Open account menu and logout
      await user.click(screen.getByRole('button'));
      await waitFor(() => {
        expect(screen.getByText('Sign out')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Sign out'));

      // Should show confirmation dialog
      expect(store.getState().ui.showDialog).toBe(true);

      // Simulate extension processing logout
      authHarness.simulateAuthStateChange(null);

      // Should be unauthenticated with data cleared
      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
        expect(screen.getByTestId('orgs-count')).toHaveTextContent('0');
        expect(screen.getByText('Sign in')).toBeInTheDocument();
      });
    });
  });

  describe('Error Scenarios and Recovery', () => {
    it('should handle network errors during authentication gracefully', async () => {
      const user = userEvent.setup();

      authHarness.simulateNetworkError();

      renderAuthFlow(<AccountButton />);

      await waitFor(() => {
        expect(screen.getByText('Sign in')).toBeInTheDocument();
      });

      // Click sign in - should handle network error gracefully
      await user.click(screen.getByText('Sign in'));

      // Should remain unauthenticated
      await waitFor(() => {
        expect(screen.getByText('Sign in')).toBeInTheDocument();
      });
    });

    it('should handle session corruption and recovery', async () => {
      // Start with corrupted session data
      const corruptedSession = {
        accessToken: 'valid-token'
        // Missing account data
      };

      authHarness.setAuthState(corruptedSession);

      const CorruptionTestComponent = () => {
        const { useAuth } = require('../context/Auth');
        const { session } = useAuth();
        
        return (
          <div>
            <div data-testid="auth-status">{session ? 'authenticated' : 'unauthenticated'}</div>
            <div data-testid="user-info">
              {session?.account?.label || 'no-user-info'}
            </div>
          </div>
        );
      };

      renderAuthFlow(<CorruptionTestComponent />);

      // Should still show as authenticated despite missing data
      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
        expect(screen.getByTestId('user-info')).toHaveTextContent('no-user-info');
      });

      // Recovery: receive proper session data
      const validSession = {
        account: { id: 'recovered-user', label: 'recovered@example.com' },
        accessToken: 'recovered-token'
      };

      authHarness.simulateAuthStateChange(validSession);

      await waitFor(() => {
        expect(screen.getByTestId('user-info')).toHaveTextContent('recovered@example.com');
      });
    });

    it('should handle rapid state changes without UI glitches', async () => {
      const StateChangeComponent = () => {
        const { useAuth } = require('../context/Auth');
        const { session } = useAuth();
        
        return (
          <div data-testid="user-display">
            {session ? session.account?.label || 'authenticated-no-label' : 'unauthenticated'}
          </div>
        );
      };

      renderAuthFlow(<StateChangeComponent />);

      // Rapid state changes
      const states = [
        { account: { id: 'user1', label: 'user1@example.com' }, accessToken: 'token1' },
        null,
        { account: { id: 'user2', label: 'user2@example.com' }, accessToken: 'token2' },
        { account: { id: 'user3', label: 'user3@example.com' }, accessToken: 'token3' },
        null
      ];

      for (let i = 0; i < states.length; i++) {
        authHarness.simulateAuthStateChange(states[i]);
        
        await waitFor(() => {
          const expectedText = states[i] 
            ? states[i]?.account?.label || 'unauthenticated'
            : 'unauthenticated';
          expect(screen.getByTestId('user-display')).toHaveTextContent(expectedText);
        });
      }
    });
  });

  describe('Cross-Component Consistency', () => {
    it('should maintain consistent auth state across all auth-dependent components', async () => {
      const user = userEvent.setup();

      // Component that combines multiple auth-dependent elements
      const ConsistencyTestComponent = () => {
        const { useAuth } = require('../context/Auth');
        const { session, organizations } = useAuth();
        
        return (
          <div>
            <AccountButton />
            <MockOnboardingCard onRemainLocal={() => {}} isDialog={false} />
            <div data-testid="session-indicator">
              {session ? 'has-session' : 'no-session'}
            </div>
            <div data-testid="orgs-indicator">
              {organizations.length > 0 ? 'has-orgs' : 'no-orgs'}
            </div>
          </div>
        );
      };

      // Start unauthenticated
      authHarness.setAuthState(null);
      renderAuthFlow(<ConsistencyTestComponent />);

      // All components should show unauthenticated state
      await waitFor(() => {
        expect(screen.getByText('Sign in')).toBeInTheDocument();
        expect(screen.getByTestId('onboarding-auth-status')).toHaveTextContent('unauthenticated');
        expect(screen.getByTestId('session-indicator')).toHaveTextContent('no-session');
        expect(screen.getByTestId('orgs-indicator')).toHaveTextContent('no-orgs');
      });

      // Authenticate via external source (e.g., another tab)
      const newSession = {
        account: { id: 'consistent-user', label: 'consistent@example.com' },
        accessToken: 'consistent-token'
      };

      authHarness.simulateAuthStateChange(newSession);

      // All components should immediately update to authenticated state
      await waitFor(() => {
        expect(screen.queryByText('Sign in')).not.toBeInTheDocument();
        expect(screen.getByTestId('onboarding-auth-status')).toHaveTextContent('authenticated');
        expect(screen.getByTestId('session-indicator')).toHaveTextContent('has-session');
      });

      // Add organizations
      store.dispatch({
        type: 'session/updateOrganizations',
        payload: [{ id: 'org1', name: 'Test Organization' }]
      });

      await waitFor(() => {
        expect(screen.getByTestId('orgs-indicator')).toHaveTextContent('has-orgs');
      });

      // Logout via webview
      authHarness.simulateAuthStateChange(null);

      // All components should return to unauthenticated state
      await waitFor(() => {
        expect(screen.getByText('Sign in')).toBeInTheDocument();
        expect(screen.getByTestId('onboarding-auth-status')).toHaveTextContent('unauthenticated');
        expect(screen.getByTestId('session-indicator')).toHaveTextContent('no-session');
        expect(screen.getByTestId('orgs-indicator')).toHaveTextContent('no-orgs');
      });
    });
  });
}); 