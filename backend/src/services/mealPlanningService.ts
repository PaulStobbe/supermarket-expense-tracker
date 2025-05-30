import { Database } from 'sqlite3';
import { promisify } from 'util';
import { PriceTrackingService } from './priceTrackingService';
import { ExpenseService } from './expenseService';

export interface Recipe {
  id?: number;
  name: string;
  description?: string;
  servings: number;
  prepTime: number; // minutes
  cookTime: number; // minutes
  difficulty: 'easy' | 'medium' | 'hard';
  cuisine?: string;
  dietaryTags: string[]; // ['vegetarian', 'gluten-free', 'low-carb', etc.]
  instructions: string[];
  nutritionInfo?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  };
  imageUrl?: string;
  userId: number;
  isPublic: boolean;
  rating?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Ingredient {
  id?: number;
  recipeId: number;
  name: string;
  amount: number;
  unit: string;
  category: string;
  optional: boolean;
  notes?: string;
}

export interface MealPlan {
  id?: number;
  userId: number;
  name: string;
  startDate: string;
  endDate: string;
  budget?: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PlannedMeal {
  id?: number;
  mealPlanId: number;
  recipeId: number;
  date: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  servings: number;
  notes?: string;
}

export interface ShoppingList {
  id?: number;
  mealPlanId: number;
  userId: number;
  name: string;
  totalEstimatedCost: number;
  actualCost?: number;
  isCompleted: boolean;
  createdAt?: string;
  completedAt?: string;
}

export interface ShoppingListItem {
  id?: number;
  shoppingListId: number;
  ingredientName: string;
  amount: number;
  unit: string;
  category: string;
  estimatedPrice: number;
  actualPrice?: number;
  isPurchased: boolean;
  store?: string;
  notes?: string;
}

export interface MealPlanAnalysis {
  totalCost: number;
  costPerMeal: number;
  costPerServing: number;
  budgetVariance: number;
  nutritionSummary: {
    totalCalories: number;
    avgCaloriesPerMeal: number;
    proteinTotal: number;
    carbsTotal: number;
    fatTotal: number;
    fiberTotal: number;
  };
  dietaryCompliance: {
    vegetarianMeals: number;
    glutenFreeMeals: number;
    lowCarbMeals: number;
    highProteinMeals: number;
  };
  costSavings: {
    estimatedRestaurantCost: number;
    homeCookingSavings: number;
    budgetEfficiency: number;
  };
  recommendations: string[];
}

export class MealPlanningService {
  private db: Database;
  private priceTrackingService: PriceTrackingService;
  private expenseService: ExpenseService;

  constructor() {
    this.db = new Database('./database/expenses.db');
    this.priceTrackingService = new PriceTrackingService();
    this.expenseService = new ExpenseService();
  }

  // Recipe Management
  async createRecipe(recipeData: Omit<Recipe, 'id'>): Promise<Recipe> {
    const query = `
      INSERT INTO recipes (
        name, description, servings, prepTime, cookTime, difficulty,
        cuisine, dietaryTags, instructions, nutritionInfo, imageUrl,
        userId, isPublic, rating, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `;

    const run = promisify(this.db.run.bind(this.db));
    const result = await run(query, [
      recipeData.name,
      recipeData.description || null,
      recipeData.servings,
      recipeData.prepTime,
      recipeData.cookTime,
      recipeData.difficulty,
      recipeData.cuisine || null,
      JSON.stringify(recipeData.dietaryTags),
      JSON.stringify(recipeData.instructions),
      JSON.stringify(recipeData.nutritionInfo),
      recipeData.imageUrl || null,
      recipeData.userId,
      recipeData.isPublic ? 1 : 0,
      recipeData.rating || null
    ]);

    return this.getRecipeById(result.lastID);
  }

  async addIngredient(ingredientData: Omit<Ingredient, 'id'>): Promise<Ingredient> {
    const query = `
      INSERT INTO ingredients (recipeId, name, amount, unit, category, optional, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const run = promisify(this.db.run.bind(this.db));
    const result = await run(query, [
      ingredientData.recipeId,
      ingredientData.name,
      ingredientData.amount,
      ingredientData.unit,
      ingredientData.category,
      ingredientData.optional ? 1 : 0,
      ingredientData.notes || null
    ]);

    return this.getIngredientById(result.lastID);
  }

  async getRecipesByDietary(userId: number, dietaryRequirements: string[]): Promise<Recipe[]> {
    const query = `
      SELECT * FROM recipes 
      WHERE (userId = ? OR isPublic = 1)
      AND (${dietaryRequirements.map(() => 'dietaryTags LIKE ?').join(' AND ')})
      ORDER BY rating DESC, name ASC
    `;

    const params = [userId, ...dietaryRequirements.map(req => `%${req}%`)];
    const all = promisify(this.db.all.bind(this.db));
    const recipes = await all(query, params);

    return recipes.map(recipe => ({
      ...recipe,
      dietaryTags: JSON.parse(recipe.dietaryTags || '[]'),
      instructions: JSON.parse(recipe.instructions || '[]'),
      nutritionInfo: recipe.nutritionInfo ? JSON.parse(recipe.nutritionInfo) : null
    }));
  }

  // Meal Planning
  async createMealPlan(mealPlanData: Omit<MealPlan, 'id'>): Promise<MealPlan> {
    const query = `
      INSERT INTO meal_plans (userId, name, startDate, endDate, budget, isActive, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `;

    const run = promisify(this.db.run.bind(this.db));
    const result = await run(query, [
      mealPlanData.userId,
      mealPlanData.name,
      mealPlanData.startDate,
      mealPlanData.endDate,
      mealPlanData.budget || null,
      mealPlanData.isActive ? 1 : 0
    ]);

    return this.getMealPlanById(result.lastID);
  }

  async addPlannedMeal(plannedMealData: Omit<PlannedMeal, 'id'>): Promise<PlannedMeal> {
    const query = `
      INSERT INTO planned_meals (mealPlanId, recipeId, date, mealType, servings, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const run = promisify(this.db.run.bind(this.db));
    const result = await run(query, [
      plannedMealData.mealPlanId,
      plannedMealData.recipeId,
      plannedMealData.date,
      plannedMealData.mealType,
      plannedMealData.servings,
      plannedMealData.notes || null
    ]);

    return this.getPlannedMealById(result.lastID);
  }

  async generateWeeklyMealPlan(
    userId: number, 
    preferences: {
      budget?: number;
      dietaryRequirements: string[];
      mealsPerDay: number;
      servings: number;
      excludeIngredients?: string[];
      preferredCuisines?: string[];
    }
  ): Promise<{ mealPlan: MealPlan; plannedMeals: PlannedMeal[] }> {
    
    // Get suitable recipes
    const availableRecipes = await this.getRecipesByDietary(userId, preferences.dietaryRequirements);
    
    // Filter by preferences
    let filteredRecipes = availableRecipes.filter(recipe => {
      if (preferences.excludeIngredients?.length) {
        // Check if recipe contains excluded ingredients
        // This would require joining with ingredients table
        return true; // Simplified for now
      }
      
      if (preferences.preferredCuisines?.length) {
        return preferences.preferredCuisines.includes(recipe.cuisine || '');
      }
      
      return true;
    });

    // Create meal plan
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    const mealPlan = await this.createMealPlan({
      userId,
      name: `Weekly Plan - ${startDate.toLocaleDateString()}`,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      budget: preferences.budget,
      isActive: true
    });

    // Generate planned meals
    const plannedMeals: PlannedMeal[] = [];
    const mealTypes: Array<'breakfast' | 'lunch' | 'dinner'> = ['breakfast', 'lunch', 'dinner'];

    for (let day = 0; day < 7; day++) {
      const date = new Date(startDate.getTime() + day * 24 * 60 * 60 * 1000);
      const dateString = date.toISOString().split('T')[0];

      for (let mealIndex = 0; mealIndex < preferences.mealsPerDay; mealIndex++) {
        const mealType = mealTypes[mealIndex % mealTypes.length];
        
        // Smart recipe selection based on meal type and previous selections
        const suitableRecipes = this.filterRecipesByMealType(filteredRecipes, mealType);
        const selectedRecipe = this.selectRecipeForMeal(suitableRecipes, plannedMeals, mealType);

        if (selectedRecipe) {
          const plannedMeal = await this.addPlannedMeal({
            mealPlanId: mealPlan.id!,
            recipeId: selectedRecipe.id!,
            date: dateString,
            mealType,
            servings: preferences.servings
          });

          plannedMeals.push(plannedMeal);
        }
      }
    }

    return { mealPlan, plannedMeals };
  }

  // Shopping List Generation
  async generateShoppingList(mealPlanId: number): Promise<ShoppingList> {
    // Get all planned meals for this meal plan
    const plannedMeals = await this.getPlannedMealsByPlan(mealPlanId);
    
    // Aggregate ingredients
    const aggregatedIngredients = new Map<string, {
      name: string;
      totalAmount: number;
      unit: string;
      category: string;
    }>();

    for (const meal of plannedMeals) {
      const ingredients = await this.getIngredientsByRecipe(meal.recipeId);
      
      for (const ingredient of ingredients) {
        const adjustedAmount = (ingredient.amount * meal.servings) / await this.getRecipeServings(meal.recipeId);
        const key = `${ingredient.name}_${ingredient.unit}`;
        
        if (aggregatedIngredients.has(key)) {
          const existing = aggregatedIngredients.get(key)!;
          existing.totalAmount += adjustedAmount;
        } else {
          aggregatedIngredients.set(key, {
            name: ingredient.name,
            totalAmount: adjustedAmount,
            unit: ingredient.unit,
            category: ingredient.category
          });
        }
      }
    }

    // Create shopping list
    const mealPlan = await this.getMealPlanById(mealPlanId);
    const shoppingList = await this.createShoppingList({
      mealPlanId,
      userId: mealPlan.userId,
      name: `Shopping List - ${mealPlan.name}`,
      totalEstimatedCost: 0,
      isCompleted: false
    });

    // Add items with price estimates
    let totalEstimatedCost = 0;
    
    for (const [, ingredient] of aggregatedIngredients) {
      const estimatedPrice = await this.estimateIngredientPrice(
        ingredient.name, 
        ingredient.totalAmount, 
        ingredient.unit,
        mealPlan.userId
      );

      await this.addShoppingListItem({
        shoppingListId: shoppingList.id!,
        ingredientName: ingredient.name,
        amount: ingredient.totalAmount,
        unit: ingredient.unit,
        category: ingredient.category,
        estimatedPrice,
        isPurchased: false
      });

      totalEstimatedCost += estimatedPrice;
    }

    // Update total estimated cost
    await this.updateShoppingListCost(shoppingList.id!, totalEstimatedCost);

    return this.getShoppingListById(shoppingList.id!);
  }

  async analyzeMealPlan(mealPlanId: number): Promise<MealPlanAnalysis> {
    const mealPlan = await this.getMealPlanById(mealPlanId);
    const plannedMeals = await this.getPlannedMealsByPlan(mealPlanId);
    const shoppingList = await this.getShoppingListByMealPlan(mealPlanId);

    let totalCost = 0;
    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;
    let totalFiber = 0;

    const dietaryCount = {
      vegetarian: 0,
      glutenFree: 0,
      lowCarb: 0,
      highProtein: 0
    };

    for (const meal of plannedMeals) {
      const recipe = await this.getRecipeById(meal.recipeId);
      const ingredients = await this.getIngredientsByRecipe(meal.recipeId);
      
      // Calculate cost for this meal
      let mealCost = 0;
      for (const ingredient of ingredients) {
        const adjustedAmount = (ingredient.amount * meal.servings) / recipe.servings;
        const ingredientCost = await this.estimateIngredientPrice(
          ingredient.name, 
          adjustedAmount, 
          ingredient.unit,
          mealPlan.userId
        );
        mealCost += ingredientCost;
      }
      totalCost += mealCost;

      // Calculate nutrition
      if (recipe.nutritionInfo) {
        const servingMultiplier = meal.servings / recipe.servings;
        totalCalories += recipe.nutritionInfo.calories * servingMultiplier;
        totalProtein += recipe.nutritionInfo.protein * servingMultiplier;
        totalCarbs += recipe.nutritionInfo.carbs * servingMultiplier;
        totalFat += recipe.nutritionInfo.fat * servingMultiplier;
        totalFiber += recipe.nutritionInfo.fiber * servingMultiplier;
      }

      // Count dietary tags
      if (recipe.dietaryTags.includes('vegetarian')) dietaryCount.vegetarian++;
      if (recipe.dietaryTags.includes('gluten-free')) dietaryCount.glutenFree++;
      if (recipe.dietaryTags.includes('low-carb')) dietaryCount.lowCarb++;
      if (recipe.nutritionInfo && recipe.nutritionInfo.protein > 20) dietaryCount.highProtein++;
    }

    const totalMeals = plannedMeals.length;
    const costPerMeal = totalMeals > 0 ? totalCost / totalMeals : 0;
    const totalServings = plannedMeals.reduce((sum, meal) => sum + meal.servings, 0);
    const costPerServing = totalServings > 0 ? totalCost / totalServings : 0;

    // Estimate restaurant costs (average $15 per meal)
    const estimatedRestaurantCost = totalMeals * 15;
    const homeCookingSavings = estimatedRestaurantCost - totalCost;

    const budgetVariance = mealPlan.budget ? ((totalCost - mealPlan.budget) / mealPlan.budget) * 100 : 0;

    const recommendations = this.generateMealPlanRecommendations({
      totalCost,
      budgetVariance,
      totalMeals,
      dietaryCount,
      nutritionSummary: { totalCalories, totalProtein, totalCarbs, totalFat, totalFiber }
    });

    return {
      totalCost: Math.round(totalCost * 100) / 100,
      costPerMeal: Math.round(costPerMeal * 100) / 100,
      costPerServing: Math.round(costPerServing * 100) / 100,
      budgetVariance: Math.round(budgetVariance * 100) / 100,
      nutritionSummary: {
        totalCalories: Math.round(totalCalories),
        avgCaloriesPerMeal: Math.round(totalCalories / totalMeals),
        proteinTotal: Math.round(totalProtein * 10) / 10,
        carbsTotal: Math.round(totalCarbs * 10) / 10,
        fatTotal: Math.round(totalFat * 10) / 10,
        fiberTotal: Math.round(totalFiber * 10) / 10
      },
      dietaryCompliance: {
        vegetarianMeals: dietaryCount.vegetarian,
        glutenFreeMeals: dietaryCount.glutenFree,
        lowCarbMeals: dietaryCount.lowCarb,
        highProteinMeals: dietaryCount.highProtein
      },
      costSavings: {
        estimatedRestaurantCost: Math.round(estimatedRestaurantCost * 100) / 100,
        homeCookingSavings: Math.round(homeCookingSavings * 100) / 100,
        budgetEfficiency: Math.round(((homeCookingSavings / estimatedRestaurantCost) * 100) * 100) / 100
      },
      recommendations
    };
  }

  async updateShoppingListFromExpenses(shoppingListId: number): Promise<void> {
    const shoppingList = await this.getShoppingListById(shoppingListId);
    const items = await this.getShoppingListItems(shoppingListId);
    
    // Get recent expenses for this user
    const recentExpenses = await this.expenseService.getUserExpenses(shoppingList.userId, {
      limit: 50,
      startDate: shoppingList.createdAt
    });

    let actualCost = 0;

    for (const item of items) {
      // Try to match shopping list items with actual expenses
      const matchingExpense = this.findMatchingExpense(item, recentExpenses);
      
      if (matchingExpense) {
        await this.updateShoppingListItem(item.id!, {
          actualPrice: matchingExpense.amount,
          isPurchased: true,
          store: matchingExpense.store
        });
        actualCost += matchingExpense.amount;
      }
    }

    // Update shopping list with actual cost
    await this.updateShoppingList(shoppingListId, {
      actualCost,
      isCompleted: items.every(item => item.isPurchased)
    });
  }

  // Helper methods
  private filterRecipesByMealType(recipes: Recipe[], mealType: string): Recipe[] {
    // Simple filtering based on recipe characteristics
    if (mealType === 'breakfast') {
      return recipes.filter(r => 
        r.name.toLowerCase().includes('breakfast') ||
        r.name.toLowerCase().includes('pancake') ||
        r.name.toLowerCase().includes('oatmeal') ||
        r.prepTime <= 30
      );
    }
    
    if (mealType === 'lunch') {
      return recipes.filter(r => 
        r.cookTime <= 45 ||
        r.name.toLowerCase().includes('salad') ||
        r.name.toLowerCase().includes('sandwich')
      );
    }

    return recipes; // dinner can be anything
  }

  private selectRecipeForMeal(recipes: Recipe[], plannedMeals: PlannedMeal[], mealType: string): Recipe | null {
    if (recipes.length === 0) return null;

    // Avoid repeating recipes in the same week
    const usedRecipeIds = plannedMeals.map(meal => meal.recipeId);
    const availableRecipes = recipes.filter(recipe => !usedRecipeIds.includes(recipe.id!));

    if (availableRecipes.length === 0) {
      // If all recipes have been used, pick from all recipes
      return recipes[Math.floor(Math.random() * recipes.length)];
    }

    // Prefer higher-rated recipes
    const sortedRecipes = availableRecipes.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    
    // Add some randomness while favoring better recipes
    const topRecipes = sortedRecipes.slice(0, Math.min(3, sortedRecipes.length));
    return topRecipes[Math.floor(Math.random() * topRecipes.length)];
  }

  private async estimateIngredientPrice(name: string, amount: number, unit: string, userId: number): Promise<number> {
    try {
      const comparison = await this.priceTrackingService.getPriceComparison(name, userId);
      
      // Use average price as base
      let basePrice = comparison.averagePrice;
      
      // Adjust for amount and unit
      if (unit.toLowerCase().includes('lb') || unit.toLowerCase().includes('pound')) {
        return basePrice * amount; // Assuming base price is per lb
      } else if (unit.toLowerCase().includes('oz') || unit.toLowerCase().includes('ounce')) {
        return (basePrice / 16) * amount; // Convert to per oz
      } else if (unit.toLowerCase().includes('cup')) {
        return basePrice * (amount / 4); // Rough estimate: 4 cups per package
      }
      
      return basePrice * (amount / 10); // Default: assume 10 units per package
    } catch (error) {
      // If no price data available, use rough estimates
      return this.getDefaultIngredientPrice(name, amount, unit);
    }
  }

  private getDefaultIngredientPrice(name: string, amount: number, unit: string): number {
    const defaultPrices = {
      'meat': 6.0,
      'dairy': 4.0,
      'produce': 2.0,
      'pantry': 3.0,
      'spices': 0.5,
      'other': 3.0
    };

    const category = this.categorizeIngredient(name);
    const basePrice = defaultPrices[category] || defaultPrices.other;

    return basePrice * (amount / 10); // Rough estimate
  }

  private categorizeIngredient(name: string): string {
    const categories = {
      meat: ['chicken', 'beef', 'pork', 'fish', 'turkey', 'lamb'],
      dairy: ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'eggs'],
      produce: ['apple', 'banana', 'onion', 'tomato', 'lettuce', 'potato'],
      pantry: ['rice', 'pasta', 'flour', 'sugar', 'oil', 'vinegar'],
      spices: ['salt', 'pepper', 'garlic', 'herbs', 'spice']
    };

    const lowerName = name.toLowerCase();
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => lowerName.includes(keyword))) {
        return category;
      }
    }

    return 'other';
  }

  private generateMealPlanRecommendations(data: any): string[] {
    const recommendations = [];

    if (data.budgetVariance > 20) {
      recommendations.push('Consider recipes with less expensive ingredients to stay within budget');
    } else if (data.budgetVariance < -20) {
      recommendations.push('You have room in your budget for higher-quality ingredients');
    }

    if (data.nutritionSummary.totalProtein < data.totalMeals * 20) {
      recommendations.push('Add more protein-rich meals to meet nutritional goals');
    }

    if (data.dietaryCount.vegetarian / data.totalMeals > 0.7) {
      recommendations.push('Great job incorporating plant-based meals!');
    }

    if (data.totalCost / data.totalMeals < 5) {
      recommendations.push('Excellent cost efficiency! You\'re saving significantly vs restaurant meals');
    }

    return recommendations;
  }

  private findMatchingExpense(item: ShoppingListItem, expenses: any[]): any | null {
    // Simple matching based on description and amount
    return expenses.find(expense => 
      expense.description.toLowerCase().includes(item.ingredientName.toLowerCase()) &&
      Math.abs(expense.amount - item.estimatedPrice) < item.estimatedPrice * 0.5
    );
  }

  // Database helper methods
  private async getRecipeById(id: number): Promise<Recipe> {
    const query = 'SELECT * FROM recipes WHERE id = ?';
    const get = promisify(this.db.get.bind(this.db));
    const recipe = await get(query, [id]);
    
    return {
      ...recipe,
      dietaryTags: JSON.parse(recipe.dietaryTags || '[]'),
      instructions: JSON.parse(recipe.instructions || '[]'),
      nutritionInfo: recipe.nutritionInfo ? JSON.parse(recipe.nutritionInfo) : null
    };
  }

  private async getIngredientById(id: number): Promise<Ingredient> {
    const query = 'SELECT * FROM ingredients WHERE id = ?';
    const get = promisify(this.db.get.bind(this.db));
    return await get(query, [id]);
  }

  private async getMealPlanById(id: number): Promise<MealPlan> {
    const query = 'SELECT * FROM meal_plans WHERE id = ?';
    const get = promisify(this.db.get.bind(this.db));
    return await get(query, [id]);
  }

  private async getPlannedMealById(id: number): Promise<PlannedMeal> {
    const query = 'SELECT * FROM planned_meals WHERE id = ?';
    const get = promisify(this.db.get.bind(this.db));
    return await get(query, [id]);
  }

  private async getShoppingListById(id: number): Promise<ShoppingList> {
    const query = 'SELECT * FROM shopping_lists WHERE id = ?';
    const get = promisify(this.db.get.bind(this.db));
    return await get(query, [id]);
  }

  private async getPlannedMealsByPlan(mealPlanId: number): Promise<PlannedMeal[]> {
    const query = 'SELECT * FROM planned_meals WHERE mealPlanId = ? ORDER BY date, mealType';
    const all = promisify(this.db.all.bind(this.db));
    return await all(query, [mealPlanId]);
  }

  private async getIngredientsByRecipe(recipeId: number): Promise<Ingredient[]> {
    const query = 'SELECT * FROM ingredients WHERE recipeId = ?';
    const all = promisify(this.db.all.bind(this.db));
    return await all(query, [recipeId]);
  }

  private async getRecipeServings(recipeId: number): Promise<number> {
    const recipe = await this.getRecipeById(recipeId);
    return recipe.servings;
  }

  private async createShoppingList(data: Omit<ShoppingList, 'id'>): Promise<ShoppingList> {
    const query = `
      INSERT INTO shopping_lists (mealPlanId, userId, name, totalEstimatedCost, actualCost, isCompleted, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `;

    const run = promisify(this.db.run.bind(this.db));
    const result = await run(query, [
      data.mealPlanId,
      data.userId,
      data.name,
      data.totalEstimatedCost,
      data.actualCost || null,
      data.isCompleted ? 1 : 0
    ]);

    return this.getShoppingListById(result.lastID);
  }

  private async addShoppingListItem(data: Omit<ShoppingListItem, 'id'>): Promise<ShoppingListItem> {
    const query = `
      INSERT INTO shopping_list_items (
        shoppingListId, ingredientName, amount, unit, category,
        estimatedPrice, actualPrice, isPurchased, store, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const run = promisify(this.db.run.bind(this.db));
    const result = await run(query, [
      data.shoppingListId,
      data.ingredientName,
      data.amount,
      data.unit,
      data.category,
      data.estimatedPrice,
      data.actualPrice || null,
      data.isPurchased ? 1 : 0,
      data.store || null,
      data.notes || null
    ]);

    const query2 = 'SELECT * FROM shopping_list_items WHERE id = ?';
    const get = promisify(this.db.get.bind(this.db));
    return await get(query2, [result.lastID]);
  }

  private async updateShoppingListCost(id: number, cost: number): Promise<void> {
    const query = 'UPDATE shopping_lists SET totalEstimatedCost = ? WHERE id = ?';
    const run = promisify(this.db.run.bind(this.db));
    await run(query, [cost, id]);
  }

  private async getShoppingListByMealPlan(mealPlanId: number): Promise<ShoppingList | null> {
    const query = 'SELECT * FROM shopping_lists WHERE mealPlanId = ?';
    const get = promisify(this.db.get.bind(this.db));
    return await get(query, [mealPlanId]);
  }

  private async getShoppingListItems(shoppingListId: number): Promise<ShoppingListItem[]> {
    const query = 'SELECT * FROM shopping_list_items WHERE shoppingListId = ?';
    const all = promisify(this.db.all.bind(this.db));
    return await all(query, [shoppingListId]);
  }

  private async updateShoppingListItem(id: number, updates: Partial<ShoppingListItem>): Promise<void> {
    const setClause = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      setClause.push(`${key} = ?`);
      values.push(value);
    }

    const query = `UPDATE shopping_list_items SET ${setClause.join(', ')} WHERE id = ?`;
    const run = promisify(this.db.run.bind(this.db));
    await run(query, [...values, id]);
  }

  private async updateShoppingList(id: number, updates: Partial<ShoppingList>): Promise<void> {
    const setClause = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      setClause.push(`${key} = ?`);
      values.push(value);
    }

    const query = `UPDATE shopping_lists SET ${setClause.join(', ')} WHERE id = ?`;
    const run = promisify(this.db.run.bind(this.db));
    await run(query, [...values, id]);
  }
}
