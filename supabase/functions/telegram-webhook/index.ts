import { z } from 'npm:zod@4.3.6';
import { createClient } from 'npm:@supabase/supabase-js@2.103.2';
import { parseAndCreate } from '../_shared/transaction-service.ts';

const messageSchema = z.object({
  message: z.object({
    text: z.string(),
    from: z.object({
      id: z.number(),
    }).optional(),
  }),
});

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const webhookSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');
const admin = createClient(supabaseUrl, serviceRole);

/**
 * Expected format from a verified Telegram user:
 * /tx <description>
 * The familyGroupId, userId, and accountId are derived server-side from
 * the verified Telegram user's link record.
 */
function parseCommand(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/tx')) return null;
  const text = trimmed.slice(3).trim();
  return text.length > 0 ? text : null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Verify Telegram webhook secret token
  if (!webhookSecret) {
    console.error('TELEGRAM_WEBHOOK_SECRET not configured');
    return new Response(JSON.stringify({ ok: false, error: 'Server not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const providedSecret = req.headers.get('x-telegram-bot-api-secret-token');
  if (providedSecret !== webhookSecret) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const payload = messageSchema.parse(await req.json());
    const telegramUserId = payload.message.from?.id;

    if (!telegramUserId) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing sender' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const text = parseCommand(payload.message.text);
    if (!text) {
      return new Response(JSON.stringify({ ok: false, error: 'Comando non valido. Usa /tx <testo>' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Resolve the verified user from telegram_bot_links
    const { data: link, error: linkError } = await admin
      .from('telegram_bot_links')
      .select('user_id, family_group_id')
      .eq('telegram_id', String(telegramUserId))
      .maybeSingle();

    if (linkError || !link) {
      return new Response(JSON.stringify({ ok: false, error: 'Telegram account non collegato' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Find the primary account for this verified family
    const { data: account, error: accountError } = await admin
      .from('accounts')
      .select('id')
      .eq('family_group_id', link.family_group_id)
      .eq('is_primary', true)
      .maybeSingle();

    if (accountError || !account) {
      return new Response(JSON.stringify({ ok: false, error: 'Nessun conto principale trovato' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const parsed = await parseAndCreate({
      text,
      categories: [],
      familyGroupId: link.family_group_id,
      userId: link.user_id,
      accountId: account.id,
    });

    return new Response(JSON.stringify({ ok: true, parsed }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: (error as Error).message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
