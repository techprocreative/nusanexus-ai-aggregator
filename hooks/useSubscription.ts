'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { PLANS, Plan, PlanFeature } from '@/app/config/plans';
import { CreditManager } from '@/utils/creditManager';

export interface UserCredits {
  id: string;
  user_id: string;
  plan_id: string;
  balance: number;
  total_purchased: number;
  total_used: number;
  created_at: string;
  updated_at: string;
  plan?: Plan;
}

export interface SubscriptionState {
  userCredits: UserCredits | null;
  userPlan: Plan | null;
  planName: keyof typeof PLANS | null;
  isLoading: boolean;
  error: string | null;
  isSubscribed: boolean;
  canAccessFeatures: {
    chat: boolean;
    compare: boolean;
    image_generation: boolean;
    video_generation: boolean;
  };
  maxModels: number;
  credits: {
    balance: number;
    totalPurchased: number;
    totalUsed: number;
  };
}

// Supabase client
const supabase = createClient();

/**
 * Hook to manage user subscription and credits
 */
export function useSubscription(): SubscriptionState {
  const queryClient = useQueryClient();

  // Fetch user credits and plan information
  const {
    data: userCredits,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['user-credits'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      // Fetch user credits with plan information
      const { data, error } = await supabase
        .from('user_credits')
        .select(`
          *,
          plans (*)
        `)
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      // If no credit account exists, create one for the user
      if (!data) {
        await CreditManager.createUserAccount(user.id);

        // Refetch after creating account
        return refetch().then(result => result.data);
      }

      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
  });

  // Extract plan information
  const userPlan = userCredits?.plans ? PLANS[userCredits.plans.name as keyof typeof PLANS] || null : null;
  const planName = userCredits?.plans?.name as keyof typeof PLANS || null;

  // Determine subscription status and feature access
  const isSubscribed = planName !== null && planName !== 'free';

  const canAccessFeatures = {
    chat: Boolean(userPlan?.features.chat),
    compare: Boolean(userPlan?.features.compare),
    image_generation: Boolean(userPlan?.features.image_generation),
    video_generation: Boolean(userPlan?.features.video_generation),
  };

  const maxModels = userPlan?.features.max_models || 0;

  return {
    userCredits: userCredits || null,
    userPlan,
    planName,
    isLoading,
    error: error?.message || null,
    isSubscribed,
    canAccessFeatures,
    maxModels,
    credits: {
      balance: userCredits?.balance || 0,
      totalPurchased: userCredits?.total_purchased || 0,
      totalUsed: userCredits?.total_used || 0,
    },
  };
}

/**
 * Hook to check if user can access a specific feature
 */
export function useFeatureAccess(feature: keyof PlanFeature): {
  canAccess: boolean;
  requiresUpgrade: boolean;
  isLoading: boolean;
  upgradeUrl: string;
} {
  const { canAccessFeatures, isLoading } = useSubscription();

  const canAccess = canAccessFeatures[feature];
  const requiresUpgrade = !canAccess && !isLoading;

  return {
    canAccess,
    requiresUpgrade,
    isLoading,
    upgradeUrl: '/pricing',
  };
}

/**
 * Hook to get user credit balance and related functions
 */
export function useCredits() {
  const queryClient = useQueryClient();
  const { credits, userCredits, isLoading } = useSubscription();

  // Refresh credits
  const refreshCredits = async () => {
    await queryClient.invalidateQueries({ queryKey: ['user-credits'] });
  };

  // Check if user has enough credits
  const hasEnoughCredits = (requiredCredits: number): boolean => {
    return credits.balance >= requiredCredits;
  };

  // Get credit usage percentage
  const getUsagePercentage = (): number => {
    if (credits.totalPurchased === 0) return 0;
    return (credits.totalUsed / credits.totalPurchased) * 100;
  };

  // Get remaining percentage
  const getRemainingPercentage = (): number => {
    if (credits.totalPurchased === 0) return 100;
    return (credits.balance / credits.totalPurchased) * 100;
  };

  return {
    balance: credits.balance,
    totalPurchased: credits.totalPurchased,
    totalUsed: credits.totalUsed,
    isLoading,
    refreshCredits,
    hasEnoughCredits,
    getUsagePercentage,
    getRemainingPercentage,
    userId: userCredits?.user_id,
  };
}

/**
 * Hook to get user's plan information
 */
export function usePlan() {
  const { userPlan, planName, isSubscribed, isLoading } = useSubscription();

  const isFree = planName === 'free';
  const isProfessional = planName === 'professional';
  const isEnterprise = planName === 'enterprise';

  const getPlanLimits = () => {
    if (!userPlan) return null;

    return {
      creditsIncluded: userPlan.credits,
      features: userPlan.features,
      price: userPlan.priceInCents,
      displayName: userPlan.displayName,
    };
  };

  const canUpgradeTo = (targetPlan: keyof typeof PLANS): boolean => {
    if (!planName) return true;

    const planHierarchy = ['free', 'professional', 'enterprise'];
    const currentIndex = planHierarchy.indexOf(planName);
    const targetIndex = planHierarchy.indexOf(targetPlan);

    return targetIndex > currentIndex;
  };

  return {
    plan: userPlan,
    planName,
    isSubscribed,
    isFree,
    isProfessional,
    isEnterprise,
    isLoading,
    getPlanLimits,
    canUpgradeTo,
  };
}

/**
 * Hook to get usage statistics
 */
export function useUsageStats(days: number = 30) {
  const { userCredits, isLoading } = useSubscription();

  const {
    data: stats,
    isLoading: statsLoading,
    error,
  } = useQuery({
    queryKey: ['usage-stats', days],
    queryFn: async () => {
      if (!userCredits?.user_id) return null;

      try {
        const stats = await CreditManager.getUsageStats(userCredits.user_id, days);
        return stats;
      } catch (error) {
        console.error('Error fetching usage stats:', error);
        return null;
      }
    },
    enabled: !!userCredits?.user_id,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    stats,
    isLoading: isLoading || statsLoading,
    error: error?.message || null,
  };
}

/**
 * Hook to manage credit transactions
 */
export function useTransactions() {
  const queryClient = useQueryClient();
  const { userCredits, isLoading } = useSubscription();

  const {
    data: transactions,
    isLoading: transactionsLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['transactions'],
    queryFn: async () => {
      if (!userCredits?.user_id) return [];

      try {
        const transactions = await CreditManager.getTransactions(userCredits.user_id, 50);
        return transactions;
      } catch (error) {
        console.error('Error fetching transactions:', error);
        return [];
      }
    },
    enabled: !!userCredits?.user_id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const refreshTransactions = async () => {
    await refetch();
  };

  return {
    transactions: transactions || [],
    isLoading: isLoading || transactionsLoading,
    error: error?.message || null,
    refreshTransactions,
  };
}

/**
 * Higher-order component for feature gating
 */
export function withFeatureGate<T extends object>(
  Component: React.ComponentType<T>,
  feature: keyof PlanFeature,
  FallbackComponent?: React.ComponentType<{ upgradeUrl: string }>
) {
  return function FeatureGatedComponent(props: T) {
    const { canAccess, requiresUpgrade, isLoading, upgradeUrl } = useFeatureAccess(feature);

    if (isLoading) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      );
    }

    if (requiresUpgrade) {
      if (FallbackComponent) {
        return <FallbackComponent upgradeUrl={upgradeUrl} />;
      }

      return (
        <div className="flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Upgrade Required
            </h3>
            <p className="text-gray-600 mb-4">
              This feature is available with a paid plan. Upgrade your account to access this feature.
            </p>
            <a
              href={upgradeUrl}
              className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
            >
              Upgrade Plan
            </a>
          </div>
        </div>
      );
    }

    return <Component {...props} />;
  };
}

/**
 * Utility function to check plan limits
 */
export function checkPlanLimit(
  planName: keyof typeof PLANS | null,
  feature: keyof PlanFeature,
  currentValue?: number
): {
  allowed: boolean;
  limit: number;
  current: number;
  remaining: number;
} {
  const plan = planName ? PLANS[planName] : null;
  const limit = plan?.features[feature] || 0;
  const current = currentValue || 0;
  const remaining = Math.max(0, limit - current);

  return {
    allowed: current < limit,
    limit,
    current,
    remaining,
  };
}