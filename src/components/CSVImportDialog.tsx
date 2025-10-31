import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Upload, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { parseCSVTransactions } from '@/utils/csvExport';

interface CSVImportDialogProps {
  onSuccess: () => void;
}

export default function CSVImportDialog({ onSuccess }: CSVImportDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const parsedData = await parseCSVTransactions(file);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get all categories for mapping
      const { data: categories } = await supabase
        .from('categories')
        .select('id, name');

      const categoryMap = new Map(
        categories?.map(cat => [cat.name.toLowerCase(), cat.id]) || []
      );

      // Transform CSV data to transaction format
      const transactions = parsedData.map((row: any) => ({
        user_id: user.id,
        date: row.Date || new Date().toISOString(),
        merchant: row.Merchant || 'Unknown',
        amount: parseFloat(row.Amount) || 0,
        description: row.Description || '',
        currency: row.Currency || 'USD',
        category_id: categoryMap.get(row.Category?.toLowerCase()) || null,
        source: 'csv_import',
      }));

      const { error } = await supabase
        .from('transactions')
        .insert(transactions);

      if (error) throw error;

      toast.success(`Successfully imported ${transactions.length} transactions`);
      setIsOpen(false);
      onSuccess();
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to import transactions. Please check your CSV format.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Import transactions from CSV">
          <Upload className="h-4 w-4 mr-2" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Transactions from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file with columns: Date, Merchant, Amount, Currency, Category, Description
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-4">
              Click to select a CSV file or drag and drop
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
              id="csv-upload"
              aria-label="Upload CSV file"
            />
            <label htmlFor="csv-upload">
              <Button
                type="button"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
                aria-label="Select CSV file"
              >
                {isUploading ? 'Uploading...' : 'Select File'}
              </Button>
            </label>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>CSV Format Requirements:</strong></p>
            <ul className="list-disc list-inside ml-2">
              <li>First row must contain headers</li>
              <li>Date format: YYYY-MM-DD</li>
              <li>Amount: numeric value</li>
              <li>Category: must match existing categories</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
