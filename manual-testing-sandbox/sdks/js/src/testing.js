let accountBalance = 100;

// Simulate an asynchronous delay
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Withdraw function
async function withdraw(amount) {
  const currentBalance = accountBalance;

  // Simulate some asynchronous database processing delay
  await delay(Math.floor(Math.random() * 100));

  if (currentBalance >= amount) {
    accountBalance = currentBalance - amount;
    console.log(`Withdrawn ${amount}, new balance: ${accountBalance}`);
  } else {
    console.log(`Failed to withdraw ${amount}, insufficient funds.`);
  }
}

async function main() {
  // Two withdrawals in parallel
  await Promise.all([
    withdraw(80),
    withdraw(80)
  ]);

  console.log(`Final balance: ${accountBalance}`);
}

main();
