import { Database } from 'sqlite3';
import { promisify } from 'util';
import { BudgetService } from './budgetService';
import { ExpenseService } from './expenseService';
import { NotificationService } from './notificationService';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: 'savings' | 'tracking' | 'budget' | 'streak' | 'social' | 'special';
  icon: string;
  points: number;
  difficulty: 'bronze' | 'silver' | 'gold' | 'platinum';
  requirements: {
    type: string;
    value: number;
    timeframe?: string;
  };
  isRepeatable: boolean;
  secretAchievement: boolean;
}

export interface UserAchievement {
  id?: number;
  userId: number;
  achievementId: string;
  unlockedAt: string;
  progress?: number;
  isCompleted: boolean;
  notificationSent: boolean;
}

export interface Challenge {
  id?: number;
  name: string;
  description: string;
  type: 'daily' | 'weekly' | 'monthly' | 'special';
  category: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  requirements: {
    type: string;
    target: number;
    unit: string;
  };
  rewards: {
    points: number;
    badges?: string[];
    unlocks?: string[];
  };
  participants: number;
  completions: number;
}

export interface UserChallenge {
  id?: number;
  userId: number;
  challengeId: number;
  joinedAt: string;
  progress: number;
  isCompleted: boolean;
  completedAt?: string;
  rank?: number;
}

export interface UserStats {
  totalPoints: number;
  level: number;
  unlockedAchievements: number;
  totalAchievements: number;
  currentStreak: number;
  longestStreak: number;
  completedChallenges: number;
  activeChallenges: number;
  rank: number;
  nextLevelPoints: number;
  categoryStats: {
    savings: number;
    tracking: number;
    budget: number;
    streak: number;
    social: number;
    special: number;
  };
}

export interface Leaderboard {
  period: 'daily' | 'weekly' | 'monthly' | 'allTime';
  entries: Array<{
    userId: number;
    username: string;
    points: number;
    level: number;
    rank: number;
    avatar?: string;
    achievements: number;
    change: number; // rank change
  }>;
}

export interface UserProfile {
  userId: number;
  username: string;
  avatar?: string;
  level: number;
  totalPoints: number;
  joinDate: string;
  bio?: string;
  badges: string[];
  favoriteAchievements: string[];
  privacy: {
    showStats: boolean;
    showAchievements: boolean;
    showChallenges: boolean;
  };
}

export class GamificationService {
  private db: Database;
  private budgetService: BudgetService;
  private expenseService: ExpenseService;
  private notificationService: NotificationService;

  constructor() {
    this.db = new Database('./database/expenses.db');
    this.budgetService = new BudgetService();
    this.expenseService = new ExpenseService();
    this.notificationService = new NotificationService();
    
    this.initializeAchievements();
  }

  // Achievement Management
  async checkAndUnlockAchievements(userId: number, triggerType: string, data?: any): Promise<UserAchievement[]> {
    const unlockedAchievements: UserAchievement[] = [];
    const availableAchievements = await this.getAvailableAchievements(userId);

    for (const achievement of availableAchievements) {
      if (await this.checkAchievementRequirement(userId, achievement, triggerType, data)) {
        const userAchievement = await this.unlockAchievement(userId, achievement.id);
        unlockedAchievements.push(userAchievement);
        
        // Send notification for achievement unlock
        await this.sendAchievementNotification(userId, achievement);
      }
    }

    // Update user level after potential point increases
    await this.updateUserLevel(userId);

    return unlockedAchievements;
  }

  async unlockAchievement(userId: number, achievementId: string): Promise<UserAchievement> {
    const achievement = await this.getAchievementById(achievementId);
    
    const query = `
      INSERT INTO user_achievements (userId, achievementId, unlockedAt, progress, isCompleted, notificationSent)
      VALUES (?, ?, datetime('now'), 100, 1, 0)
    `;

    const run = promisify(this.db.run.bind(this.db));
    const result = await run(query, [userId, achievementId]);

    // Add points to user
    await this.addPointsToUser(userId, achievement.points);

    return this.getUserAchievementById(result.lastID);
  }

  async getUserStats(userId: number): Promise<UserStats> {
    const statsQuery = `
      SELECT 
        COALESCE(SUM(a.points), 0) as totalPoints,
        COUNT(ua.id) as unlockedAchievements
      FROM user_achievements ua
      JOIN achievements a ON ua.achievementId = a.id
      WHERE ua.userId = ? AND ua.isCompleted = 1
    `;

    const get = promisify(this.db.get.bind(this.db));
    const stats = await get(statsQuery, [userId]);

    const level = this.calculateLevel(stats.totalPoints);
    const nextLevelPoints = this.getPointsForLevel(level + 1) - stats.totalPoints;

    const streaks = await this.getCurrentStreak(userId);
    const challenges = await this.getUserChallengeStats(userId);
    const rank = await this.getUserRank(userId);
    const categoryStats = await this.getCategoryStats(userId);

    return {
      totalPoints: stats.totalPoints || 0,
      level,
      unlockedAchievements: stats.unlockedAchievements || 0,
      totalAchievements: await this.getTotalAchievementsCount(),
      currentStreak: streaks.current,
      longestStreak: streaks.longest,
      completedChallenges: challenges.completed,
      activeChallenges: challenges.active,
      rank,
      nextLevelPoints,
      categoryStats
    };
  }

  // Challenge Management
  async createChallenge(challengeData: Omit<Challenge, 'id'>): Promise<Challenge> {
    const query = `
      INSERT INTO challenges (
        name, description, type, category, startDate, endDate, 
        isActive, requirements, rewards, participants, completions
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
    `;

    const run = promisify(this.db.run.bind(this.db));
    const result = await run(query, [
      challengeData.name,
      challengeData.description,
      challengeData.type,
      challengeData.category,
      challengeData.startDate,
      challengeData.endDate,
      challengeData.isActive ? 1 : 0,
      JSON.stringify(challengeData.requirements),
      JSON.stringify(challengeData.rewards)
    ]);

    return this.getChallengeById(result.lastID);
  }

  async joinChallenge(userId: number, challengeId: number): Promise<UserChallenge> {
    // Check if user is already participating
    const existingQuery = 'SELECT * FROM user_challenges WHERE userId = ? AND challengeId = ?';
    const get = promisify(this.db.get.bind(this.db));
    const existing = await get(existingQuery, [userId, challengeId]);

    if (existing) {
      throw new Error('User is already participating in this challenge');
    }

    const query = `
      INSERT INTO user_challenges (userId, challengeId, joinedAt, progress, isCompleted)
      VALUES (?, ?, datetime('now'), 0, 0)
    `;

    const run = promisify(this.db.run.bind(this.db));
    const result = await run(query, [userId, challengeId]);

    // Update participant count
    await this.updateChallengeParticipants(challengeId, 1);

    return this.getUserChallengeById(result.lastID);
  }

  async updateChallengeProgress(userId: number, challengeId: number, progress: number): Promise<void> {
    const challenge = await this.getChallengeById(challengeId);
    const isCompleted = progress >= challenge.requirements.target;

    const query = `
      UPDATE user_challenges 
      SET progress = ?, isCompleted = ?, completedAt = CASE WHEN ? THEN datetime('now') ELSE completedAt END
      WHERE userId = ? AND challengeId = ?
    `;

    const run = promisify(this.db.run.bind(this.db));
    await run(query, [progress, isCompleted ? 1 : 0, isCompleted, userId, challengeId]);

    if (isCompleted) {
      // Award challenge rewards
      await this.awardChallengeRewards(userId, challenge);
      
      // Update completion count
      await this.updateChallengeCompletions(challengeId, 1);
    }
  }

  async getActiveChallenge(userId: number): Promise<Challenge[]> {
    const query = `
      SELECT c.*, uc.progress, uc.isCompleted, uc.joinedAt
      FROM challenges c
      LEFT JOIN user_challenges uc ON c.id = uc.challengeId AND uc.userId = ?
      WHERE c.isActive = 1 AND date('now') BETWEEN c.startDate AND c.endDate
      ORDER BY c.endDate ASC
    `;

    const all = promisify(this.db.all.bind(this.db));
    const challenges = await all(query, [userId]);

    return challenges.map(challenge => ({
      ...challenge,
      requirements: JSON.parse(challenge.requirements),
      rewards: JSON.parse(challenge.rewards)
    }));
  }

  // Daily/Weekly Challenge Generation
  async generateDailyChallenge(): Promise<Challenge> {
    const dailyChallenges = [
      {
        name: 'Track Every Expense',
        description: 'Record all your expenses for the day',
        requirements: { type: 'expense_count', target: 3, unit: 'expenses' },
        rewards: { points: 50 }
      },
      {
        name: 'Budget Hero',
        description: 'Stay within your daily budget',
        requirements: { type: 'budget_adherence', target: 100, unit: 'percentage' },
        rewards: { points: 75 }
      },
      {
        name: 'Receipt Scanner',
        description: 'Upload and process a receipt',
        requirements: { type: 'receipt_upload', target: 1, unit: 'receipts' },
        rewards: { points: 30 }
      }
    ];

    const randomChallenge = dailyChallenges[Math.floor(Math.random() * dailyChallenges.length)];
    const today = new Date().toISOString().split('T')[0];

    return await this.createChallenge({
      ...randomChallenge,
      type: 'daily',
      category: 'daily',
      startDate: today,
      endDate: today,
      isActive: true,
      participants: 0,
      completions: 0
    });
  }

  async generateWeeklyChallenge(): Promise<Challenge> {
    const weeklyChallenges = [
      {
        name: 'Savings Champion',
        description: 'Save $50 this week compared to last week',
        requirements: { type: 'weekly_savings', target: 50, unit: 'dollars' },
        rewards: { points: 200, badges: ['savings_champion'] }
      },
      {
        name: 'Price Hunter',
        description: 'Find and track 10 different product prices',
        requirements: { type: 'price_tracking', target: 10, unit: 'products' },
        rewards: { points: 150 }
      },
      {
        name: 'Meal Planner',
        description: 'Create and complete a meal plan',
        requirements: { type: 'meal_plan_completion', target: 1, unit: 'plans' },
        rewards: { points: 175, badges: ['meal_master'] }
      }
    ];

    const randomChallenge = weeklyChallenges[Math.floor(Math.random() * weeklyChallenges.length)];
    const today = new Date();
    const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
    const endOfWeek = new Date(startOfWeek.getTime() + 6 * 24 * 60 * 60 * 1000);

    return await this.createChallenge({
      ...randomChallenge,
      type: 'weekly',
      category: 'weekly',
      startDate: startOfWeek.toISOString().split('T')[0],
      endDate: endOfWeek.toISOString().split('T')[0],
      isActive: true,
      participants: 0,
      completions: 0
    });
  }

  // Leaderboard
  async getLeaderboard(period: 'daily' | 'weekly' | 'monthly' | 'allTime', limit: number = 20): Promise<Leaderboard> {
    let dateFilter = '';
    
    switch (period) {
      case 'daily':
        dateFilter = "AND date(ua.unlockedAt) = date('now')";
        break;
      case 'weekly':
        dateFilter = "AND date(ua.unlockedAt) >= date('now', '-7 days')";
        break;
      case 'monthly':
        dateFilter = "AND date(ua.unlockedAt) >= date('now', '-30 days')";
        break;
      default:
        dateFilter = '';
    }

    const query = `
      SELECT 
        u.id as userId,
        u.name as username,
        u.avatar,
        SUM(a.points) as points,
        COUNT(ua.id) as achievements,
        ROW_NUMBER() OVER (ORDER BY SUM(a.points) DESC) as rank
      FROM users u
      LEFT JOIN user_achievements ua ON u.id = ua.userId AND ua.isCompleted = 1 ${dateFilter}
      LEFT JOIN achievements a ON ua.achievementId = a.id
      GROUP BY u.id, u.name, u.avatar
      ORDER BY points DESC
      LIMIT ?
    `;

    const all = promisify(this.db.all.bind(this.db));
    const entries = await all(query, [limit]);

    return {
      period,
      entries: entries.map((entry, index) => ({
        ...entry,
        level: this.calculateLevel(entry.points || 0),
        rank: index + 1,
        change: 0 // Would require historical data to calculate
      }))
    };
  }

  // Social Features
  async getUserProfile(userId: number): Promise<UserProfile> {
    const query = 'SELECT * FROM user_profiles WHERE userId = ?';
    const get = promisify(this.db.get.bind(this.db));
    let profile = await get(query, [userId]);

    if (!profile) {
      profile = await this.createUserProfile(userId);
    }

    const stats = await this.getUserStats(userId);
    const badges = await this.getUserBadges(userId);

    return {
      ...profile,
      level: stats.level,
      totalPoints: stats.totalPoints,
      badges,
      privacy: JSON.parse(profile.privacy || '{"showStats": true, "showAchievements": true, "showChallenges": true}'),
      favoriteAchievements: JSON.parse(profile.favoriteAchievements || '[]')
    };
  }

  async updateUserProfile(userId: number, updates: Partial<UserProfile>): Promise<UserProfile> {
    const setClause = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (['username', 'avatar', 'bio'].includes(key)) {
        setClause.push(`${key} = ?`);
        values.push(value);
      } else if (key === 'privacy' || key === 'favoriteAchievements') {
        setClause.push(`${key} = ?`);
        values.push(JSON.stringify(value));
      }
    }

    if (setClause.length > 0) {
      const query = `UPDATE user_profiles SET ${setClause.join(', ')} WHERE userId = ?`;
      const run = promisify(this.db.run.bind(this.db));
      await run(query, [...values, userId]);
    }

    return this.getUserProfile(userId);
  }

  // Helper Methods
  private async checkAchievementRequirement(
    userId: number, 
    achievement: Achievement, 
    triggerType: string, 
    data?: any
  ): Promise<boolean> {
    const { requirements } = achievement;

    switch (requirements.type) {
      case 'expense_count':
        if (triggerType === 'expense_added') {
          const count = await this.getUserExpenseCount(userId, requirements.timeframe);
          return count >= requirements.value;
        }
        break;

      case 'budget_adherence':
        if (triggerType === 'budget_check') {
          const adherence = await this.getBudgetAdherence(userId);
          return adherence >= requirements.value;
        }
        break;

      case 'savings_amount':
        if (triggerType === 'expense_added') {
          const savings = await this.calculateSavings(userId, requirements.timeframe);
          return savings >= requirements.value;
        }
        break;

      case 'consecutive_days':
        if (triggerType === 'expense_added') {
          const streak = await this.getCurrentStreak(userId);
          return streak.current >= requirements.value;
        }
        break;

      case 'price_tracking':
        if (triggerType === 'price_tracked') {
          const trackedCount = await this.getPriceTrackingCount(userId, requirements.timeframe);
          return trackedCount >= requirements.value;
        }
        break;

      case 'receipt_upload':
        if (triggerType === 'receipt_uploaded') {
          return true; // Single upload achievement
        }
        break;

      default:
        return false;
    }

    return false;
  }

  private calculateLevel(points: number): number {
    // Level calculation: Level = sqrt(points / 100)
    return Math.floor(Math.sqrt(points / 100)) + 1;
  }

  private getPointsForLevel(level: number): number {
    // Inverse of level calculation
    return Math.pow(level - 1, 2) * 100;
  }

  private async addPointsToUser(userId: number, points: number): Promise<void> {
    // Points are calculated from achievements, so this is handled automatically
    // Could implement a separate points table if needed for more complex point systems
  }

  private async updateUserLevel(userId: number): Promise<void> {
    const stats = await this.getUserStats(userId);
    // Level is calculated from points, so no separate update needed
  }

  private async sendAchievementNotification(userId: number, achievement: Achievement): Promise<void> {
    // Integration with notification service
    const message = `🎉 Achievement Unlocked: ${achievement.name}! You earned ${achievement.points} points.`;
    // await this.notificationService.sendPushNotification(userId, message);
  }

  private async initializeAchievements(): Promise<void> {
    const achievements: Achievement[] = [
      {
        id: 'first_expense',
        name: 'Getting Started',
        description: 'Add your first expense',
        category: 'tracking',
        icon: '🎯',
        points: 10,
        difficulty: 'bronze',
        requirements: { type: 'expense_count', value: 1 },
        isRepeatable: false,
        secretAchievement: false
      },
      {
        id: 'expense_streak_7',
        name: 'Weekly Warrior',
        description: 'Track expenses for 7 consecutive days',
        category: 'streak',
        icon: '🔥',
        points: 100,
        difficulty: 'silver',
        requirements: { type: 'consecutive_days', value: 7 },
        isRepeatable: false,
        secretAchievement: false
      },
      {
        id: 'budget_master',
        name: 'Budget Master',
        description: 'Stay within budget for an entire month',
        category: 'budget',
        icon: '💰',
        points: 200,
        difficulty: 'gold',
        requirements: { type: 'budget_adherence', value: 100, timeframe: 'month' },
        isRepeatable: true,
        secretAchievement: false
      },
      {
        id: 'savings_hero',
        name: 'Savings Hero',
        description: 'Save $500 in a single month',
        category: 'savings',
        icon: '🏆',
        points: 300,
        difficulty: 'gold',
        requirements: { type: 'savings_amount', value: 500, timeframe: 'month' },
        isRepeatable: true,
        secretAchievement: false
      },
      {
        id: 'price_hunter',
        name: 'Price Hunter',
        description: 'Track prices for 50 different products',
        category: 'tracking',
        icon: '🔍',
        points: 150,
        difficulty: 'silver',
        requirements: { type: 'price_tracking', value: 50 },
        isRepeatable: false,
        secretAchievement: false
      },
      {
        id: 'receipt_scanner',
        name: 'Digital Collector',
        description: 'Upload your first receipt',
        category: 'tracking',
        icon: '📱',
        points: 50,
        difficulty: 'bronze',
        requirements: { type: 'receipt_upload', value: 1 },
        isRepeatable: false,
        secretAchievement: false
      },
      {
        id: 'extreme_saver',
        name: 'Extreme Saver',
        description: 'Save $1000 in a single month',
        category: 'savings',
        icon: '💎',
        points: 500,
        difficulty: 'platinum',
        requirements: { type: 'savings_amount', value: 1000, timeframe: 'month' },
        isRepeatable: true,
        secretAchievement: true
      }
    ];

    for (const achievement of achievements) {
      await this.insertAchievementIfNotExists(achievement);
    }
  }

  private async insertAchievementIfNotExists(achievement: Achievement): Promise<void> {
    const query = 'SELECT id FROM achievements WHERE id = ?';
    const get = promisify(this.db.get.bind(this.db));
    const existing = await get(query, [achievement.id]);

    if (!existing) {
      const insertQuery = `
        INSERT INTO achievements (
          id, name, description, category, icon, points, difficulty,
          requirements, isRepeatable, secretAchievement
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const run = promisify(this.db.run.bind(this.db));
      await run(insertQuery, [
        achievement.id,
        achievement.name,
        achievement.description,
        achievement.category,
        achievement.icon,
        achievement.points,
        achievement.difficulty,
        JSON.stringify(achievement.requirements),
        achievement.isRepeatable ? 1 : 0,
        achievement.secretAchievement ? 1 : 0
      ]);
    }
  }

  // Database helper methods
  private async getAvailableAchievements(userId: number): Promise<Achievement[]> {
    const query = `
      SELECT a.* FROM achievements a
      LEFT JOIN user_achievements ua ON a.id = ua.achievementId AND ua.userId = ?
      WHERE ua.id IS NULL OR a.isRepeatable = 1
    `;

    const all = promisify(this.db.all.bind(this.db));
    const achievements = await all(query, [userId]);

    return achievements.map(achievement => ({
      ...achievement,
      requirements: JSON.parse(achievement.requirements)
    }));
  }

  private async getAchievementById(id: string): Promise<Achievement> {
    const query = 'SELECT * FROM achievements WHERE id = ?';
    const get = promisify(this.db.get.bind(this.db));
    const achievement = await get(query, [id]);

    return {
      ...achievement,
      requirements: JSON.parse(achievement.requirements)
    };
  }

  private async getUserAchievementById(id: number): Promise<UserAchievement> {
    const query = 'SELECT * FROM user_achievements WHERE id = ?';
    const get = promisify(this.db.get.bind(this.db));
    return await get(query, [id]);
  }

  private async getChallengeById(id: number): Promise<Challenge> {
    const query = 'SELECT * FROM challenges WHERE id = ?';
    const get = promisify(this.db.get.bind(this.db));
    const challenge = await get(query, [id]);

    return {
      ...challenge,
      requirements: JSON.parse(challenge.requirements),
      rewards: JSON.parse(challenge.rewards)
    };
  }

  private async getUserChallengeById(id: number): Promise<UserChallenge> {
    const query = 'SELECT * FROM user_challenges WHERE id = ?';
    const get = promisify(this.db.get.bind(this.db));
    return await get(query, [id]);
  }

  private async getCurrentStreak(userId: number): Promise<{ current: number; longest: number }> {
    // Implementation would calculate consecutive days of expense tracking
    return { current: 0, longest: 0 };
  }

  private async getUserChallengeStats(userId: number): Promise<{ completed: number; active: number }> {
    const query = `
      SELECT 
        SUM(CASE WHEN isCompleted = 1 THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN isCompleted = 0 THEN 1 ELSE 0 END) as active
      FROM user_challenges 
      WHERE userId = ?
    `;

    const get = promisify(this.db.get.bind(this.db));
    const stats = await get(query, [userId]);
    return { completed: stats.completed || 0, active: stats.active || 0 };
  }

  private async getUserRank(userId: number): Promise<number> {
    // Implementation would calculate user's rank based on total points
    return 1;
  }

  private async getCategoryStats(userId: number): Promise<any> {
    const query = `
      SELECT 
        a.category,
        SUM(a.points) as points
      FROM user_achievements ua
      JOIN achievements a ON ua.achievementId = a.id
      WHERE ua.userId = ? AND ua.isCompleted = 1
      GROUP BY a.category
    `;

    const all = promisify(this.db.all.bind(this.db));
    const stats = await all(query, [userId]);

    const categories = ['savings', 'tracking', 'budget', 'streak', 'social', 'special'];
    const result = {};

    categories.forEach(category => {
      result[category] = stats.find(s => s.category === category)?.points || 0;
    });

    return result;
  }

  private async getTotalAchievementsCount(): Promise<number> {
    const query = 'SELECT COUNT(*) as count FROM achievements WHERE secretAchievement = 0';
    const get = promisify(this.db.get.bind(this.db));
    const result = await get(query, []);
    return result.count;
  }

  // Additional helper methods for achievement checking
  private async getUserExpenseCount(userId: number, timeframe?: string): Promise<number> {
    let dateFilter = '';
    if (timeframe === 'day') dateFilter = "AND date(created_at) = date('now')";
    else if (timeframe === 'week') dateFilter = "AND date(created_at) >= date('now', '-7 days')";
    else if (timeframe === 'month') dateFilter = "AND date(created_at) >= date('now', '-30 days')";

    const query = `SELECT COUNT(*) as count FROM expenses WHERE userId = ? ${dateFilter}`;
    const get = promisify(this.db.get.bind(this.db));
    const result = await get(query, [userId]);
    return result.count;
  }

  private async getBudgetAdherence(userId: number): Promise<number> {
    // Implementation would calculate budget adherence percentage
    return 85; // Placeholder
  }

  private async calculateSavings(userId: number, timeframe?: string): Promise<number> {
    // Implementation would calculate savings compared to previous period
    return 0; // Placeholder
  }

  private async getPriceTrackingCount(userId: number, timeframe?: string): Promise<number> {
    let dateFilter = '';
    if (timeframe === 'week') dateFilter = "AND date(date) >= date('now', '-7 days')";
    else if (timeframe === 'month') dateFilter = "AND date(date) >= date('now', '-30 days')";

    const query = `SELECT COUNT(DISTINCT productName) as count FROM product_prices WHERE userId = ? ${dateFilter}`;
    const get = promisify(this.db.get.bind(this.db));
    const result = await get(query, [userId]);
    return result.count;
  }

  private async updateChallengeParticipants(challengeId: number, increment: number): Promise<void> {
    const query = 'UPDATE challenges SET participants = participants + ? WHERE id = ?';
    const run = promisify(this.db.run.bind(this.db));
    await run(query, [increment, challengeId]);
  }

  private async updateChallengeCompletions(challengeId: number, increment: number): Promise<void> {
    const query = 'UPDATE challenges SET completions = completions + ? WHERE id = ?';
    const run = promisify(this.db.run.bind(this.db));
    await run(query, [increment, challengeId]);
  }

  private async awardChallengeRewards(userId: number, challenge: Challenge): Promise<void> {
    // Award points
    await this.addPointsToUser(userId, challenge.rewards.points);

    // Award badges if any
    if (challenge.rewards.badges) {
      for (const badge of challenge.rewards.badges) {
        await this.awardBadge(userId, badge);
      }
    }
  }

  private async awardBadge(userId: number, badge: string): Promise<void> {
    const query = `
      INSERT OR IGNORE INTO user_badges (userId, badge, awardedAt)
      VALUES (?, ?, datetime('now'))
    `;
    const run = promisify(this.db.run.bind(this.db));
    await run(query, [userId, badge]);
  }

  private async getUserBadges(userId: number): Promise<string[]> {
    const query = 'SELECT badge FROM user_badges WHERE userId = ?';
    const all = promisify(this.db.all.bind(this.db));
    const badges = await all(query, [userId]);
    return badges.map(b => b.badge);
  }

  private async createUserProfile(userId: number): Promise<UserProfile> {
    const user = await this.getUserById(userId);
    
    const query = `
      INSERT INTO user_profiles (
        userId, username, joinDate, privacy, favoriteAchievements
      ) VALUES (?, ?, datetime('now'), ?, ?)
    `;

    const run = promisify(this.db.run.bind(this.db));
    await run(query, [
      userId,
      user.name || `User${userId}`,
      JSON.stringify({ showStats: true, showAchievements: true, showChallenges: true }),
      JSON.stringify([])
    ]);

    return this.getUserProfile(userId);
  }

  private async getUserById(userId: number): Promise<any> {
    const query = 'SELECT * FROM users WHERE id = ?';
    const get = promisify(this.db.get.bind(this.db));
    return await get(query, [userId]);
  }
}
