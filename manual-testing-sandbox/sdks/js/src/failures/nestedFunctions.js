// Example of nested functions with closure issues and error propagation

function createUserManager(initialUsers = []) {
    let users = [...initialUsers];
    let nextId = 1;

    // Nested function to generate IDs
    function generateUserId() {
        return `USER_${nextId++}`;
    }

    // Nested function to validate user
    function validateUserData(userData) {
        if (!userData || typeof userData !== 'object') {
            throw new Error('Invalid user data object');
        }

        // This validation will pass but cause problems later
        if (!userData.preferences) {
            userData.preferences = null; // Problematic default
        }
    }

    // Nested function to process preferences
    function processUserPreferences(preferences) {
        // This will throw error when preferences is null
        // but error message won't show where null was introduced
        return preferences.theme || 'default';
    }

    return {
        addUser(userData) {
            try {
                validateUserData(userData);
                
                const user = {
                    id: generateUserId(),
                    ...userData,
                    // This calls processUserPreferences with null when preferences wasn't provided
                    theme: processUserPreferences(userData.preferences)
                };

                users.push(user);
                return user;
            } catch (error) {
                // Error gets wrapped, making it harder to trace
                throw new Error(`Failed to add user: ${error.message}`);
            }
        },

        getAllUsers() {
            return [...users];
        }
    };
}

// Usage that will cause error
const userManager = createUserManager();

try {
    // This will throw error but stack trace won't clearly show the null preference issue
    const newUser = userManager.addUser({
        name: "John Doe",
        email: "john@example.com"
        // preferences missing
    });
} catch (e) {
    console.error("Error adding user:", e);
}
