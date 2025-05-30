import { createWorker } from 'tesseract.js';
import sharp from 'sharp';

export interface ReceiptData {
  storeName?: string;
  total?: number;
  date?: string;
  items?: Array<{
    name: string;
    price: number;
    quantity?: number;
  }>;
  raw: string;
}

export class OCRService {
  private worker: any;

  async initialize() {
    this.worker = await createWorker('eng');
  }

  async processReceipt(imageBuffer: Buffer): Promise<ReceiptData> {
    // Preprocess image for better OCR accuracy
    const processedImage = await sharp(imageBuffer)
      .greyscale()
      .normalize()
      .sharpen()
      .toBuffer();

    const { data: { text } } = await this.worker.recognize(processedImage);
    
    return this.parseReceiptText(text);
  }

  private parseReceiptText(text: string): ReceiptData {
    const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
    
    const result: ReceiptData = {
      raw: text,
      items: []
    };

    // Extract store name (usually first few lines)
    const storePattern = /(walmart|target|kroger|safeway|whole foods|costco)/i;
    const storeMatch = text.match(storePattern);
    if (storeMatch) {
      result.storeName = storeMatch[1];
    }

    // Extract total amount
    const totalPattern = /total[:\s]*\$?(\d+\.?\d*)/i;
    const totalMatch = text.match(totalPattern);
    if (totalMatch) {
      result.total = parseFloat(totalMatch[1]);
    }

    // Extract date
    const datePattern = /(\d{1,2}\/\d{1,2}\/\d{2,4})/;
    const dateMatch = text.match(datePattern);
    if (dateMatch) {
      result.date = dateMatch[1];
    }

    // Extract line items (simplified pattern)
    const itemPattern = /^(.+?)\s+\$?(\d+\.?\d*)$/;
    lines.forEach(line => {
      const match = line.match(itemPattern);
      if (match && !line.toLowerCase().includes('total')) {
        result.items?.push({
          name: match[1].trim(),
          price: parseFloat(match[2])
        });
      }
    });

    return result;
  }

  async terminate() {
    if (this.worker) {
      await this.worker.terminate();
    }
  }
}
