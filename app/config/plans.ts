export interface PlanFeature {
  chat: boolean;
  compare: boolean;
  image_generation: boolean;
  video_generation: boolean;
  max_models: number;
}

export interface Plan {
  id: string;
  name: 'free' | 'professional' | 'enterprise';
  displayName: string;
  description: string;
  priceInCents: number;
  credits: number;
  features: PlanFeature;
  isActive: boolean;
  displayPrice: string;
}

export const PLANS: Record<Plan['name'], Plan> = {
  free: {
    id: 'free',
    name: 'free',
    displayName: 'Free',
    description: 'Perfect for trying out our AI services',
    priceInCents: 0,
    credits: 100,
    features: {
      chat: true,
      compare: false,
      image_generation: false,
      video_generation: false,
      max_models: 5,
    },
    isActive: true,
    displayPrice: 'Gratis',
  },
  professional: {
    id: 'professional',
    name: 'professional',
    displayName: 'Professional',
    description: 'Ideal for professionals and small teams',
    priceInCents: 150000, // Rp 1.500
    credits: 1000,
    features: {
      chat: true,
      compare: true,
      image_generation: true,
      video_generation: false,
      max_models: 20,
    },
    isActive: true,
    displayPrice: 'Rp 150.000',
  },
  enterprise: {
    id: 'enterprise',
    name: 'enterprise',
    displayName: 'Enterprise',
    description: 'Full access for businesses and power users',
    priceInCents: 500000, // Rp 5.000
    credits: 5000,
    features: {
      chat: true,
      compare: true,
      image_generation: true,
      video_generation: true,
      max_models: 999,
    },
    isActive: true,
    displayPrice: 'Rp 500.000',
  },
};

// Credit pricing for different operations
export const CREDIT_COSTS = {
  // Chat costs (per 1K tokens)
  CHAT_PER_1K_TOKENS: 1,

  // Image generation costs
  IMAGE_GENERATION: {
    'FLUX.1-schnell': 40, // ~0.04 USD
    'FLUX.1-dev': 550,    // ~0.55 USD
    'SDXL-base': 600,     // ~0.60 USD
    'SD-2.1': 250,        // ~0.25 USD
  },

  // Video generation costs
  VIDEO_GENERATION: {
    'Stable Video Diffusion': 3000, // ~3.00 USD
    'Mochi 1 Preview': 2500,       // ~2.50 USD
  },

  // Compare feature cost
  COMPARE_FEATURE: 50, // Extra credits for comparing two models
} as const;

// Helper functions
export function getPlanByName(name: string): Plan | undefined {
  return PLANS[name as Plan['name']];
}

export function getPlanById(id: string): Plan | undefined {
  return Object.values(PLANS).find(plan => plan.id === id);
}

export function canAccessFeature(
  plan: Plan | undefined,
  feature: keyof PlanFeature
): boolean {
  return Boolean(plan?.features[feature]);
}

export function calculateCreditCost(
  operation: keyof typeof CREDIT_COSTS,
  model?: string,
  tokens?: number
): number {
  switch (operation) {
    case 'CHAT_PER_1K_TOKENS':
      if (!tokens) return 0;
      return Math.ceil((tokens / 1000) * CREDIT_COSTS.CHAT_PER_1K_TOKENS);

    case 'IMAGE_GENERATION':
      if (!model) return 0;
      return CREDIT_COSTS.IMAGE_GENERATION[model as keyof typeof CREDIT_COSTS.IMAGE_GENERATION] || 0;

    case 'VIDEO_GENERATION':
      if (!model) return 0;
      return CREDIT_COSTS.VIDEO_GENERATION[model as keyof typeof CREDIT_COSTS.VIDEO_GENERATION] || 0;

    case 'COMPARE_FEATURE':
      return CREDIT_COSTS.COMPARE_FEATURE;

    default:
      return 0;
  }
}

// Tripay payment configuration
export const TRIPAY_CONFIG = {
  // You can get these from your Tripay dashboard
  API_KEY: process.env.TRIPAY_API_KEY || '',
  PRIVATE_KEY: process.env.TRIPAY_PRIVATE_KEY || '',
  MERCHANT_CODE: process.env.TRIPAY_MERCHANT_CODE || '',

  // Callback URLs
  CALLBACK_URL: process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/tripay`
    : 'http://localhost:3000/api/webhooks/tripay',

  RETURN_URL: process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/credits`
    : 'http://localhost:3000/dashboard/credits',

  // Payment methods available
  PAYMENT_METHODS: [
    // Bank Transfer
    { code: 'BCAVA', name: 'BCA Virtual Account' },
    { code: 'BRIVA', name: 'BRI Virtual Account' },
    { code: 'BNIVA', name: 'BNI Virtual Account' },
    { code: 'MANDIRIVA', name: 'Mandiri Virtual Account' },
    { code: 'PERMATAVA', name: 'Permata Virtual Account' },

    // E-Wallet
    { code: 'QRIS', name: 'QRIS (GoPay, OVO, Dana, etc.)' },
    { code: 'OVO', name: 'OVO' },
    { code: 'DANA', name: 'DANA' },
    { code: 'SHOPEEPAY', name: 'ShopeePay' },

    // Convenience Store
    { code: 'ALFAMART', name: 'Alfamart' },
    { code: 'INDOMARET', name: 'Indomaret' },
  ],
} as const;

// Credit packages for purchase
export const CREDIT_PACKAGES = [
  {
    id: 'starter',
    name: 'Starter Pack',
    credits: 200,
    priceInCents: 30000, // Rp 300
    bonus: 0,
  },
  {
    id: 'popular',
    name: 'Popular Pack',
    credits: 500,
    priceInCents: 70000, // Rp 700
    bonus: 50, // 50 bonus credits
  },
  {
    id: 'value',
    name: 'Value Pack',
    credits: 1200,
    priceInCents: 150000, // Rp 1.500
    bonus: 200, // 200 bonus credits
  },
  {
    id: 'enterprise',
    name: 'Enterprise Pack',
    credits: 3000,
    priceInCents: 350000, // Rp 3.500
    bonus: 500, // 500 bonus credits
  },
] as const;

export type CreditPackage = typeof CREDIT_PACKAGES[number];

export function getCreditsForPackage(packageId: string): CreditPackage | undefined {
  return CREDIT_PACKAGES.find(pkg => pkg.id === packageId);
}

export function getTotalCreditsForPackage(packageId: string): number {
  const pkg = getCreditsForPackage(packageId);
  if (!pkg) return 0;
  return pkg.credits + pkg.bonus;
}