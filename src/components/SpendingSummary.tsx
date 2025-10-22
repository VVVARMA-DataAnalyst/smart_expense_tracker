import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, DollarSign, ShoppingBag } from "lucide-react";

interface SpendingSummaryProps {
  refreshKey: number;
}

const SpendingSummary = ({ refreshKey }: SpendingSummaryProps) => {
  const [totalSpend, setTotalSpend] = useState(0);
  const [transactionCount, setTransactionCount] = useState(0);
  const [topCategory, setTopCategory] = useState("");

  useEffect(() => {
    loadSummary();
  }, [refreshKey]);

  const loadSummary = async () => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: transactions } = await supabase
      .from("transactions")
      .select(`
        amount,
        category:categories (
          name
        )
      `)
      .gte("date", startOfMonth.toISOString());

    if (transactions) {
      const total = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
      setTotalSpend(total);
      setTransactionCount(transactions.length);

      const categoryTotals = transactions.reduce((acc, t) => {
        if (t.category?.name) {
          acc[t.category.name] = (acc[t.category.name] || 0) + Number(t.amount);
        }
        return acc;
      }, {} as Record<string, number>);

      const top = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
      if (top) {
        setTopCategory(top[0]);
      }
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Total Spend (This Month)</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${totalSpend.toFixed(2)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Transactions</CardTitle>
          <ShoppingBag className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{transactionCount}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Top Category</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{topCategory || "N/A"}</div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SpendingSummary;
