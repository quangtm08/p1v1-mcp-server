#!/bin/bash

# Gmail Webhook Quick Test Script
# Usage: ./tests/quick-test.sh [WEBHOOK_URL]
# Example: ./tests/quick-test.sh https://your-webhook.herokuapp.com

# Get webhook URL from command line argument or use default
WEBHOOK_URL=${1:-${WEBHOOK_URL:-"https://dream-mail-webhook-5ab3266932fe.herokuapp.com"}}

echo "🧪 Gmail Webhook Quick Test"
echo "=========================="
echo "🌐 Testing: $WEBHOOK_URL"
echo ""

echo "1️⃣ Health Check:"
curl -s "$WEBHOOK_URL/health" | jq '.'
echo ""

echo "2️⃣ Current Users:"
curl -s "$WEBHOOK_URL/debug/users" | jq '.'
echo ""

echo "3️⃣ Email Addresses:"
curl -s "$WEBHOOK_URL/debug/emails" | jq '.'
echo ""

echo "4️⃣ OAuth URL:"
curl -s "$WEBHOOK_URL/auth/oauth-url" | jq '.authUrl'
echo ""

echo "5️⃣ Test Webhook:"
curl -s -X POST "$WEBHOOK_URL/webhook/gmail/test" \
  -H "Content-Type: application/json" \
  -d '{"emailAddress": "test@example.com", "historyId": "12345"}' | jq '.'
echo ""

echo "🎯 Next Steps:"
echo "=============="
echo "1. Visit the OAuth URL above to add a new user"
echo "2. Check users and emails endpoints after OAuth"
echo "3. Start Gmail watch for authenticated users"
echo "4. Send test emails to trigger notifications"
echo "5. Monitor logs: heroku logs --tail --app dream-mail-webhook"