# Gmail Webhook Tests

This directory contains all test scripts and utilities for the Gmail webhook system.

## 📁 Test Files

- `test-webhook.js` - Comprehensive webhook functionality test
- `generate-oauth-urls.js` - Generate OAuth URLs for existing users
- `quick-test.sh` - Quick status check script
- `test-pubsub-setup.js` - Verify Pub/Sub configuration
- `setup-gmail-watch.js` - Gmail watch setup utility
- `test-config.env` - Test configuration file

## 🚀 Usage

### Quick Test
```bash
# Test with default webhook URL
./tests/quick-test.sh

# Test with custom webhook URL
./tests/quick-test.sh https://your-webhook.herokuapp.com
```

### Comprehensive Test
```bash
# Test with default webhook URL
node tests/test-webhook.js

# Test with custom webhook URL
node tests/test-webhook.js https://your-webhook.herokuapp.com
```

### Generate OAuth URLs
```bash
# Generate OAuth URLs for all users
node tests/generate-oauth-urls.js

# Generate OAuth URLs for custom webhook
node tests/generate-oauth-urls.js https://your-webhook.herokuapp.com
```

### Test Pub/Sub Setup
```bash
# Test with default project ID
node tests/test-pubsub-setup.js

# Test with custom project ID
node tests/test-pubsub-setup.js your-project-id
```

### Setup Gmail Watch
```bash
# Setup Gmail watch for a specific user
node tests/setup-gmail-watch.js techyouth2025 62bdd1e1-68cc-49fd-b10f-3ecf45298301
```

## 🔧 Configuration

### Environment Variables
You can override default values using environment variables:

```bash
export WEBHOOK_URL=https://your-webhook.herokuapp.com
export GOOGLE_CLOUD_PROJECT_ID=your-project-id
export TEST_USER_ID=your-user-id
```

### Test Configuration File
Edit `test-config.env` to set default values for your environment.

## 📋 Test Scenarios

### 1. Health Check
- Verifies webhook server is running
- Checks basic connectivity

### 2. User Management
- Lists users with Gmail tokens
- Shows email addresses in database
- Displays user authentication status

### 3. OAuth Flow
- Generates OAuth URLs for users
- Tests OAuth callback endpoint
- Verifies authentication flow

### 4. Gmail Watch
- Tests Gmail watch setup
- Verifies Pub/Sub configuration
- Checks notification delivery

### 5. Webhook Processing
- Tests webhook endpoint
- Verifies message processing
- Checks error handling

## 🛡️ Safety Features

- **No Hardcoded Values**: All URLs and IDs are configurable
- **Environment Isolation**: Tests don't affect production
- **Error Handling**: Graceful failure with helpful messages
- **Validation**: Input validation and error checking

## 📝 Notes

- Tests are designed to be safe and non-destructive
- All hardcoded values have been removed
- Scripts can be run against any webhook instance
- Configuration is flexible and environment-aware
- No production data is modified during testing
