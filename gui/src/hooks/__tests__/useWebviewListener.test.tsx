import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IdeMessengerContext } from '../../context/IdeMessenger';
import { useWebviewListener } from '../useWebviewListener';

// Mock IdeMessenger
class MockIdeMessenger {
  respond = vi.fn();
}

describe('useWebviewListener', () => {
  let mockIdeMessenger: MockIdeMessenger;
  let messageHandlers: ((event: any) => void)[] = [];

  // Mock window.addEventListener and removeEventListener
  const originalAddEventListener = window.addEventListener;
  const originalRemoveEventListener = window.removeEventListener;

  beforeEach(() => {
    mockIdeMessenger = new MockIdeMessenger();
    messageHandlers = [];

    window.addEventListener = vi.fn((event, handler) => {
      if (event === 'message') {
        messageHandlers.push(handler);
      }
    });
    
    window.removeEventListener = vi.fn((event, handler) => {
      if (event === 'message') {
        const index = messageHandlers.indexOf(handler);
        if (index > -1) {
          messageHandlers.splice(index, 1);
        }
      }
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    window.addEventListener = originalAddEventListener;
    window.removeEventListener = originalRemoveEventListener;
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <IdeMessengerContext.Provider value={mockIdeMessenger as any}>
      {children}
    </IdeMessengerContext.Provider>
  );

  describe('basic functionality', () => {
    it('should register message listener for specified message type', () => {
      const mockHandler = vi.fn().mockResolvedValue('response');

      renderHook(
        () => useWebviewListener('didChangeControlPlaneSessionInfo', mockHandler),
        { wrapper }
      );

      expect(window.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
    });

    it('should handle matching message type correctly', async () => {
      const mockHandler = vi.fn().mockResolvedValue('test-response');
      const testData = { sessionInfo: { account: { id: 'test-user' } } };

      renderHook(
        () => useWebviewListener('didChangeControlPlaneSessionInfo', mockHandler),
        { wrapper }
      );

      // Simulate message event
      const messageEvent = {
        data: {
          messageType: 'didChangeControlPlaneSessionInfo',
          data: testData,
          messageId: 'test-message-id'
        }
      };

      await act(async () => {
        messageHandlers[0](messageEvent);
        await new Promise(resolve => setTimeout(resolve, 0)); // Allow async handler to complete
      });

      expect(mockHandler).toHaveBeenCalledWith(testData);
      expect(mockIdeMessenger.respond).toHaveBeenCalledWith(
        'didChangeControlPlaneSessionInfo',
        'test-response',
        'test-message-id'
      );
    });

    it('should ignore non-matching message types', async () => {
      const mockHandler = vi.fn().mockResolvedValue('response');

      renderHook(
        () => useWebviewListener('didChangeControlPlaneSessionInfo', mockHandler),
        { wrapper }
      );

      // Simulate different message type
      const messageEvent = {
        data: {
          messageType: 'differentMessageType',
          data: { some: 'data' },
          messageId: 'test-id'
        }
      };

      await act(async () => {
        messageHandlers[0](messageEvent);
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(mockHandler).not.toHaveBeenCalled();
      expect(mockIdeMessenger.respond).not.toHaveBeenCalled();
    });

    it('should clean up listener on unmount', () => {
      const mockHandler = vi.fn().mockResolvedValue('response');

      const { unmount } = renderHook(
        () => useWebviewListener('didChangeControlPlaneSessionInfo', mockHandler),
        { wrapper }
      );

      expect(messageHandlers.length).toBe(1);

      unmount();

      expect(window.removeEventListener).toHaveBeenCalledWith('message', expect.any(Function));
      expect(messageHandlers.length).toBe(0);
    });
  });

  describe('auth-specific message handling', () => {
    it('should handle didChangeControlPlaneSessionInfo messages', async () => {
      const mockHandler = vi.fn().mockResolvedValue(undefined);
      const sessionData = {
        sessionInfo: {
          account: { id: 'auth-user', label: 'auth@example.com' },
          accessToken: 'auth-token'
        }
      };

      renderHook(
        () => useWebviewListener('didChangeControlPlaneSessionInfo', mockHandler),
        { wrapper }
      );

      const messageEvent = {
        data: {
          messageType: 'didChangeControlPlaneSessionInfo',
          data: sessionData,
          messageId: 'auth-message'
        }
      };

      await act(async () => {
        messageHandlers[0](messageEvent);
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(mockHandler).toHaveBeenCalledWith(sessionData);
      expect(mockIdeMessenger.respond).toHaveBeenCalledWith(
        'didChangeControlPlaneSessionInfo',
        undefined,
        'auth-message'
      );
    });

    it('should handle didChangeAvailableProfiles messages', async () => {
      const mockHandler = vi.fn().mockResolvedValue(undefined);
      const profileData = {
        profiles: [
          { id: 'profile1', title: 'Development' },
          { id: 'profile2', title: 'Production' }
        ],
        selectedProfileId: 'profile1'
      };

      renderHook(
        () => useWebviewListener('didChangeAvailableProfiles', mockHandler),
        { wrapper }
      );

      const messageEvent = {
        data: {
          messageType: 'didChangeAvailableProfiles',
          data: profileData,
          messageId: 'profile-message'
        }
      };

      await act(async () => {
        messageHandlers[0](messageEvent);
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(mockHandler).toHaveBeenCalledWith(profileData);
      expect(mockIdeMessenger.respond).toHaveBeenCalledWith(
        'didChangeAvailableProfiles',
        undefined,
        'profile-message'
      );
    });

    it('should handle didChangeIdeSettings messages', async () => {
      const mockHandler = vi.fn().mockResolvedValue(undefined);
      const settingsData = {
        settings: {
          enableControlServerBeta: true,
          debuggAiTestEnvironment: 'production'
        }
      };

      renderHook(
        () => useWebviewListener('didChangeIdeSettings', mockHandler),
        { wrapper }
      );

      const messageEvent = {
        data: {
          messageType: 'didChangeIdeSettings',
          data: settingsData,
          messageId: 'settings-message'
        }
      };

      await act(async () => {
        messageHandlers[0](messageEvent);
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(mockHandler).toHaveBeenCalledWith(settingsData);
      expect(mockIdeMessenger.respond).toHaveBeenCalledWith(
        'didChangeIdeSettings',
        undefined,
        'settings-message'
      );
    });
  });

  describe('error handling', () => {
    it('should handle handler errors gracefully', async () => {
      const mockHandler = vi.fn().mockRejectedValue(new Error('Handler error'));
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      renderHook(
        () => useWebviewListener('didChangeControlPlaneSessionInfo', mockHandler),
        { wrapper }
      );

      const messageEvent = {
        data: {
          messageType: 'didChangeControlPlaneSessionInfo',
          data: { sessionInfo: null },
          messageId: 'error-message'
        }
      };

      await act(async () => {
        messageHandlers[0](messageEvent);
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(mockHandler).toHaveBeenCalled();
      // Should still try to respond even if handler errors
      expect(mockIdeMessenger.respond).toHaveBeenCalled();

      consoleError.mockRestore();
    });

    it('should handle malformed message events', async () => {
      const mockHandler = vi.fn().mockResolvedValue('response');

      renderHook(
        () => useWebviewListener('didChangeControlPlaneSessionInfo', mockHandler),
        { wrapper }
      );

      // Malformed message without required properties
      const malformedEvent = {
        data: {
          // Missing messageType
          data: { some: 'data' },
          messageId: 'malformed-id'
        }
      };

      await act(async () => {
        messageHandlers[0](malformedEvent);
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(mockHandler).not.toHaveBeenCalled();
      expect(mockIdeMessenger.respond).not.toHaveBeenCalled();
    });

    it('should handle message events with no data', async () => {
      const mockHandler = vi.fn().mockResolvedValue('response');

      renderHook(
        () => useWebviewListener('didChangeControlPlaneSessionInfo', mockHandler),
        { wrapper }
      );

      // Event with no data property
      const noDataEvent = {};

      await act(async () => {
        messageHandlers[0](noDataEvent);
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(mockHandler).not.toHaveBeenCalled();
      expect(mockIdeMessenger.respond).not.toHaveBeenCalled();
    });
  });

  describe('dependency management', () => {
    it('should re-register listener when dependencies change', () => {
      let dependency = 'initial';
      const mockHandler = vi.fn().mockResolvedValue('response');

      const { rerender } = renderHook(
        () => useWebviewListener('didChangeControlPlaneSessionInfo', mockHandler, [dependency]),
        { wrapper }
      );

      expect(window.addEventListener).toHaveBeenCalledTimes(1);

      // Change dependency
      dependency = 'changed';
      rerender();

      // Should have re-registered (remove old + add new)
      expect(window.removeEventListener).toHaveBeenCalledTimes(1);
      expect(window.addEventListener).toHaveBeenCalledTimes(2);
    });

    it('should skip registration when skip parameter is true', () => {
      const mockHandler = vi.fn().mockResolvedValue('response');

      renderHook(
        () => useWebviewListener('didChangeControlPlaneSessionInfo', mockHandler, [], true),
        { wrapper }
      );

      expect(window.addEventListener).not.toHaveBeenCalled();
    });

    it('should register when skip parameter changes from true to false', () => {
      const mockHandler = vi.fn().mockResolvedValue('response');
      let skip = true;

      const { rerender } = renderHook(
        () => useWebviewListener('didChangeControlPlaneSessionInfo', mockHandler, [], skip),
        { wrapper }
      );

      expect(window.addEventListener).not.toHaveBeenCalled();

      skip = false;
      rerender();

      expect(window.addEventListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('multiple listeners', () => {
    it('should handle multiple listeners for different message types', async () => {
      const authHandler = vi.fn().mockResolvedValue('auth-response');
      const profileHandler = vi.fn().mockResolvedValue('profile-response');

      renderHook(
        () => {
          useWebviewListener('didChangeControlPlaneSessionInfo', authHandler);
          useWebviewListener('didChangeAvailableProfiles', profileHandler);
        },
        { wrapper }
      );

      expect(window.addEventListener).toHaveBeenCalledTimes(2);
      expect(messageHandlers.length).toBe(2);

      // Send auth message
      const authMessage = {
        data: {
          messageType: 'didChangeControlPlaneSessionInfo',
          data: { sessionInfo: null },
          messageId: 'auth-id'
        }
      };

      await act(async () => {
        messageHandlers.forEach(handler => handler(authMessage));
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(authHandler).toHaveBeenCalledWith({ sessionInfo: null });
      expect(profileHandler).not.toHaveBeenCalled();

      // Send profile message
      const profileMessage = {
        data: {
          messageType: 'didChangeAvailableProfiles',
          data: { profiles: [], selectedProfileId: null },
          messageId: 'profile-id'
        }
      };

      await act(async () => {
        messageHandlers.forEach(handler => handler(profileMessage));
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(profileHandler).toHaveBeenCalledWith({ profiles: [], selectedProfileId: null });
      expect(authHandler).toHaveBeenCalledTimes(1); // Should still be 1 from before
    });

    it('should handle concurrent message processing', async () => {
      const handler = vi.fn().mockImplementation(async (data) => {
        await new Promise(resolve => setTimeout(resolve, 10)); // Simulate async work
        return `processed-${data.id}`;
      });

      renderHook(
        () => useWebviewListener('didChangeControlPlaneSessionInfo', handler),
        { wrapper }
      );

      // Send multiple messages concurrently
      const messages = [
        { data: { messageType: 'didChangeControlPlaneSessionInfo', data: { id: 1 }, messageId: 'msg1' } },
        { data: { messageType: 'didChangeControlPlaneSessionInfo', data: { id: 2 }, messageId: 'msg2' } },
        { data: { messageType: 'didChangeControlPlaneSessionInfo', data: { id: 3 }, messageId: 'msg3' } }
      ];

      await act(async () => {
        messages.forEach(msg => messageHandlers[0](msg));
        await new Promise(resolve => setTimeout(resolve, 50)); // Allow all to complete
      });

      expect(handler).toHaveBeenCalledTimes(3);
      expect(mockIdeMessenger.respond).toHaveBeenCalledTimes(3);
      expect(mockIdeMessenger.respond).toHaveBeenCalledWith(
        'didChangeControlPlaneSessionInfo',
        'processed-1',
        'msg1'
      );
      expect(mockIdeMessenger.respond).toHaveBeenCalledWith(
        'didChangeControlPlaneSessionInfo',
        'processed-2',
        'msg2'
      );
      expect(mockIdeMessenger.respond).toHaveBeenCalledWith(
        'didChangeControlPlaneSessionInfo',
        'processed-3',
        'msg3'
      );
    });
  });

  describe('real-world auth scenarios', () => {
    it('should handle rapid auth state changes', async () => {
      const authStates: any[] = [];
      const handler = vi.fn().mockImplementation(async (data) => {
        authStates.push(data.sessionInfo);
        return undefined;
      });

      renderHook(
        () => useWebviewListener('didChangeControlPlaneSessionInfo', handler),
        { wrapper }
      );

      // Simulate rapid auth state changes
      const sessions = [
        { account: { id: 'user1' }, accessToken: 'token1' },
        null,
        { account: { id: 'user2' }, accessToken: 'token2' },
        null,
        { account: { id: 'user3' }, accessToken: 'token3' }
      ];

      await act(async () => {
        for (let i = 0; i < sessions.length; i++) {
          const message = {
            data: {
              messageType: 'didChangeControlPlaneSessionInfo',
              data: { sessionInfo: sessions[i] },
              messageId: `msg-${i}`
            }
          };
          messageHandlers[0](message);
        }
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      expect(handler).toHaveBeenCalledTimes(5);
      expect(authStates).toEqual(sessions);
    });

    it('should handle logout scenario', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);

      renderHook(
        () => useWebviewListener('didChangeControlPlaneSessionInfo', handler),
        { wrapper }
      );

      // Simulate logout message
      const logoutMessage = {
        data: {
          messageType: 'didChangeControlPlaneSessionInfo',
          data: { sessionInfo: null },
          messageId: 'logout-msg'
        }
      };

      await act(async () => {
        messageHandlers[0](logoutMessage);
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(handler).toHaveBeenCalledWith({ sessionInfo: null });
      expect(mockIdeMessenger.respond).toHaveBeenCalledWith(
        'didChangeControlPlaneSessionInfo',
        undefined,
        'logout-msg'
      );
    });

    it('should handle profile switch scenario', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);

      renderHook(
        () => useWebviewListener('didChangeAvailableProfiles', handler),
        { wrapper }
      );

      // Simulate profile switch
      const profileSwitchMessage = {
        data: {
          messageType: 'didChangeAvailableProfiles',
          data: {
            profiles: [
              { id: 'dev', title: 'Development' },
              { id: 'prod', title: 'Production' }
            ],
            selectedProfileId: 'prod'
          },
          messageId: 'profile-switch-msg'
        }
      };

      await act(async () => {
        messageHandlers[0](profileSwitchMessage);
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(handler).toHaveBeenCalledWith({
        profiles: [
          { id: 'dev', title: 'Development' },
          { id: 'prod', title: 'Production' }
        ],
        selectedProfileId: 'prod'
      });
    });
  });
}); 