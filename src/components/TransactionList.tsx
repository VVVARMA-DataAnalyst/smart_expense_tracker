import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Loader2, Download } from "lucide-react";
import CSVImportDialog from "./CSVImportDialog";

interface Transaction {
  id: string;
  amount: number;
  merchant: string;
  description: string;
  date: string;
  category: {
    name: string;
    icon: string;
    color: string;
  } | null;
}

interface TransactionListProps {
  refreshKey: number;
}

const TransactionList = ({ refreshKey }: TransactionListProps) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadTransactions();
  }, [refreshKey]);

  const loadTransactions = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("transactions")
      .select(`
        id,
        amount,
        merchant,
        description,
        date,
        category:categories (
          name,
          icon,
          color
        )
      `)
      .order("date", { ascending: false })
      .limit(10);

    if (error) {
      console.error("Error loading transactions:", error);
    } else {
      setTransactions(data || []);
    }
    setIsLoading(false);
  };

  const exportToCSV = async () => {
    const { data, error } = await supabase
      .from("transactions")
      .select(`
        amount,
        merchant,
        description,
        date,
        category:categories (name)
      `)
      .order("date", { ascending: false });

    if (error) {
      toast({
        title: "Export failed",
        description: "Failed to export transactions.",
        variant: "destructive",
      });
      return;
    }

    // Create CSV content
    const headers = ["Date", "Merchant", "Description", "Category", "Amount"];
    const csvRows = [
      headers.join(","),
      ...data.map((tx) =>
        [
          format(new Date(tx.date), "yyyy-MM-dd"),
          `"${tx.merchant}"`,
          `"${tx.description || ""}"`,
          `"${tx.category?.name || ""}"`,
          tx.amount,
        ].join(",")
      ),
    ];

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export successful",
      description: "Transactions exported to CSV.",
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Recent Transactions</CardTitle>
        <div className="flex gap-2">
          <CSVImportDialog onSuccess={loadTransactions} />
          <Button onClick={exportToCSV} variant="outline" size="sm" aria-label="Export transactions to CSV">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : transactions.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No transactions yet. Add your first expense!
          </p>
        ) : (
          <div className="space-y-4">
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {transaction.category && (
                    <div className="text-2xl">{transaction.category.icon}</div>
                  )}
                  <div>
                    <p className="font-medium">{transaction.merchant}</p>
                    {transaction.description && (
                      <p className="text-sm text-muted-foreground">
                        {transaction.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(transaction.date), "MMM d, yyyy")}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-lg">
                    ${transaction.amount.toFixed(2)}
                  </p>
                  {transaction.category && (
                    <Badge
                      variant="secondary"
                      style={{ backgroundColor: transaction.category.color + "20" }}
                    >
                      {transaction.category.name}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TransactionList;
