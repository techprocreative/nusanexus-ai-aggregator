'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CreditCard, Zap, Crown, Star, Check, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useCredits } from '@/hooks/useSubscription';
import { CREDIT_PACKAGES, TRIPAY_CONFIG } from '@/app/config/plans';

interface CreditPurchaseProps {
  trigger?: React.ReactNode;
  onPurchaseComplete?: () => void;
}

export function CreditPurchase({ trigger, onPurchaseComplete }: CreditPurchaseProps) {
  const [selectedPackage, setSelectedPackage] = useState(CREDIT_PACKAGES[1].id); // Default to popular pack
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const { toast } = useToast();
  const { refreshCredits } = useCredits();

  const selectedPackageData = CREDIT_PACKAGES.find(pkg => pkg.id === selectedPackage);

  const handlePurchase = async () => {
    if (!selectedPackageData) return;

    setIsProcessing(true);

    try {
      const response = await fetch('/api/payment/tripay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          packageId: selectedPackageData.id,
          paymentMethod: 'QRIS', // Default to QRIS for demo
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to initiate payment');
      }

      const data = await response.json();

      if (data.success && data.data.checkoutUrl) {
        // Redirect to payment page
        window.location.href = data.data.checkoutUrl;
      } else {
        throw new Error('Payment initiation failed');
      }

    } catch (error: any) {
      toast({
        title: 'Payment Error',
        description: error.message || 'Failed to initiate payment. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const formatPrice = (priceInCents: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(priceInCents);
  };

  const totalCredits = selectedPackageData
    ? selectedPackageData.credits + selectedPackageData.bonus
    : 0;

  const TriggerComponent = trigger || (
    <Button className="bg-purple-600 hover:bg-purple-700">
      <CreditCard className="h-4 w-4 mr-2" />
      Buy Credits
    </Button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {TriggerComponent}
      </DialogTrigger>
      <DialogContent className="bg-white/90 backdrop-blur-lg border-white/30 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Zap className="h-5 w-5 text-purple-600" />
            <span>Purchase Credits</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Credit Packages */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CREDIT_PACKAGES.map((pkg) => {
              const isPopular = pkg.id === 'popular';
              const total = pkg.credits + pkg.bonus;
              const savings = pkg.bonus > 0 ? Math.round((pkg.bonus / total) * 100) : 0;

              return (
                <Card
                  key={pkg.id}
                  className={`relative cursor-pointer transition-all ${
                    selectedPackage === pkg.id
                      ? 'ring-2 ring-purple-500 bg-purple-50 border-purple-200'
                      : 'hover:border-purple-300 bg-white/60 border-white/30'
                  }`}
                  onClick={() => setSelectedPackage(pkg.id)}
                >
                  {isPopular && (
                    <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-orange-500 text-white">Most Popular</Badge>
                    </div>
                  )}

                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span>{pkg.name}</span>
                      {pkg.id === 'enterprise' && <Crown className="h-5 w-5 text-purple-600" />}
                    </CardTitle>
                    <div className="text-2xl font-bold text-purple-600">
                      {formatPrice(pkg.priceInCents)}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Base Credits</span>
                        <span className="font-medium">{pkg.credits}</span>
                      </div>
                      {pkg.bonus > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-green-600">Bonus Credits</span>
                          <span className="font-medium text-green-600">+{pkg.bonus}</span>
                        </div>
                      )}
                      <div className="border-t pt-2">
                        <div className="flex items-center justify-between font-medium">
                          <span>Total Credits</span>
                          <span className="text-lg text-purple-600">{total}</span>
                        </div>
                      </div>
                    </div>

                    {savings > 0 && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800 w-full justify-center">
                        Save {savings}% with bonus credits!
                      </Badge>
                    )}

                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value={pkg.id} id={pkg.id} />
                      <Label htmlFor={pkg.id} className="text-sm text-gray-600">
                        Select this package
                      </Label>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Selected Package Summary */}
          {selectedPackageData && (
            <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-purple-900">Order Summary</h4>
                    <p className="text-sm text-purple-700">
                      {selectedPackageData.name} - {totalCredits} total credits
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-purple-900">
                      {formatPrice(selectedPackageData.priceInCents)}
                    </div>
                    {selectedPackageData.bonus > 0 && (
                      <p className="text-xs text-green-600">
                        Includes {selectedPackageData.bonus} bonus credits
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment Info */}
          <Alert className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-blue-800">
              Payments are processed securely through Tripay. You'll be redirected to complete your payment.
            </AlertDescription>
          </Alert>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="flex-1"
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePurchase}
              disabled={!selectedPackageData || isProcessing}
              className="flex-1 bg-purple-600 hover:bg-purple-700"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Proceed to Payment
                </>
              )}
            </Button>
          </div>

          {/* Additional Info */}
          <div className="text-center space-y-2">
            <p className="text-sm text-gray-600">
              Credits are added to your account immediately after successful payment.
            </p>
            <div className="flex items-center justify-center space-x-4 text-xs text-gray-500">
              <span>✓ Instant delivery</span>
              <span>✓ Secure payment</span>
              <span>✓ No expiration</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface QuickBuyCreditsProps {
  className?: string;
}

export function QuickBuyCredits({ className = '' }: QuickBuyCreditsProps) {
  return (
    <Card className={`bg-white/60 backdrop-blur-lg border-white/30 ${className}`}>
      <CardContent className="p-4">
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center space-x-2">
            <Zap className="h-5 w-5 text-orange-500" />
            <h3 className="font-semibold text-gray-900">Low on Credits?</h3>
          </div>
          <p className="text-sm text-gray-600">
            Purchase more credits to continue using AI features
          </p>
          <CreditPurchase />
        </div>
      </CardContent>
    </Card>
  );
}

interface CreditPackageDisplayProps {
  packageId: string;
  className?: string;
}

export function CreditPackageDisplay({ packageId, className = '' }: CreditPackageDisplayProps) {
  const packageData = CREDIT_PACKAGES.find(pkg => pkg.id === packageId);

  if (!packageData) return null;

  const totalCredits = packageData.credits + packageData.bonus;
  const formatPrice = (priceInCents: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(priceInCents);
  };

  return (
    <div className={`flex items-center justify-between ${className}`}>
      <div>
        <span className="font-medium">{packageData.name}</span>
        <div className="text-sm text-gray-600">
          {totalCredits} credits
          {packageData.bonus > 0 && (
            <span className="text-green-600"> (+{packageData.bonus} bonus)</span>
          )}
        </div>
      </div>
      <Badge variant="outline" className="bg-white/50">
        {formatPrice(packageData.priceInCents)}
      </Badge>
    </div>
  );
}