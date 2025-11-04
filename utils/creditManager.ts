import { createClient } from '@supabase/supabase-js';
import { CreditUsageRequest, CreditUsageResponse, CreditError, Transaction, Payment } from '@/types/credits';
import { calculateCreditCost } from '@/utils/models';
import { CREDIT_COSTS } from '@/app/config/plans';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export class CreditManager {
  /**
   * Get user's current credit balance
   */
  static async getBalance(userId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('user_credits')
        .select('balance')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        throw error;
      }

      return data?.balance || 0;
    } catch (error) {
      console.error('Error fetching user balance:', error);
      throw new Error('Failed to fetch user balance');
    }
  }

  /**
   * Get user's credit account details
   */
  static async getUserCredits(userId: string) {
    try {
      const { data, error } = await supabase
        .from('user_credits')
        .select(`
          *,
          plans (*)
        `)
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching user credits:', error);
      throw new Error('Failed to fetch user credits');
    }
  }

  /**
   * Check if user has sufficient credits for a request
   */
  static async checkCredits(
    userId: string,
    request: CreditUsageRequest
  ): Promise<CreditUsageResponse> {
    try {
      const balance = await this.getBalance(userId);
      let creditsRequired = 0;

      switch (request.operation) {
        case 'chat':
          if (!request.tokens) {
            throw new Error('Token count is required for chat operations');
          }
          creditsRequired = Math.ceil((request.tokens / 1000) * CREDIT_COSTS.CHAT_PER_1K_TOKENS);
          break;

        case 'image':
          creditsRequired = CREDIT_COSTS.IMAGE_GENERATION[request.modelId as keyof typeof CREDIT_COSTS.IMAGE_GENERATION] || 0;
          break;

        case 'video':
          creditsRequired = CREDIT_COSTS.VIDEO_GENERATION[request.modelId as keyof typeof CREDIT_COSTS.VIDEO_GENERATION] || 0;
          break;

        case 'compare':
          creditsRequired = CREDIT_COSTS.COMPARE_FEATURE;
          break;

        default:
          throw new Error(`Unknown operation: ${request.operation}`);
      }

      if (creditsRequired <= 0) {
        throw new Error('Invalid credit calculation');
      }

      return {
        creditsRequired,
        canAfford: balance >= creditsRequired,
        currentBalance: balance,
      };
    } catch (error) {
      console.error('Error checking credits:', error);
      throw new Error('Failed to check credits');
    }
  }

  /**
   * Deduct credits from user account
   */
  static async deductCredits(
    userId: string,
    amount: number,
    description: string = 'Credit usage',
    referenceId?: string
  ): Promise<{ success: boolean; transaction?: Transaction; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('deduct_credits', {
        p_user_id: userId,
        p_amount: amount,
        p_description: description,
        p_reference_id: referenceId,
      });

      if (error) {
        console.error('Error deducting credits:', error);
        return { success: false, error: error.message };
      }

      if (!data) {
        return { success: false, error: 'Insufficient credits' };
      }

      // Get the transaction record
      const { data: transaction } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .eq('amount', -amount)
        .eq('description', description)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      return { success: true, transaction: transaction || undefined };
    } catch (error) {
      console.error('Error deducting credits:', error);
      return { success: false, error: 'Failed to deduct credits' };
    }
  }

  /**
   * Add credits to user account
   */
  static async addCredits(
    userId: string,
    amount: number,
    description: string = 'Credit purchase',
    referenceId?: string,
    type: 'purchase' | 'refund' | 'bonus' = 'purchase'
  ): Promise<{ success: boolean; transaction?: Transaction; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('add_credits', {
        p_user_id: userId,
        p_amount: amount,
        p_description: description,
        p_reference_id: referenceId,
        p_type: type,
      });

      if (error) {
        console.error('Error adding credits:', error);
        return { success: false, error: error.message };
      }

      if (!data) {
        return { success: false, error: 'Failed to add credits' };
      }

      // Get the transaction record
      const { data: transaction } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .eq('amount', amount)
        .eq('description', description)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      return { success: true, transaction: transaction || undefined };
    } catch (error) {
      console.error('Error adding credits:', error);
      return { success: false, error: 'Failed to add credits' };
    }
  }

  /**
   * Get user's transaction history
   */
  static async getTransactions(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Transaction[]> {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw new Error('Failed to fetch transactions');
    }
  }

  /**
   * Get user's usage logs
   */
  static async getUsageLogs(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('usage_logs')
        .select(`
          *,
          ai_models (*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching usage logs:', error);
      throw new Error('Failed to fetch usage logs');
    }
  }

  /**
   * Create usage log entry
   */
  static async logUsage(
    userId: string,
    modelId: string,
    creditsUsed: number,
    requestData: Record<string, any> = {}
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('usage_logs')
        .insert({
          user_id: userId,
          model_id: modelId,
          credits_used: creditsUsed,
          request_data: requestData,
        });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error logging usage:', error);
      // Don't throw here as this is not critical for the main operation
    }
  }

  /**
   * Get usage statistics for dashboard
   */
  static async getUsageStats(userId: string, days: number = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from('usage_logs')
        .select(`
          credits_used,
          created_at,
          ai_models (*)
        `)
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      const logs = data || [];

      // Calculate statistics
      const totalCreditsUsed = logs.reduce((sum, log) => sum + log.credits_used, 0);
      const totalRequests = logs.length;

      // Group by model
      const usageByModel = logs.reduce((acc, log) => {
        const modelName = log.ai_models?.display_name || 'Unknown';
        acc[modelName] = (acc[modelName] || 0) + log.credits_used;
        return acc;
      }, {} as Record<string, number>);

      // Group by date
      const usageByDate = logs.reduce((acc, log) => {
        const date = new Date(log.created_at).toISOString().split('T')[0];
        if (!acc[date]) {
          acc[date] = { credits: 0, requests: 0 };
        }
        acc[date].credits += log.credits_used;
        acc[date].requests += 1;
        return acc;
      }, {} as Record<string, { credits: number; requests: number }>);

      // Find favorite model
      const favoriteModel = Object.entries(usageByModel)
        .sort(([, a], [, b]) => b - a)[0]?.[0] || 'None';

      return {
        totalCreditsUsed,
        totalRequests,
        favoriteModel,
        usageByModel,
        usageByDate: Object.entries(usageByDate).map(([date, data]) => ({
          date,
          ...data,
        })),
      };
    } catch (error) {
      console.error('Error fetching usage stats:', error);
      throw new Error('Failed to fetch usage statistics');
    }
  }

  /**
   * Create user credit account for new users
   */
  static async createUserAccount(userId: string, planId?: string): Promise<void> {
    try {
      // Get the free plan if no plan specified
      let targetPlanId = planId;
      if (!targetPlanId) {
        const { data: freePlan } = await supabase
          .from('plans')
          .select('id')
          .eq('name', 'free')
          .single();

        targetPlanId = freePlan?.id;
      }

      if (!targetPlanId) {
        throw new Error('Default plan not found');
      }

      const { error } = await supabase
        .from('user_credits')
        .upsert({
          user_id: userId,
          plan_id: targetPlanId,
        }, {
          onConflict: 'user_id',
          ignoreDuplicates: true,
        });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error creating user credit account:', error);
      throw new Error('Failed to create user credit account');
    }
  }

  /**
   * Refund credits for failed operations
   */
  static async refundCredits(
    userId: string,
    amount: number,
    reason: string = 'Operation failed',
    referenceId?: string
  ): Promise<{ success: boolean; error?: string }> {
    return this.addCredits(userId, amount, reason, referenceId, 'refund');
  }
}

// Validation helpers
export function validateCreditRequest(request: CreditUsageRequest): CreditError | null {
  if (!request.modelId && request.operation !== 'compare') {
    return {
      code: 'INVALID_MODEL',
      message: 'Model ID is required',
    };
  }

  if (request.operation === 'chat' && !request.tokens) {
    return {
      code: 'SYSTEM_ERROR',
      message: 'Token count is required for chat operations',
    };
  }

  if (request.operation === 'image' && !CREDIT_COSTS.IMAGE_GENERATION[request.modelId as keyof typeof CREDIT_COSTS.IMAGE_GENERATION]) {
    return {
      code: 'INVALID_MODEL',
      message: 'Invalid image generation model',
    };
  }

  if (request.operation === 'video' && !CREDIT_COSTS.VIDEO_GENERATION[request.modelId as keyof typeof CREDIT_COSTS.VIDEO_GENERATION]) {
    return {
      code: 'INVALID_MODEL',
      message: 'Invalid video generation model',
    };
  }

  return null;
}

// Error handling utilities
export function formatCreditError(error: any): CreditError {
  if (error.code === 'PGRST116') {
    return {
      code: 'INSUFFICIENT_CREDITS',
      message: 'User account not found. Please sign in again.',
    };
  }

  if (error.message?.includes('Insufficient credits')) {
    return {
      code: 'INSUFFICIENT_CREDITS',
      message: 'Insufficient credits. Please purchase more credits to continue.',
    };
  }

  return {
    code: 'SYSTEM_ERROR',
    message: error.message || 'An unexpected error occurred',
  };
}