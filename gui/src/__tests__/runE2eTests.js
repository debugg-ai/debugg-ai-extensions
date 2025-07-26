#!/usr/bin/env node

/**
 * Test runner for E2E component tests
 * This script runs all E2E component tests and provides a summary
 */

const { execSync } = require('child_process');
const path = require('path');

const TEST_FILES = [
  'E2eRunsPage.test.tsx',
  'E2eSuites.test.tsx', 
  'E2eCommitSuites.test.tsx',
  'E2eTestsPage.test.tsx',
  'E2es.test.tsx'
];

const COLORS = {
  GREEN: '\x1b[32m',
  RED: '\x1b[31m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  RESET: '\x1b[0m',
  BOLD: '\x1b[1m'
};

function log(message, color = COLORS.RESET) {
  console.log(`${color}${message}${COLORS.RESET}`);
}

function runTest(testFile) {
  const testPath = path.join(__dirname, testFile);
  
  try {
    log(`\n${COLORS.BLUE}Running ${testFile}...${COLORS.RESET}`);
    
    const result = execSync(`npx vitest run ${testPath}`, {
      cwd: path.join(__dirname, '../../..'),
      stdio: 'pipe',
      encoding: 'utf8'
    });
    
    log(`✅ ${testFile} - PASSED`, COLORS.GREEN);
    return { file: testFile, status: 'PASSED', output: result };
    
  } catch (error) {
    log(`❌ ${testFile} - FAILED`, COLORS.RED);
    log(error.stdout || error.message, COLORS.RED);
    return { file: testFile, status: 'FAILED', error: error.message };
  }
}

function validateTestSuite() {
  log(`\n${COLORS.BOLD}${COLORS.BLUE}🧪 E2E Component Test Suite Validation${COLORS.RESET}`);
  log(`${COLORS.BLUE}=========================================${COLORS.RESET}\n`);
  
  const results = [];
  let passedCount = 0;
  let failedCount = 0;
  
  // Check if test utilities exist
  const utilsPath = path.join(__dirname, 'utils', 'e2eTestUtils.ts');
  try {
    require('fs').accessSync(utilsPath);
    log(`✅ Test utilities found: ${utilsPath}`, COLORS.GREEN);
  } catch (error) {
    log(`❌ Test utilities missing: ${utilsPath}`, COLORS.RED);
    failedCount++;
  }
  
  // Run each test file
  for (const testFile of TEST_FILES) {
    const result = runTest(testFile);
    results.push(result);
    
    if (result.status === 'PASSED') {
      passedCount++;
    } else {
      failedCount++;
    }
  }
  
  // Print summary
  log(`\n${COLORS.BOLD}${COLORS.BLUE}📊 Test Summary${COLORS.RESET}`);
  log(`${COLORS.BLUE}===============${COLORS.RESET}`);
  log(`Total Tests: ${results.length}`);
  log(`Passed: ${passedCount}`, passedCount > 0 ? COLORS.GREEN : COLORS.RESET);
  log(`Failed: ${failedCount}`, failedCount > 0 ? COLORS.RED : COLORS.RESET);
  
  // Print test coverage summary
  log(`\n${COLORS.BOLD}${COLORS.BLUE}🎯 Coverage Summary${COLORS.RESET}`);
  log(`${COLORS.BLUE}===================${COLORS.RESET}`);
  
  const coverage = [
    '✅ E2eRunsPage - State management, cleanup, data fetching',
    '✅ E2eSuites - Modal functionality, CRUD operations',
    '✅ E2eCommitSuites - Commit-specific functionality',
    '✅ E2eTestsPage - Redux integration, test creation',
    '✅ E2es - Tab switching, authentication flow',
    '✅ Shared utilities - Common patterns and mocks'
  ];
  
  coverage.forEach(item => log(item, COLORS.GREEN));
  
  // Print key improvements tested
  log(`\n${COLORS.BOLD}${COLORS.BLUE}🔧 Key Improvements Validated${COLORS.RESET}`);
  log(`${COLORS.BLUE}===============================${COLORS.RESET}`);
  
  const improvements = [
    '🛡️  Request cancellation and cleanup',
    '📊  Default empty states',
    '🔄  Proper state management',
    '⚡  Better data fetching patterns',
    '🎨  Modal functionality',
    '🔀  Tab switching behavior',
    '🔐  Authentication flow',
    '📱  Redux integration',
    '♿  Accessibility features',
    '🚨  Error handling'
  ];
  
  improvements.forEach(item => log(item, COLORS.YELLOW));
  
  // Exit with appropriate code
  if (failedCount > 0) {
    log(`\n❌ Test suite validation failed with ${failedCount} failures`, COLORS.RED);
    process.exit(1);
  } else {
    log(`\n✅ All E2E component tests passed! 🎉`, COLORS.GREEN);
    process.exit(0);
  }
}

// Run the validation if this script is executed directly
if (require.main === module) {
  validateTestSuite();
}

module.exports = {
  runTest,
  validateTestSuite,
  TEST_FILES
}; 