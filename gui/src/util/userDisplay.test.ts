import { describe, it, expect, vi } from 'vitest';
import {
  formatUserDisplay,
  formatUserWithPrefix,
  formatPublicUserInfo,
  isSafeReactChild,
  makeSafeReactChild,
  validateReactChild
} from './userDisplay';
import type { PublicUserInfo } from 'core/debuggAIServer/types';

const mockUser: PublicUserInfo = {
  uuid: 'user-123',
  email: 'john.doe@example.com',
  firstName: 'John',
  lastName: 'Doe',
  company: 'Acme Corp'
};

describe('userDisplay utilities', () => {
  describe('formatUserDisplay', () => {
    it('should format user with both names', () => {
      expect(formatUserDisplay(mockUser)).toBe('John Doe');
    });

    it('should format user with first name only', () => {
      const user = { ...mockUser, lastName: '' };
      expect(formatUserDisplay(user)).toBe('John');
    });

    it('should format user with last name only', () => {
      const user = { ...mockUser, firstName: '' };
      expect(formatUserDisplay(user)).toBe('Doe');
    });

    it('should fall back to email when no names', () => {
      const user = { ...mockUser, firstName: '', lastName: '' };
      expect(formatUserDisplay(user)).toBe('john.doe@example.com');
    });

    it('should handle string user', () => {
      expect(formatUserDisplay('user123')).toBe('User user123');
    });

    it('should handle null/undefined', () => {
      expect(formatUserDisplay(null)).toBe('Unknown User');
      expect(formatUserDisplay(undefined)).toBe('Unknown User');
    });

    it('should handle empty object', () => {
      expect(formatUserDisplay({})).toBe('Unknown User');
    });
  });

  describe('formatUserWithPrefix', () => {
    it('should add default prefix', () => {
      expect(formatUserWithPrefix(mockUser)).toBe('By: John Doe');
    });

    it('should add custom prefix', () => {
      expect(formatUserWithPrefix(mockUser, 'Created by: ')).toBe('Created by: John Doe');
    });
  });

  describe('formatPublicUserInfo', () => {
    it('should format PublicUserInfo correctly', () => {
      expect(formatPublicUserInfo(mockUser)).toBe('John Doe');
    });

    it('should fall back to email for PublicUserInfo', () => {
      const user = { ...mockUser, firstName: '', lastName: '' };
      expect(formatPublicUserInfo(user)).toBe('john.doe@example.com');
    });
  });

  describe('isSafeReactChild', () => {
    it('should return true for safe values', () => {
      expect(isSafeReactChild('string')).toBe(true);
      expect(isSafeReactChild(123)).toBe(true);
      expect(isSafeReactChild(true)).toBe(true);
      expect(isSafeReactChild(false)).toBe(true);
      expect(isSafeReactChild(null)).toBe(true);
      expect(isSafeReactChild(undefined)).toBe(true);
    });

    it('should return false for unsafe values', () => {
      expect(isSafeReactChild({})).toBe(false);
      expect(isSafeReactChild([])).toBe(false);
      expect(isSafeReactChild(mockUser)).toBe(false);
    });
  });

  describe('makeSafeReactChild', () => {
    it('should pass through safe values as strings', () => {
      expect(makeSafeReactChild('hello')).toBe('hello');
      expect(makeSafeReactChild(123)).toBe('123');
      expect(makeSafeReactChild(true)).toBe('true');
      expect(makeSafeReactChild(null)).toBe('');
      expect(makeSafeReactChild(undefined)).toBe('');
    });

    it('should format user objects', () => {
      expect(makeSafeReactChild(mockUser)).toBe('John Doe');
    });

    it('should handle non-user objects', () => {
      expect(makeSafeReactChild({ some: 'object' })).toBe('[Object]');
    });

    it('should handle arrays', () => {
      expect(makeSafeReactChild([1, 2, 3])).toBe('1,2,3');
    });
  });

  describe('validateReactChild', () => {
    it('should warn for object values', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      validateReactChild(mockUser, 'TestComponent');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('TestComponent: Attempting to render object as React child'),
        mockUser
      );
      
      consoleSpy.mockRestore();
    });

    it('should not warn for safe values', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      validateReactChild('safe string');
      validateReactChild(123);
      validateReactChild(null);
      
      expect(consoleSpy).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('should handle user with only whitespace names', () => {
      const user = { ...mockUser, firstName: '   ', lastName: '   ' };
      expect(formatUserDisplay(user)).toBe('john.doe@example.com');
    });

    it('should handle user with special characters in names', () => {
      const user = { ...mockUser, firstName: 'José', lastName: "O'Connor" };
      expect(formatUserDisplay(user)).toBe("José O'Connor");
    });

    it('should handle very long names', () => {
      const user = { 
        ...mockUser, 
        firstName: 'A'.repeat(100), 
        lastName: 'B'.repeat(100) 
      };
      const result = formatUserDisplay(user);
      expect(result).toBe('A'.repeat(100) + ' ' + 'B'.repeat(100));
      expect(typeof result).toBe('string');
    });

    it('should never return undefined or null', () => {
      const testCases = [null, undefined, {}, '', 0, false];
      
      testCases.forEach(testCase => {
        const result = formatUserDisplay(testCase);
        expect(result).toBeDefined();
        expect(result).not.toBeNull();
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });
    });
  });
});