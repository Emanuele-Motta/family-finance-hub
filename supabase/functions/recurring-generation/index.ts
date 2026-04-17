// Author: Emanuele Motta
// Date: 16-Apr-2026
// Supabase Edge Function: Generate recurring occurrences
// Runs daily to create upcoming recurring transaction instances

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async req => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔄 Starting recurring occurrences generation...');

    // Get all active recurring templates
    const { data: templates, error: templatesError } = await supabase
      .from('recurring_templates')
      .select('*')
      .eq('is_active', true);

    if (templatesError) throw templatesError;

    let generatedCount = 0;
    let errorCount = 0;

    for (const template of templates || []) {
      try {
        // Get the latest occurrence
        const { data: lastOccurrence } = await supabase
          .from('recurring_occurrences')
          .select('occurrence_date')
          .eq('recurring_template_id', template.id)
          .order('occurrence_date', { ascending: false })
          .limit(1)
          .single();

        const lastDate = lastOccurrence
          ? new Date(lastOccurrence.occurrence_date)
          : new Date(template.starts_at);

        // Generate next 90 days of occurrences
        const occurrences = generateOccurrences(
          template,
          new Date(lastDate),
          new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
        );

        if (occurrences.length > 0) {
          const { error: insertError } = await supabase
            .from('recurring_occurrences')
            .insert(
              occurrences.map(date => ({
                recurring_template_id: template.id,
                family_group_id: template.family_group_id,
                occurrence_date: date.toISOString(),
                status: 'pending',
                created_at: new Date().toISOString(),
              }))
            );

          if (insertError) {
            console.error(
              `Error inserting occurrences for template ${template.id}:`,
              insertError
            );
            errorCount++;
          } else {
            generatedCount += occurrences.length;
            console.log(
              `✅ Generated ${occurrences.length} occurrences for template ${template.id}`
            );
          }
        }
      } catch (err) {
        console.error(`Error processing template ${template.id}:`, err);
        errorCount++;
      }
    }

    console.log(
      `✅ Recurring occurrences generation complete. Generated: ${generatedCount}, Errors: ${errorCount}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        generated: generatedCount,
        errors: errorCount,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('❌ Recurring generation failed:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

/**
 * Generate occurrences for a recurring template
 */
function generateOccurrences(
  template: any,
  startDate: Date,
  endDate: Date
): Date[] {
  const occurrences: Date[] = [];
  let currentDate = new Date(startDate);

  const maxOccurrences = template.max_occurrences || 1000;
  const templateEndDate = template.ends_at ? new Date(template.ends_at) : null;

  while (occurrences.length < maxOccurrences && currentDate <= endDate) {
    if (templateEndDate && currentDate > templateEndDate) {
      break;
    }

    occurrences.push(new Date(currentDate));
    currentDate = getNextDate(currentDate, template);
  }

  return occurrences;
}

/**
 * Calculate next occurrence date based on frequency
 */
function getNextDate(currentDate: Date, template: any): Date {
  const next = new Date(currentDate);
  const interval = template.interval || 1;

  switch (template.frequency) {
    case 'daily':
      next.setDate(next.getDate() + interval);
      break;

    case 'weekly':
      next.setDate(next.getDate() + 7 * interval);
      break;

    case 'biweekly':
      next.setDate(next.getDate() + 14 * interval);
      break;

    case 'monthly':
      const dayOfMonth = template.day_of_month || next.getDate();
      next.setMonth(next.getMonth() + interval);
      next.setDate(Math.min(dayOfMonth, getDaysInMonth(next)));
      break;

    case 'quarterly':
      next.setMonth(next.getMonth() + 3 * interval);
      break;

    case 'yearly':
      next.setFullYear(next.getFullYear() + interval);
      break;

    default:
      next.setDate(next.getDate() + 1);
  }

  return next;
}

function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}
