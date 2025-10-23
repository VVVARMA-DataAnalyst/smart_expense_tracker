import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Calendar, Check } from "lucide-react";
import { format, isAfter, isBefore, addDays } from "date-fns";

interface Bill {
  id: string;
  name: string;
  amount: number;
  due_date: string;
  frequency: string;
  is_paid: boolean;
  reminder_days: number;
  notes: string;
  category: {
    name: string;
    icon: string;
  } | null;
}

const BillReminders = () => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    amount: "",
    due_date: "",
    frequency: "monthly",
    category_id: "",
    reminder_days: "3",
    notes: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    loadBills();
    loadCategories();
  }, []);

  const loadBills = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("bills")
      .select(`
        id,
        name,
        amount,
        due_date,
        frequency,
        is_paid,
        reminder_days,
        notes,
        category:categories (
          name,
          icon
        )
      `)
      .order("due_date", { ascending: true });

    if (error) {
      console.error("Error loading bills:", error);
    } else {
      setBills(data || []);
    }
    setIsLoading(false);
  };

  const loadCategories = async () => {
    const { data } = await supabase
      .from("categories")
      .select("*")
      .order("name");
    
    if (data) setCategories(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { error } = await supabase.from("bills").insert([{
      user_id: user.id,
      name: formData.name,
      amount: parseFloat(formData.amount),
      due_date: new Date(formData.due_date).toISOString(),
      frequency: formData.frequency,
      category_id: formData.category_id || null,
      reminder_days: parseInt(formData.reminder_days),
      notes: formData.notes || null,
      is_paid: false,
    }]);

    if (error) {
      console.error("Error creating bill:", error);
      toast({
        title: "Error",
        description: "Failed to create bill reminder.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Bill created",
        description: "Bill reminder has been added successfully.",
      });
      setIsDialogOpen(false);
      setFormData({
        name: "",
        amount: "",
        due_date: "",
        frequency: "monthly",
        category_id: "",
        reminder_days: "3",
        notes: "",
      });
      loadBills();
    }
  };

  const markAsPaid = async (id: string) => {
    const { error } = await supabase
      .from("bills")
      .update({ is_paid: true })
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to mark bill as paid.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Marked as paid",
        description: "Bill has been marked as paid.",
      });
      loadBills();
    }
  };

  const isDueSoon = (dueDate: string, reminderDays: number) => {
    const due = new Date(dueDate);
    const reminderDate = addDays(new Date(), reminderDays);
    return isAfter(due, new Date()) && isBefore(due, reminderDate);
  };

  const isPastDue = (dueDate: string) => {
    return isBefore(new Date(dueDate), new Date());
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Bill Reminders
          </CardTitle>
          <CardDescription>Track and manage your upcoming bills</CardDescription>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Bill
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Bill Reminder</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Bill Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Electric Bill"
                  required
                />
              </div>
              <div>
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>
              <div>
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="frequency">Frequency</Label>
                <Select
                  value={formData.frequency}
                  onValueChange={(value) => setFormData({ ...formData, frequency: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one-time">One-time</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="category">Category (Optional)</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.icon} {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="reminder_days">Remind me (days before)</Label>
                <Input
                  id="reminder_days"
                  type="number"
                  value={formData.reminder_days}
                  onChange={(e) => setFormData({ ...formData, reminder_days: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Add any notes..."
                />
              </div>
              <Button type="submit" className="w-full">
                Add Bill Reminder
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : bills.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No bill reminders yet. Add your first bill!
          </p>
        ) : (
          <div className="space-y-4">
            {bills.map((bill) => (
              <div
                key={bill.id}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  bill.is_paid
                    ? "bg-muted/50 opacity-60"
                    : isPastDue(bill.due_date)
                    ? "border-destructive bg-destructive/5"
                    : isDueSoon(bill.due_date, bill.reminder_days)
                    ? "border-yellow-500 bg-yellow-500/5"
                    : "bg-card"
                }`}
              >
                <div className="flex items-center gap-3 flex-1">
                  {bill.category && (
                    <div className="text-2xl">{bill.category.icon}</div>
                  )}
                  <div>
                    <p className="font-medium">{bill.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {bill.frequency}
                      </Badge>
                      {bill.is_paid && (
                        <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-700 dark:text-green-300">
                          <Check className="h-3 w-3 mr-1" />
                          Paid
                        </Badge>
                      )}
                      {!bill.is_paid && isPastDue(bill.due_date) && (
                        <Badge variant="destructive" className="text-xs">
                          Overdue
                        </Badge>
                      )}
                      {!bill.is_paid && isDueSoon(bill.due_date, Number(bill.reminder_days)) && (
                        <Badge className="text-xs bg-yellow-500/20 text-yellow-700 dark:text-yellow-300">
                          Due Soon
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Due: {format(new Date(bill.due_date), "MMM d, yyyy")}
                    </p>
                  </div>
                </div>
                <div className="text-right flex items-center gap-3">
                  <div>
                    <p className="font-semibold text-lg">
                      ${Number(bill.amount).toFixed(2)}
                    </p>
                  </div>
                  {!bill.is_paid && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => markAsPaid(bill.id)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
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

export default BillReminders;
