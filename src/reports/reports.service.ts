import { Injectable } from '@nestjs/common';
import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';

@Injectable()
export class ReportsService {
  private readonly TMP_DIR = 'tmp';
  private readonly OUTPUT_DIR = 'out';
  private readonly states = {
    accounts: 'idle',
    yearly: 'idle',
    fs: 'idle',
  };
  
  private readonly FINANCIAL_CATEGORIES = {
    'Income Statement': {
      Revenues: ['Sales Revenue'],
      Expenses: [
        'Cost of Goods Sold',
        'Salaries Expense',
        'Rent Expense',
        'Utilities Expense',
        'Interest Expense',
        'Tax Expense',
      ],
    },
    'Balance Sheet': {
      Assets: [
        'Cash',
        'Accounts Receivable',
        'Inventory',
        'Fixed Assets',
        'Prepaid Expenses',
      ],
      Liabilities: [
        'Accounts Payable',
        'Loan Payable',
        'Sales Tax Payable',
        'Accrued Liabilities',
        'Unearned Revenue',
        'Dividends Payable',
      ],
      Equity: ['Common Stock', 'Retained Earnings'],
    },
  };

  // Cache for file contents to avoid redundant reads
  private fileCache = new Map<string, string[]>();

  state(scope: string): string {
    return this.states[scope] || 'unknown';
  }

  // Helper method to efficiently get all CSV file data from the directory
  private getFileData(): string[][] {
    if (this.fileCache.size === 0) {
      const files = fs.readdirSync(this.TMP_DIR);
      for (const file of files) {
        if (file.endsWith('.csv')) {
          const filePath = path.join(this.TMP_DIR, file);
          const content = fs.readFileSync(filePath, 'utf-8').trim().split('\n');
          this.fileCache.set(file, content);
        }
      }
    }
    
    // Return all lines from all files as a flattened array
    return Array.from(this.fileCache.values()).map(lines => lines);
  }

  accounts(): void {
    // Schedule this for next tick to not block client
    setTimeout(() => {
      try {
        this.states.accounts = 'processing';
        const start = performance.now();
        
        const accountBalances: Record<string, number> = {};
        const allFileData = this.getFileData();
        
        // Process all files in a single optimized loop
        for (const fileLines of allFileData) {
          for (const line of fileLines) {
            const [, account, , debit, credit] = line.split(',');
            if (!accountBalances[account]) {
              accountBalances[account] = 0;
            }
            accountBalances[account] += 
              parseFloat(debit || '0') - parseFloat(credit || '0');
          }
        }
        
        // Generate output
        const output = ['Account,Balance'];
        for (const [account, balance] of Object.entries(accountBalances)) {
          output.push(`${account},${balance.toFixed(2)}`);
        }
        
        // Write file
        fs.writeFileSync(path.join(this.OUTPUT_DIR, 'accounts.csv'), output.join('\n'));
        
        this.states.accounts = `finished in ${((performance.now() - start) / 1000).toFixed(2)}`;
      } catch (error) {
        this.states.accounts = `error: ${error instanceof Error ? error.message : String(error)}`;
        console.error('Error generating accounts report:', error);
      }
    }, 0);
  }

  yearly(): void {
    // Schedule this for next tick to not block client
    setTimeout(() => {
      try {
        this.states.yearly = 'processing';
        const start = performance.now();
        
        const cashByYear: Record<string, number> = {};
        const allFileData = this.getFileData();
        
        // Process all files in a single optimized loop
        for (const fileLines of allFileData) {
          for (const line of fileLines) {
            const [date, account, , debit, credit] = line.split(',');
            if (account === 'Cash') {
              const year = new Date(date).getFullYear().toString();
              if (!cashByYear[year]) {
                cashByYear[year] = 0;
              }
              cashByYear[year] += 
                parseFloat(debit || '0') - parseFloat(credit || '0');
            }
          }
        }
        
        // Generate output
        const output = ['Financial Year,Cash Balance'];
        const sortedYears = Object.keys(cashByYear).sort();
        for (const year of sortedYears) {
          output.push(`${year},${cashByYear[year].toFixed(2)}`);
        }
        
        // Write file
        fs.writeFileSync(path.join(this.OUTPUT_DIR, 'yearly.csv'), output.join('\n'));
        
        this.states.yearly = `finished in ${((performance.now() - start) / 1000).toFixed(2)}`;
      } catch (error) {
        this.states.yearly = `error: ${error instanceof Error ? error.message : String(error)}`;
        console.error('Error generating yearly report:', error);
      }
    }, 0);
  }

  fs(): void {
    // Schedule this for next tick to not block client
    setTimeout(() => {
      try {
        this.states.fs = 'processing';
        const start = performance.now();
        
        const categories = this.FINANCIAL_CATEGORIES;
        const balances: Record<string, number> = {};
        
        // Initialize account balances
        for (const section of Object.values(categories)) {
          for (const group of Object.values(section)) {
            for (const account of group) {
              balances[account] = 0;
            }
          }
        }
        
        // Get all relevant accounts for quick lookup
        const relevantAccounts = new Set(Object.keys(balances));
        
        const allFileData = this.getFileData();
        
        // Process all files in a single optimized loop
        for (const fileLines of allFileData) {
          for (const line of fileLines) {
            const [, account, , debit, credit] = line.split(',');
            if (relevantAccounts.has(account)) {
              balances[account] += 
                parseFloat(debit || '0') - parseFloat(credit || '0');
            }
          }
        }

        // Generate output
        const output: string[] = [];
        output.push('Basic Financial Statement');
        output.push('');
        
        // Income Statement
        output.push('Income Statement');
        let totalRevenue = 0;
        let totalExpenses = 0;
        
        for (const account of categories['Income Statement']['Revenues']) {
          const value = balances[account] || 0;
          output.push(`${account},${value.toFixed(2)}`);
          totalRevenue += value;
        }
        
        for (const account of categories['Income Statement']['Expenses']) {
          const value = balances[account] || 0;
          output.push(`${account},${value.toFixed(2)}`);
          totalExpenses += value;
        }
        
        const netIncome = totalRevenue - totalExpenses;
        output.push(`Net Income,${netIncome.toFixed(2)}`);
        output.push('');
        
        // Balance Sheet
        output.push('Balance Sheet');
        let totalAssets = 0;
        let totalLiabilities = 0;
        let totalEquity = 0;
        
        // Assets
        output.push('Assets');
        for (const account of categories['Balance Sheet']['Assets']) {
          const value = balances[account] || 0;
          output.push(`${account},${value.toFixed(2)}`);
          totalAssets += value;
        }
        output.push(`Total Assets,${totalAssets.toFixed(2)}`);
        output.push('');
        
        // Liabilities
        output.push('Liabilities');
        for (const account of categories['Balance Sheet']['Liabilities']) {
          const value = balances[account] || 0;
          output.push(`${account},${value.toFixed(2)}`);
          totalLiabilities += value;
        }
        output.push(`Total Liabilities,${totalLiabilities.toFixed(2)}`);
        output.push('');
        
        // Equity
        output.push('Equity');
        for (const account of categories['Balance Sheet']['Equity']) {
          const value = balances[account] || 0;
          output.push(`${account},${value.toFixed(2)}`);
          totalEquity += value;
        }
        
        output.push(`Retained Earnings (Net Income),${netIncome.toFixed(2)}`);
        totalEquity += netIncome;
        output.push(`Total Equity,${totalEquity.toFixed(2)}`);
        output.push('');
        
        output.push(
          `Assets = Liabilities + Equity, ${totalAssets.toFixed(2)} = ${(
            totalLiabilities + totalEquity
          ).toFixed(2)}`
        );
        
        // Write file
        fs.writeFileSync(path.join(this.OUTPUT_DIR, 'fs.csv'), output.join('\n'));
        
        this.states.fs = `finished in ${((performance.now() - start) / 1000).toFixed(2)}`;
      } catch (error) {
        this.states.fs = `error: ${error instanceof Error ? error.message : String(error)}`;
        console.error('Error generating financial statement:', error);
      }
    }, 0);
  }
}