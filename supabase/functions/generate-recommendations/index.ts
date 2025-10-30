import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    // Get user's spending data for the last 3 months
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const { data: transactions } = await supabase
      .from('transactions')
      .select('*, categories(name)')
      .eq('user_id', user.id)
      .gte('date', threeMonthsAgo.toISOString())
      .order('date', { ascending: false });

    if (!transactions || transactions.length === 0) {
      return new Response(JSON.stringify({ message: 'No recommendations yet' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Analyze spending patterns
    const categorySpending = new Map<string, { total: number, count: number, name: string }>();
    transactions.forEach(t => {
      const catId = t.category_id || 'uncategorized';
      const catName = t.categories?.name || 'Uncategorized';
      if (!categorySpending.has(catId)) {
        categorySpending.set(catId, { total: 0, count: 0, name: catName });
      }
      const cat = categorySpending.get(catId)!;
      cat.total += Number(t.amount);
      cat.count += 1;
    });

    // Generate AI-powered recommendations using Lovable AI
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) throw new Error('LOVABLE_API_KEY not configured');

    const spendingSummary = Array.from(categorySpending.entries())
      .map(([id, data]) => `${data.name}: $${data.total.toFixed(2)} (${data.count} transactions)`)
      .join('\n');

    const prompt = `Based on the following spending data for the last 3 months, provide 3-5 personalized savings recommendations. Be specific and actionable.

Spending breakdown:
${spendingSummary}

For each recommendation, provide:
1. A clear title
2. Detailed description of the action
3. Estimated potential monthly savings
4. The category it relates to (if applicable)

Focus on realistic, achievable suggestions like reducing spending in high-cost categories, finding subscription duplicates, or optimizing recurring expenses.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a financial advisor AI that provides personalized savings recommendations. Return recommendations in a structured format.' },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      console.error('AI API error:', aiResponse.status, await aiResponse.text());
      throw new Error('Failed to generate recommendations');
    }

    const aiData = await aiResponse.json();
    const recommendationsText = aiData.choices[0].message.content;

    // Parse AI response and create recommendation records
    const recommendations = [];
    const lines = recommendationsText.split('\n');
    let currentRec: any = null;

    for (const line of lines) {
      if (line.match(/^\d+\./)) {
        if (currentRec) recommendations.push(currentRec);
        currentRec = {
          user_id: user.id,
          recommendation_type: 'savings',
          title: line.replace(/^\d+\.\s*/, '').trim(),
          description: '',
          potential_savings: null,
          category_id: null,
        };
      } else if (currentRec && line.trim()) {
        currentRec.description += line.trim() + ' ';
        
        // Try to extract savings amount
        const savingsMatch = line.match(/\$(\d+(?:\.\d{2})?)/);
        if (savingsMatch && !currentRec.potential_savings) {
          currentRec.potential_savings = parseFloat(savingsMatch[1]);
        }
      }
    }
    if (currentRec) recommendations.push(currentRec);

    // Clean up descriptions
    recommendations.forEach(rec => {
      rec.description = rec.description.trim();
    });

    // Insert recommendations into database
    const { error: insertError } = await supabase
      .from('recommendations')
      .insert(recommendations);

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ 
        message: 'Recommendations generated successfully',
        count: recommendations.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating recommendations:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});