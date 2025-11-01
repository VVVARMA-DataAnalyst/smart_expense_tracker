import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 🔐 Initialize Supabase client
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized or missing user");

    // 📊 Get user's last 3 months transactions
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const { data: transactions, error: txnError } = await supabase
      .from("transactions")
      .select("id, amount, date, category_id, categories(name)")
      .eq("user_id", user.id)
      .gte("date", threeMonthsAgo.toISOString())
      .order("date", { ascending: false });

    if (txnError) throw txnError;
    if (!transactions || transactions.length === 0) {
      return new Response(
        JSON.stringify({ message: "No transactions found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 🧮 Analyze spending by category
    const categorySpending = new Map<
      string,
      { total: number; count: number; name: string }
    >();

    transactions.forEach((t) => {
      const catId = t.category_id || "uncategorized";
      const catName = t.categories?.name || "Uncategorized";
      if (!categorySpending.has(catId)) {
        categorySpending.set(catId, { total: 0, count: 0, name: catName });
      }
      const cat = categorySpending.get(catId)!;
      cat.total += Number(t.amount);
      cat.count += 1;
    });

    // 🧠 Generate AI recommendations with Lovable AI
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY not configured");

    const spendingSummary = Array.from(categorySpending.values())
      .map(
        (d) =>
          `${d.name}: $${d.total.toFixed(2)} (${d.count} transactions)`
      )
      .join("\n");

    const prompt = `
You are a financial advisor AI. Based on the user's last 3 months of spending, provide 3–5 realistic, personalized savings recommendations.

Spending breakdown:
${spendingSummary}

Each recommendation should be returned as valid JSON array objects in this structure:
[
  {
    "title": "Short actionable title",
    "description": "Detailed step-by-step suggestion",
    "potential_savings": 25.50,
    "category": "Food & Dining"
  }
]
If no savings are applicable, say: []
`;

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "You are a concise and smart AI financial coach. Always respond in pure JSON format only.",
            },
            { role: "user", content: prompt },
          ],
        }),
      }
    );

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI API Error:", aiResponse.status, errText);
      throw new Error("Failed to generate recommendations");
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content?.trim();

    if (!aiContent) throw new Error("Empty AI response");

    // 🧩 Parse AI JSON safely
    let recommendationsJson;
    try {
      recommendationsJson = JSON.parse(aiContent);
    } catch {
      console.warn("AI returned non-JSON text, fallback parsing");
      // Basic fallback for non-JSON responses
      recommendationsJson = [
        {
          title: "Track expenses weekly",
          description:
            "Review your weekly spend in the Smart Expense Tracker to spot waste quickly.",
          potential_savings: 15,
          category: "General",
        },
      ];
    }

    if (!Array.isArray(recommendationsJson) || recommendationsJson.length === 0) {
      return new Response(
        JSON.stringify({ message: "No actionable recommendations found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 🪄 Prepare rows for DB insert
    const recommendations = recommendationsJson.map((rec) => ({
      user_id: user.id,
      recommendation_type: "savings",
      title: rec.title?.trim() || "Savings Tip",
      description: rec.description?.trim() || "Take small steps to reduce expenses.",
      potential_savings: rec.potential_savings
        ? Number(rec.potential_savings)
        : null,
      is_dismissed: false,
      is_applied: false,
      created_at: new Date().toISOString(),
    }));

    // 💾 Store in DB
    const { error: insertError } = await supabase
      .from("recommendations")
      .insert(recommendations);

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({
        message: "Recommendations generated successfully",
        count: recommendations.length,
        data: recommendations,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating recommendations:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
