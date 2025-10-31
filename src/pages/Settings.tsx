import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Download, Trash2, Globe, DollarSign, Shield, ArrowLeft } from 'lucide-react';
import { exportAllUserData } from '@/utils/csvExport';
import { Separator } from '@/components/ui/separator';

export default function Settings() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(i18n.language);
  const [selectedCurrency, setSelectedCurrency] = useState('USD');

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Fetch all user data
      const [
        { data: transactions },
        { data: budgets },
        { data: goals },
        { data: insights },
        { data: profile }
      ] = await Promise.all([
        supabase.from('transactions').select('*').eq('user_id', user.id),
        supabase.from('budgets').select('*').eq('user_id', user.id),
        supabase.from('savings_goals').select('*').eq('user_id', user.id),
        supabase.from('spending_insights').select('*').eq('user_id', user.id),
        supabase.from('profiles').select('*').eq('id', user.id).single()
      ]);

      await exportAllUserData(
        transactions || [],
        budgets || [],
        goals || [],
        insights || [],
        profile
      );

      toast.success('Data exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Delete all user data
      await Promise.all([
        supabase.from('transactions').delete().eq('user_id', user.id),
        supabase.from('budgets').delete().eq('user_id', user.id),
        supabase.from('savings_goals').delete().eq('user_id', user.id),
        supabase.from('spending_insights').delete().eq('user_id', user.id),
        supabase.from('recommendations').delete().eq('user_id', user.id),
        supabase.from('recurring_patterns').delete().eq('user_id', user.id),
        supabase.from('auto_categorization_rules').delete().eq('user_id', user.id),
        supabase.from('bills').delete().eq('user_id', user.id),
        supabase.from('profiles').delete().eq('id', user.id),
      ]);

      // Delete auth user
      const { error } = await supabase.auth.admin.deleteUser(user.id);
      if (error) throw error;

      toast.success('Account deleted successfully');
      navigate('/auth');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete account. Please contact support.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLanguageChange = (lang: string) => {
    setSelectedLanguage(lang);
    i18n.changeLanguage(lang);
    toast.success('Language updated');
  };

  const handleCurrencyChange = async (currency: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('profiles')
        .update({ currency })
        .eq('id', user.id);

      if (error) throw error;

      setSelectedCurrency(currency);
      toast.success('Currency updated');
    } catch (error) {
      console.error('Currency update error:', error);
      toast.error('Failed to update currency');
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Button
        variant="ghost"
        onClick={() => navigate('/dashboard')}
        className="mb-4"
        aria-label="Back to dashboard"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Button>

      <h1 className="text-3xl font-bold mb-6">{t('settings.title')}</h1>

      {/* Localization Settings */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Localization
          </CardTitle>
          <CardDescription>Configure language and currency preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">{t('settings.language')}</label>
            <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
              <SelectTrigger aria-label="Select language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">{t('settings.currency')}</label>
            <Select value={selectedCurrency} onValueChange={handleCurrencyChange}>
              <SelectTrigger aria-label="Select currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD - US Dollar</SelectItem>
                <SelectItem value="EUR">EUR - Euro</SelectItem>
                <SelectItem value="GBP">GBP - British Pound</SelectItem>
                <SelectItem value="JPY">JPY - Japanese Yen</SelectItem>
                <SelectItem value="INR">INR - Indian Rupee</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Privacy & Data */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t('settings.privacy')}
          </CardTitle>
          <CardDescription>Manage your data and privacy settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold mb-2">{t('privacy.gdprCompliant')}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t('privacy.retentionDesc')}
            </p>
          </div>

          <Separator />

          <div>
            <h3 className="text-sm font-semibold mb-2">{t('privacy.yourRights')}</h3>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>{t('privacy.rightAccess')}</li>
              <li>{t('privacy.rightRectification')}</li>
              <li>{t('privacy.rightErasure')}</li>
              <li>{t('privacy.rightPortability')}</li>
            </ul>
          </div>

          <Separator />

          <div className="space-y-3">
            <Button
              onClick={handleExportData}
              disabled={isExporting}
              variant="outline"
              className="w-full justify-start"
              aria-label="Export all your data"
            >
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? 'Exporting...' : t('settings.exportData')}
            </Button>
            <p className="text-xs text-muted-foreground">{t('settings.exportDataDesc')}</p>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  className="w-full justify-start"
                  aria-label="Delete your account"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t('settings.deleteAccount')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('settings.deleteAccountWarning')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    disabled={isDeleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isDeleting ? 'Deleting...' : 'Delete Account'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <p className="text-xs text-muted-foreground">{t('settings.deleteAccountDesc')}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
