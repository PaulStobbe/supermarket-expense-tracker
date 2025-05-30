import { Database } from 'sqlite3';
import { promisify } from 'util';

export interface Budget {
  id?: number;
  userId: number;
  name: string;
  amount: number;
  category?: string;
  period: 'weekly' | 'monthly' | 'yearly';
  startDate: string;
  endDate: string;
  alertThreshold: number; // Percentage (e.g., 80 for 80%)
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface BudgetAlert {
  budgetId: number;
  budgetName: string;
  currentSpent: number;
  budgetAmount: number;
  percentageUsed: number;
  alertLevel: 'warning' | 'danger' | 'exceeded';
  message: string;
}

export interface BudgetAnalysis {
  totalBudgets: number;
  activeBudgets: number;
  totalBudgetAmount: number;
  totalSpent: number;
  overBudgetCount: number;
  savings: number;
  budgetPerformance: Array<{
    budgetId: number;
    name: string;
    budgetAmount: number;
    spent: number;
    remaining: number;
    percentageUsed: number;
    status: 'under' | 'warning' | 'over';
  }>;
}

export class BudgetService {
  private db: Database;

  constructor() {
    this.db = new Database('./database/expenses.db');
  }

  async createBudget(userId: number, budgetData: Omit<Budget, 'id' | 'userId'>): Promise<Budget> {
    const query = `
      INSERT INTO budgets (
        userId, name, amount, category, period, startDate, endDate, 
        alertThreshold, isActive, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `;

    const run = promisify(this.db.run.bind(this.db));
    const result = await run(query, [
      userId,
      budgetData.name,
      budgetData.amount,
      budgetData.category || null,
      budgetData.period,
      budgetData.startDate,
      budgetData.endDate,
      budgetData.alertThreshold,
      budgetData.isActive ? 1 : 0
    ]);

    return this.getBudgetById(result.lastID);
  }

  async getUserBudgets(userId: number): Promise<Budget[]> {
    const query = `
      SELECT * FROM budgets 
      WHERE userId = ? 
      ORDER BY createdAt DESC
    `;

    const all = promisify(this.db.all.bind(this.db));
    return await all(query, [userId]);
  }

  async getBudgetById(budgetId: number): Promise<Budget> {
    const query = 'SELECT * FROM budgets WHERE id = ?';
    const get = promisify(this.db.get.bind(this.db));
    return await get(query, [budgetId]);
  }

  async updateBudget(budgetId: number, userId: number, updates: Partial<Budget>): Promise<Budget> {
    const allowedFields = ['name', 'amount', 'category', 'period', 'startDate', 'endDate', 'alertThreshold', 'isActive'];
    const setClause = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClause.push(`${key} = ?`);
        values.push(key === 'isActive' && typeof value === 'boolean' ? (value ? 1 : 0) : value);
      }
    }

    if (setClause.length === 0) {
      throw new Error('No valid fields to update');
    }

    const query = `
      UPDATE budgets 
      SET ${setClause.join(', ')}, updatedAt = datetime('now')
      WHERE id = ? AND userId = ?
    `;

    const run = promisify(this.db.run.bind(this.db));
    await run(query, [...values, budgetId, userId]);

    return this.getBudgetById(budgetId);
  }

  async deleteBudget(budgetId: number, userId: number): Promise<void> {
    const query = 'DELETE FROM budgets WHERE id = ? AND userId = ?';
    const run = promisify(this.db.run.bind(this.db));
    await run(query, [budgetId, userId]);
  }

  async getBudgetAnalysis(userId: number): Promise<BudgetAnalysis> {
    const budgets = await this.getUserBudgets(userId);
    const activeBudgets = budgets.filter(b => b.isActive);

    const analysis: BudgetAnalysis = {
      totalBudgets: budgets.length,
      activeBudgets: activeBudgets.length,
      totalBudgetAmount: activeBudgets.reduce((sum, b) => sum + b.amount, 0),
      totalSpent: 0,
      overBudgetCount: 0,
      savings: 0,
      budgetPerformance: []
    };

    for (const budget of activeBudgets) {
      const spent = await this.calculateBudgetSpent(userId, budget);
      const remaining = budget.amount - spent;
      const percentageUsed = (spent / budget.amount) * 100;

      let status: 'under' | 'warning' | 'over' = 'under';
      if (percentageUsed >= 100) status = 'over';
      else if (percentageUsed >= budget.alertThreshold) status = 'warning';

      analysis.budgetPerformance.push({
        budgetId: budget.id!,
        name: budget.name,
        budgetAmount: budget.amount,
        spent,
        remaining,
        percentageUsed: Math.round(percentageUsed * 100) / 100,
        status
      });

      analysis.totalSpent += spent;
      if (status === 'over') analysis.overBudgetCount++;
    }

    analysis.savings = analysis.totalBudgetAmount - analysis.totalSpent;

    return analysis;
  }

  async getBudgetAlerts(userId: number): Promise<BudgetAlert[]> {
    const budgets = await this.getUserBudgets(userId);
    const activeBudgets = budgets.filter(b => b.isActive);
    const alerts: BudgetAlert[] = [];

    for (const budget of activeBudgets) {
      const spent = await this.calculateBudgetSpent(userId, budget);
      const percentageUsed = (spent / budget.amount) * 100;

      if (percentageUsed >= budget.alertThreshold) {
        let alertLevel: BudgetAlert['alertLevel'] = 'warning';
        let message = `You've used ${Math.round(percentageUsed)}% of your ${budget.name} budget`;

        if (percentageUsed >= 100) {
          alertLevel = 'exceeded';
          message = `You've exceeded your ${budget.name} budget by $${(spent - budget.amount).toFixed(2)}`;
        } else if (percentageUsed >= 90) {
          alertLevel = 'danger';
          message = `You're close to exceeding your ${budget.name} budget (${Math.round(percentageUsed)}% used)`;
        }

        alerts.push({
          budgetId: budget.id!,
          budgetName: budget.name,
          currentSpent: spent,
          budgetAmount: budget.amount,
          percentageUsed: Math.round(percentageUsed * 100) / 100,
          alertLevel,
          message
        });
      }
    }

    return alerts;
  }

  private async calculateBudgetSpent(userId: number, budget: Budget): Promise<number> {
    let query = `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM expenses 
      WHERE userId = ? 
        AND date(purchase_date) BETWEEN date(?) AND date(?)
    `;
    const params = [userId, budget.startDate, budget.endDate];

    if (budget.category) {
      query += ' AND category = ?';
      params.push(budget.category);
    }

    const get = promisify(this.db.get.bind(this.db));
    const result = await get(query, params);
    return result.total || 0;
  }
}
