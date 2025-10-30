import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, X, Lightbulb, TrendingDown, CheckCircle } from "lucide-react";

interface Recommendation {
  id: string;
  recommendation_type: string;
  title: string;
  description: string;
  potential_savings: number | null;
  is_dismissed: boolean;
  is_applied: boolean;
}

const RecommendationsPanel = () => {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadRecommendations();
  }, []);

  const loadRecommendations = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("recommendations")
      .select("*")
      .eq("is_dismissed", false)
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) {
      console.error("Error loading recommendations:", error);
    } else {
      setRecommendations(data || []);
    }
    setIsLoading(false);
  };

  const generateRecommendations = async () => {
    setIsGenerating(true);
    try {
      const { error } = await supabase.functions.invoke("generate-recommendations");

      if (error) throw error;

      toast({
        title: "Recommendations generated",
        description: "New personalized recommendations are ready!",
      });

      await loadRecommendations();
    } catch (error) {
      console.error("Error generating recommendations:", error);
      toast({
        title: "Generation failed",
        description: "Failed to generate recommendations. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const dismissRecommendation = async (id: string) => {
    const { error } = await supabase
      .from("recommendations")
      .update({ is_dismissed: true })
      .eq("id", id);

    if (error) {
      console.error("Error dismissing recommendation:", error);
      toast({
        title: "Error",
        description: "Failed to dismiss recommendation.",
        variant: "destructive",
      });
    } else {
      setRecommendations(recommendations.filter(r => r.id !== id));
    }
  };

  const applyRecommendation = async (id: string) => {
    const { error } = await supabase
      .from("recommendations")
      .update({ is_applied: true })
      .eq("id", id);

    if (!error) {
      toast({
        title: "Marked as applied",
        description: "Great job taking action!",
      });
      loadRecommendations();
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            AI Recommendations
          </CardTitle>
          <CardDescription>Personalized suggestions to improve your finances</CardDescription>
        </div>
        <Button
          onClick={generateRecommendations}
          disabled={isGenerating}
          variant="outline"
          size="sm"
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Generate
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : recommendations.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              No recommendations yet. Generate personalized suggestions based on your spending.
            </p>
            <Button onClick={generateRecommendations} disabled={isGenerating}>
              Generate Recommendations
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {recommendations.map((rec) => (
              <Alert key={rec.id}>
                <TrendingDown className="h-4 w-4" />
                <div className="flex items-start justify-between flex-1 ml-2">
                  <div className="flex-1">
                    <AlertTitle>{rec.title}</AlertTitle>
                    <AlertDescription className="mt-1">
                      {rec.description}
                      {rec.potential_savings && (
                        <p className="font-semibold text-green-600 mt-2">
                          Potential savings: ${Number(rec.potential_savings).toFixed(2)}/month
                        </p>
                      )}
                    </AlertDescription>
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => applyRecommendation(rec.id)}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Mark as Applied
                      </Button>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => dismissRecommendation(rec.id)}
                    className="ml-2"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </Alert>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RecommendationsPanel;