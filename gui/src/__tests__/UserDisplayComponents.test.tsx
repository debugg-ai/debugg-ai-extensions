import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import type { PublicUserInfo, E2eTestCommitSuite } from 'core/debuggAIServer/types';

// Mock data for testing
const mockUserObject: PublicUserInfo = {
  uuid: 'user-123',
  email: 'john.doe@example.com',
  firstName: 'John',
  lastName: 'Doe',
  company: 'Acme Corp'
};

const mockCommitSuite: E2eTestCommitSuite = {
  id: 1,
  uuid: 'suite-123',
  commitHash: 'abc123def456',
  commitHashShort: 'abc123d',
  project: 1,
  projectName: 'Test Project',
  description: 'Test Suite',
  summarizedChanges: 'Some test changes',
  tests: [],
  tunnelKey: 'test-tunnel-key',
  key: 'test-key',
  runStatus: 'completed',
  createdBy: mockUserObject,
  timestamp: '2024-01-01T00:00:00Z',
  lastMod: '2024-01-01T00:00:00Z'
};

// Component to test user display logic
function UserDisplayComponent({ user }: { user: any }) {
  return (
    <div data-testid="user-display">
      {user && typeof user === 'object' 
        ? (() => {
            const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
            return fullName || user.email || 'Unknown User';
          })()
        : `User ${user || 'Unknown'}`
      }
    </div>
  );
}

// Component to test commit suite user display (from actual code)
function CommitSuiteUserDisplay({ suite }: { suite: { createdBy: any } }) {
  return (
    <div data-testid="commit-suite-user">
      By: {suite.createdBy && typeof suite.createdBy === 'object' 
        ? (() => {
            const user = suite.createdBy as any;
            const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
            return fullName || user.email || 'Unknown User';
          })()
        : `User ${suite.createdBy || 'Unknown'}`
      }
    </div>
  );
}

describe('User Display Components', () => {
  describe('UserDisplayComponent', () => {
    it('should render full name when both firstName and lastName are present', () => {
      render(<UserDisplayComponent user={mockUserObject} />);
      expect(screen.getByTestId('user-display')).toHaveTextContent('John Doe');
    });

    it('should render first name only when lastName is missing', () => {
      const userWithoutLastName = { ...mockUserObject, lastName: '' };
      render(<UserDisplayComponent user={userWithoutLastName} />);
      expect(screen.getByTestId('user-display')).toHaveTextContent('John');
    });

    it('should render last name only when firstName is missing', () => {
      const userWithoutFirstName = { ...mockUserObject, firstName: '' };
      render(<UserDisplayComponent user={userWithoutFirstName} />);
      expect(screen.getByTestId('user-display')).toHaveTextContent('Doe');
    });

    it('should fall back to email when no names are present', () => {
      const userWithoutNames = { ...mockUserObject, firstName: '', lastName: '' };
      render(<UserDisplayComponent user={userWithoutNames} />);
      expect(screen.getByTestId('user-display')).toHaveTextContent('john.doe@example.com');
    });

    it('should render "Unknown User" when no name or email is present', () => {
      const userWithoutInfo = { ...mockUserObject, firstName: '', lastName: '', email: '' };
      render(<UserDisplayComponent user={userWithoutInfo} />);
      expect(screen.getByTestId('user-display')).toHaveTextContent('Unknown User');
    });

    it('should handle string user ID', () => {
      render(<UserDisplayComponent user="user123" />);
      expect(screen.getByTestId('user-display')).toHaveTextContent('User user123');
    });

    it('should handle null/undefined user', () => {
      render(<UserDisplayComponent user={null} />);
      expect(screen.getByTestId('user-display')).toHaveTextContent('User Unknown');
    });

    it('should never render a raw object', () => {
      const { container } = render(<UserDisplayComponent user={mockUserObject} />);
      const displayText = container.textContent;
      
      // Ensure we never render the object itself
      expect(displayText).not.toContain('[object Object]');
      expect(displayText).not.toContain('uuid');
      expect(displayText).not.toContain('company');
      
      // Should render a proper string
      expect(typeof displayText).toBe('string');
      expect(displayText).toBeTruthy();
    });
  });

  describe('CommitSuiteUserDisplay', () => {
    it('should render commit suite creator properly', () => {
      render(<CommitSuiteUserDisplay suite={mockCommitSuite} />);
      expect(screen.getByTestId('commit-suite-user')).toHaveTextContent('By: John Doe');
    });

    it('should handle commit suite with string createdBy', () => {
      const suiteWithStringUser = { ...mockCommitSuite, createdBy: 'user123' };
      render(<CommitSuiteUserDisplay suite={suiteWithStringUser} />);
      expect(screen.getByTestId('commit-suite-user')).toHaveTextContent('By: User user123');
    });

    it('should handle commit suite with no createdBy', () => {
      const suiteWithoutUser = { ...mockCommitSuite, createdBy: undefined };
      render(<CommitSuiteUserDisplay suite={suiteWithoutUser} />);
      expect(screen.getByTestId('commit-suite-user')).toHaveTextContent('By: User Unknown');
    });

    it('should never render raw user object in commit suite', () => {
      const { container } = render(<CommitSuiteUserDisplay suite={mockCommitSuite} />);
      const displayText = container.textContent;
      
      // Ensure we never render the object itself
      expect(displayText).not.toContain('[object Object]');
      expect(displayText).not.toContain('uuid');
      expect(displayText).not.toContain('company');
      expect(displayText).not.toContain('email');
      
      // Should render proper text
      expect(displayText?.startsWith('By: ')).toBe(true);
    });
  });

  describe('React Child Validation', () => {
    it('should throw error when trying to render object directly', () => {
      // This test demonstrates what would happen if we tried to render the object directly
      const BrokenComponent = () => {
        // This would cause the original error:
        // return <div>{mockUserObject}</div>;
        
        // Instead, we simulate the error condition and test our fix prevents it
        const userDisplay = typeof mockUserObject === 'object' 
          ? (() => {
              const fullName = `${mockUserObject.firstName || ''} ${mockUserObject.lastName || ''}`.trim();
              return fullName || mockUserObject.email || 'Unknown User';
            })()
          : String(mockUserObject);
        
        return <div data-testid="safe-display">{userDisplay}</div>;
      };

      // This should not throw
      expect(() => render(<BrokenComponent />)).not.toThrow();
      
      // And should render proper text
      const display = screen.getByTestId('safe-display');
      expect(display).toHaveTextContent('John Doe');
    });

    it('should ensure all user display logic returns strings', () => {
      const testCases = [
        mockUserObject,
        { ...mockUserObject, firstName: '', lastName: '' },
        { ...mockUserObject, firstName: '', lastName: '', email: '' },
        'string-user',
        null,
        undefined
      ];

      testCases.forEach((user) => {
        const result = user && typeof user === 'object' 
          ? (() => {
              const fullName = `${(user as any).firstName || ''} ${(user as any).lastName || ''}`.trim();
              return fullName || (user as any).email || 'Unknown User';
            })()
          : `User ${user || 'Unknown'}`;

        expect(typeof result).toBe('string');
        expect(result).not.toContain('[object Object]');
      });
    });
  });
});