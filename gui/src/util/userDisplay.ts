import type { PublicUserInfo } from 'core/debuggAIServer/types';

/**
 * Safely formats a user object for display in React components.
 * This utility prevents "Objects are not valid as a React child" errors
 * by ensuring only strings are returned.
 */
export function formatUserDisplay(user: any): string {
  if (!user) {
    return 'Unknown User';
  }

  // Handle string user IDs
  if (typeof user === 'string') {
    return `User ${user}`;
  }

  // Handle user objects
  if (typeof user === 'object') {
    const firstName = user.firstName || '';
    const lastName = user.lastName || '';
    const email = user.email || '';
    
    const fullName = `${firstName} ${lastName}`.trim();
    
    if (fullName) {
      return fullName;
    }
    
    if (email) {
      return email;
    }
    
    return 'Unknown User';
  }

  // Fallback for any other type
  return String(user);
}

/**
 * Formats a user with a "By: " prefix, commonly used in commit suites
 */
export function formatUserWithPrefix(user: any, prefix: string = 'By: '): string {
  return `${prefix}${formatUserDisplay(user)}`;
}

/**
 * Formats a PublicUserInfo object specifically, with type safety
 */
export function formatPublicUserInfo(user: PublicUserInfo): string {
  const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  return fullName || user.email || 'Unknown User';
}

/**
 * React-safe user display component props
 */
export interface SafeUserDisplayProps {
  user: any;
  prefix?: string;
  fallback?: string;
}

/**
 * Type guard to check if a value is safe to render in React
 */
export function isSafeReactChild(value: any): value is string | number | boolean | null | undefined {
  const type = typeof value;
  return (
    type === 'string' ||
    type === 'number' ||
    type === 'boolean' ||
    value === null ||
    value === undefined
  );
}

/**
 * Ensures any value is safe to render as a React child
 */
export function makeSafeReactChild(value: any): string {
  if (isSafeReactChild(value)) {
    return String(value ?? '');
  }
  
  if (Array.isArray(value)) {
    return value.join(',');
  }
  
  if (typeof value === 'object') {
    // If it looks like a user object, format it appropriately
    if (value && ('firstName' in value || 'lastName' in value || 'email' in value)) {
      return formatUserDisplay(value);
    }
    
    // For other objects, provide a safe fallback
    return '[Object]';
  }
  
  return String(value);
}

/**
 * Validation function for development/testing to catch object rendering issues
 */
export function validateReactChild(value: any, componentName: string = 'Component'): void {
  if (typeof value === 'object' && value !== null) {
    console.warn(
      `⚠️  ${componentName}: Attempting to render object as React child. ` +
      'This will cause an error. Use formatUserDisplay() or makeSafeReactChild() instead.',
      value
    );
  }
}