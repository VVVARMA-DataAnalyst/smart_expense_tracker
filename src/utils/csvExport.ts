import Papa from 'papaparse';
import { format } from 'date-fns';

export interface Transaction {
  id: string;
  date: string;
  merchant: string | null;
  amount: number;
  category_id: string | null;
  description: string | null;
  source: string;
  currency: string;
}

export const exportTransactionsToCSV = (transactions: Transaction[], filename = 'transactions.csv') => {
  const csvData = transactions.map(tx => ({
    Date: format(new Date(tx.date), 'yyyy-MM-dd'),
    Merchant: tx.merchant || '',
    Amount: tx.amount,
    Currency: tx.currency,
    Category: tx.category_id || '',
    Description: tx.description || '',
    Source: tx.source,
  }));

  const csv = Papa.unparse(csvData);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const parseCSVTransactions = (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve(results.data);
      },
      error: (error) => {
        reject(error);
      },
    });
  });
};

export const exportAllUserData = async (
  transactions: any[],
  budgets: any[],
  goals: any[],
  insights: any[],
  profile: any
) => {
  const userData = {
    exportDate: new Date().toISOString(),
    profile,
    transactions,
    budgets,
    savingsGoals: goals,
    insights,
  };

  const json = JSON.stringify(userData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `my-expense-data-${format(new Date(), 'yyyy-MM-dd')}.json`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
