import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    // Get all transactions for the user from the last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data: transactions, error: txError } = await supabaseClient
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', sixMonthsAgo.toISOString())
      .order('date', { ascending: true });

    if (txError) throw txError;

    // Group transactions by merchant and similar amounts
    const merchantGroups: Record<string, any[]> = {};
    
    transactions?.forEach((tx) => {
      const merchant = tx.merchant?.toLowerCase() || 'unknown';
      const amount = parseFloat(tx.amount);
      const key = `${merchant}_${Math.round(amount)}`;
      
      if (!merchantGroups[key]) {
        merchantGroups[key] = [];
      }
      merchantGroups[key].push(tx);
    });

    const patterns = [];

    // Analyze each group for recurring patterns
    for (const [key, txList] of Object.entries(merchantGroups)) {
      if (txList.length < 2) continue; // Need at least 2 transactions

      // Sort by date
      txList.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Calculate intervals between transactions (in days)
      const intervals: number[] = [];
      for (let i = 1; i < txList.length; i++) {
        const days = Math.round(
          (new Date(txList[i].date).getTime() - new Date(txList[i - 1].date).getTime()) / 
          (1000 * 60 * 60 * 24)
        );
        intervals.push(days);
      }

      // Detect frequency based on average interval
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const stdDev = Math.sqrt(
        intervals.reduce((sq, n) => sq + Math.pow(n - avgInterval, 2), 0) / intervals.length
      );

      // If standard deviation is low, it's likely recurring
      const isRecurring = stdDev < avgInterval * 0.3;

      if (isRecurring) {
        let frequency = 'monthly';
        if (avgInterval < 10) frequency = 'weekly';
        else if (avgInterval > 300) frequency = 'yearly';

        // Calculate next expected date
        const lastTx = txList[txList.length - 1];
        const nextDate = new Date(lastTx.date);
        nextDate.setDate(nextDate.getDate() + avgInterval);

        const confidence = Math.max(0.7, Math.min(0.99, 1 - (stdDev / avgInterval)));

        patterns.push({
          user_id: user.id,
          merchant: txList[0].merchant,
          amount: txList[0].amount,
          frequency,
          next_expected_date: nextDate.toISOString(),
          confidence,
          is_active: true
        });
      }
    }

    // Save detected patterns to database
    if (patterns.length > 0) {
      // First, deactivate old patterns
      await supabaseClient
        .from('recurring_patterns')
        .update({ is_active: false })
        .eq('user_id', user.id);

      // Insert new patterns
      const { error: insertError } = await supabaseClient
        .from('recurring_patterns')
        .insert(patterns);

      if (insertError) throw insertError;
    }

    console.log(`Detected ${patterns.length} recurring patterns for user ${user.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        patterns_detected: patterns.length,
        patterns 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in detect-recurring-payments:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
