import { PLANS } from '@/app/config/plans';

export interface AIModel {
  id: string;
  provider: 'openrouter' | 'together';
  modelName: string;
  displayName: string;
  costPerCredit: number;
  markupMultiplier: number;
  isFree: boolean;
  isActive: boolean;
  modelType: 'chat' | 'image' | 'video';
  description?: string;
  maxTokens?: number;
  supportedFeatures?: string[];
}

// OpenRouter Chat Models
export const OPENROUTER_CHAT_MODELS: AIModel[] = [
  {
    id: 'llama-3.2-3b-free',
    provider: 'openrouter',
    modelName: 'meta-llama/llama-3.2-3b-instruct:free',
    displayName: 'Llama 3.2 3B (Free)',
    costPerCredit: 0.0001,
    markupMultiplier: 1.0,
    isFree: true,
    isActive: true,
    modelType: 'chat',
    description: 'Fast and efficient small language model, perfect for quick responses',
    maxTokens: 128000,
    supportedFeatures: ['chat', 'reasoning'],
  },
  {
    id: 'llama-3.2-1b-free',
    provider: 'openrouter',
    modelName: 'meta-llama/llama-3.2-1b-instruct:free',
    displayName: 'Llama 3.2 1B (Free)',
    costPerCredit: 0.00005,
    markupMultiplier: 1.0,
    isFree: true,
    isActive: true,
    modelType: 'chat',
    description: 'Ultra-compact model for basic queries',
    maxTokens: 128000,
    supportedFeatures: ['chat'],
  },
  {
    id: 'phi-3-mini-free',
    provider: 'openrouter',
    modelName: 'microsoft/phi-3-mini-128k-instruct:free',
    displayName: 'Phi-3 Mini (Free)',
    costPerCredit: 0.0001,
    markupMultiplier: 1.0,
    isFree: true,
    isActive: true,
    modelType: 'chat',
    description: 'Microsoft\'s small but capable model with long context',
    maxTokens: 128000,
    supportedFeatures: ['chat', 'reasoning'],
  },
  {
    id: 'qwen-2.5-7b-free',
    provider: 'openrouter',
    modelName: 'qwen/qwen-2.5-7b-instruct:free',
    displayName: 'Qwen 2.5 7B (Free)',
    costPerCredit: 0.0001,
    markupMultiplier: 1.0,
    isFree: true,
    isActive: true,
    modelType: 'chat',
    description: 'Alibaba\'s powerful multilingual model',
    maxTokens: 32768,
    supportedFeatures: ['chat', 'reasoning', 'multilingual'],
  },
  {
    id: 'llama-3.1-70b',
    provider: 'openrouter',
    modelName: 'meta-llama/llama-3.1-70b-instruct',
    displayName: 'Llama 3.1 70B',
    costPerCredit: 0.0059,
    markupMultiplier: 1.5,
    isFree: false,
    isActive: true,
    modelType: 'chat',
    description: 'Large, powerful model for complex tasks',
    maxTokens: 131072,
    supportedFeatures: ['chat', 'reasoning', 'analysis'],
  },
  {
    id: 'claude-3.5-sonnet',
    provider: 'openrouter',
    modelName: 'anthropic/claude-3.5-sonnet',
    displayName: 'Claude 3.5 Sonnet',
    costPerCredit: 0.015,
    markupMultiplier: 1.5,
    isFree: false,
    isActive: true,
    modelType: 'chat',
    description: 'Anthropic\'s most intelligent model',
    maxTokens: 200000,
    supportedFeatures: ['chat', 'reasoning', 'analysis', 'coding'],
  },
  {
    id: 'gpt-4o',
    provider: 'openrouter',
    modelName: 'openai/gpt-4o',
    displayName: 'GPT-4o',
    costPerCredit: 0.005,
    markupMultiplier: 1.5,
    isFree: false,
    isActive: true,
    modelType: 'chat',
    description: 'OpenAI\'s flagship multimodal model',
    maxTokens: 128000,
    supportedFeatures: ['chat', 'reasoning', 'analysis', 'coding', 'vision'],
  },
  {
    id: 'gpt-4o-mini',
    provider: 'openrouter',
    modelName: 'openai/gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    costPerCredit: 0.00015,
    markupMultiplier: 1.5,
    isFree: false,
    isActive: true,
    modelType: 'chat',
    description: 'Affordable and capable model for most tasks',
    maxTokens: 128000,
    supportedFeatures: ['chat', 'reasoning', 'coding'],
  },
  {
    id: 'gemini-pro-1.5',
    provider: 'openrouter',
    modelName: 'google/gemini-pro-1.5',
    displayName: 'Gemini Pro 1.5',
    costPerCredit: 0.007,
    markupMultiplier: 1.5,
    isFree: false,
    isActive: true,
    modelType: 'chat',
    description: 'Google\'s advanced model with long context',
    maxTokens: 2000000,
    supportedFeatures: ['chat', 'reasoning', 'analysis', 'vision'],
  },
];

// Together AI Image Generation Models
export const TOGETHER_IMAGE_MODELS: AIModel[] = [
  {
    id: 'flux-schnell',
    provider: 'together',
    modelName: 'black-forest-labs/FLUX.1-schnell',
    displayName: 'FLUX.1 Schnell',
    costPerCredit: 0.004,
    markupMultiplier: 1.5,
    isFree: false,
    isActive: true,
    modelType: 'image',
    description: 'Fast image generation with good quality',
    supportedFeatures: ['image_generation', 'text_to_image'],
  },
  {
    id: 'flux-dev',
    provider: 'together',
    modelName: 'black-forest-labs/FLUX.1-dev',
    displayName: 'FLUX.1 Dev',
    costPerCredit: 0.055,
    markupMultiplier: 1.5,
    isFree: false,
    isActive: true,
    modelType: 'image',
    description: 'High-quality image generation',
    supportedFeatures: ['image_generation', 'text_to_image'],
  },
  {
    id: 'sdxl-base',
    provider: 'together',
    modelName: 'stabilityai/stable-diffusion-xl-base-1.0',
    displayName: 'SDXL Base 1.0',
    costPerCredit: 0.06,
    markupMultiplier: 1.5,
    isFree: false,
    isActive: true,
    modelType: 'image',
    description: 'Professional grade image generation',
    supportedFeatures: ['image_generation', 'text_to_image'],
  },
  {
    id: 'sd-2.1',
    provider: 'together',
    modelName: 'stabilityai/stable-diffusion-2-1',
    displayName: 'Stable Diffusion 2.1',
    costPerCredit: 0.025,
    markupMultiplier: 1.5,
    isFree: false,
    isActive: true,
    modelType: 'image',
    description: 'Classic reliable image generation',
    supportedFeatures: ['image_generation', 'text_to_image'],
  },
];

// Together AI Video Generation Models
export const TOGETHER_VIDEO_MODELS: AIModel[] = [
  {
    id: 'stable-video-diffusion',
    provider: 'together',
    modelName: 'stabilityai/stable-video-diffusion',
    displayName: 'Stable Video Diffusion',
    costPerCredit: 0.3,
    markupMultiplier: 1.5,
    isFree: false,
    isActive: true,
    modelType: 'video',
    description: 'Generate short video clips from images',
    supportedFeatures: ['video_generation', 'image_to_video'],
  },
  {
    id: 'mochi-1-preview',
    provider: 'together',
    modelName: 'genmo/mochi-1-preview',
    displayName: 'Mochi 1 Preview',
    costPerCredit: 0.25,
    markupMultiplier: 1.5,
    isFree: false,
    isActive: true,
    modelType: 'video',
    description: 'High-quality text-to-video generation',
    supportedFeatures: ['video_generation', 'text_to_video'],
  },
];

// All models combined
export const ALL_MODELS = {
  chat: OPENROUTER_CHAT_MODELS,
  image: TOGETHER_IMAGE_MODELS,
  video: TOGETHER_VIDEO_MODELS,
} as const;

// Helper functions
export function getModelsByType(type: keyof typeof ALL_MODELS): AIModel[] {
  return ALL_MODELS[type] || [];
}

export function getModelById(id: string): AIModel | undefined {
  for (const models of Object.values(ALL_MODELS)) {
    const model = models.find(m => m.id === id);
    if (model) return model;
  }
  return undefined;
}

export function getModelsByProvider(provider: AIModel['provider']): AIModel[] {
  const allModels = [...OPENROUTER_CHAT_MODELS, ...TOGETHER_IMAGE_MODELS, ...TOGETHER_VIDEO_MODELS];
  return allModels.filter(model => model.provider === provider);
}

export function getFreeModels(): AIModel[] {
  const allModels = [...OPENROUTER_CHAT_MODELS, ...TOGETHER_IMAGE_MODELS, ...TOGETHER_VIDEO_MODELS];
  return allModels.filter(model => model.isFree);
}

export function getActiveModels(): AIModel[] {
  const allModels = [...OPENROUTER_CHAT_MODELS, ...TOGETHER_IMAGE_MODELS, ...TOGETHER_VIDEO_MODELS];
  return allModels.filter(model => model.isActive);
}

export function filterModelsByPlan(models: AIModel[], planName: keyof typeof PLANS): AIModel[] {
  const plan = PLANS[planName];
  if (!plan) return [];

  // Filter by max models limit and free tier access
  let filtered = models.filter(model => {
    if (planName === 'free') {
      // Free tier can only access free models
      return model.isFree;
    }
    // Paid tiers can access all models
    return true;
  });

  // Limit by max_models for the plan
  if (filtered.length > plan.features.max_models) {
    filtered = filtered.slice(0, plan.features.max_models);
  }

  return filtered;
}

export function calculateCreditCost(model: AIModel, tokens?: number): number {
  const baseCost = model.costPerCredit * model.markupMultiplier;

  switch (model.modelType) {
    case 'chat':
      if (!tokens) return Math.ceil(baseCost * 1000); // Default to 1K tokens
      return Math.ceil((tokens / 1000) * baseCost * 1000);

    case 'image':
      return Math.ceil(baseCost * 1000);

    case 'video':
      return Math.ceil(baseCost * 1000);

    default:
      return Math.ceil(baseCost * 1000);
  }
}

export function getModelEndpoint(model: AIModel): string {
  switch (model.provider) {
    case 'openrouter':
      return 'https://openrouter.ai/api/v1/chat/completions';

    case 'together':
      if (model.modelType === 'image') {
        return 'https://api.together.xyz/v1/images/generations';
      } else if (model.modelType === 'video') {
        return 'https://api.together.xyz/v1/videos/generations';
      }
      return 'https://api.together.xyz/v1/chat/completions';

    default:
      throw new Error(`Unknown provider: ${model.provider}`);
  }
}

// Model categories for UI organization
export const MODEL_CATEGORIES = {
  chat: {
    name: 'Chat Models',
    description: 'Conversational AI models for text-based interactions',
    icon: 'MessageCircle',
  },
  image: {
    name: 'Image Generation',
    description: 'Create stunning images from text descriptions',
    icon: 'Image',
  },
  video: {
    name: 'Video Generation',
    description: 'Generate video content from text or images',
    icon: 'Video',
  },
} as const;

export type ModelType = keyof typeof ALL_MODELS;