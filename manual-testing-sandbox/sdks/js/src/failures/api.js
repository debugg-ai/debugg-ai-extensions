// Example of API error due to unexpected field value

async function fetchUserProfile(userId) {
    try {
        // Simulated API response with unexpected value type
        const mockApiResponse = {
            id: userId,
            name: "John Smith",
            age: "thirty", // Age sent as string instead of number
            email: "john@example.com",
            preferences: {
                theme: "dark",
                notifications: true
            }
        };

        // Function that expects age to be a number
        function calculateRetirementAge(currentAge) {
            // This will produce NaN since age is a string
            const retirementAge = currentAge + 65;
            
            return retirementAge;
        }

        const profile = mockApiResponse;
        const retirementAge = calculateRetirementAge(profile.age);

        console.log(`User ${profile.name} will retire at age ${retirementAge}`);
        return {
            ...profile,
            retirementAge
        };

    } catch (error) {
        console.error('Error processing user profile:', error);
        throw error;
    }
}

// This will trigger the error
fetchUserProfile("user_123");
