import nodemailer from 'nodemailer';
import cron from 'node-cron';
import { BudgetService } from './budgetService';
import { ExpenseService } from './expenseService';

export interface NotificationPreferences {
  email: string;
  budgetAlerts: boolean;
  weeklyReports: boolean;
  monthlyReports: boolean;
  dailyReminders: boolean;
  alertThresholds: {
    dailySpendingLimit: number;
    weeklySpendingLimit: number;
  };
}

export class NotificationService {
  private transporter: nodemailer.Transporter;
  private budgetService: BudgetService;
  private expenseService: ExpenseService;

  constructor() {
    this.transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    this.budgetService = new BudgetService();
    this.expenseService = new ExpenseService();

    // Initialize scheduled notifications
    this.initializeScheduledNotifications();
  }

  private initializeScheduledNotifications() {
    // Daily budget check at 8 PM
    cron.schedule('0 20 * * *', async () => {
      await this.sendDailyBudgetChecks();
    });

    // Weekly report on Sundays at 10 AM
    cron.schedule('0 10 * * 0', async () => {
      await this.sendWeeklyReports();
    });

    // Monthly report on the 1st at 9 AM
    cron.schedule('0 9 1 * *', async () => {
      await this.sendMonthlyReports();
    });

    // Smart spending reminder at 6 PM (only if user spent today)
    cron.schedule('0 18 * * *', async () => {
      await this.sendSmartSpendingReminders();
    });
  }

  async sendBudgetAlert(userId: number, alert: any) {
    const user = await this.getUserNotificationPreferences(userId);
    if (!user.budgetAlerts) return;

    const subject = `🚨 Budget Alert: ${alert.budgetName}`;
    const html = this.generateBudgetAlertEmail(alert);

    await this.sendEmail(user.email, subject, html);
  }

  async sendWeeklyReport(userId: number) {
    const user = await this.getUserNotificationPreferences(userId);
    if (!user.weeklyReports) return;

    const weekData = await this.generateWeeklyReportData(userId);
    const subject = `📊 Your Weekly Spending Report`;
    const html = this.generateWeeklyReportEmail(weekData);

    await this.sendEmail(user.email, subject, html);
  }

  async sendMonthlyReport(userId: number) {
    const user = await this.getUserNotificationPreferences(userId);
    if (!user.monthlyReports) return;

    const monthData = await this.generateMonthlyReportData(userId);
    const subject = `📈 Your Monthly Spending Summary`;
    const html = this.generateMonthlyReportEmail(monthData);

    await this.sendEmail(user.email, subject, html);
  }

  async sendSmartInsight(userId: number, insight: any) {
    const user = await this.getUserNotificationPreferences(userId);
    const subject = `💡 Smart Spending Insight`;
    const html = this.generateInsightEmail(insight);

    await this.sendEmail(user.email, subject, html);
  }

  private async sendDailyBudgetChecks() {
    // Implementation to check all users' budgets and send alerts
    const users = await this.getAllUsersWithBudgets();
    
    for (const user of users) {
      const alerts = await this.budgetService.getBudgetAlerts(user.id);
      for (const alert of alerts) {
        await this.sendBudgetAlert(user.id, alert);
      }
    }
  }

  private async sendWeeklyReports() {
    const users = await this.getAllUsersWithWeeklyReports();
    
    for (const user of users) {
      await this.sendWeeklyReport(user.id);
    }
  }

  private async sendMonthlyReports() {
    const users = await this.getAllUsersWithMonthlyReports();
    
    for (const user of users) {
      await this.sendMonthlyReport(user.id);
    }
  }

  private async sendSmartSpendingReminders() {
    const users = await this.getUsersWithTodaySpending();
    
    for (const user of users) {
      const insights = await this.generateSmartInsights(user.id);
      if (insights.length > 0) {
        await this.sendSmartInsight(user.id, insights[0]);
      }
    }
  }

  private generateBudgetAlertEmail(alert: any): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">Budget Alert</h1>
        </div>
        
        <div style="padding: 20px; background: #f8f9fa;">
          <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #dc3545;">
            <h2 style="color: #dc3545; margin-top: 0;">${alert.budgetName} Budget Alert</h2>
            <p style="font-size: 16px; line-height: 1.5;">
              You've used <strong>${alert.percentageUsed.toFixed(1)}%</strong> of your ${alert.budgetName} budget.
            </p>
            
            <div style="display: flex; justify-content: space-between; margin: 20px 0;">
              <div style="text-align: center;">
                <div style="font-size: 24px; font-weight: bold; color: #333;">$${alert.currentSpent.toFixed(2)}</div>
                <div style="color: #666;">Spent</div>
              </div>
              <div style="text-align: center;">
                <div style="font-size: 24px; font-weight: bold; color: #333;">$${alert.budgetAmount.toFixed(2)}</div>
                <div style="color: #666;">Budget</div>
              </div>
              <div style="text-align: center;">
                <div style="font-size: 24px; font-weight: bold; color: #28a745;">$${(alert.budgetAmount - alert.currentSpent).toFixed(2)}</div>
                <div style="color: #666;">Remaining</div>
              </div>
            </div>

            <div style="background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 15px 0;">
              <h3 style="margin-top: 0; color: #333;">💡 Quick Tips:</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li>Review your recent purchases to identify unnecessary expenses</li>
                <li>Consider switching to generic brands for savings</li>
                <li>Plan your meals to avoid impulse purchases</li>
              </ul>
            </div>
          </div>
        </div>
        
        <div style="padding: 20px; text-align: center; background: #f8f9fa; color: #666;">
          <p>Visit your dashboard to see detailed analytics and adjust your budget if needed.</p>
          <a href="${process.env.FRONTEND_URL}/dashboard" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">View Dashboard</a>
        </div>
      </div>
    `;
  }

  private generateWeeklyReportEmail(weekData: any): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">Weekly Spending Report</h1>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">${weekData.dateRange}</p>
        </div>
        
        <div style="padding: 20px; background: #f8f9fa;">
          <!-- Summary Cards -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px;">
            <div style="background: white; padding: 15px; border-radius: 8px; text-align: center;">
              <div style="font-size: 24px; font-weight: bold; color: #333;">$${weekData.totalSpent.toFixed(2)}</div>
              <div style="color: #666; font-size: 14px;">Total Spent</div>
            </div>
            <div style="background: white; padding: 15px; border-radius: 8px; text-align: center;">
              <div style="font-size: 24px; font-weight: bold; color: #333;">${weekData.transactionCount}</div>
              <div style="color: #666; font-size: 14px;">Transactions</div>
            </div>
            <div style="background: white; padding: 15px; border-radius: 8px; text-align: center;">
              <div style="font-size: 24px; font-weight: bold; color: #333;">$${weekData.averageTransaction.toFixed(2)}</div>
              <div style="color: #666; font-size: 14px;">Avg per Trip</div>
            </div>
          </div>

          <!-- Top Categories -->
          <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="margin-top: 0; color: #333;">Top Spending Categories</h3>
            ${weekData.topCategories.map((cat: any) => `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #eee;">
                <span>${cat.category}</span>
                <span style="font-weight: bold;">$${cat.amount.toFixed(2)}</span>
              </div>
            `).join('')}
          </div>

          <!-- Insights -->
          <div style="background: white; padding: 20px; border-radius: 8px;">
            <h3 style="margin-top: 0; color: #333;">📊 This Week's Insights</h3>
            <ul style="margin: 0; padding-left: 20px; line-height: 1.6;">
              ${weekData.insights.map((insight: string) => `<li>${insight}</li>`).join('')}
            </ul>
          </div>
        </div>
        
        <div style="padding: 20px; text-align: center; background: #f8f9fa; color: #666;">
          <a href="${process.env.FRONTEND_URL}/analytics" style="background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">View Detailed Analytics</a>
        </div>
      </div>
    `;
  }

  private async generateWeeklyReportData(userId: number) {
    // Implementation to generate weekly data
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

    // This would fetch actual data from your expense service
    return {
      dateRange: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
      totalSpent: 156.78,
      transactionCount: 8,
      averageTransaction: 19.60,
      topCategories: [
        { category: 'Groceries', amount: 89.45 },
        { category: 'Household', amount: 34.23 },
        { category: 'Personal Care', amount: 33.10 }
      ],
      insights: [
        'You spent 15% more on groceries this week compared to last week',
        'Your average transaction amount decreased by $3.50',
        'You made 2 fewer shopping trips than usual'
      ]
    };
  }

  private async generateMonthlyReportData(userId: number) {
    // Similar implementation for monthly data
    return {};
  }

  private async generateSmartInsights(userId: number) {
    // AI-powered insights based on spending patterns
    return [];
  }

  private async sendEmail(to: string, subject: string, html: string) {
    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@expense-tracker.com',
        to,
        subject,
        html,
      });
    } catch (error) {
      console.error('Failed to send email:', error);
    }
  }

  private async getUserNotificationPreferences(userId: number): Promise<NotificationPreferences> {
    // Implementation to fetch user preferences from database
    return {
      email: 'user@example.com',
      budgetAlerts: true,
      weeklyReports: true,
      monthlyReports: true,
      dailyReminders: false,
      alertThresholds: {
        dailySpendingLimit: 50,
        weeklySpendingLimit: 200
      }
    };
  }

  private async getAllUsersWithBudgets() {
    // Implementation to fetch users with active budgets
    return [];
  }

  private async getAllUsersWithWeeklyReports() {
    // Implementation to fetch users who want weekly reports
    return [];
  }

  private async getAllUsersWithMonthlyReports() {
    // Implementation to fetch users who want monthly reports
    return [];
  }

  private async getUsersWithTodaySpending() {
    // Implementation to fetch users who made purchases today
    return [];
  }
}
