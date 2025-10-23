import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, TrendingUp } from "lucide-react";
import { format } from "date-fns";

interface RecurringPattern {
  id: string;
  merchant: string;
  amount: number;
  frequency: string;
  next_expected_date: string;
  confidence: number;
  is_active: boolean;
}

const RecurringPayments = () => {
  const [patterns, setPatterns] = useState<RecurringPattern[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetecting, setIsDetecting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadPatterns();
  }, []);

  const loadPatterns = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("recurring_patterns")
      .select("*")
      .eq("is_active", true)
      .order("next_expected_date", { ascending: true });

    if (error) {
      console.error("Error loading patterns:", error);
    } else {
      setPatterns(data || []);
    }
    setIsLoading(false);
  };

  const detectPatterns = async () => {
    setIsDetecting(true);
    try {
      const { error } = await supabase.functions.invoke("detect-recurring-payments");

      if (error) throw error;

      toast({
        title: "Analysis complete",
        description: "Recurring payments have been detected and updated.",
      });

      await loadPatterns();
    } catch (error) {
      console.error("Error detecting patterns:", error);
      toast({
        title: "Detection failed",
        description: "Failed to detect recurring payments. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDetecting(false);
    }
  };

  const getFrequencyColor = (frequency: string) => {
    switch (frequency) {
      case "weekly":
        return "bg-blue-500/20 text-blue-700 dark:text-blue-300";
      case "monthly":
        return "bg-green-500/20 text-green-700 dark:text-green-300";
      case "yearly":
        return "bg-purple-500/20 text-purple-700 dark:text-purple-300";
      default:
        return "bg-gray-500/20 text-gray-700 dark:text-gray-300";
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Recurring Payments
          </CardTitle>
          <CardDescription>Automatically detected subscriptions and bills</CardDescription>
        </div>
        <Button
          onClick={detectPatterns}
          disabled={isDetecting}
          variant="outline"
          size="sm"
        >
          {isDetecting ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Detect Patterns
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : patterns.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              No recurring payments detected yet.
            </p>
            <Button onClick={detectPatterns} disabled={isDetecting}>
              Run Detection
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {patterns.map((pattern) => (
              <div
                key={pattern.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1">
                  <p className="font-medium">{pattern.merchant}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={getFrequencyColor(pattern.frequency)} variant="secondary">
                      {pattern.frequency}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {Math.round(pattern.confidence * 100)}% confidence
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Next expected: {format(new Date(pattern.next_expected_date), "MMM d, yyyy")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-lg">
                    ${Number(pattern.amount).toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RecurringPayments;
