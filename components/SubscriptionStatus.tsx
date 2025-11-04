'use client';

import React from 'react';
import Link from 'next/link';
import { Crown, Zap, Star, TrendingUp, CreditCard } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useSubscription, useCredits, usePlan } from '@/hooks/useSubscription';
import { PLANS } from '@/app/config/plans';

interface SubscriptionStatusProps {
  showUpgradeButton?: boolean;
  compact?: boolean;
  className?: string;
}

export function SubscriptionStatus({
  showUpgradeButton = true,
  compact = false,
  className = '',
}: SubscriptionStatusProps) {
  const { userPlan, planName, isSubscribed, canAccessFeatures } = useSubscription();
  const { balance, getRemainingPercentage } = useCredits();

  if (compact) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <Badge
          variant={planName === 'free' ? 'secondary' : 'default'}
          className={
            planName === 'free'
              ? 'bg-gray-100 text-gray-700'
              : planName === 'professional'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-purple-100 text-purple-800'
          }
        >
          {userPlan?.displayName || 'Free'}
        </Badge>
        <Badge variant="outline" className="bg-white/50 text-gray-700">
          {balance} credits
        </Badge>
      </div>
    );
  }

  return (
    <Card className={`bg-white/60 backdrop-blur-lg border-white/30 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center space-x-2">
            {planName === 'free' && <Zap className="h-5 w-5 text-gray-600" />}
            {planName === 'professional' && <Star className="h-5 w-5 text-blue-600" />}
            {planName === 'enterprise' && <Crown className="h-5 w-5 text-purple-600" />}
            <span>{userPlan?.displayName || 'Free Plan'}</span>
          </CardTitle>
          {showUpgradeButton && !isSubscribed && (
            <Button asChild size="sm" className="bg-purple-600 hover:bg-purple-700">
              <Link href="/pricing">Upgrade</Link>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Credits Overview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Credits Balance</span>
            <span className="font-medium">{balance}</span>
          </div>
          {userPlan && (
            <div className="space-y-1">
              <Progress
                value={getRemainingPercentage()}
                className="h-2"
              />
              <p className="text-xs text-gray-500">
                {getRemainingPercentage().toFixed(1)}% of {userPlan.credits} total credits
              </p>
            </div>
          )}
        </div>

        {/* Feature Access */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-900">Feature Access</h4>
          <div className="grid grid-cols-2 gap-3">
            <FeatureItem
              feature="Chat"
              available={canAccessFeatures.chat}
              icon={<Zap className="h-4 w-4" />}
            />
            <FeatureItem
              feature="Compare"
              available={canAccessFeatures.compare}
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <FeatureItem
              feature="Image Gen"
              available={canAccessFeatures.image_generation}
              icon={<Star className="h-4 w-4" />}
            />
            <FeatureItem
              feature="Video Gen"
              available={canAccessFeatures.video_generation}
              icon={<Crown className="h-4 w-4" />}
            />
          </div>
        </div>

        {/* Upgrade CTA */}
        {showUpgradeButton && planName === 'free' && (
          <div className="pt-2">
            <Button asChild className="w-full bg-purple-600 hover:bg-purple-700">
              <Link href="/pricing">
                <CreditCard className="h-4 w-4 mr-2" />
                Upgrade to Professional
              </Link>
            </Button>
            <p className="text-xs text-gray-600 mt-2 text-center">
              Unlock model comparison, image generation, and more!
            </p>
          </div>
        )}

        {showUpgradeButton && planName === 'professional' && (
          <div className="pt-2">
            <Button asChild variant="outline" className="w-full bg-white/50 border-white/30 hover:bg-white/70">
              <Link href="/pricing">
                <Crown className="h-4 w-4 mr-2" />
                Upgrade to Enterprise
              </Link>
            </Button>
            <p className="text-xs text-gray-600 mt-2 text-center">
              Get video generation and unlimited features!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface FeatureItemProps {
  feature: string;
  available: boolean;
  icon: React.ReactNode;
}

function FeatureItem({ feature, available, icon }: FeatureItemProps) {
  return (
    <div className="flex items-center space-x-2">
      <div
        className={`p-1 rounded ${
          available ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
        }`}
      >
        {icon}
      </div>
      <span
        className={`text-sm ${
          available ? 'text-gray-900' : 'text-gray-400'
        }`}
      >
        {feature}
      </span>
    </div>
  );
}

interface UpgradePromptProps {
  feature: string;
  description?: string;
  className?: string;
}

export function UpgradePrompt({
  feature,
  description = 'This feature requires a paid subscription.',
  className = '',
}: UpgradePromptProps) {
  return (
    <Card className={`bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 ${className}`}>
      <CardContent className="p-6 text-center">
        <Crown className="h-12 w-12 text-purple-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Upgrade to Access {feature}
        </h3>
        <p className="text-gray-600 mb-4">{description}</p>
        <Button asChild className="bg-purple-600 hover:bg-purple-700">
          <Link href="/pricing">
            <CreditCard className="h-4 w-4 mr-2" />
            Upgrade Plan
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

interface CreditBalanceProps {
  showProgress?: boolean;
  className?: string;
}

export function CreditBalance({ showProgress = false, className = '' }: CreditBalanceProps) {
  const { balance, totalPurchased, getRemainingPercentage } = useCredits();
  const { userPlan } = usePlan();

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Credits</span>
        <Badge variant="outline" className="bg-white/50 text-gray-700">
          {balance}
        </Badge>
      </div>
      {showProgress && userPlan && (
        <div className="space-y-1">
          <Progress value={getRemainingPercentage()} className="h-2" />
          <p className="text-xs text-gray-500">
            {balance} of {userPlan.credits} credits
          </p>
        </div>
      )}
    </div>
  );
}

interface PlanComparisonProps {
  className?: string;
}

export function PlanComparison({ className = '' }: PlanComparisonProps) {
  const { planName } = useSubscription();

  const plans = [
    { key: 'free', name: 'Free', color: 'bg-gray-100 text-gray-700' },
    { key: 'professional', name: 'Professional', color: 'bg-blue-100 text-blue-800' },
    { key: 'enterprise', name: 'Enterprise', color: 'bg-purple-100 text-purple-800' },
  ];

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {plans.map((plan) => (
        <Badge
          key={plan.key}
          variant={planName === plan.key ? 'default' : 'secondary'}
          className={
            planName === plan.key
              ? plan.color
              : 'bg-gray-50 text-gray-500 border-gray-200'
          }
        >
          {plan.name}
          {planName === plan.key && (
            <span className="ml-1">✓</span>
          )}
        </Badge>
      ))}
    </div>
  );
}