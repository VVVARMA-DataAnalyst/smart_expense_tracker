import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Zap, Trash2 } from "lucide-react";

interface Rule {
  id: string;
  name: string;
  merchant_pattern: string;
  category_id: string;
  is_active: boolean;
  priority: number;
  categories?: { name: string };
}

interface Category {
  id: string;
  name: string;
}

const SmartRules = () => {
  const [rules, setRules] = useState<Rule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    merchant_pattern: "",
    category_id: "",
    priority: "0",
  });

  useEffect(() => {
    loadRules();
    loadCategories();
  }, []);

  const loadRules = async () => {
    const { data, error } = await supabase
      .from("auto_categorization_rules")
      .select("*, categories(name)")
      .order("priority", { ascending: false });

    if (error) {
      console.error("Error loading rules:", error);
    } else {
      setRules(data || []);
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

    const { error } = await supabase.from("auto_categorization_rules").insert({
      user_id: user.id,
      name: formData.name,
      merchant_pattern: formData.merchant_pattern,
      category_id: formData.category_id,
      priority: parseInt(formData.priority),
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create rule",
        variant: "destructive",
      });
    } else {
      toast({ title: "Success", description: "Smart rule created" });
      setIsOpen(false);
      setFormData({ name: "", merchant_pattern: "", category_id: "", priority: "0" });
      loadRules();
    }

    setIsLoading(false);
  };

  const toggleRule = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from("auto_categorization_rules")
      .update({ is_active: isActive })
      .eq("id", id);

    if (!error) {
      loadRules();
      toast({ title: isActive ? "Rule enabled" : "Rule disabled" });
    }
  };

  const deleteRule = async (id: string) => {
    const { error } = await supabase.from("auto_categorization_rules").delete().eq("id", id);
    if (!error) {
      toast({ title: "Rule deleted" });
      loadRules();
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Smart Categorization Rules
          </CardTitle>
          <CardDescription>
            Automatically categorize transactions based on merchant patterns
          </CardDescription>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Rule
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Smart Rule</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Rule Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Amazon purchases"
                  required
                />
              </div>
              <div>
                <Label htmlFor="merchant_pattern">Merchant Pattern</Label>
                <Input
                  id="merchant_pattern"
                  value={formData.merchant_pattern}
                  onChange={(e) => setFormData({ ...formData, merchant_pattern: e.target.value })}
                  placeholder="e.g., amazon, amzn"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Case-insensitive. Use commas to separate multiple patterns.
                </p>
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
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
              <div>
                <Label htmlFor="priority">Priority (higher = applied first)</Label>
                <Input
                  id="priority"
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                Create Rule
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {rules.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No rules yet. Create smart rules to auto-categorize transactions.
            </p>
          ) : (
            rules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between border rounded-lg p-4">
                <div className="flex-1">
                  <h3 className="font-semibold">{rule.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    Pattern: {rule.merchant_pattern} → {rule.categories?.name}
                  </p>
                  <p className="text-xs text-muted-foreground">Priority: {rule.priority}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={rule.is_active}
                    onCheckedChange={(checked) => toggleRule(rule.id, checked)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteRule(rule.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SmartRules;