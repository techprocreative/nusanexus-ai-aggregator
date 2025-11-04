'use client';

import React from 'react';
import Link from 'next/link';
import { Lock, Crown, Zap, Star, Video, Image, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useFeatureAccess } from '@/hooks/useSubscription';
import { PLANS } from '@/app/config/plans';

interface UpgradeGuardProps {
  feature: keyof ReturnType<typeof useFeatureAccess>['canAccessFeatures'];
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgradeButton?: boolean;
  inline?: boolean;
}

export function UpgradeGuard({
  feature,
  children,
  fallback,
  showUpgradeButton = true,
  inline = false,
}: UpgradeGuardProps) {
  const { canAccess, requiresUpgrade, isLoading, upgradeUrl } = useFeatureAccess(feature);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (canAccess) {
    return <>{children}</>;
  }

  if (requiresUpgrade && fallback) {
    return <>{fallback}</>;
  }

  if (requiresUpgrade && inline) {
    return <InlineUpgradePrompt feature={feature} showButton={showUpgradeButton} />;
  }

  return (
    <div className="flex items-center justify-center p-8">
      <Card className="w-full max-w-md bg-white/60 backdrop-blur-lg border-white/30">
        <CardHeader className="text-center">
          <FeatureIcon feature={feature} className="h-12 w-12 text-purple-600 mx-auto mb-4" />
          <CardTitle>Upgrade Required</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-gray-600">
            {getUpgradeMessage(feature)}
          </p>
          <FeatureRequirementList feature={feature} />
          {showUpgradeButton && (
            <Button asChild className="w-full bg-purple-600 hover:bg-purple-700">
              <Link href={upgradeUrl}>
                <Crown className="h-4 w-4 mr-2" />
                Upgrade Plan
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FeatureIcon({ feature, className }: { feature: string; className?: string }) {
  const iconMap = {
    compare: <TrendingUp className={className} />,
    image_generation: <Image className={className} />,
    video_generation: <Video className={className} />,
    chat: <Zap className={className} />,
  };

  return iconMap[feature as keyof typeof iconMap] || <Lock className={className} />;
}

function getUpgradeMessage(feature: string): string {
  const messageMap = {
    compare: 'Compare AI models side-by-side to find the best responses for your needs.',
    image_generation: 'Create stunning images from text descriptions using advanced AI models.',
    video_generation: 'Generate dynamic video content from text prompts with cutting-edge AI.',
    chat: 'Access advanced AI models for more intelligent conversations.',
  };

  return messageMap[feature as keyof typeof messageMap] ||
    'This feature is available with a paid subscription. Upgrade your account to access premium features.';
}

function FeatureRequirementList({ feature }: { feature: string }) {
  const requirements = {
    compare: {
      plan: 'Professional',
      features: ['Side-by-side model comparison', 'Detailed response analysis', 'Performance metrics'],
    },
    image_generation: {
      plan: 'Professional',
      features: ['High-quality image generation', 'Multiple art styles', 'Custom dimensions', 'Commercial usage'],
    },
    video_generation: {
      plan: 'Enterprise',
      features: ['AI video generation', 'Multiple frame options', 'High-resolution output', 'Commercial usage'],
    },
    chat: {
      plan: 'Free',
      features: ['Basic AI chat', 'Limited model access', 'Standard response quality'],
    },
  };

  const requirement = requirements[feature as keyof typeof requirements];

  if (!requirement) return null;

  return (
    <div className="space-y-2">
      <Alert className="bg-blue-50 border-blue-200">
        <AlertDescription className="text-blue-800">
          Available with <strong>{requirement.plan}</strong> plan
        </AlertDescription>
      </Alert>
      <div className="text-left space-y-1">
        <p className="text-sm font-medium text-gray-900">What you get:</p>
        <ul className="text-sm text-gray-600 space-y-1">
          {requirement.features.map((featureItem, index) => (
            <li key={index} className="flex items-center space-x-2">
              <div className="w-1 h-1 bg-green-500 rounded-full"></div>
              <span>{featureItem}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function InlineUpgradePrompt({
  feature,
  showButton,
}: {
  feature: string;
  showButton: boolean;
}) {
  const { upgradeUrl } = useFeatureAccess(feature);

  return (
    <Alert className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
      <div className="flex items-center space-x-3">
        <FeatureIcon feature={feature} className="h-5 w-5 text-purple-600" />
        <div className="flex-1">
          <p className="text-sm font-medium text-purple-900">
            Upgrade to access this feature
          </p>
          <p className="text-xs text-purple-700">
            {getUpgradeMessage(feature)}
          </p>
        </div>
        {showButton && (
          <Button asChild size="sm" variant="outline" className="bg-white/50 border-white/30 hover:bg-white/70">
            <Link href={upgradeUrl}>Upgrade</Link>
          </Button>
        )}
      </div>
    </Alert>
  );
}

interface FeatureGateProps {
  feature: keyof ReturnType<typeof useFeatureAccess>['canAccessFeatures'];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function FeatureGate({ feature, children, fallback }: FeatureGateProps) {
  return (
    <UpgradeGuard feature={feature} fallback={fallback} inline>
      {children}
    </UpgradeGuard>
  );
}

interface CompareGateProps {
  children: React.ReactNode;
}

export function CompareGate({ children }: CompareGateProps) {
  return (
    <FeatureGate feature="compare" fallback={
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardContent className="p-6 text-center">
          <TrendingUp className="h-12 w-12 text-blue-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Upgrade to Compare Models
          </h3>
          <p className="text-gray-600 mb-4">
            Compare AI models side-by-side to find the best responses for your needs.
          </p>
          <Button asChild className="bg-blue-600 hover:bg-blue-700">
            <Link href="/pricing">
              <Crown className="h-4 w-4 mr-2" />
              Upgrade to Professional
            </Link>
          </Button>
        </CardContent>
      </Card>
    }>
      {children}
    </FeatureGate>
  );
}

interface ImageGenGateProps {
  children: React.ReactNode;
}

export function ImageGenGate({ children }: ImageGenGateProps) {
  return (
    <FeatureGate feature="image_generation" fallback={
      <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
        <CardContent className="p-6 text-center">
          <Image className="h-12 w-12 text-green-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Upgrade to Generate Images
          </h3>
          <p className="text-gray-600 mb-4">
            Create stunning images from text descriptions using advanced AI models.
          </p>
          <Button asChild className="bg-green-600 hover:bg-green-700">
            <Link href="/pricing">
              <Crown className="h-4 w-4 mr-2" />
              Upgrade to Professional
            </Link>
          </Button>
        </CardContent>
      </Card>
    }>
      {children}
    </FeatureGate>
  );
}

interface VideoGenGateProps {
  children: React.ReactNode;
}

export function VideoGenGate({ children }: VideoGenGateProps) {
  return (
    <FeatureGate feature="video_generation" fallback={
      <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
        <CardContent className="p-6 text-center">
          <Video className="h-12 w-12 text-purple-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Upgrade to Generate Videos
          </h3>
          <p className="text-gray-600 mb-4">
            Generate dynamic video content from text prompts with cutting-edge AI.
          </p>
          <Button asChild className="bg-purple-600 hover:bg-purple-700">
            <Link href="/pricing">
              <Crown className="h-4 w-4 mr-2" />
              Upgrade to Enterprise
            </Link>
          </Button>
        </CardContent>
      </Card>
    }>
      {children}
    </FeatureGate>
  );
}

// Hook to check if user needs upgrade for specific features
export function useUpgradeCheck() {
  const { canAccessFeatures, planName } = useSubscription();

  const needsUpgradeFor = (feature: keyof typeof canAccessFeatures): boolean => {
    return !canAccessFeatures[feature];
  };

  const getUpgradePlan = (feature: keyof typeof canAccessFeatures): keyof typeof PLANS => {
    if (feature === 'video_generation') return 'enterprise';
    if (feature === 'compare' || feature === 'image_generation') return 'professional';
    return 'free';
  };

  const canUpgrade = (feature: keyof typeof canAccessFeatures): boolean => {
    const requiredPlan = getUpgradePlan(feature);
    const planHierarchy = ['free', 'professional', 'enterprise'];
    const currentIndex = planHierarchy.indexOf(planName || 'free');
    const requiredIndex = planHierarchy.indexOf(requiredPlan);

    return requiredIndex > currentIndex;
  };

  return {
    needsUpgradeFor,
    getUpgradePlan,
    canUpgrade,
    currentPlan: planName,
  };
}