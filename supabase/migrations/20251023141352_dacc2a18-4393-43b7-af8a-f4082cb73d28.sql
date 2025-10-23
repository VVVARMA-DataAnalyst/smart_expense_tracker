-- Add recurring patterns table for subscription detection
CREATE TABLE public.recurring_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  merchant TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  frequency TEXT NOT NULL, -- 'weekly', 'monthly', 'yearly'
  next_expected_date TIMESTAMP WITH TIME ZONE,
  confidence NUMERIC NOT NULL DEFAULT 0.85,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on recurring_patterns
ALTER TABLE public.recurring_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own recurring patterns"
ON public.recurring_patterns FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own recurring patterns"
ON public.recurring_patterns FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recurring patterns"
ON public.recurring_patterns FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recurring patterns"
ON public.recurring_patterns FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_recurring_patterns_updated_at
BEFORE UPDATE ON public.recurring_patterns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add bills table for bill reminders
CREATE TABLE public.bills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  frequency TEXT NOT NULL, -- 'one-time', 'monthly', 'quarterly', 'yearly'
  category_id UUID,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  reminder_days INTEGER NOT NULL DEFAULT 3, -- remind X days before due
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL
);

-- Enable RLS on bills
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own bills"
ON public.bills FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own bills"
ON public.bills FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bills"
ON public.bills FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bills"
ON public.bills FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_bills_updated_at
BEFORE UPDATE ON public.bills
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add recurring_pattern_id to transactions
ALTER TABLE public.transactions
ADD COLUMN recurring_pattern_id UUID,
ADD FOREIGN KEY (recurring_pattern_id) REFERENCES public.recurring_patterns(id) ON DELETE SET NULL;

-- Add merchant_normalized field for better categorization
ALTER TABLE public.transactions
ADD COLUMN merchant_normalized TEXT;

-- Create spending insights table for anomaly detection
CREATE TABLE public.spending_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  insight_type TEXT NOT NULL, -- 'anomaly', 'trend', 'suggestion'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category_id UUID,
  amount NUMERIC,
  severity TEXT NOT NULL DEFAULT 'info', -- 'info', 'warning', 'critical'
  is_dismissed BOOLEAN NOT NULL DEFAULT false,
  insight_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL
);

-- Enable RLS on spending_insights
ALTER TABLE public.spending_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own insights"
ON public.spending_insights FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own insights"
ON public.spending_insights FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own insights"
ON public.spending_insights FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own insights"
ON public.spending_insights FOR DELETE
USING (auth.uid() = user_id);