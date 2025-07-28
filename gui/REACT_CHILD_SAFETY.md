# React Child Safety Guidelines

This document outlines best practices for preventing "Objects are not valid as a React child" errors in our React components.

## The Problem

React can only render certain types as children:
- Strings
- Numbers
- Booleans
- `null` or `undefined`
- React elements
- Arrays of the above

When you try to render an object directly, React throws the error:
```
Objects are not valid as a React child (found: object with keys {uuid, email, firstName, lastName, company})
```

## Common Scenarios That Cause This Error

### 1. Direct Object Rendering
```tsx
// ❌ BAD - Will cause error
const user = { firstName: 'John', lastName: 'Doe', email: 'john@example.com' };
return <div>{user}</div>;

// ✅ GOOD - Use utility function
return <div>{formatUserDisplay(user)}</div>;
```

### 2. Conditional Rendering That Can Return Objects
```tsx
// ❌ BAD - Can return object
return (
  <div>
    {user ? user : 'No user'}
  </div>
);

// ✅ GOOD - Always returns string
return (
  <div>
    {user ? formatUserDisplay(user) : 'No user'}
  </div>
);
```

### 3. Complex Ternary Expressions
```tsx
// ❌ BAD - Can accidentally return object
const displayName = user && typeof user === 'object' 
  ? user.firstName || user  // This could return the object!
  : 'Unknown';

// ✅ GOOD - Use IIFE to ensure string return
const displayName = user && typeof user === 'object' 
  ? (() => {
      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
      return fullName || user.email || 'Unknown User';
    })()
  : `User ${user || 'Unknown'}`;
```

## Best Practices

### 1. Use Utility Functions

Always use our utility functions from `src/util/userDisplay.ts`:

```tsx
import { formatUserDisplay, formatUserWithPrefix } from '../util/userDisplay';

// For simple user display
<span>{formatUserDisplay(user)}</span>

// For user display with prefix
<span>{formatUserWithPrefix(user, 'Created by: ')}</span>
```

### 2. Type Your Props Properly

```tsx
// ✅ GOOD - Clear prop typing
interface UserDisplayProps {
  user: PublicUserInfo | string | null;
  prefix?: string;
}

function UserDisplay({ user, prefix = 'By: ' }: UserDisplayProps) {
  return <span>{formatUserWithPrefix(user, prefix)}</span>;
}
```

### 3. Validate in Development

Use the validation function during development:

```tsx
import { validateReactChild } from '../util/userDisplay';

function MyComponent({ data }) {
  // In development, this will warn if data is an object
  if (process.env.NODE_ENV === 'development') {
    validateReactChild(data, 'MyComponent');
  }
  
  return <div>{makeSafeReactChild(data)}</div>;
}
```

### 4. Handle Edge Cases

Always consider what happens with:
- `null` or `undefined` values
- Empty objects `{}`
- Objects without expected properties
- Malformed API responses

```tsx
// ✅ GOOD - Handles all edge cases
function SafeUserDisplay({ user }: { user: any }) {
  if (!user) return <span>Unknown User</span>;
  
  if (typeof user === 'string') {
    return <span>User {user}</span>;
  }
  
  if (typeof user === 'object') {
    const name = formatUserDisplay(user);
    return <span>{name}</span>;
  }
  
  return <span>{String(user)}</span>;
}
```

## Testing Guidelines

### 1. Test Object Rendering Scenarios

Always test components with various user data types:

```tsx
const testCases = [
  { firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
  { firstName: 'John', lastName: '', email: 'john@example.com' },
  { firstName: '', lastName: '', email: 'john@example.com' },
  'string-user-id',
  null,
  undefined,
  {}
];

testCases.forEach(user => {
  it(`should handle user: ${JSON.stringify(user)}`, () => {
    expect(() => render(<UserComponent user={user} />)).not.toThrow();
  });
});
```

### 2. Test Component Stability

Ensure components don't break on re-renders:

```tsx
it('should handle re-renders without errors', () => {
  const { rerender } = render(<UserComponent user={mockUser} />);
  
  // Re-render multiple times
  for (let i = 0; i < 5; i++) {
    expect(() => {
      rerender(<UserComponent user={mockUser} />);
    }).not.toThrow();
  }
});
```

## ESLint Rules

Our ESLint configuration prevents common object rendering mistakes:

```json
{
  "rules": {
    "react/jsx-no-leaked-render": "error",
    "no-restricted-syntax": [
      "error",
      {
        "selector": "JSXExpressionContainer > ObjectExpression",
        "message": "Don't render objects directly in JSX. Use formatUserDisplay() or similar utility functions."
      }
    ]
  }
}
```

## TypeScript Configuration

We use strict TypeScript settings to catch potential issues:

```json
{
  "compilerOptions": {
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noUncheckedIndexedAccess": true
  }
}
```

## Common Fixes

### Before (Problematic)
```tsx
// Component with potential object rendering
function CommitSuiteCard({ suite }) {
  return (
    <div>
      <h3>{suite.description}</h3>
      <p>By: {suite.createdBy}</p> {/* Could be object! */}
    </div>
  );
}
```

### After (Safe)
```tsx
import { formatUserWithPrefix } from '../util/userDisplay';

function CommitSuiteCard({ suite }: { suite: E2eTestCommitSuite }) {
  return (
    <div>
      <h3>{suite.description}</h3>
      <p>{formatUserWithPrefix(suite.createdBy)}</p>
    </div>
  );
}
```

## Quick Checklist

Before submitting any component that displays user data:

- [ ] Does it use `formatUserDisplay()` or similar utilities?
- [ ] Are all edge cases (null, undefined, empty object) handled?
- [ ] Does it have tests covering different user data scenarios?
- [ ] Does ESLint pass without object rendering warnings?
- [ ] Can the component re-render without errors?
- [ ] Are TypeScript types properly defined?

## Emergency Debugging

If you encounter the object rendering error:

1. **Find the component**: The error stack trace will show which component
2. **Identify the data**: Look for variables being rendered in JSX expressions
3. **Check data type**: Use `console.log(typeof data, data)` to inspect
4. **Apply fix**: Use appropriate utility function or type conversion
5. **Test thoroughly**: Ensure fix works with all possible data shapes

## Additional Resources

- [React Documentation - React Children](https://react.dev/reference/react/Children)
- [TypeScript React Cheatsheet](https://github.com/typescript-cheatsheets/react)
- Our utility functions: `src/util/userDisplay.ts`
- Integration tests: `src/__tests__/E2eSuitePages.integration.test.tsx`