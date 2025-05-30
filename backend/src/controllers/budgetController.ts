import { Request, Response } from 'express';
import { BudgetService } from '../services/budgetService';

export class BudgetController {
  private budgetService: BudgetService;

  constructor() {
    this.budgetService = new BudgetService();
  }

  async createBudget(req: Request, res: Response) {
    try {
      const { userId } = req.user as any;
      const budget = await this.budgetService.createBudget(userId, req.body);
      res.status(201).json({ success: true, data: budget });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async getBudgets(req: Request, res: Response) {
    try {
      const { userId } = req.user as any;
      const budgets = await this.budgetService.getUserBudgets(userId);
      res.json({ success: true, data: budgets });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getBudgetAnalysis(req: Request, res: Response) {
    try {
      const { userId } = req.user as any;
      const analysis = await this.budgetService.getBudgetAnalysis(userId);
      res.json({ success: true, data: analysis });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async updateBudget(req: Request, res: Response) {
    try {
      const { userId } = req.user as any;
      const { budgetId } = req.params;
      const budget = await this.budgetService.updateBudget(
        parseInt(budgetId), 
        userId, 
        req.body
      );
      res.json({ success: true, data: budget });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async deleteBudget(req: Request, res: Response) {
    try {
      const { userId } = req.user as any;
      const { budgetId } = req.params;
      await this.budgetService.deleteBudget(parseInt(budgetId), userId);
      res.json({ success: true, message: 'Budget deleted successfully' });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async getBudgetAlerts(req: Request, res: Response) {
    try {
      const { userId } = req.user as any;
      const alerts = await this.budgetService.getBudgetAlerts(userId);
      res.json({ success: true, data: alerts });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
