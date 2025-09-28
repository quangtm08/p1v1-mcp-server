// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.
// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
/// <reference path="../deno.d.ts" />
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
Deno.serve(async (req)=>{
  try {
    console.log("OAuth callback received:", req.method, req.url);
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    console.log("Code:", code ? "present" : "missing");
    console.log("State:", state);
    if (!code) {
      console.log("Missing authorization code");
      return new Response(JSON.stringify({
        error: "Missing code"
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    // Exchange code for tokens
    console.log("Exchanging code for tokens...");
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: `${SUPABASE_URL}/functions/v1/gmail-oauth-callback`,
        grant_type: "authorization_code"
      })
    });
    const tokenData = await tokenRes.json();
    console.log("Token response status:", tokenRes.status);
    console.log("Token data keys:", Object.keys(tokenData));
    if (!tokenData.access_token) {
      console.log("Token exchange failed:", tokenData);
      return new Response(JSON.stringify({
        error: "Token exchange failed",
        details: tokenData
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    // Get user info from ID token
    const idToken = tokenData.id_token;
    let googleUserId = null;
    if (idToken) {
      const payload = JSON.parse(atob(idToken.split(".")[1]));
      googleUserId = payload.sub;
      console.log("Google User ID from token:", googleUserId);
    }
    // Get the Supabase user ID from the state parameter
    const supabaseUserId = state; // This should be the Supabase user ID passed from frontend
    console.log("=== DEBUG INFO ===");
    console.log("State parameter:", state);
    console.log("Supabase User ID:", supabaseUserId);
    console.log("Google User ID:", googleUserId);
    console.log("==================");
    if (!supabaseUserId) {
      console.log("Missing Supabase user ID in state parameter");
      return new Response(JSON.stringify({
        error: "Missing user context - please ensure you're logged in to the app"
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    // Validate that supabaseUserId is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(supabaseUserId)) {
      console.log("Invalid UUID format for Supabase user ID:", supabaseUserId);
      return new Response(JSON.stringify({
        error: "Invalid user ID format - please try logging in again"
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    // Store tokens in Supabase using UPSERT (insert or update)
    console.log("Storing tokens in Supabase for user:", supabaseUserId);
    const supabaseRes = await fetch(`${SUPABASE_URL}/rest/v1/email_tokens`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Prefer": "return=representation,resolution=merge-duplicates"
      },
      body: JSON.stringify({
        user_id: supabaseUserId,
        provider: "gmail",
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      })
    });
    const supabaseData = await supabaseRes.json();
    console.log("Supabase response status:", supabaseRes.status);
    console.log("Supabase data:", supabaseData);
    // Handle duplicate key error gracefully
    if (supabaseRes.status === 409 && supabaseData.code === "23505") {
      console.log("Tokens already exist for this user, updating instead...");
      // Update existing tokens
      const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/email_tokens?user_id=eq.${supabaseUserId}&provider=eq.gmail`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Prefer": "return=representation"
        },
        body: JSON.stringify({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
        })
      });
      const updateData = await updateRes.json();
      console.log("Update response status:", updateRes.status);
      console.log("Update data:", updateData);
      return new Response(JSON.stringify({
        success: true,
        message: "Gmail tokens updated successfully",
        supabase: updateData
      }), {
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    if (supabaseRes.status >= 400) {
      console.log("Supabase error:", supabaseData);
      return new Response(JSON.stringify({
        error: "Failed to store tokens",
        details: supabaseData
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    return new Response(JSON.stringify({
      success: true,
      supabase: supabaseData
    }), {
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("Error in OAuth callback:", error);
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

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/gmail-oauth-callback' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/ 
