import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, Trash2 } from "lucide-react";

interface Budget {
  id: string;
  name: string;
}

interface BudgetShare {
  id: string;
  budget_id: string;
  user_id: string;
  permission: string;
  budgets?: { name: string };
}

const SharedBudgets = () => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [shares, setShares] = useState<BudgetShare[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    budget_id: "",
    user_email: "",
    permission: "view",
  });

  useEffect(() => {
    loadBudgets();
    loadShares();
  }, []);

  const loadBudgets = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("budgets")
      .select("id, name")
      .eq("user_id", user.id);

    if (!error && data) setBudgets(data);
  };

  const loadShares = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("budget_shares")
      .select("*, budgets(name)")
      .eq("shared_by_user_id", user.id);

    if (!error && data) setShares(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // First, find the user by email
    const { data: targetUser, error: userError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", formData.user_email)
      .single();

    if (userError) {
      toast({
        title: "Error",
        description: "User not found. Make sure they have an account.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    const { error } = await supabase.from("budget_shares").insert({
      budget_id: formData.budget_id,
      user_id: targetUser.id,
      shared_by_user_id: user.id,
      permission: formData.permission,
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to share budget. They may already have access.",
        variant: "destructive",
      });
    } else {
      toast({ title: "Success", description: "Budget shared successfully" });
      setIsOpen(false);
      setFormData({ budget_id: "", user_email: "", permission: "view" });
      loadShares();
    }

    setIsLoading(false);
  };

  const deleteShare = async (id: string) => {
    const { error } = await supabase.from("budget_shares").delete().eq("id", id);
    if (!error) {
      toast({ title: "Access removed" });
      loadShares();
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Shared Budgets
          </CardTitle>
          <CardDescription>Collaborate on budgets with family members</CardDescription>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Share Budget
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Share Budget</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="budget">Budget</Label>
                <Select value={formData.budget_id} onValueChange={(val) => setFormData({ ...formData, budget_id: val })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select budget" />
                  </SelectTrigger>
                  <SelectContent>
                    {budgets.map((budget) => (
                      <SelectItem key={budget.id} value={budget.id}>{budget.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="user_email">User ID</Label>
                <Input
                  id="user_email"
                  value={formData.user_email}
                  onChange={(e) => setFormData({ ...formData, user_email: e.target.value })}
                  placeholder="Enter user ID to share with"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  The user must have an account in the app
                </p>
              </div>
              <div>
                <Label htmlFor="permission">Permission</Label>
                <Select value={formData.permission} onValueChange={(val) => setFormData({ ...formData, permission: val })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">View Only</SelectItem>
                    <SelectItem value="edit">Edit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                Share Budget
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {shares.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No shared budgets yet. Share a budget to collaborate with family.
            </p>
          ) : (
            shares.map((share) => (
              <div key={share.id} className="flex items-center justify-between border rounded-lg p-4">
                <div>
                  <h3 className="font-semibold">{share.budgets?.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    Shared with: User ID {share.user_id.substring(0, 8)}...
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">
                    Permission: {share.permission}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteShare(share.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SharedBudgets;