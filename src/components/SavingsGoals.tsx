import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Plus, Target, Trash2, CheckCircle } from "lucide-react";

interface SavingsGoal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  category_id: string | null;
  is_completed: boolean;
}

interface Category {
  id: string;
  name: string;
}

const SavingsGoals = () => {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    target_amount: "",
    current_amount: "0",
    deadline: "",
    category_id: "",
  });

  useEffect(() => {
    loadGoals();
    loadCategories();
  }, []);

  const loadGoals = async () => {
    const { data, error } = await supabase
      .from("savings_goals")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading goals:", error);
    } else {
      setGoals(data || []);
    }
  };

  const loadCategories = async () => {
    const { data, error } = await supabase.from("categories").select("*");
    if (!error && data) setCategories(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("savings_goals").insert({
      user_id: user.id,
      name: formData.name,
      target_amount: parseFloat(formData.target_amount),
      current_amount: parseFloat(formData.current_amount),
      deadline: formData.deadline || null,
      category_id: formData.category_id || null,
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create goal",
        variant: "destructive",
      });
    } else {
      toast({ title: "Success", description: "Goal created successfully" });
      setIsOpen(false);
      setFormData({ name: "", target_amount: "", current_amount: "0", deadline: "", category_id: "" });
      loadGoals();
    }

    setIsLoading(false);
  };

  const updateGoalProgress = async (goalId: string, newAmount: number) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;

    const isCompleted = newAmount >= goal.target_amount;

    const { error } = await supabase
      .from("savings_goals")
      .update({ current_amount: newAmount, is_completed: isCompleted })
      .eq("id", goalId);

    if (!error) {
      loadGoals();
      if (isCompleted) {
        toast({ title: "Goal Completed! 🎉", description: `You've reached your goal: ${goal.name}` });
      }
    }
  };

  const deleteGoal = async (id: string) => {
    const { error } = await supabase.from("savings_goals").delete().eq("id", id);
    if (!error) {
      toast({ title: "Goal deleted" });
      loadGoals();
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Savings Goals
        </CardTitle>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Goal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Savings Goal</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Goal Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="target_amount">Target Amount ($)</Label>
                <Input
                  id="target_amount"
                  type="number"
                  step="0.01"
                  value={formData.target_amount}
                  onChange={(e) => setFormData({ ...formData, target_amount: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="current_amount">Current Amount ($)</Label>
                <Input
                  id="current_amount"
                  type="number"
                  step="0.01"
                  value={formData.current_amount}
                  onChange={(e) => setFormData({ ...formData, current_amount: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="deadline">Deadline (Optional)</Label>
                <Input
                  id="deadline"
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="category">Category (Optional)</Label>
                <Select value={formData.category_id} onValueChange={(val) => setFormData({ ...formData, category_id: val })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                Create Goal
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {goals.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No goals yet. Create one to start saving!</p>
          ) : (
            goals.map((goal) => {
              const progress = (goal.current_amount / goal.target_amount) * 100;
              return (
                <div key={goal.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold flex items-center gap-2">
                        {goal.name}
                        {goal.is_completed && <CheckCircle className="h-4 w-4 text-green-500" />}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        ${Number(goal.current_amount).toFixed(2)} / ${Number(goal.target_amount).toFixed(2)}
                      </p>
                      {goal.deadline && (
                        <p className="text-xs text-muted-foreground">
                          Deadline: {new Date(goal.deadline).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteGoal(goal.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Progress value={progress} />
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Add amount"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const input = e.currentTarget;
                          const amount = parseFloat(input.value);
                          if (amount > 0) {
                            updateGoalProgress(goal.id, goal.current_amount + amount);
                            input.value = '';
                          }
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      onClick={(e) => {
                        const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                        const amount = parseFloat(input.value);
                        if (amount > 0) {
                          updateGoalProgress(goal.id, goal.current_amount + amount);
                          input.value = '';
                        }
                      }}
                    >
                      Add
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SavingsGoals;