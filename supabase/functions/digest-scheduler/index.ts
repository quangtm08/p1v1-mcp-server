// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.
// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
/// <reference path="../deno.d.ts" />

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const N8N_DIGEST_WEBHOOK_URL = Deno.env.get("N8N_DIGEST_WEBHOOK_URL");
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");

// Helper function to refresh Gmail access token
async function refreshGmailToken(userId: string) {
  try {
    const { data: tokenData, error } = await fetch(`${SUPABASE_URL}/rest/v1/email_tokens?user_id=eq.${userId}&provider=eq.gmail`, {
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY!,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY!}`
      }
    }).then((res) => res.json());

    if (error || !tokenData || tokenData.length === 0) {
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
          client_id: GOOGLE_CLIENT_ID!,
          client_secret: GOOGLE_CLIENT_SECRET!,
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
          'apikey': SUPABASE_SERVICE_ROLE_KEY!,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY!}`,
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

// Helper function to send digest email via Gmail API
async function sendDigestEmail(accessToken: string, to: string, subject: string, htmlContent: string) {
  try {
    // Create email message
    const message = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/html; charset=utf-8',
      '',
      htmlContent
    ].join('\n');

    // Encode message in base64url
    const encodedMessage = btoa(message)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Send email via Gmail API
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        raw: encodedMessage
      })
    });

    if (!response.ok) {
      throw new Error(`Gmail API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error sending digest email:', error);
    throw error;
  }
}

// Helper function to generate digest HTML content
function generateDigestHTML(entries: any[], userEmail: string) {
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Email Digest - ${date}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f4f4f4; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .category { margin-bottom: 30px; }
        .category-title { font-size: 18px; font-weight: bold; color: #2c3e50; margin-bottom: 10px; padding-bottom: 5px; border-bottom: 2px solid #3498db; }
        .entry { background: #f9f9f9; padding: 15px; margin-bottom: 15px; border-radius: 5px; border-left: 4px solid #3498db; }
        .entry-title { font-weight: bold; margin-bottom: 8px; }
        .entry-summary { color: #666; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>📧 Email Digest</h1>
        <p>Hello! Here's your email summary for ${date}</p>
      </div>
  `;

  // Group entries by category
  const groupedEntries = entries.reduce((acc, entry) => {
    const category = entry.category_key || 'others';
    if (!acc[category]) acc[category] = [];
    acc[category].push(entry);
    return acc;
  }, {});

  // Generate content for each category
  Object.entries(groupedEntries).forEach(([category, categoryEntries]) => {
    const categoryName = category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    html += `<div class="category">`;
    html += `<div class="category-title">${categoryName}</div>`;
    
    (categoryEntries as any[]).forEach(entry => {
      html += `
        <div class="entry">
          <div class="entry-title">${entry.summary}</div>
          <div class="entry-summary">${entry.email_count} email(s) processed</div>
        </div>
      `;
    });
    
    html += `</div>`;
  });

  html += `
      <div class="footer">
        <p>This digest was automatically generated by Dream Mail Assistant.</p>
        <p>You can manage your digest settings in your dashboard.</p>
      </div>
    </body>
    </html>
  `;

  return html;
}

Deno.serve(async (req) => {
  try {
    console.log("Digest scheduler triggered");

    // Get current time
    const now = new Date();

    // Find users with digest settings that should run now
    const { data: digestSettings, error: settingsError } = await fetch(`${SUPABASE_URL}/rest/v1/digest_settings?next_run_at=lte.${now.toISOString()}`, {
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY!,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY!}`
      }
    }).then((res) => res.json());

    if (settingsError) {
      throw new Error(`Failed to fetch digest settings: ${settingsError.message}`);
    }

    if (!digestSettings || digestSettings.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: "No digest jobs scheduled for this time"
      }), {
        headers: {
          "Content-Type": "application/json"
        }
      });
    }

    console.log(`Processing ${digestSettings.length} digest jobs`);

    const results: any[] = [];

    // Process each user's digest
    for (const settings of digestSettings) {
      const userId = settings.user_id;
      console.log(`Processing digest for user ${userId}`);

      try {
        // Get user profile
        const { data: profile, error: profileError } = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY!,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY!}`
          }
        }).then((res) => res.json());

        if (profileError || !profile || profile.length === 0) {
          console.error(`No profile found for user ${userId}`);
          continue;
        }

        const userEmail = profile[0].email;
        if (!userEmail) {
          console.error(`No email found for user ${userId}`);
          continue;
        }

        // Get Gmail access token
        const accessToken = await refreshGmailToken(userId);
        if (!accessToken) {
          console.error(`No valid Gmail token for user ${userId}`);
          continue;
        }

        // Calculate time range for emails (since last digest or last 24 hours)
        const lastSentAt = settings.last_sent_at ? new Date(settings.last_sent_at) : new Date(Date.now() - 24 * 60 * 60 * 1000);
        const timeFilter = lastSentAt.toISOString();

        // Fetch emails since last digest
        const { data: emails, error: emailsError } = await fetch(`${SUPABASE_URL}/rest/v1/emails?user_id=eq.${userId}&received_at=gte.${timeFilter}&order=received_at.desc`, {
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY!,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY!}`
          }
        }).then((res) => res.json());

        if (emailsError || !emails || emails.length === 0) {
          console.log(`No emails found for user ${userId} since ${timeFilter}`);
          // Update last sent time even if no emails
          await fetch(`${SUPABASE_URL}/rest/v1/digest_settings?id=eq.${settings.id}`, {
            method: 'PATCH',
            headers: {
              'apikey': SUPABASE_SERVICE_ROLE_KEY!,
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY!}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              last_sent_at: now.toISOString(),
              next_run_at: new Date(now.getTime() + (settings.frequency === 'daily' ? 24 : 7 * 24) * 60 * 60 * 1000).toISOString()
            })
          });
          continue;
        }

        // Get classifications for all emails
        const emailIds = emails.map(e => e.id);
        const { data: classifications, error: classificationsError } = await fetch(`${SUPABASE_URL}/rest/v1/classifications?email_id=in.(${emailIds.join(',')})`, {
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY!,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY!}`
          }
        }).then((res) => res.json());

        if (classificationsError) {
          console.error(`Failed to fetch classifications for user ${userId}:`, classificationsError);
          continue;
        }

        // Group emails by category for summarization
        const emailsByCategory = emails.reduce((acc, email) => {
          // Find the latest classification for this email
          const classification = classifications?.find(c => c.email_id === email.id);
          const category = classification?.category_key || 'others';
          if (!acc[category]) acc[category] = [];
          acc[category].push(email);
          return acc;
        }, {});

        // Send to n8n for AI summarization
        const summaries: any[] = [];
        for (const [category, categoryEmails] of Object.entries(emailsByCategory)) {
          try {
            const summaryResponse = await fetch(N8N_DIGEST_WEBHOOK_URL!, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                category,
                emails: (categoryEmails as any[]).map(email => ({
                  id: email.id,
                  subject: email.subject,
                  from: email.from_address,
                  snippet: email.snippet,
                  body: email.body?.substring(0, 1000) // Limit body length
                }))
              })
            });

            if (summaryResponse.ok) {
              const summaryData = await summaryResponse.json();
              summaries.push({
                category_key: category,
                summary: summaryData.summary || `Summary for ${category} category`,
                email_ids: (categoryEmails as any[]).map(e => e.id),
                email_count: (categoryEmails as any[]).length
              });
            } else {
              // Fallback summary
              summaries.push({
                category_key: category,
                summary: `${(categoryEmails as any[]).length} emails in ${category} category`,
                email_ids: (categoryEmails as any[]).map(e => e.id),
                email_count: (categoryEmails as any[]).length
              });
            }
          } catch (error) {
            console.error(`Error summarizing category ${category}:`, error);
            // Fallback summary
            summaries.push({
              category_key: category,
              summary: `${(categoryEmails as any[]).length} emails in ${category} category`,
              email_ids: (categoryEmails as any[]).map(e => e.id),
              email_count: (categoryEmails as any[]).length
            });
          }
        }

        // Create digest job record
        const { data: digestJob, error: jobError } = await fetch(`${SUPABASE_URL}/rest/v1/digest_jobs`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY!,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY!}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            user_id: userId,
            scheduled_for: now.toISOString(),
            status: 'processing',
            payload: {
              email_count: emails.length,
              categories: Object.keys(emailsByCategory)
            }
          })
        }).then((res) => res.json());

        if (jobError) {
          console.error('Error creating digest job:', jobError);
          continue;
        }

        // Store digest entries
        for (const summary of summaries) {
          await fetch(`${SUPABASE_URL}/rest/v1/digest_entries`, {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_SERVICE_ROLE_KEY!,
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY!}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              digest_job_id: digestJob[0].id,
              category_key: summary.category_key,
              summary: summary.summary,
              email_ids: summary.email_ids
            })
          });
        }

        // Generate and send digest email
        const subject = `📧 Email Digest - ${emails.length} emails processed`;
        const htmlContent = generateDigestHTML(summaries, userEmail);

        await sendDigestEmail(accessToken, userEmail, subject, htmlContent);

        // Update digest job status
        await fetch(`${SUPABASE_URL}/rest/v1/digest_jobs?id=eq.${digestJob[0].id}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY!,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY!}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            status: 'sent',
            result: {
              email_sent: true,
              entries_count: summaries.length,
              total_emails: emails.length
            }
          })
        });

        // Update digest settings
        await fetch(`${SUPABASE_URL}/rest/v1/digest_settings?id=eq.${settings.id}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY!,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY!}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            last_sent_at: now.toISOString(),
            next_run_at: new Date(now.getTime() + (settings.frequency === 'daily' ? 24 : 7 * 24) * 60 * 60 * 1000).toISOString()
          })
        });

        results.push({
          user_id: userId,
          emails_processed: emails.length,
          categories: Object.keys(emailsByCategory).length,
          status: 'sent'
        });

        console.log(`Digest sent successfully for user ${userId}`);

      } catch (error) {
        console.error(`Error processing digest for user ${userId}:`, error);
        results.push({
          user_id: userId,
          status: 'failed',
          error: error.message
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
    console.error("Error in digest scheduler:", error);
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
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/digest-scheduler' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json'

*/
