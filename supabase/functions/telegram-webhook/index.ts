import { z } from 'npm:zod@4.3.6';
import { parseAndCreate } from '../_shared/transaction-service.ts';

const messageSchema = z.object({
  message: z.object({
    text: z.string(),
  }),
});

const commandSchema = z.object({
  familyGroupId: z.string().uuid(),
  userId: z.string().uuid(),
  accountId: z.string().uuid(),
  text: z.string().min(1),
});

/**
 * Expected format:
 * /tx <familyGroupId> <userId> <accountId> <description>
 */
function parseCommand(raw: string) {
  const parts = raw.trim().split(/\s+/);
  if (parts[0] !== '/tx' || parts.length < 5) return null;

  const [_, familyGroupId, userId, accountId, ...textParts] = parts;
  return commandSchema.safeParse({
    familyGroupId,
    userId,
    accountId,
    text: textParts.join(' '),
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const payload = messageSchema.parse(await req.json());
    const parsedCommand = parseCommand(payload.message.text);

    if (!parsedCommand || !parsedCommand.success) {
      return new Response(JSON.stringify({ ok: false, error: 'Comando non valido. Usa /tx <familyId> <userId> <accountId> <testo>' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { familyGroupId, userId, accountId, text } = parsedCommand.data;

    const parsed = await parseAndCreate({
      text,
      categories: [],
      familyGroupId,
      userId,
      accountId,
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
