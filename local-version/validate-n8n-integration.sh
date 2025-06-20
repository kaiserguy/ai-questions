#!/bin/bash

# Integration test script for n8n chat and Wikipedia workflow
# This script validates the end-to-end functionality of the n8n integration

echo "Starting n8n integration validation..."

# Check if n8n is running
echo "Checking n8n availability..."
n8n_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5678 || echo "failed")

if [ "$n8n_status" = "failed" ] || [ "$n8n_status" != "200" ]; then
  echo "⚠️ n8n is not running. Please start n8n before running this test."
  echo "You can start n8n using docker-compose in the n8n-agent directory."
  exit 1
fi

echo "✅ n8n is running"

# Check if the AI Questions server is running
echo "Checking AI Questions server availability..."
server_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 || echo "failed")

if [ "$server_status" = "failed" ] || [ "$server_status" != "200" ]; then
  echo "⚠️ AI Questions server is not running. Please start the server before running this test."
  echo "You can start the server with: LOCAL_MODE=true node index.js"
  exit 1
fi

echo "✅ AI Questions server is running"

# Test n8n chat workflow
echo "Testing n8n chat workflow..."
chat_response=$(curl -s -X POST http://localhost:5678/webhook/ai-chat-processor \
  -H "Content-Type: application/json" \
  -d '{"message":"What is the capital of Poland?","model":"mistral:7b","includeWikipedia":true}')

if [[ $chat_response == *"success"*"true"* ]]; then
  echo "✅ n8n chat workflow test passed"
else
  echo "❌ n8n chat workflow test failed"
  echo "Response: $chat_response"
fi

# Test n8n Wikipedia article workflow
echo "Testing n8n Wikipedia article workflow..."
article_response=$(curl -s -X GET "http://localhost:5678/webhook/wikipedia-article-processor?id=12345")

if [[ $article_response == *"article"* ]] || [[ $article_response == *"success"* ]]; then
  echo "✅ n8n Wikipedia article workflow test passed"
else
  echo "❌ n8n Wikipedia article workflow test failed"
  echo "Response: $article_response"
fi

# Test frontend integration
echo "Testing frontend integration with n8n..."
frontend_test=$(curl -s http://localhost:3000 | grep -c "n8n-query-logging.js")

if [ "$frontend_test" -gt 0 ]; then
  echo "✅ Frontend integration test passed"
else
  echo "❌ Frontend integration test failed - n8n-query-logging.js not found in frontend"
fi

echo "Validation complete!"
