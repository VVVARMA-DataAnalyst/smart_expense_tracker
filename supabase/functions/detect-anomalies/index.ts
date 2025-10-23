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

    // Get transactions from last 3 months
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const { data: transactions, error: txError } = await supabaseClient
      .from('transactions')
      .select('*, category:categories(*)')
      .eq('user_id', user.id)
      .gte('date', threeMonthsAgo.toISOString());

    if (txError) throw txError;

    const insights = [];

    // Calculate spending statistics by category
    const categoryStats: Record<string, { amounts: number[], avg: number, max: number }> = {};
    
    transactions?.forEach((tx) => {
      const categoryId = tx.category_id || 'uncategorized';
      if (!categoryStats[categoryId]) {
        categoryStats[categoryId] = { amounts: [], avg: 0, max: 0 };
      }
      categoryStats[categoryId].amounts.push(parseFloat(tx.amount));
    });

    // Calculate averages and detect anomalies
    for (const [categoryId, stats] of Object.entries(categoryStats)) {
      const amounts = stats.amounts;
      const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const max = Math.max(...amounts);
      const stdDev = Math.sqrt(
        amounts.reduce((sq, n) => sq + Math.pow(n - avg, 2), 0) / amounts.length
      );

      categoryStats[categoryId].avg = avg;
      categoryStats[categoryId].max = max;

      // Detect unusual transactions (more than 2 standard deviations above average)
      const threshold = avg + (2 * stdDev);
      const unusualTxs = transactions?.filter(
        tx => tx.category_id === categoryId && parseFloat(tx.amount) > threshold
      );

      if (unusualTxs && unusualTxs.length > 0) {
        unusualTxs.forEach(tx => {
          insights.push({
            user_id: user.id,
            insight_type: 'anomaly',
            title: `Unusual ${tx.category?.name || 'spending'} detected`,
            description: `$${tx.amount} spent at ${tx.merchant} is ${Math.round((parseFloat(tx.amount) / avg - 1) * 100)}% higher than your average.`,
            category_id: tx.category_id,
            amount: tx.amount,
            severity: parseFloat(tx.amount) > threshold * 1.5 ? 'warning' : 'info',
            is_dismissed: false
          });
        });
      }
    }

    // Detect spending trends (month over month increase)
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    
    const lastMonthTxs = transactions?.filter(
      tx => new Date(tx.date) >= lastMonth
    );
    const prevMonthTxs = transactions?.filter(
      tx => new Date(tx.date) < lastMonth
    );

    const lastMonthTotal = lastMonthTxs?.reduce((sum, tx) => sum + parseFloat(tx.amount), 0) || 0;
    const prevMonthTotal = prevMonthTxs?.reduce((sum, tx) => sum + parseFloat(tx.amount), 0) || 0;

    if (prevMonthTotal > 0) {
      const increase = ((lastMonthTotal - prevMonthTotal) / prevMonthTotal) * 100;
      
      if (increase > 20) {
        insights.push({
          user_id: user.id,
          insight_type: 'trend',
          title: 'Spending increased significantly',
          description: `Your spending increased by ${Math.round(increase)}% compared to last month. Last month: $${prevMonthTotal.toFixed(2)}, This month: $${lastMonthTotal.toFixed(2)}.`,
          amount: lastMonthTotal - prevMonthTotal,
          severity: increase > 50 ? 'warning' : 'info',
          is_dismissed: false
        });
      }
    }

    // Save insights to database
    if (insights.length > 0) {
      const { error: insertError } = await supabaseClient
        .from('spending_insights')
        .insert(insights);

      if (insertError) throw insertError;
    }

    console.log(`Generated ${insights.length} insights for user ${user.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        insights_generated: insights.length,
        insights 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in detect-anomalies:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
