import { Plan } from '@/app/config/plans';
import { AIModel } from '@/utils/models';

// Database types
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

export interface Transaction {
  id: string;
  user_id: string;
  type: 'purchase' | 'usage' | 'refund' | 'bonus';
  amount: number;
  balance_after: number;
  description: string;
  reference_id?: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface Payment {
  id: string;
  user_id: string;
  reference: string;
  amount: number;
  method?: string;
  status: 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';
  tripay_data: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface UsageLog {
  id: string;
  user_id: string;
  model_id: string;
  credits_used: number;
  request_data: Record<string, any>;
  created_at: string;
  model?: AIModel;
}

// Credit calculation types
export interface CreditUsageRequest {
  modelId: string;
  tokens?: number;
  operation: 'chat' | 'image' | 'video' | 'compare';
  parameters?: Record<string, any>;
}

export interface CreditUsageResponse {
  creditsRequired: number;
  canAfford: boolean;
  currentBalance: number;
  error?: string;
}

// Tripay types
export interface TripayPaymentRequest {
  method: string;
  amount: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  order_items: TripayOrderItem[];
  callback_url: string;
  return_url: string;
  expired_time?: number;
}

export interface TripayOrderItem {
  sku: string;
  name: string;
  price: number;
  quantity: number;
}

export interface TripayPaymentResponse {
  success: boolean;
  message: string;
  data?: {
    reference: string;
    checkout_url: string;
    expired_time: number;
    method: string;
    amount: number;
    status: 'UNPAID' | 'PAID' | 'REFUND' | 'EXPIRED' | 'FAILED';
    pay_code?: string;
    pay_url?: string;
    qr_url?: string;
  };
}

export interface TripayWebhookPayload {
  status: 'PAID' | 'REFUND' | 'EXPIRED' | 'FAILED';
  reference: string;
  merchant_ref: string;
  payment_method: string;
  payment_name: string;
  buyer_email: string;
  buyer_phone: string;
  amount: number;
  paid_amount: number;
  total_fee: number;
  total_amount: number;
  paid_at: string;
  note: string;
  signature: string;
  checksum: string;
}

// API Request/Response types
export interface ChatRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

export interface ChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ImageGenerationRequest {
  model: string;
  prompt: string;
  width?: number;
  height?: number;
  steps?: number;
  seed?: number;
  negative_prompt?: string;
  style?: string;
}

export interface ImageGenerationResponse {
  data: Array<{
    url: string;
    b64_json?: string;
  }>;
  created: number;
}

export interface VideoGenerationRequest {
  model: string;
  prompt: string;
  width?: number;
  height?: number;
  frames?: number;
  steps?: number;
  seed?: number;
}

export interface VideoGenerationResponse {
  data: Array<{
    url: string;
  }>;
  created: number;
}

// UI State types
export interface CreditState {
  balance: number;
  totalPurchased: number;
  totalUsed: number;
  plan: Plan | null;
  loading: boolean;
  error: string | null;
}

export interface UsageState {
  logs: UsageLog[];
  totalCreditsUsed: number;
  totalRequests: number;
  loading: boolean;
  error: string | null;
}

// Error types
export interface CreditError {
  code: 'INSUFFICIENT_CREDITS' | 'INVALID_MODEL' | 'PLAN_LIMIT' | 'SYSTEM_ERROR';
  message: string;
  details?: Record<string, any>;
}

// Dashboard stats
export interface DashboardStats {
  creditsUsed: number;
  creditsRemaining: number;
  totalRequests: number;
  favoriteModel: string;
  usageByType: Record<string, number>;
  usageOverTime: Array<{
    date: string;
    credits: number;
    requests: number;
  }>;
}

// Compare feature types
export interface CompareRequest {
  model1: string;
  model2: string;
  prompt: string;
  parameters?: Record<string, any>;
}

export interface CompareResponse {
  model1_response: ChatResponse;
  model2_response: ChatResponse;
  credits_used: number;
}

// Credit package types
export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  priceInCents: number;
  bonus: number;
  totalCredits: number;
}

// Payment method types
export interface PaymentMethod {
  code: string;
  name: string;
  icon?: string;
  fee?: number;
  min_amount?: number;
  max_amount?: number;
}