import { Database } from 'sqlite3';
import { promisify } from 'util';

export interface ProductPrice {
  id?: number;
  productName: string;
  store: string;
  price: number;
  unit?: string;
  pricePerUnit?: number;
  category: string;
  brand?: string;
  size?: string;
  date: string;
  userId: number;
  isOnSale?: boolean;
  originalPrice?: number;
  saleEndDate?: string;
}

export interface PriceComparison {
  productName: string;
  lowestPrice: {
    price: number;
    store: string;
    date: string;
  };
  highestPrice: {
    price: number;
    store: string;
    date: string;
  };
  averagePrice: number;
  priceVariation: number; // percentage
  savings: number; // potential savings
  recommendation: string;
  priceHistory: Array<{
    store: string;
    price: number;
    date: string;
  }>;
}

export interface PriceAlert {
  id?: number;
  userId: number;
  productName: string;
  targetPrice: number;
  currentPrice: number;
  store?: string;
  isActive: boolean;
  createdAt: string;
}

export interface ShoppingSuggestion {
  type: 'price_drop' | 'best_deal' | 'bulk_opportunity' | 'seasonal_sale';
  productName: string;
  store: string;
  currentPrice: number;
  previousPrice?: number;
  savings: number;
  confidence: number;
  validUntil?: string;
  description: string;
}

export class PriceTrackingService {
  private db: Database;

  constructor() {
    this.db = new Database('./database/expenses.db');
  }

  async trackPrice(priceData: Omit<ProductPrice, 'id'>): Promise<ProductPrice> {
    const query = `
      INSERT INTO product_prices (
        productName, store, price, unit, pricePerUnit, category, 
        brand, size, date, userId, isOnSale, originalPrice, saleEndDate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const run = promisify(this.db.run.bind(this.db));
    const result = await run(query, [
      priceData.productName,
      priceData.store,
      priceData.price,
      priceData.unit || null,
      priceData.pricePerUnit || null,
      priceData.category,
      priceData.brand || null,
      priceData.size || null,
      priceData.date,
      priceData.userId,
      priceData.isOnSale ? 1 : 0,
      priceData.originalPrice || null,
      priceData.saleEndDate || null
    ]);

    return this.getPriceById(result.lastID);
  }

  async getPriceComparison(productName: string, userId: number): Promise<PriceComparison> {
    const query = `
      SELECT * FROM product_prices 
      WHERE productName LIKE ? AND userId = ? 
      ORDER BY date DESC 
      LIMIT 50
    `;

    const all = promisify(this.db.all.bind(this.db));
    const prices = await all(query, [`%${productName}%`, userId]);

    if (prices.length === 0) {
      throw new Error('No price data found for this product');
    }

    const priceValues = prices.map(p => p.price);
    const lowestPrice = Math.min(...priceValues);
    const highestPrice = Math.max(...priceValues);
    const averagePrice = priceValues.reduce((sum, price) => sum + price, 0) / priceValues.length;
    const priceVariation = ((highestPrice - lowestPrice) / averagePrice) * 100;

    const lowestPriceEntry = prices.find(p => p.price === lowestPrice);
    const highestPriceEntry = prices.find(p => p.price === highestPrice);

    const currentPrice = prices[0].price; // Most recent price
    const savings = currentPrice - lowestPrice;

    return {
      productName,
      lowestPrice: {
        price: lowestPrice,
        store: lowestPriceEntry.store,
        date: lowestPriceEntry.date
      },
      highestPrice: {
        price: highestPrice,
        store: highestPriceEntry.store,
        date: highestPriceEntry.date
      },
      averagePrice: Math.round(averagePrice * 100) / 100,
      priceVariation: Math.round(priceVariation * 100) / 100,
      savings: Math.round(savings * 100) / 100,
      recommendation: this.generatePriceRecommendation(prices),
      priceHistory: prices.map(p => ({
        store: p.store,
        price: p.price,
        date: p.date
      }))
    };
  }

  async createPriceAlert(alertData: Omit<PriceAlert, 'id'>): Promise<PriceAlert> {
    const query = `
      INSERT INTO price_alerts (
        userId, productName, targetPrice, currentPrice, store, isActive, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `;

    const run = promisify(this.db.run.bind(this.db));
    const result = await run(query, [
      alertData.userId,
      alertData.productName,
      alertData.targetPrice,
      alertData.currentPrice,
      alertData.store || null,
      alertData.isActive ? 1 : 0
    ]);

    return this.getPriceAlertById(result.lastID);
  }

  async checkPriceAlerts(userId: number): Promise<PriceAlert[]> {
    const query = `
      SELECT pa.*, pp.price as latestPrice, pp.store as latestStore, pp.date as latestDate
      FROM price_alerts pa
      LEFT JOIN product_prices pp ON pa.productName = pp.productName AND pa.userId = pp.userId
      WHERE pa.userId = ? AND pa.isActive = 1
      AND pp.date = (
        SELECT MAX(date) FROM product_prices 
        WHERE productName = pa.productName AND userId = pa.userId
      )
      AND pp.price <= pa.targetPrice
    `;

    const all = promisify(this.db.all.bind(this.db));
    return await all(query, [userId]);
  }

  async generateShoppingSuggestions(userId: number): Promise<ShoppingSuggestion[]> {
    const suggestions: ShoppingSuggestion[] = [];

    // Price drop suggestions
    const priceDrops = await this.findRecentPriceDrops(userId);
    suggestions.push(...priceDrops);

    // Best deal suggestions
    const bestDeals = await this.findBestDeals(userId);
    suggestions.push(...bestDeals);

    // Bulk opportunity suggestions
    const bulkOpportunities = await this.findBulkOpportunities(userId);
    suggestions.push(...bulkOpportunities);

    // Seasonal sale suggestions
    const seasonalSales = await this.findSeasonalSales(userId);
    suggestions.push(...seasonalSales);

    return suggestions.sort((a, b) => b.savings - a.savings).slice(0, 10);
  }

  async getStorePriceAnalysis(userId: number): Promise<any> {
    const query = `
      SELECT 
        store,
        COUNT(*) as itemCount,
        AVG(price) as averagePrice,
        MIN(price) as lowestPrice,
        MAX(price) as highestPrice,
        SUM(CASE WHEN isOnSale = 1 THEN 1 ELSE 0 END) as saleItemCount
      FROM product_prices 
      WHERE userId = ? 
      GROUP BY store
      ORDER BY averagePrice ASC
    `;

    const all = promisify(this.db.all.bind(this.db));
    const storeData = await all(query, [userId]);

    return storeData.map(store => ({
      ...store,
      averagePrice: Math.round(store.averagePrice * 100) / 100,
      salePercentage: Math.round((store.saleItemCount / store.itemCount) * 100),
      priceRanking: this.calculatePriceRanking(store, storeData)
    }));
  }

  async trackPriceFromReceipt(receiptData: any, userId: number): Promise<ProductPrice[]> {
    const trackedPrices: ProductPrice[] = [];

    for (const item of receiptData.items || []) {
      const priceData: Omit<ProductPrice, 'id'> = {
        productName: this.normalizeProductName(item.name),
        store: receiptData.storeName || 'Unknown',
        price: item.price,
        category: this.categorizeProduct(item.name),
        date: receiptData.date || new Date().toISOString().split('T')[0],
        userId,
        unit: item.unit || null,
        pricePerUnit: item.quantity ? item.price / item.quantity : null,
        brand: this.extractBrand(item.name),
        size: this.extractSize(item.name)
      };

      const tracked = await this.trackPrice(priceData);
      trackedPrices.push(tracked);
    }

    return trackedPrices;
  }

  async getPriceHistory(productName: string, userId: number, days: number = 90): Promise<any[]> {
    const query = `
      SELECT store, price, date, isOnSale
      FROM product_prices 
      WHERE productName LIKE ? AND userId = ? 
      AND date >= date('now', '-${days} days')
      ORDER BY date ASC
    `;

    const all = promisify(this.db.all.bind(this.db));
    return await all(query, [`%${productName}%`, userId]);
  }

  private async findRecentPriceDrops(userId: number): Promise<ShoppingSuggestion[]> {
    const query = `
      SELECT 
        pp1.productName,
        pp1.store,
        pp1.price as currentPrice,
        pp2.price as previousPrice,
        pp1.date as currentDate
      FROM product_prices pp1
      JOIN product_prices pp2 ON pp1.productName = pp2.productName 
        AND pp1.store = pp2.store AND pp1.userId = pp2.userId
      WHERE pp1.userId = ?
        AND pp1.date = (
          SELECT MAX(date) FROM product_prices 
          WHERE productName = pp1.productName AND store = pp1.store AND userId = pp1.userId
        )
        AND pp2.date = (
          SELECT MAX(date) FROM product_prices 
          WHERE productName = pp1.productName AND store = pp1.store AND userId = pp1.userId
            AND date < pp1.date
        )
        AND pp1.price < pp2.price * 0.9
      ORDER BY (pp2.price - pp1.price) DESC
      LIMIT 5
    `;

    const all = promisify(this.db.all.bind(this.db));
    const priceDrops = await all(query, [userId]);

    return priceDrops.map(drop => ({
      type: 'price_drop' as const,
      productName: drop.productName,
      store: drop.store,
      currentPrice: drop.currentPrice,
      previousPrice: drop.previousPrice,
      savings: drop.previousPrice - drop.currentPrice,
      confidence: 85,
      description: `${drop.productName} dropped from $${drop.previousPrice.toFixed(2)} to $${drop.currentPrice.toFixed(2)} at ${drop.store}`
    }));
  }

  private async findBestDeals(userId: number): Promise<ShoppingSuggestion[]> {
    const query = `
      SELECT 
        productName,
        store,
        price,
        MIN(price) as lowestPrice,
        AVG(price) as averagePrice
      FROM product_prices 
      WHERE userId = ? 
        AND date >= date('now', '-30 days')
      GROUP BY productName
      HAVING price = MIN(price) AND price < averagePrice * 0.8
      ORDER BY (averagePrice - price) DESC
      LIMIT 5
    `;

    const all = promisify(this.db.all.bind(this.db));
    const bestDeals = await all(query, [userId]);

    return bestDeals.map(deal => ({
      type: 'best_deal' as const,
      productName: deal.productName,
      store: deal.store,
      currentPrice: deal.price,
      savings: deal.averagePrice - deal.price,
      confidence: 90,
      description: `Best price for ${deal.productName} at ${deal.store} - $${(deal.averagePrice - deal.price).toFixed(2)} below average`
    }));
  }

  private async findBulkOpportunities(userId: number): Promise<ShoppingSuggestion[]> {
    // Find items that are frequently purchased and currently on sale
    const query = `
      SELECT 
        pp.productName,
        pp.store,
        pp.price,
        pp.originalPrice,
        COUNT(e.id) as purchaseFrequency
      FROM product_prices pp
      LEFT JOIN expenses e ON pp.productName LIKE '%' || e.description || '%' 
        AND e.userId = pp.userId
      WHERE pp.userId = ? 
        AND pp.isOnSale = 1
        AND pp.date >= date('now', '-7 days')
      GROUP BY pp.productName, pp.store
      HAVING purchaseFrequency >= 3
      ORDER BY (pp.originalPrice - pp.price) DESC
      LIMIT 3
    `;

    const all = promisify(this.db.all.bind(this.db));
    const bulkOpportunities = await all(query, [userId]);

    return bulkOpportunities.map(bulk => ({
      type: 'bulk_opportunity' as const,
      productName: bulk.productName,
      store: bulk.store,
      currentPrice: bulk.price,
      previousPrice: bulk.originalPrice,
      savings: bulk.originalPrice - bulk.price,
      confidence: 75,
      description: `Stock up on ${bulk.productName} at ${bulk.store} - you buy this frequently and it's currently on sale`
    }));
  }

  private async findSeasonalSales(userId: number): Promise<ShoppingSuggestion[]> {
    const currentMonth = new Date().getMonth() + 1;
    const seasonalItems = this.getSeasonalItems(currentMonth);

    if (seasonalItems.length === 0) return [];

    const query = `
      SELECT productName, store, price, AVG(price) as averagePrice
      FROM product_prices 
      WHERE userId = ? 
        AND (${seasonalItems.map(() => 'productName LIKE ?').join(' OR ')})
        AND date >= date('now', '-7 days')
      GROUP BY productName, store
      HAVING price < averagePrice * 0.85
      ORDER BY (averagePrice - price) DESC
      LIMIT 3
    `;

    const params = [userId, ...seasonalItems.map(item => `%${item}%`)];
    const all = promisify(this.db.all.bind(this.db));
    const seasonalSales = await all(query, params);

    return seasonalSales.map(sale => ({
      type: 'seasonal_sale' as const,
      productName: sale.productName,
      store: sale.store,
      currentPrice: sale.price,
      savings: sale.averagePrice - sale.price,
      confidence: 70,
      description: `Seasonal sale on ${sale.productName} at ${sale.store}`
    }));
  }

  private generatePriceRecommendation(prices: any[]): string {
    if (prices.length < 2) return 'Not enough data for recommendation';

    const latestPrice = prices[0].price;
    const averagePrice = prices.reduce((sum, p) => sum + p.price, 0) / prices.length;
    const minPrice = Math.min(...prices.map(p => p.price));

    if (latestPrice <= minPrice * 1.05) {
      return 'Great price! This is close to the lowest price recorded.';
    } else if (latestPrice <= averagePrice) {
      return 'Good price! Below average price for this product.';
    } else if (latestPrice <= averagePrice * 1.2) {
      return 'Fair price. Consider waiting for a better deal.';
    } else {
      return 'High price. Wait for a sale or check other stores.';
    }
  }

  private calculatePriceRanking(store: any, allStores: any[]): string {
    const sortedStores = allStores.sort((a, b) => a.averagePrice - b.averagePrice);
    const rank = sortedStores.findIndex(s => s.store === store.store) + 1;
    const total = allStores.length;

    if (rank <= total * 0.33) return 'Low Price';
    if (rank <= total * 0.66) return 'Medium Price';
    return 'High Price';
  }

  private normalizeProductName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\b(oz|lb|gal|qt|pt)\b/g, '') // Remove units
      .replace(/\b\d+\s*(pack|ct|count)\b/g, '') // Remove pack sizes
      .replace(/[^\w\s]/g, '') // Remove special characters
      .trim();
  }

  private categorizeProduct(name: string): string {
    const categories = {
      'Dairy': ['milk', 'cheese', 'yogurt', 'butter', 'cream'],
      'Produce': ['apple', 'banana', 'orange', 'lettuce', 'tomato', 'onion'],
      'Meat': ['chicken', 'beef', 'pork', 'fish', 'turkey'],
      'Bakery': ['bread', 'bagel', 'muffin', 'cake', 'cookie'],
      'Pantry': ['rice', 'pasta', 'cereal', 'soup', 'sauce']
    };

    const lowerName = name.toLowerCase();
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => lowerName.includes(keyword))) {
        return category;
      }
    }

    return 'Other';
  }

  private extractBrand(name: string): string | null {
    const commonBrands = ['kroger', 'great value', 'kirkland', 'store brand'];
    const lowerName = name.toLowerCase();
    
    for (const brand of commonBrands) {
      if (lowerName.includes(brand)) {
        return brand;
      }
    }

    // Extract first word as potential brand
    const words = name.split(' ');
    return words.length > 1 ? words[0] : null;
  }

  private extractSize(name: string): string | null {
    const sizeMatch = name.match(/(\d+\.?\d*\s*(oz|lb|gal|qt|pt|ml|l|kg|g))/i);
    return sizeMatch ? sizeMatch[1] : null;
  }

  private getSeasonalItems(month: number): string[] {
    const seasonal = {
      1: ['soup', 'hot chocolate', 'comfort food'], // January
      2: ['valentine', 'chocolate', 'wine'], // February
      3: ['spring cleaning', 'fresh produce'], // March
      4: ['easter', 'spring', 'fresh'], // April
      5: ['bbq', 'grill', 'outdoor'], // May
      6: ['summer', 'ice cream', 'cold drinks'], // June
      7: ['summer', 'ice cream', 'cold drinks'], // July
      8: ['back to school', 'lunch', 'snacks'], // August
      9: ['fall', 'apple', 'pumpkin'], // September
      10: ['halloween', 'candy', 'pumpkin'], // October
      11: ['thanksgiving', 'turkey', 'cranberry'], // November
      12: ['holiday', 'christmas', 'cookies'] // December
    };

    return seasonal[month] || [];
  }

  private async getPriceById(id: number): Promise<ProductPrice> {
    const query = 'SELECT * FROM product_prices WHERE id = ?';
    const get = promisify(this.db.get.bind(this.db));
    return await get(query, [id]);
  }

  private async getPriceAlertById(id: number): Promise<PriceAlert> {
    const query = 'SELECT * FROM price_alerts WHERE id = ?';
    const get = promisify(this.db.get.bind(this.db));
    return await get(query, [id]);
  }
}
