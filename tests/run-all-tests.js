#!/usr/bin/env node

/**
 * Test Runner - Run all Gmail webhook tests
 * 
 * Usage: node tests/run-all-tests.js [WEBHOOK_URL]
 * Example: node tests/run-all-tests.js https://your-webhook.herokuapp.com
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get webhook URL from command line argument or environment variable
const WEBHOOK_URL = process.argv[2] || process.env.WEBHOOK_URL || 'https://dream-mail-webhook-5ab3266932fe.herokuapp.com';

const tests = [
  {
    name: 'Quick Test',
    command: 'bash',
    args: ['tests/quick-test.sh', WEBHOOK_URL]
  },
  {
    name: 'Comprehensive Test',
    command: 'node',
    args: ['tests/test-webhook.js', WEBHOOK_URL]
  },
  {
    name: 'OAuth URL Generation',
    command: 'node',
    args: ['tests/generate-oauth-urls.js', WEBHOOK_URL]
  },
  {
    name: 'Pub/Sub Setup Test',
    command: 'node',
    args: ['tests/test-pubsub-setup.js']
  }
];

async function runTest(test) {
  return new Promise((resolve, reject) => {
    console.log(`\n🧪 Running ${test.name}...`);
    console.log('='.repeat(50));
    
    const child = spawn(test.command, test.args, {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${test.name} completed successfully`);
        resolve();
      } else {
        console.log(`❌ ${test.name} failed with code ${code}`);
        reject(new Error(`Test ${test.name} failed`));
      }
    });
    
    child.on('error', (error) => {
      console.log(`❌ ${test.name} error:`, error.message);
      reject(error);
    });
  });
}

async function runAllTests() {
  console.log('🚀 Gmail Webhook Test Suite');
  console.log('============================');
  console.log(`🌐 Testing: ${WEBHOOK_URL}`);
  console.log(`📅 Started: ${new Date().toISOString()}\n`);
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      await runTest(test);
      passed++;
    } catch (error) {
      failed++;
      console.log(`\n⚠️  Continuing with remaining tests...`);
    }
  }
  
  console.log('\n📊 Test Results');
  console.log('================');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Total: ${passed + failed}`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Check the output above.');
    process.exit(1);
  }
}

runAllTests().catch((error) => {
  console.error('💥 Test suite failed:', error.message);
  process.exit(1);
});
