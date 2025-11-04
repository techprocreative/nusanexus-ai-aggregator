import { TRIPAY_CONFIG } from '@/app/config/plans';
import { TripayPaymentRequest, TripayPaymentResponse, TripayWebhookPayload } from '@/types/credits';
import { createHmac } from 'crypto';

export class TripayClient {
  private apiKey: string;
  private privateKey: string;
  private merchantCode: string;
  private isSandbox: boolean;

  constructor() {
    this.apiKey = TRIPAY_CONFIG.API_KEY;
    this.privateKey = TRIPAY_CONFIG.PRIVATE_KEY;
    this.merchantCode = TRIPAY_CONFIG.MERCHANT_CODE;
    this.isSandbox = this.apiKey.includes('sandbox') || !this.apiKey;
  }

  /**
   * Get base URL for Tripay API
   */
  private getBaseUrl(): string {
    return this.isSandbox
      ? 'https://tripay.co.id/api-sandbox'
      : 'https://tripay.co.id/api';
  }

  /**
   * Generate signature for API requests
   */
  private generateSignature(payload: any): string {
    const jsonPayload = JSON.stringify(payload);
    return createHmac('sha256', this.privateKey)
      .update(jsonPayload)
      .digest('hex');
  }

  /**
   * Create a payment transaction
   */
  async createTransaction(request: TripayPaymentRequest): Promise<TripayPaymentResponse> {
    try {
      // Add merchant code to request
      const payload = {
        ...request,
        merchant_code: this.merchantCode,
      };

      // Generate signature
      const signature = this.generateSignature(payload);

      const response = await fetch(`${this.getBaseUrl()}/transaction/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'X-Signature': signature,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Tripay API error: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating Tripay transaction:', error);
      throw error;
    }
  }

  /**
   * Get transaction details
   */
  async getTransaction(reference: string): Promise<any> {
    try {
      const response = await fetch(`${this.getBaseUrl()}/transaction/detail?reference=${reference}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Tripay API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching Tripay transaction:', error);
      throw error;
    }
  }

  /**
   * Get available payment channels
   */
  async getPaymentChannels(): Promise<any> {
    try {
      const response = await fetch(`${this.getBaseUrl()}/payment-channel`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Tripay API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching payment channels:', error);
      throw error;
    }
  }

  /**
   * Get merchant information
   */
  async getMerchantInfo(): Promise<any> {
    try {
      const response = await fetch(`${this.getBaseUrl()}/merchant`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Tripay API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching merchant info:', error);
      throw error;
    }
  }

  /**
   * Calculate payment fees for different methods
   */
  calculateFees(amount: number, method: string): { totalFee: number; netAmount: number } {
    // Fee structure (these are examples, adjust based on actual Tripay fees)
    const feeStructure: Record<string, { fixed: number; percentage: number }> = {
      'QRIS': { fixed: 0, percentage: 0.7 },      // 0.7% for QRIS
      'OVO': { fixed: 1000, percentage: 2 },       // Rp 1.000 + 2%
      'DANA': { fixed: 1000, percentage: 2 },      // Rp 1.000 + 2%
      'SHOPEEPAY': { fixed: 1000, percentage: 2 }, // Rp 1.000 + 2%
      'BCAVA': { fixed: 4000, percentage: 0 },      // Rp 4.000 flat
      'BRIVA': { fixed: 4000, percentage: 0 },      // Rp 4.000 flat
      'BNIVA': { fixed: 4000, percentage: 0 },      // Rp 4.000 flat
      'MANDIRIVA': { fixed: 4000, percentage: 0 },  // Rp 4.000 flat
      'PERMATAVA': { fixed: 4000, percentage: 0 },  // Rp 4.000 flat
      'ALFAMART': { fixed: 5000, percentage: 0 },   // Rp 5.000 flat
      'INDOMARET': { fixed: 5000, percentage: 0 },  // Rp 5.000 flat
    };

    const fees = feeStructure[method] || { fixed: 0, percentage: 0 };
    const variableFee = Math.floor(amount * (fees.percentage / 100));
    const totalFee = fees.fixed + variableFee;
    const netAmount = amount - totalFee;

    return {
      totalFee,
      netAmount,
    };
  }

  /**
   * Format payment instructions for different methods
   */
  getPaymentInstructions(paymentData: any): string[] {
    const instructions: string[] = [];

    switch (paymentData.method) {
      case 'QRIS':
        instructions.push('1. Buka aplikasi e-wallet (GoPay, OVO, DANA, ShopeePay, dll)');
        instructions.push('2. Pindai kode QR yang ditampilkan');
        instructions.push('3. Masukkan jumlah pembayaran');
        instructions.push('4. Konfirmasi pembayaran');
        break;

      case 'OVO':
      case 'DANA':
      case 'SHOPEEPAY':
        instructions.push(`1. Buka aplikasi ${paymentData.payment_name}`);
        instructions.push(`2. Pilih menu "Transfer" atau "Kirim"`);
        instructions.push(`3. Masukkan nomor virtual account: ${paymentData.pay_code}`);
        instructions.push(`4. Masukkan jumlah pembayaran: Rp ${paymentData.amount.toLocaleString('id-ID')}`);
        instructions.push('5. Konfirmasi pembayaran');
        break;

      case 'BCAVA':
      case 'BRIVA':
      case 'BNIVA':
      case 'MANDIRIVA':
      case 'PERMATAVA':
        instructions.push('1. Buka aplikasi mobile banking atau internet banking');
        instructions.push('2. Pilih menu "Transfer"');
        instructions.push('3. Pilih "Transfer ke Virtual Account"');
        instructions.push(`4. Masukkan nomor virtual account: ${paymentData.pay_code}`);
        instructions.push(`5. Masukkan jumlah pembayaran: Rp ${paymentData.amount.toLocaleString('id-ID')}`);
        instructions.push('6. Konfirmasi pembayaran');
        break;

      case 'ALFAMART':
      case 'INDOMARET':
        instructions.push('1. Kunjungi gerai Alfamart/Indomaret terdekat');
        instructions.push('2. Sampaikan kepada kasir ingin melakukan pembayaran');
        instructions.push(`3. Berikan kode pembayaran: ${paymentData.pay_code}`);
        instructions.push(`4. Sebutkan jumlah pembayaran: Rp ${paymentData.amount.toLocaleString('id-ID')}`);
        instructions.push('5. Simpan struk pembayaran sebagai bukti');
        break;

      default:
        instructions.push('Ikuti instruksi pembayaran yang ditampilkan');
    }

    instructions.push('');
    instructions.push(`Referensi: ${paymentData.reference}`);
    instructions.push(`Kadaluarsa: ${new Date(paymentData.expired_time * 1000).toLocaleString('id-ID')}`);

    return instructions;
  }
}

// Singleton instance
export const tripayClient = new TripayClient();

// Helper functions
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatDateTime(timestamp: number | string): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp * 1000);
  return date.toLocaleString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function getPaymentIcon(method: string): string {
  const iconMap: Record<string, string> = (
    {
      'QRIS': '/icons/qris.png',
      'OVO': '/icons/ovo.png',
      'DANA': '/icons/dana.png',
      'SHOPEEPAY': '/icons/shopeepay.png',
      'BCAVA': '/icons/bca.png',
      'BRIVA': '/icons/bri.png',
      'BNIVA': '/icons/bni.png',
      'MANDIRIVA': '/icons/mandiri.png',
      'PERMATAVA': '/icons/permata.png',
      'ALFAMART': '/icons/alfamart.png',
      'INDOMARET': '/icons/indomaret.png',
    }
  );

  return iconMap[method] || '/icons/payment-default.png';
}

export function isPaymentExpired(expiredTime: number): boolean {
  return Date.now() > (expiredTime * 1000);
}

export function getTimeRemaining(expiredTime: number): string {
  const now = Date.now();
  const expiry = expiredTime * 1000;
  const diff = expiry - now;

  if (diff <= 0) {
    return 'Kadaluarsa';
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days} hari ${hours % 24} jam`;
  }

  return `${hours} jam ${minutes} menit`;
}