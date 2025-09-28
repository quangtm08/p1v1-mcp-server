// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.
// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
/// <reference path="../deno.d.ts" />
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
Deno.serve(async (req)=>{
  try {
    const url = new URL(req.url);
    const method = req.method;
    const path = url.pathname;
    // Extract user ID from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({
        error: 'Missing or invalid authorization header'
      }), {
        status: 401,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    const token = authHeader.substring(7);
    // Verify token and get user
    const { data: { user }, error: authError } = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': SUPABASE_SERVICE_ROLE_KEY
      }
    }).then((res)=>res.json());
    if (authError || !user) {
      return new Response(JSON.stringify({
        error: 'Invalid token'
      }), {
        status: 401,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    const userId = user.id;
    // Handle different endpoints
    if (path === '/rules' && method === 'GET') {
      // Get all rules for user
      const { data: rules, error } = await fetch(`${SUPABASE_URL}/rest/v1/rules?user_id=eq.${userId}&order=priority.asc`, {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      }).then((res)=>res.json());
      if (error) {
        throw new Error(`Failed to fetch rules: ${error.message}`);
      }
      return new Response(JSON.stringify({
        rules: rules || []
      }), {
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    if (path === '/rules' && method === 'POST') {
      // Create new rule
      const ruleData = await req.json();
      const { data: newRule, error } = await fetch(`${SUPABASE_URL}/rest/v1/rules`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...ruleData,
          user_id: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      }).then((res)=>res.json());
      if (error) {
        throw new Error(`Failed to create rule: ${error.message}`);
      }
      return new Response(JSON.stringify({
        rule: newRule
      }), {
        status: 201,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    if (path.startsWith('/rules/') && method === 'PUT') {
      // Update rule
      const ruleId = path.split('/')[2];
      const ruleData = await req.json();
      const { data: updatedRule, error } = await fetch(`${SUPABASE_URL}/rest/v1/rules?id=eq.${ruleId}&user_id=eq.${userId}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...ruleData,
          updated_at: new Date().toISOString()
        })
      }).then((res)=>res.json());
      if (error) {
        throw new Error(`Failed to update rule: ${error.message}`);
      }
      if (!updatedRule || updatedRule.length === 0) {
        return new Response(JSON.stringify({
          error: 'Rule not found'
        }), {
          status: 404,
          headers: {
            "Content-Type": "application/json"
          }
        });
      }
      return new Response(JSON.stringify({
        rule: updatedRule[0]
      }), {
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    if (path.startsWith('/rules/') && method === 'DELETE') {
      // Delete rule
      const ruleId = path.split('/')[2];
      const { error } = await fetch(`${SUPABASE_URL}/rest/v1/rules?id=eq.${ruleId}&user_id=eq.${userId}`, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      });
      if (error) {
        throw new Error(`Failed to delete rule: ${error.message}`);
      }
      return new Response(JSON.stringify({
        success: true
      }), {
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    if (path === '/categories' && method === 'GET') {
      // Get available categories
      const { data: categories, error } = await fetch(`${SUPABASE_URL}/rest/v1/categories?is_builtin=eq.true`, {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      }).then((res)=>res.json());
      if (error) {
        throw new Error(`Failed to fetch categories: ${error.message}`);
      }
      return new Response(JSON.stringify({
        categories: categories || []
      }), {
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    if (path === '/digest-settings' && method === 'GET') {
      // Get digest settings for user
      const { data: settings, error } = await fetch(`${SUPABASE_URL}/rest/v1/digest_settings?user_id=eq.${userId}`, {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      }).then((res)=>res.json());
      if (error) {
        throw new Error(`Failed to fetch digest settings: ${error.message}`);
      }
      return new Response(JSON.stringify({
        settings: settings?.[0] || null
      }), {
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    if (path === '/digest-settings' && method === 'POST') {
      // Create or update digest settings
      const settingsData = await req.json();
      const { data: settings, error } = await fetch(`${SUPABASE_URL}/rest/v1/digest_settings`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation,resolution=merge-duplicates'
        },
        body: JSON.stringify({
          ...settingsData,
          user_id: userId,
          updated_at: new Date().toISOString()
        })
      }).then((res)=>res.json());
      if (error) {
        throw new Error(`Failed to save digest settings: ${error.message}`);
      }
      return new Response(JSON.stringify({
        settings: settings?.[0] || settings
      }), {
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    if (path === '/safety-queue' && method === 'GET') {
      // Get safety queue items for user
      const { data: items, error } = await fetch(`${SUPABASE_URL}/rest/v1/safety_queue?user_id=eq.${userId}&order=created_at.desc`, {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      }).then((res)=>res.json());
      if (error) {
        throw new Error(`Failed to fetch safety queue: ${error.message}`);
      }
      return new Response(JSON.stringify({
        items: items || []
      }), {
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    if (path.startsWith('/safety-queue/') && method === 'PATCH') {
      // Update safety queue item status
      const itemId = path.split('/')[2];
      const { status, notes } = await req.json();
      const { data: updatedItem, error } = await fetch(`${SUPABASE_URL}/rest/v1/safety_queue?id=eq.${itemId}&user_id=eq.${userId}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status,
          notes,
          updated_at: new Date().toISOString()
        })
      }).then((res)=>res.json());
      if (error) {
        throw new Error(`Failed to update safety queue item: ${error.message}`);
      }
      return new Response(JSON.stringify({
        item: updatedItem?.[0]
      }), {
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    if (path === '/stats' && method === 'GET') {
      // Get user statistics
      const { data: emailStats, error: emailError } = await fetch(`${SUPABASE_URL}/rest/v1/admin_email_stats?user_id=eq.${userId}`, {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      }).then((res)=>res.json());
      const { data: classificationStats, error: classificationError } = await fetch(`${SUPABASE_URL}/rest/v1/admin_classification_stats?user_id=eq.${userId}`, {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      }).then((res)=>res.json());
      if (emailError || classificationError) {
        throw new Error(`Failed to fetch stats: ${emailError?.message || classificationError?.message}`);
      }
      return new Response(JSON.stringify({
        emailStats: emailStats?.[0] || {},
        classificationStats: classificationStats || []
      }), {
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }
    return new Response(JSON.stringify({
      error: 'Endpoint not found'
    }), {
      status: 404,
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("Error in API handler:", error);
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
}); /* API Endpoints:

GET /rules - Get all rules for user
POST /rules - Create new rule
PUT /rules/{id} - Update rule
DELETE /rules/{id} - Delete rule

GET /categories - Get available categories
GET /digest-settings - Get digest settings
POST /digest-settings - Create/update digest settings
GET /safety-queue - Get safety queue items
PATCH /safety-queue/{id} - Update safety queue item
GET /stats - Get user statistics

All endpoints require Authorization: Bearer {supabase_jwt_token}

*/ 
