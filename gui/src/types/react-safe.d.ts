/**
 * Type definitions for React-safe rendering to prevent object rendering errors
 */

import { ReactNode } from 'react';

/**
 * Safe React child types that can be rendered without error
 */
export type SafeReactChild = string | number | boolean | null | undefined;

/**
 * Utility type to ensure a value is safe to render as a React child
 */
export type EnsureSafeReactChild<T> = T extends object 
  ? string 
  : T extends SafeReactChild 
  ? T 
  : string;

/**
 * Type guard function signature for checking if a value is safe to render
 */
export type SafeReactChildGuard = (value: any) => value is SafeReactChild;

/**
 * Enhanced JSX element type that warns about object children at compile time
 */
declare global {
  namespace JSX {
    interface Element extends React.ReactElement<any, any> {}
    
    interface ElementChildrenAttribute {
      children: ReactNode; // This ensures children are properly typed
    }
  }
}

/**
 * Utility type for props that might contain user objects
 */
export interface UserDisplayProps {
  user?: any; // The user object that needs safe rendering
  fallback?: string; // Fallback text if user is not available
  prefix?: string; // Optional prefix like "By: "
}

/**
 * Type for components that need to safely render user information
 */
export interface SafeUserRenderComponent {
  (props: UserDisplayProps): React.ReactElement<{ children: string }>;
}

/**
 * Branded type to ensure values have been processed for safe rendering
 */
export type SafelyProcessed<T = string> = T & { __safelyProcessed: true };

/**
 * Utility to mark a string as safely processed
 */
export function markAsSafelyProcessed<T extends string>(value: T): SafelyProcessed<T> {
  return value as SafelyProcessed<T>;
}