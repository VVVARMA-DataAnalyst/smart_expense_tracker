-- Create savings_goals table for personalized saving goals
CREATE TABLE public.savings_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  target_amount NUMERIC NOT NULL,
  current_amount NUMERIC NOT NULL DEFAULT 0,
  deadline TIMESTAMP WITH TIME ZONE,
  category_id UUID,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT fk_savings_goals_category FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;

-- Create policies for savings_goals
CREATE POLICY "Users can view their own goals" 
ON public.savings_goals FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own goals" 
ON public.savings_goals FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goals" 
ON public.savings_goals FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own goals" 
ON public.savings_goals FOR DELETE 
USING (auth.uid() = user_id);

-- Create auto_categorization_rules table for smart rules
CREATE TABLE public.auto_categorization_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  merchant_pattern TEXT NOT NULL,
  category_id UUID NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT fk_auto_rules_category FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.auto_categorization_rules ENABLE ROW LEVEL SECURITY;

-- Create policies for auto_categorization_rules
CREATE POLICY "Users can view their own rules" 
ON public.auto_categorization_rules FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own rules" 
ON public.auto_categorization_rules FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own rules" 
ON public.auto_categorization_rules FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own rules" 
ON public.auto_categorization_rules FOR DELETE 
USING (auth.uid() = user_id);

-- Create budget_shares table for collaborative budgets
CREATE TABLE public.budget_shares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_id UUID NOT NULL,
  user_id UUID NOT NULL,
  shared_by_user_id UUID NOT NULL,
  permission TEXT NOT NULL DEFAULT 'view',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT fk_budget_shares_budget FOREIGN KEY (budget_id) REFERENCES public.budgets(id) ON DELETE CASCADE,
  UNIQUE(budget_id, user_id)
);

-- Enable RLS
ALTER TABLE public.budget_shares ENABLE ROW LEVEL SECURITY;

-- Create policies for budget_shares
CREATE POLICY "Users can view budgets shared with them" 
ON public.budget_shares FOR SELECT 
USING (auth.uid() = user_id OR auth.uid() = shared_by_user_id);

CREATE POLICY "Budget owners can create shares" 
ON public.budget_shares FOR INSERT 
WITH CHECK (
  auth.uid() = shared_by_user_id AND 
  EXISTS (SELECT 1 FROM public.budgets WHERE id = budget_id AND user_id = auth.uid())
);

CREATE POLICY "Budget owners can delete shares" 
ON public.budget_shares FOR DELETE 
USING (
  auth.uid() = shared_by_user_id AND 
  EXISTS (SELECT 1 FROM public.budgets WHERE id = budget_id AND user_id = auth.uid())
);

-- Add premium tier to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS premium_tier TEXT DEFAULT 'free';

-- Create recommendations table for AI suggestions
CREATE TABLE public.recommendations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  recommendation_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  potential_savings NUMERIC,
  category_id UUID,
  is_dismissed BOOLEAN NOT NULL DEFAULT false,
  is_applied BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT fk_recommendations_category FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;

-- Create policies for recommendations
CREATE POLICY "Users can view their own recommendations" 
ON public.recommendations FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own recommendations" 
ON public.recommendations FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recommendations" 
ON public.recommendations FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recommendations" 
ON public.recommendations FOR DELETE 
USING (auth.uid() = user_id);

-- Create triggers for updated_at
CREATE TRIGGER update_savings_goals_updated_at
BEFORE UPDATE ON public.savings_goals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_auto_categorization_rules_updated_at
BEFORE UPDATE ON public.auto_categorization_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();