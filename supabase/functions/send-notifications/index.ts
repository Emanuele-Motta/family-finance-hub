// Author: Emanuele Motta
// Date: 16-Apr-2026
// Supabase Edge Function: Send notifications
// Delivers queued notifications via Telegram, Email, and Push

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('📬 Starting notification delivery...');

    // Get pending notifications
    const { data: notifications, error: notifError } = await supabase
      .from('notifications')
      .select('*')
      .eq('delivery_status', 'pending')
      .limit(100);

    if (notifError) throw notifError;

    let deliveredCount = 0;
    let failedCount = 0;

    for (const notif of notifications || []) {
      try {
        // Get user telegram/email if applicable
        const { data: userData } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', notif.user_id)
          .single();

        // Send via specified channels
        const channels = (notif.delivery_channels || ['push']).split(',');

        for (const channel of channels) {
          try {
            switch (channel.trim()) {
              case 'telegram':
                if (telegramBotToken && userData?.telegram_user_id) {
                  await sendTelegramMessage(
                    telegramBotToken,
                    userData.telegram_user_id,
                    notif.title,
                    notif.message
                  );
                  console.log(`✅ Telegram sent to ${notif.user_id}`);
                }
                break;

              case 'email':
                if (resendApiKey && userData?.email) {
                  await sendEmailNotification(
                    resendApiKey,
                    userData.email,
                    notif.title,
                    notif.message
                  );
                  console.log(`✅ Email sent to ${userData.email}`);
                }
                break;

              case 'push':
                // Push notifications handled by Firebase Cloud Messaging
                console.log(`📱 Push notification queued for ${notif.user_id}`);
                break;
            }
          } catch (channelError) {
            console.error(`Error sending via ${channel}:`, channelError);
          }
        }

        // Mark as delivered
        await supabase
          .from('notifications')
          .update({
            delivery_status: 'delivered',
            delivery_sent_at: new Date().toISOString(),
          })
          .eq('id', notif.id);

        deliveredCount++;
      } catch (err) {
        console.error(`Error processing notification ${notif.id}:`, err);

        // Mark as failed
        await supabase
          .from('notifications')
          .update({
            delivery_status: 'failed',
            delivery_error: err.message,
          })
          .eq('id', notif.id);

        failedCount++;
      }
    }

    console.log(
      `✅ Notification delivery complete. Delivered: ${deliveredCount}, Failed: ${failedCount}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        delivered: deliveredCount,
        failed: failedCount,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('❌ Notification delivery failed:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

/**
 * Send message via Telegram Bot API
 */
async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  title: string,
  message: string
): Promise<void> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const text = `*${title}*\n\n${message}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown',
    }),
  });

  if (!response.ok) {
    throw new Error(`Telegram API error: ${response.statusText}`);
  }
}

/**
 * Send email via Resend API
 */
async function sendEmailNotification(
  apiKey: string,
  email: string,
  title: string,
  message: string
): Promise<void> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: 'notifications@familyfinance.app',
      to: email,
      subject: title,
      html: `
        <h2>${title}</h2>
        <p>${message}</p>
        <hr />
        <p><small>Family Finance Hub</small></p>
      `,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Resend API error: ${error.message}`);
  }
}
