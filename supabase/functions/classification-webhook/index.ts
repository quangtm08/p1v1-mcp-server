// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.
// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
/// <reference path="../deno.d.ts" />
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const N8N_WEBHOOK_URL = Deno.env.get("N8N_CLASSIFICATION_WEBHOOK_URL");
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
// Helper function to refresh Gmail access token
async function refreshGmailToken(userId) {
  try {
    const tokenData = await fetch(`${SUPABASE_URL}/rest/v1/email_tokens?user_id=eq.${userId}&provider=eq.gmail`, {
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      }
    }).then((res)=>res.json());
    if (!tokenData || tokenData.length === 0) {
      console.error('No Gmail token found for user:', userId);
      return null;
    }
    const token = tokenData[0];
    // Check if token is expired
    if (token.expires_at && new Date(token.expires_at) <= new Date()) {
      if (!token.refresh_token) {
        console.error('No refresh token available for user:', userId);
        return null;
      }
      // Refresh the token
      const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          refresh_token: token.refresh_token,
          grant_type: "refresh_token"
        })
      });
      const refreshData = await refreshResponse.json();
      if (!refreshData.access_token) {
        console.error('Failed to refresh token:', refreshData);
        return null;
      }
      // Update token in database
      await fetch(`${SUPABASE_URL}/rest/v1/email_tokens?id=eq.${token.id}`, {
        method: "PATCH",
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          access_token: refreshData.access_token,
          expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString()
        })
      });
      return refreshData.access_token;
    }
    return token.access_token;
  } catch (error) {
    console.error('Error refreshing Gmail token:', error);
    return null;
  }
}
// Helper function to check if email matches rule conditions
function matchesRule(email, rule) {
  const { conditions, match_type } = rule;
  if (match_type === 'all') {
    return conditions.every((condition)=>checkCondition(email, condition));
  } else {
    return conditions.some((condition)=>checkCondition(email, condition));
  }
}
function checkCondition(email, condition) {
  const { type, operator, value } = condition;
  let fieldValue = '';
  switch(type){
    case 'sender':
      fieldValue = email.from_address || '';
      break;
    case 'subject':
      fieldValue = email.subject || '';
      break;
    case 'body':
      fieldValue = email.body || '';
      break;
    case 'domain':
      fieldValue = email.from_address?.split('@')[1] || '';
      break;
    default:
      return false;
  }
  switch(operator){
    case 'contains':
      return fieldValue.toLowerCase().includes(value.toLowerCase());
    case 'equals':
      return fieldValue.toLowerCase() === value.toLowerCase();
    case 'starts_with':
      return fieldValue.toLowerCase().startsWith(value.toLowerCase());
    case 'ends_with':
      return fieldValue.toLowerCase().endsWith(value.toLowerCase());
    default:
      return false;
  }
}
// Helper function to apply Gmail actions
async function applyGmailActions(accessToken, messageId, actions) {
  try {
    const { category, archive, label } = actions;
    // Get or create Gmail label
    let labelId = null;
    if (label) {
      // First, try to find existing label
      const labelsResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/labels`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      const labelsData = await labelsResponse.json();
      const existingLabel = labelsData.labels?.find((l)=>l.name === label);
      if (existingLabel) {
        labelId = existingLabel.id;
      } else {
        // Create new label
        const createLabelResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/labels`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: label,
            labelListVisibility: 'labelShow',
            messageListVisibility: 'show'
          })
        });
        const newLabelData = await createLabelResponse.json();
        labelId = newLabelData.id;
      }
    }
    // Apply label and/or archive
    const modifyRequest = {
      addLabelIds: [],
      removeLabelIds: []
    };
    if (labelId) {
      modifyRequest.addLabelIds.push(labelId);
    }
    if (archive) {
      modifyRequest.removeLabelIds.push('INBOX');
    }
    if (modifyRequest.addLabelIds.length > 0 || modifyRequest.removeLabelIds.length > 0) {
      await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(modifyRequest)
      });
    }
    return true;
  } catch (error) {
    console.error('Error applying Gmail actions:', error);
    return false;
  }
}
// Helper function to send batch to n8n for AI classification
async function classifyWithAI(emails) {
  try {
    const payload = {
      emails: emails.map((email)=>({
          id: email.id,
          subject: email.subject,
          from: email.from_address,
          snippet: email.snippet,
          body: email.body?.substring(0, 1000) // Limit body length for API
        }))
    };
    
    console.log('Sending to n8n webhook:', {
      url: N8N_WEBHOOK_URL,
      emailCount: emails.length,
      payload: JSON.stringify(payload, null, 2)
    });
    
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    console.log('n8n webhook response:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('n8n webhook error response:', errorText);
      throw new Error(`n8n webhook failed: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    console.log('n8n webhook success response:', JSON.stringify(result, null, 2));
    
    // Handle both response formats:
    // 1. Direct array format: [{"email_id": "1", "category": "payment", ...}]
    // 2. Wrapped format: {"classifications": [{"email_id": "1", "category": "payment", ...}]}
    if (Array.isArray(result)) {
      console.log('Received direct array format from n8n');
      return result;
    } else if (result.classifications && Array.isArray(result.classifications)) {
      console.log('Received wrapped format from n8n');
      return result.classifications;
    } else {
      console.log('Unknown response format from n8n:', typeof result);
      return [];
    }
  } catch (error) {
    console.error('Error classifying with AI:', error);
    return [];
  }
}
Deno.serve(async (req)=>{
  try {
    console.log("Classification webhook triggered");
    console.log("Environment variables:", {
      SUPABASE_URL: SUPABASE_URL ? "SET" : "NOT SET",
      N8N_WEBHOOK_URL: N8N_WEBHOOK_URL ? "SET" : "NOT SET",
      GOOGLE_CLIENT_ID: GOOGLE_CLIENT_ID ? "SET" : "NOT SET"
    });
    
    // Fetch pending classification queue items (10-20 items)
    const queryUrl = `${SUPABASE_URL}/rest/v1/classification_queue?status=eq.pending&attempts=lt.3&order=created_at.asc`;
    console.log("Query URL:", queryUrl);
    console.log("Request headers:", {
      'apikey': SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET',
      'Authorization': SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET'
    });
    
    const response = await fetch(queryUrl, {
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY!,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY!}`,
        'Range': '0-19' // Limit to 20 items
      }
    });
    
    console.log("Response status:", response.status);
    console.log("Response headers:", Object.fromEntries(response.headers.entries()));
    
    const queueItems = await response.json();
    
    console.log("Queue fetch result:", {
      queueItemsCount: queueItems?.length || 0,
      sampleQueueItem: queueItems?.[0] || null
    });
    
    console.log("Full queue items array:", JSON.stringify(queueItems, null, 2));
    
    if (!queueItems || queueItems.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: "No pending items to process"
      }), {
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    console.log(`Processing ${queueItems.length} queue items`);
    // Group emails by user for batch processing
    const userGroups = new Map();
    queueItems.forEach((item)=>{
      if (!userGroups.has(item.user_id)) {
        userGroups.set(item.user_id, []);
      }
      userGroups.get(item.user_id).push(item);
    });
    const results = [];
    // Process each user's emails
    for (const [userId, userQueueItems] of userGroups){
      console.log(`Processing ${userQueueItems.length} items for user ${userId}`);
      // Get Gmail access token
      const accessToken = await refreshGmailToken(userId);
      if (!accessToken) {
        console.error(`No valid Gmail token for user ${userId}`);
        // Mark items as failed
        for (const item of userQueueItems){
          await fetch(`${SUPABASE_URL}/rest/v1/classification_queue?id=eq.${item.id}`, {
            method: 'PATCH',
            headers: {
              'apikey': SUPABASE_SERVICE_ROLE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              status: 'failed',
              attempts: item.attempts + 1,
              updated_at: new Date().toISOString()
            })
          });
        }
        continue;
      }
      // Fetch email details
      const emailIds = userQueueItems.map((item)=>item.email_id);
      const { data: emails, error: emailsError } = await fetch(`${SUPABASE_URL}/rest/v1/emails?id=in.(${emailIds.join(',')})`, {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      }).then((res)=>res.json());
      if (emailsError || !emails) {
        console.error(`Failed to fetch emails for user ${userId}:`, emailsError);
        continue;
      }
      
      console.log(`Fetched ${emails.length} emails for user ${userId}:`, JSON.stringify(emails, null, 2));
      // Fetch user's rules
      const { data: rules, error: rulesError } = await fetch(`${SUPABASE_URL}/rest/v1/rules?user_id=eq.${userId}&enabled=eq.true`, {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      }).then((res)=>res.json());
      const userRules = rules || [];
      // Process each email
      for (const email of emails){
        let classification = null;
        let matchedRule = null;
        // Check rules first (sorted by priority)
        const sortedRules = userRules.sort((a, b)=>a.priority - b.priority);
        for (const rule of sortedRules){
          if (matchesRule(email, rule)) {
            classification = {
              email_id: email.id,
              category: rule.actions.category,
              confidence: 1.0,
              source: 'rule',
              rule_id: rule.id
            };
            matchedRule = rule;
            if (!rule.continue_on_match) {
              break; // Stop processing other rules
            }
          }
        }
        // If no rule matched, use AI classification
        if (!classification) {
          console.log(`No rule matched for email ${email.id}, using AI classification`);
          const aiResults = await classifyWithAI([
            email
          ]);
          console.log(`AI classification results for email ${email.id}:`, aiResults);
          
          if (aiResults.length > 0) {
            classification = {
              ...aiResults[0],
              source: 'ai'
            };
          } else {
            // Default classification
            console.log(`No AI results, using default classification for email ${email.id}`);
            classification = {
              email_id: email.id,
              category: 'others',
              confidence: 0.5,
              source: 'ai'
            };
          }
        }
        
        console.log(`Final classification for email ${email.id}:`, classification);
        // Store classification result
        const { error: classificationError } = await fetch(`${SUPABASE_URL}/rest/v1/classifications`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email_id: email.id,
            user_id: userId,
            category_key: classification.category,
            score: classification.confidence,
            source: classification.source,
            model: classification.source === 'ai' ? 'gpt-4o-mini' : 'rule',
            raw_response: {
              rule_id: classification.rule_id,
              matched_rule: matchedRule?.name
            }
          })
        });
        if (classificationError) {
          console.error('Error storing classification:', classificationError);
        }
        // Apply Gmail actions
        if (matchedRule) {
          await applyGmailActions(accessToken, email.message_id, matchedRule.actions);
        } else if (classification.source === 'ai') {
          // For AI classifications, archive non-urgent emails
          const urgentCategories = [
            'important_information',
            'action'
          ];
          if (!urgentCategories.includes(classification.category)) {
            await applyGmailActions(accessToken, email.message_id, {
              category: classification.category,
              archive: true
            });
          }
        }
        // Update email status
        await fetch(`${SUPABASE_URL}/rest/v1/emails?id=eq.${email.id}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            processed_at: new Date().toISOString(),
            archived: classification.category !== 'important_information' && classification.category !== 'action'
          })
        });
        // Mark queue item as processed
        const queueItem = userQueueItems.find((item)=>item.email_id === email.id);
        if (queueItem) {
          await fetch(`${SUPABASE_URL}/rest/v1/classification_queue?id=eq.${queueItem.id}`, {
            method: 'PATCH',
            headers: {
              'apikey': SUPABASE_SERVICE_ROLE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              status: 'completed',
              processed_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
          });
        }
        results.push({
          email_id: email.id,
          classification: classification.category,
          confidence: classification.confidence,
          source: classification.source
        });
      }
    }
    return new Response(JSON.stringify({
      success: true,
      processed: results.length,
      results: results
    }), {
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("Error in classification webhook:", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      details: error.message
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
}); /* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/classification-webhook' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json'

*/ 
