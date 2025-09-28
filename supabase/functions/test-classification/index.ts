// Test endpoint to verify classification webhook data format
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
/// <reference path="../deno.d.ts" />

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const N8N_WEBHOOK_URL = Deno.env.get("N8N_CLASSIFICATION_WEBHOOK_URL");

Deno.serve(async (req) => {
  try {
    console.log("Test classification endpoint triggered");
    
    // Get method and path
    const method = req.method;
    const url = new URL(req.url);
    const path = url.pathname;
    
    console.log("Request details:", {
      method,
      path,
      headers: Object.fromEntries(req.headers.entries())
    });
    
    if (method === "GET") {
      // Return test data format
      const testPayload = {
        emails: [
          {
            id: "test-email-1",
            subject: "Test Email Subject",
            from: "test@example.com",
            snippet: "This is a test email snippet",
            body: "This is the full body of the test email for classification testing."
          },
          {
            id: "test-email-2", 
            subject: "Another Test Email",
            from: "another@example.com",
            snippet: "Another test snippet",
            body: "Another test email body content."
          }
        ]
      };
      
      return new Response(JSON.stringify({
        success: true,
        message: "Test endpoint - GET request",
        testPayload,
        environment: {
          SUPABASE_URL: SUPABASE_URL ? "SET" : "NOT SET",
          N8N_WEBHOOK_URL: N8N_WEBHOOK_URL || "NOT SET",
          SUPABASE_SERVICE_ROLE_KEY: SUPABASE_SERVICE_ROLE_KEY ? "SET" : "NOT SET"
        }
      }, null, 2), {
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    
    if (method === "POST") {
      // Test the actual n8n webhook
      const testPayload = {
        emails: [
          {
            id: "test-email-1",
            subject: "Test Email Subject",
            from: "test@example.com", 
            snippet: "This is a test email snippet",
            body: "This is the full body of the test email for classification testing."
          }
        ]
      };
      
      console.log("Testing n8n webhook with payload:", JSON.stringify(testPayload, null, 2));
      
      if (!N8N_WEBHOOK_URL) {
        return new Response(JSON.stringify({
          success: false,
          error: "N8N_WEBHOOK_URL not configured"
        }), {
          status: 500,
          headers: {
            "Content-Type": "application/json"
          }
        });
      }
      
      try {
        const response = await fetch(N8N_WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(testPayload)
        });
        
        console.log("n8n webhook test response:", {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        });
        
        const responseText = await response.text();
        console.log("n8n webhook response body:", responseText);
        
        return new Response(JSON.stringify({
          success: response.ok,
          status: response.status,
          statusText: response.statusText,
          response: responseText,
          testPayload
        }, null, 2), {
          headers: {
            "Content-Type": "application/json"
          }
        });
        
      } catch (error) {
        console.error("Error testing n8n webhook:", error);
        return new Response(JSON.stringify({
          success: false,
          error: error.message,
          testPayload
        }, null, 2), {
          status: 500,
          headers: {
            "Content-Type": "application/json"
          }
        });
      }
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: "Method not allowed"
    }), {
      status: 405,
      headers: {
        "Content-Type": "application/json"
      }
    });
    
  } catch (error) {
    console.error("Error in test classification endpoint:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  # Test GET request (shows data format)
  curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/test-classification' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

  # Test POST request (tests n8n webhook)
  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/test-classification' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json'

*/
