import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, AlertTriangle, Info, X, Lightbulb } from "lucide-react";

interface Insight {
  id: string;
  insight_type: string;
  title: string;
  description: string;
  severity: string;
  amount: number;
  is_dismissed: boolean;
}

const InsightsPanel = () => {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadInsights();
  }, []);

  const loadInsights = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("spending_insights")
      .select("*")
      .eq("is_dismissed", false)
      .order("insight_date", { ascending: false })
      .limit(5);

    if (error) {
      console.error("Error loading insights:", error);
    } else {
      setInsights(data || []);
    }
    setIsLoading(false);
  };

  const analyzeSpending = async () => {
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("detect-anomalies");

      if (error) throw error;

      const insightsGenerated = data?.insights_generated || 0;

      if (insightsGenerated === 0) {
        toast({
          title: "Analysis complete",
          description: "No anomalies detected. Add more transactions over time to see spending patterns and insights.",
        });
      } else {
        toast({
          title: "Analysis complete",
          description: `Found ${insightsGenerated} new ${insightsGenerated === 1 ? 'insight' : 'insights'} about your spending.`,
        });
      }

      await loadInsights();
    } catch (error) {
      console.error("Error analyzing spending:", error);
      toast({
        title: "Analysis failed",
        description: "Failed to analyze spending. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const dismissInsight = async (id: string) => {
    const { error } = await supabase
      .from("spending_insights")
      .update({ is_dismissed: true })
      .eq("id", id);

    if (error) {
      console.error("Error dismissing insight:", error);
      toast({
        title: "Error",
        description: "Failed to dismiss insight.",
        variant: "destructive",
      });
    } else {
      setInsights(insights.filter(i => i.id !== id));
    }
  };

  const getIcon = (type: string, severity: string) => {
    if (severity === "warning") return <AlertTriangle className="h-4 w-4" />;
    if (type === "trend") return <Lightbulb className="h-4 w-4" />;
    return <Info className="h-4 w-4" />;
  };

  const getVariant = (severity: string) => {
    if (severity === "warning") return "destructive";
    return "default";
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Spending Insights</CardTitle>
          <CardDescription>AI-powered analysis of your spending patterns</CardDescription>
        </div>
        <Button
          onClick={analyzeSpending}
          disabled={isAnalyzing}
          variant="outline"
          size="sm"
        >
          {isAnalyzing ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Analyze
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : insights.length === 0 ? (
          <div className="text-center py-8">
            <Info className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-2 font-medium">
              No insights detected
            </p>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              AI analysis requires at least 3 transactions per category over multiple months to detect spending patterns and anomalies. Keep adding transactions to unlock insights!
            </p>
            <Button onClick={analyzeSpending} disabled={isAnalyzing} variant="outline">
              {isAnalyzing ? "Analyzing..." : "Run Analysis Again"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {insights.map((insight) => (
              <Alert key={insight.id} variant={getVariant(insight.severity)}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2 flex-1">
                    {getIcon(insight.insight_type, insight.severity)}
                    <div className="flex-1">
                      <AlertTitle>{insight.title}</AlertTitle>
                      <AlertDescription className="mt-1">
                        {insight.description}
                      </AlertDescription>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => dismissInsight(insight.id)}
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

export default InsightsPanel;
