
// Initialize logging
// SentinalLogger.init({
//     endpoint: 'http://localhost:81/api/v1/ingest/59be6716-a478-4834-b7e0-754f975f4368/',
//     level: 'error',
//     console: false,
//     host: 'debuggai-sandbox',
//     handleExceptions: true,
//     otherTransports: []
// });
// ConsoleWrapper.init(SentinalLogger.getLogger());

// This function expects an array of user objects with specific properties
// But silently fails in unexpected ways if given wrong parameter structure
function calculateTotalUserPoints(users) {
    let totalPoints = 0;
    
    // This will silently fail if users is not an array or objects don't have expected properties
    users.forEach(user => {
        // Attempts to add points, but if points is undefined/null it adds 0
        totalPoints += user.points?.completed || 0;
        
        // Attempts to add bonus points, may be accessing undefined properties
        if (user.achievements?.length > 5) {
            totalPoints += user.bonusPoints;
        }
    });

    console.log(`Total points calculated: ${totalPoints}`);
    return totalPoints;
}

// Example usage with correct parameter structure
const validUsers = [
    { 
        points: { completed: 100 },
        achievements: ['a1', 'a2', 'a3'],
        bonusPoints: 50
    },
    {
        points: { completed: 200 },
        achievements: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'],
        bonusPoints: 100
    }
];

// This works as expected
console.log('Valid calculation:', calculateTotalUserPoints(validUsers)); // 450

// Example of silent failures with incorrect parameter structures
const invalidUsers = {
    user1: { points: 100 },
    user2: { points: 200 }
};

// This will throw error since forEach doesn't exist on object
try {
    console.log('Invalid calculation:', calculateTotalUserPoints(invalidUsers));
} catch (e) {
    console.error('Error with invalid user structure:', e);
}

const malformedUsers = [
    { score: 100 }, // Wrong property name
    { points: 200 }, // Missing nested structure
    { points: { total: 300 } } // Wrong nested property
];

// This runs but produces incorrect results
console.log('Malformed calculation:', calculateTotalUserPoints(malformedUsers)); // 0

// String instead of array - will throw error
try {
    console.log('String input:', calculateTotalUserPoints("not an array"));
} catch (e) {
    console.error('Error with string input:', e);
}
