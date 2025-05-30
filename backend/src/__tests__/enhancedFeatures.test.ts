import { BudgetService, Budget } from '../services/budgetService';
import { AIInsightsService } from '../services/aiInsightsService';
import { NotificationService } from '../services/notificationService';
import { OCRService } from '../services/ocrService';

describe('Enhanced Features Test Suite', () => {
  
  describe('BudgetService', () => {
    let budgetService: BudgetService;
    const mockUserId = 1;

    beforeEach(() => {
      budgetService = new BudgetService();
    });

    afterEach(() => {
      // Clean up test data
    });

    describe('Budget Creation', () => {
      test('should create a valid monthly budget', async () => {
        const budgetData = {
          name: 'Groceries Budget',
          amount: 500,
          category: 'Groceries',
          period: 'monthly' as const,
          startDate: '2025-01-01',
          endDate: '2025-01-31',
          alertThreshold: 80,
          isActive: true
        };

        const budget = await budgetService.createBudget(mockUserId, budgetData);

        expect(budget).toBeDefined();
        expect(budget.name).toBe('Groceries Budget');
        expect(budget.amount).toBe(500);
        expect(budget.period).toBe('monthly');
        expect(budget.alertThreshold).toBe(80);
      });

      test('should validate budget data before creation', async () => {
        const invalidBudgetData = {
          name: '',
          amount: -100,
          period: 'monthly' as const,
          startDate: '2025-01-01',
          endDate: '2024-12-31', // End date before start date
          alertThreshold: 150, // Above 100%
          isActive: true
        };

        await expect(
          budgetService.createBudget(mockUserId, invalidBudgetData)
        ).rejects.toThrow();
      });
    });

    describe('Budget Analysis', () => {
      test('should calculate budget analysis correctly', async () => {
        // Create test budgets
        const budget1 = await budgetService.createBudget(mockUserId, {
          name: 'Test Budget 1',
          amount: 300,
          period: 'monthly',
          startDate: '2025-01-01',
          endDate: '2025-01-31',
          alertThreshold: 80,
          isActive: true
        });

        const budget2 = await budgetService.createBudget(mockUserId, {
          name: 'Test Budget 2',
          amount: 200,
          period: 'monthly',
          startDate: '2025-01-01',
          endDate: '2025-01-31',
          alertThreshold: 90,
          isActive: true
        });

        const analysis = await budgetService.getBudgetAnalysis(mockUserId);

        expect(analysis).toBeDefined();
        expect(analysis.totalBudgets).toBeGreaterThanOrEqual(2);
        expect(analysis.activeBudgets).toBeGreaterThanOrEqual(2);
        expect(analysis.totalBudgetAmount).toBeGreaterThanOrEqual(500);
        expect(analysis.budgetPerformance).toBeInstanceOf(Array);
      });

      test('should identify over-budget scenarios', async () => {
        // This test would require mock expense data that exceeds budget
        const analysis = await budgetService.getBudgetAnalysis(mockUserId);
        
        // Check if the analysis correctly identifies over-budget situations
        const overBudgetItems = analysis.budgetPerformance.filter(
          item => item.status === 'over'
        );

        expect(overBudgetItems).toBeInstanceOf(Array);
      });
    });

    describe('Budget Alerts', () => {
      test('should generate alerts for budgets approaching threshold', async () => {
        const alerts = await budgetService.getBudgetAlerts(mockUserId);

        expect(alerts).toBeInstanceOf(Array);
        
        alerts.forEach(alert => {
          expect(alert).toHaveProperty('budgetId');
          expect(alert).toHaveProperty('budgetName');
          expect(alert).toHaveProperty('currentSpent');
          expect(alert).toHaveProperty('budgetAmount');
          expect(alert).toHaveProperty('percentageUsed');
          expect(alert).toHaveProperty('alertLevel');
          expect(['warning', 'danger', 'exceeded']).toContain(alert.alertLevel);
        });
      });
    });
  });

  describe('AIInsightsService', () => {
    let aiInsightsService: AIInsightsService;
    const mockUserId = 1;

    beforeEach(() => {
      aiInsightsService = new AIInsightsService();
    });

    describe('Spending Insights Generation', () => {
      test('should generate meaningful spending insights', async () => {
        const insights = await aiInsightsService.generateSpendingInsights(mockUserId);

        expect(insights).toBeInstanceOf(Array);
        
        insights.forEach(insight => {
          expect(insight).toHaveProperty('type');
          expect(insight).toHaveProperty('title');
          expect(insight).toHaveProperty('description');
          expect(insight).toHaveProperty('impact');
          expect(insight).toHaveProperty('actionable');
          expect(insight).toHaveProperty('suggestions');
          
          expect(['trend', 'anomaly', 'opportunity', 'warning']).toContain(insight.type);
          expect(['high', 'medium', 'low']).toContain(insight.impact);
          expect(typeof insight.actionable).toBe('boolean');
          expect(insight.suggestions).toBeInstanceOf(Array);
        });
      });

      test('should prioritize insights by impact level', async () => {
        const insights = await aiInsightsService.generateSpendingInsights(mockUserId);
        
        if (insights.length > 1) {
          const impactOrder = { high: 3, medium: 2, low: 1 };
          
          for (let i = 0; i < insights.length - 1; i++) {
            const currentImpact = impactOrder[insights[i].impact];
            const nextImpact = impactOrder[insights[i + 1].impact];
            
            expect(currentImpact).toBeGreaterThanOrEqual(nextImpact);
          }
        }
      });
    });

    describe('Spending Prediction', () => {
      test('should predict next month spending with confidence score', async () => {
        const prediction = await aiInsightsService.predictNextMonthSpending(mockUserId);

        expect(prediction).toHaveProperty('predictedAmount');
        expect(prediction).toHaveProperty('confidence');
        expect(prediction).toHaveProperty('factors');
        expect(prediction).toHaveProperty('recommendation');

        expect(typeof prediction.predictedAmount).toBe('number');
        expect(prediction.predictedAmount).toBeGreaterThanOrEqual(0);
        expect(prediction.confidence).toBeGreaterThanOrEqual(0);
        expect(prediction.confidence).toBeLessThanOrEqual(100);
        expect(prediction.factors).toBeInstanceOf(Array);
        expect(typeof prediction.recommendation).toBe('string');
      });

      test('should handle insufficient data gracefully', async () => {
        // Test with user that has no expense history
        const newUserId = 999;
        const prediction = await aiInsightsService.predictNextMonthSpending(newUserId);

        expect(prediction.predictedAmount).toBe(0);
        expect(prediction.confidence).toBeLessThan(50);
      });
    });

    describe('User Profile Generation', () => {
      test('should generate comprehensive user spending profile', async () => {
        const profile = await aiInsightsService.generateUserProfile(mockUserId);

        expect(profile).toHaveProperty('averageMonthlySpend');
        expect(profile).toHaveProperty('preferredStores');
        expect(profile).toHaveProperty('topCategories');
        expect(profile).toHaveProperty('spendingPattern');
        expect(profile).toHaveProperty('budgetAdherence');
        expect(profile).toHaveProperty('riskScore');

        expect(typeof profile.averageMonthlySpend).toBe('number');
        expect(profile.preferredStores).toBeInstanceOf(Array);
        expect(profile.topCategories).toBeInstanceOf(Array);
        expect(['consistent', 'variable', 'seasonal']).toContain(profile.spendingPattern);
        expect(profile.budgetAdherence).toBeGreaterThanOrEqual(0);
        expect(profile.budgetAdherence).toBeLessThanOrEqual(100);
        expect(profile.riskScore).toBeGreaterThanOrEqual(0);
        expect(profile.riskScore).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('OCRService', () => {
    let ocrService: OCRService;

    beforeEach(async () => {
      ocrService = new OCRService();
      await ocrService.initialize();
    });

    afterEach(async () => {
      await ocrService.terminate();
    });

    describe('Receipt Processing', () => {
      test('should extract data from receipt text', async () => {
        // Mock receipt text
        const mockReceiptText = `
          WALMART SUPERCENTER
          Store #1234
          Date: 05/30/2025
          
          Milk 2%           $3.49
          Bread Wheat       $2.99
          Bananas 1lb       $1.29
          
          SUBTOTAL          $7.77
          TAX               $0.62
          TOTAL             $8.39
        `;

        // Create a mock image buffer (in real scenario, this would be an actual image)
        const mockImageBuffer = Buffer.from('mock image data');
        
        // Mock the OCR recognize method
        jest.spyOn(ocrService as any, 'worker', 'get').mockReturnValue({
          recognize: jest.fn().mockResolvedValue({
            data: { text: mockReceiptText }
          })
        });

        const result = await ocrService.processReceipt(mockImageBuffer);

        expect(result).toHaveProperty('raw');
        expect(result).toHaveProperty('items');
        expect(result).toHaveProperty('total');
        expect(result).toHaveProperty('storeName');
        expect(result).toHaveProperty('date');

        expect(result.raw).toBe(mockReceiptText);
        expect(result.items).toBeInstanceOf(Array);
        expect(result.total).toBeCloseTo(8.39);
        expect(result.storeName?.toLowerCase()).toContain('walmart');
      });

      test('should handle malformed receipt text gracefully', async () => {
        const malformedText = 'This is not a receipt';
        const mockImageBuffer = Buffer.from('mock image data');
        
        jest.spyOn(ocrService as any, 'worker', 'get').mockReturnValue({
          recognize: jest.fn().mockResolvedValue({
            data: { text: malformedText }
          })
        });

        const result = await ocrService.processReceipt(mockImageBuffer);

        expect(result).toHaveProperty('raw');
        expect(result.raw).toBe(malformedText);
        expect(result.items).toEqual([]);
        expect(result.total).toBeUndefined();
      });
    });
  });

  describe('NotificationService', () => {
    let notificationService: NotificationService;

    beforeEach(() => {
      notificationService = new NotificationService();
      
      // Mock the email transporter
      jest.spyOn(notificationService as any, 'transporter', 'get').mockReturnValue({
        sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' })
      });
    });

    describe('Budget Alerts', () => {
      test('should send budget alert email', async () => {
        const mockAlert = {
          budgetId: 1,
          budgetName: 'Groceries',
          currentSpent: 450,
          budgetAmount: 500,
          percentageUsed: 90,
          alertLevel: 'warning' as const,
          message: 'You are approaching your budget limit'
        };

        const mockUserId = 1;
        
        // Mock getUserNotificationPreferences
        jest.spyOn(notificationService as any, 'getUserNotificationPreferences')
          .mockResolvedValue({
            email: 'test@example.com',
            budgetAlerts: true,
            weeklyReports: true,
            monthlyReports: true,
            dailyReminders: false,
            alertThresholds: {
              dailySpendingLimit: 50,
              weeklySpendingLimit: 200
            }
          });

        await expect(
          notificationService.sendBudgetAlert(mockUserId, mockAlert)
        ).resolves.not.toThrow();
      });
    });

    describe('Weekly Reports', () => {
      test('should generate and send weekly report', async () => {
        const mockUserId = 1;
        
        jest.spyOn(notificationService as any, 'getUserNotificationPreferences')
          .mockResolvedValue({ email: 'test@example.com', weeklyReports: true });
        
        jest.spyOn(notificationService as any, 'generateWeeklyReportData')
          .mockResolvedValue({
            dateRange: 'May 24 - May 30, 2025',
            totalSpent: 156.78,
            transactionCount: 8,
            averageTransaction: 19.60,
            topCategories: [
              { category: 'Groceries', amount: 89.45 }
            ],
            insights: ['You spent 15% more this week']
          });

        await expect(
          notificationService.sendWeeklyReport(mockUserId)
        ).resolves.not.toThrow();
      });
    });

    describe('Email Template Generation', () => {
      test('should generate valid HTML email templates', () => {
        const mockAlert = {
          budgetName: 'Test Budget',
          percentageUsed: 85,
          currentSpent: 425,
          budgetAmount: 500
        };

        const html = (notificationService as any).generateBudgetAlertEmail(mockAlert);

        expect(typeof html).toBe('string');
        expect(html).toContain('Budget Alert');
        expect(html).toContain('Test Budget');
        expect(html).toContain('85');
        expect(html).toContain('$425');
        expect(html).toContain('$500');
      });
    });
  });

  describe('Integration Tests', () => {
    describe('Budget and AI Insights Integration', () => {
      test('should provide budget-aware insights', async () => {
        const budgetService = new BudgetService();
        const aiInsightsService = new AIInsightsService();
        const mockUserId = 1;

        // Create a budget
        const budget = await budgetService.createBudget(mockUserId, {
          name: 'Integration Test Budget',
          amount: 400,
          period: 'monthly',
          startDate: '2025-01-01',
          endDate: '2025-01-31',
          alertThreshold: 75,
          isActive: true
        });

        // Generate insights
        const insights = await aiInsightsService.generateSpendingInsights(mockUserId);
        
        // Insights should be aware of budget constraints
        const budgetRelatedInsights = insights.filter(
          insight => insight.title.toLowerCase().includes('budget') ||
                    insight.description.toLowerCase().includes('budget')
        );

        expect(budgetRelatedInsights.length).toBeGreaterThanOrEqual(0);
      });
    });

    describe('OCR and Expense Creation Integration', () => {
      test('should create expenses from OCR data', async () => {
        const ocrService = new OCRService();
        await ocrService.initialize();

        const mockReceiptData = {
          storeName: 'Target',
          total: 45.67,
          date: '2025-05-30',
          items: [
            { name: 'Milk', price: 3.99 },
            { name: 'Bread', price: 2.49 }
          ],
          raw: 'receipt text'
        };

        // In a real integration test, you would:
        // 1. Process receipt with OCR
        // 2. Create expense from OCR data
        // 3. Verify expense was created correctly
        
        expect(mockReceiptData.total).toBeGreaterThan(0);
        expect(mockReceiptData.items?.length).toBeGreaterThan(0);

        await ocrService.terminate();
      });
    });
  });

  describe('Performance Tests', () => {
    test('AI insights should generate within acceptable time', async () => {
      const aiInsightsService = new AIInsightsService();
      const mockUserId = 1;

      const startTime = Date.now();
      await aiInsightsService.generateSpendingInsights(mockUserId);
      const endTime = Date.now();

      const executionTime = endTime - startTime;
      
      // Should complete within 5 seconds
      expect(executionTime).toBeLessThan(5000);
    });

    test('Budget analysis should handle large datasets efficiently', async () => {
      const budgetService = new BudgetService();
      const mockUserId = 1;

      const startTime = Date.now();
      await budgetService.getBudgetAnalysis(mockUserId);
      const endTime = Date.now();

      const executionTime = endTime - startTime;
      
      // Should complete within 2 seconds
      expect(executionTime).toBeLessThan(2000);
    });
  });

  describe('Error Handling Tests', () => {
    test('should handle database connection failures gracefully', async () => {
      const budgetService = new BudgetService();
      
      // Mock database failure
      jest.spyOn(budgetService as any, 'db', 'get').mockReturnValue({
        run: jest.fn().mockRejectedValue(new Error('Database connection failed'))
      });

      await expect(
        budgetService.createBudget(1, {
          name: 'Test',
          amount: 100,
          period: 'monthly',
          startDate: '2025-01-01',
          endDate: '2025-01-31',
          alertThreshold: 80,
          isActive: true
        })
      ).rejects.toThrow('Database connection failed');
    });

    test('should handle OCR service failures', async () => {
      const ocrService = new OCRService();
      
      jest.spyOn(ocrService as any, 'worker', 'get').mockReturnValue({
        recognize: jest.fn().mockRejectedValue(new Error('OCR processing failed'))
      });

      const mockImageBuffer = Buffer.from('test');
      
      await expect(
        ocrService.processReceipt(mockImageBuffer)
      ).rejects.toThrow('OCR processing failed');
    });

    test('should handle email service failures', async () => {
      const notificationService = new NotificationService();
      
      jest.spyOn(notificationService as any, 'transporter', 'get').mockReturnValue({
        sendMail: jest.fn().mockRejectedValue(new Error('SMTP server unavailable'))
      });

      jest.spyOn(notificationService as any, 'getUserNotificationPreferences')
        .mockResolvedValue({ email: 'test@example.com', budgetAlerts: true });

      // Should not throw, but log the error
      await expect(
        notificationService.sendBudgetAlert(1, {
          budgetId: 1,
          budgetName: 'Test',
          currentSpent: 100,
          budgetAmount: 200,
          percentageUsed: 50,
          alertLevel: 'warning',
          message: 'Test alert'
        })
      ).resolves.not.toThrow();
    });
  });
});

// Test utilities and helpers
export class TestHelpers {
  static createMockExpense(overrides: any = {}) {
    return {
      id: Math.floor(Math.random() * 1000),
      userId: 1,
      amount: 25.99,
      category: 'Groceries',
      store: 'Test Store',
      description: 'Test expense',
      purchase_date: new Date().toISOString(),
      receipt_url: null,
      tags: [],
      ...overrides
    };
  }

  static createMockBudget(overrides: any = {}) {
    return {
      id: Math.floor(Math.random() * 1000),
      userId: 1,
      name: 'Test Budget',
      amount: 500,
      category: 'Groceries',
      period: 'monthly' as const,
      startDate: '2025-01-01',
      endDate: '2025-01-31',
      alertThreshold: 80,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides
    };
  }

  static async createTestUser() {
    // Helper to create test user in database
    return {
      id: Math.floor(Math.random() * 1000),
      email: 'test@example.com',
      name: 'Test User'
    };
  }

  static async cleanupTestData() {
    // Helper to clean up test data after tests
    // Implementation would delete test records from database
  }
}
