import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Plus, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Category {
  id: string;
  name: string;
  icon: string;
}

interface Budget {
  id: string;
  name: string;
  limit_amount: number;
  category: {
    name: string;
    icon: string;
  };
  spent: number;
}

const BudgetManager = () => {
  const { toast } = useToast();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [budgetName, setBudgetName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [limitAmount, setLimitAmount] = useState("");

  useEffect(() => {
    loadCategories();
    loadBudgets();
  }, []);

  const loadCategories = async () => {
    const { data } = await supabase
      .from("categories")
      .select("id, name, icon")
      .order("name");
    setCategories(data || []);
  };

  const loadBudgets = async () => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: budgetData } = await supabase
      .from("budgets")
      .select(`
        id,
        name,
        limit_amount,
        category:categories (
          id,
          name,
          icon
        )
      `)
      .eq("period", "monthly");

    if (budgetData) {
      const budgetsWithSpending = await Promise.all(
        budgetData.map(async (budget) => {
          const { data: transactions } = await supabase
            .from("transactions")
            .select("amount")
            .eq("category_id", budget.category.id)
            .gte("date", startOfMonth.toISOString());

          const spent = transactions?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
          
          const percentage = (spent / Number(budget.limit_amount)) * 100;
          if (percentage >= 80) {
            toast({
              title: "Budget Alert",
              description: `You've used ${percentage.toFixed(0)}% of your ${budget.name} budget`,
              variant: percentage >= 100 ? "destructive" : "default",
            });
          }

          return {
            ...budget,
            spent,
          };
        })
      );

      setBudgets(budgetsWithSpending);
    }
  };

  const handleCreateBudget = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("budgets").insert({
        user_id: user.id,
        name: budgetName,
        category_id: categoryId,
        limit_amount: parseFloat(limitAmount),
        period: "monthly",
        alert_threshold: 0.8,
      });

      if (error) throw error;

      toast({
        title: "Budget created",
        description: "Your budget has been set successfully.",
      });

      setBudgetName("");
      setCategoryId("");
      setLimitAmount("");
      setShowForm(false);
      loadBudgets();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create budget",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Budgets</CardTitle>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Budget
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <form onSubmit={handleCreateBudget} className="space-y-4 p-4 border rounded-lg">
            <div className="space-y-2">
              <Label htmlFor="budget-name">Budget Name</Label>
              <Input
                id="budget-name"
                placeholder="Monthly Food Budget"
                value={budgetName}
                onChange={(e) => setBudgetName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="budget-category">Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.icon} {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="budget-limit">Monthly Limit ($)</Label>
              <Input
                id="budget-limit"
                type="number"
                step="0.01"
                placeholder="500.00"
                value={limitAmount}
                onChange={(e) => setLimitAmount(e.target.value)}
                required
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" size="sm">Create Budget</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {budgets.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No budgets set. Create one to start tracking!
          </p>
        ) : (
          <div className="space-y-4">
            {budgets.map((budget) => {
              const percentage = (budget.spent / Number(budget.limit_amount)) * 100;
              const isOverBudget = percentage >= 100;
              const isNearLimit = percentage >= 80;

              return (
                <div key={budget.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{budget.category.icon}</span>
                      <div>
                        <p className="font-medium">{budget.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {budget.category.name}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        ${budget.spent.toFixed(2)} / ${Number(budget.limit_amount).toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {percentage.toFixed(0)}%
                      </p>
                    </div>
                  </div>
                  <Progress
                    value={Math.min(percentage, 100)}
                    className={isOverBudget ? "bg-destructive/20" : ""}
                  />
                  {isNearLimit && (
                    <Alert variant={isOverBudget ? "destructive" : "default"}>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        {isOverBudget
                          ? "Budget exceeded! Consider reviewing your spending."
                          : "Approaching budget limit. Monitor your expenses."}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BudgetManager;
