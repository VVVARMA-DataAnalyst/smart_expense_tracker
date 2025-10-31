import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Plus, Wallet, Settings } from "lucide-react";
import AddTransactionDialog from "@/components/AddTransactionDialog";
import TransactionList from "@/components/TransactionList";
import SpendingSummary from "@/components/SpendingSummary";
import BudgetManager from "@/components/BudgetManager";
import RecurringPayments from "@/components/RecurringPayments";
import InsightsPanel from "@/components/InsightsPanel";
import BillReminders from "@/components/BillReminders";
import SavingsGoals from "@/components/SavingsGoals";
import SmartRules from "@/components/SmartRules";
import RecommendationsPanel from "@/components/RecommendationsPanel";
import SharedBudgets from "@/components/SharedBudgets";
import ExpenseCharts from "@/components/ExpenseCharts";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Signed out",
      description: "You have been signed out successfully.",
    });
  };

  const handleTransactionAdded = () => {
    setRefreshKey(prev => prev + 1);
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/5">
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Expense Tracker</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate('/settings')} aria-label="Open settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
            <Button variant="ghost" onClick={handleSignOut} aria-label="Sign out">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Welcome back!</CardTitle>
                <CardDescription>Track and manage your expenses</CardDescription>
              </div>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Expense
              </Button>
            </CardHeader>
          </Card>

          <SpendingSummary refreshKey={refreshKey} />
          
          <ExpenseCharts refreshKey={refreshKey} />
          
          <RecommendationsPanel />
          
          <div className="grid gap-6 md:grid-cols-2">
            <SavingsGoals />
            <SmartRules />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <BudgetManager />
            <SharedBudgets />
          </div>
          
          <div className="grid gap-6 md:grid-cols-2">
            <RecurringPayments />
            <BillReminders />
          </div>
          
          <InsightsPanel />

          <div className="grid gap-6 md:grid-cols-2">
            <TransactionList refreshKey={refreshKey} />
          </div>
        </div>
      </main>

      <AddTransactionDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSuccess={handleTransactionAdded}
      />
    </div>
  );
};

export default Dashboard;
