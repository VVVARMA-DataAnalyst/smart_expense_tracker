import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { 
  Area, 
  AreaChart, 
  Bar, 
  BarChart, 
  Cell,
  Line,
  LineChart,
  Pie, 
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend
} from "recharts";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, subMonths } from "date-fns";

interface Transaction {
  id: string;
  date: string;
  amount: number;
  category_id: string;
  merchant: string;
}
interface ExpenseChartsProps {
  refreshKey?: number;
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const ExpenseCharts = ({ refreshKey = 0 }: ExpenseChartsProps) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTransactions();
  }, [refreshKey]);

  const loadTransactions = async () => {
    setLoading(true);
    const threeMonthsAgo = subMonths(new Date(), 3);
    
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .gte('date', threeMonthsAgo.toISOString())
      .order('date', { ascending: true });

    if (!error && data) {
      setTransactions(data);
    }
    setLoading(false);
  };

  // Daily spending trend
  const dailyData = () => {
    const grouped = transactions.reduce((acc, t) => {
      const date = format(new Date(t.date), 'MMM dd');
      acc[date] = (acc[date] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped).map(([date, amount]) => ({
      date,
      amount: Number(amount.toFixed(2))
    }));
  };

  // Category breakdown
  const categoryData = () => {
    const grouped = transactions.reduce((acc, t) => {
      const category = t.category_name || 'Uncategorized';
      acc[category] = (acc[category] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped)
      .map(([category, amount]) => ({
        name: category,
        value: Number(amount.toFixed(2))
      }))
      .sort((a, b) => b.value - a.value);
  };

  // Top merchants
  const merchantData = () => {
    const grouped = transactions.reduce((acc, t) => {
      acc[t.merchant] = (acc[t.merchant] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped)
      .map(([merchant, amount]) => ({
        merchant,
        amount: Number(amount.toFixed(2))
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
  };

  // Monthly comparison
  const monthlyData = () => {
    const grouped = transactions.reduce((acc, t) => {
      const month = format(new Date(t.date), 'MMM yyyy');
      acc[month] = (acc[month] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped).map(([month, amount]) => ({
      month,
      amount: Number(amount.toFixed(2))
    }));
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Expense Analytics</CardTitle>
          <CardDescription>Loading charts...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Expense Analytics</CardTitle>
          <CardDescription>Add transactions to see visualizations</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Expense Analytics</CardTitle>
        <CardDescription>Visual analysis of your spending patterns</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="trend" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="trend">Trend</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="merchants">Merchants</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
          </TabsList>

          <TabsContent value="trend" className="space-y-4">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyData()}>
                  <defs>
                    <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="hsl(var(--primary))" 
                    fillOpacity={1} 
                    fill="url(#colorAmount)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="categories" className="space-y-4">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData()}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="hsl(var(--primary))"
                    dataKey="value"
                  >
                    {categoryData().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="merchants" className="space-y-4">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={merchantData()} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    type="number"
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    dataKey="merchant" 
                    type="category" 
                    width={100}
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                  <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="monthly" className="space-y-4">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData()}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="month"
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                  <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default ExpenseCharts;
