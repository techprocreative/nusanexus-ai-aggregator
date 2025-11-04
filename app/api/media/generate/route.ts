import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { CreditManager } from '@/utils/creditManager';
import { getModelById, getModelsByProvider } from '@/utils/models';
import { ImageGenerationRequest, VideoGenerationRequest, CreditError } from '@/types/credits';
import { CREDIT_COSTS } from '@/app/config/plans';

// Together AI configuration
const TOGETHER_CONFIG = {
  baseUrl: 'https://api.together.xyz/v1',
  apiKey: process.env.TOGETHER_API_KEY,
};

/**
 * Generate images using Together AI
 */
async function generateImage(
  request: ImageGenerationRequest,
  userId: string,
  requestId: string
) {
  const modelConfig = getModelById(request.model);
  if (!modelConfig || modelConfig.provider !== 'together' || modelConfig.modelType !== 'image') {
    throw new Error('Invalid or unsupported image model');
  }

  const creditsRequired = CREDIT_COSTS.IMAGE_GENERATION[request.model as keyof typeof CREDIT_COSTS.IMAGE_GENERATION] || 0;
  if (creditsRequired === 0) {
    throw new Error('Credit cost not defined for this model');
  }

  // Check credits
  const creditCheck = await CreditManager.checkCredits(userId, {
    modelId: request.model,
    operation: 'image',
  });

  if (!creditCheck.canAfford) {
    return {
      error: 'Insufficient credits',
      details: {
        creditsRequired,
        currentBalance: creditCheck.currentBalance,
        message: `You need ${creditsRequired} credits but only have ${creditCheck.currentBalance}`,
      },
      status: 402,
    };
  }

  // Prepare Together AI request
  const togetherRequest = {
    model: modelConfig.modelName,
    prompt: request.prompt,
    width: request.width || 1024,
    height: request.height || 1024,
    steps: request.steps || 20,
    seed: request.seed,
    negative_prompt: request.negative_prompt,
    style: request.style || 'realistic',
    response_format: 'url',
  };

  console.log(`Processing image generation: ${requestId}`, {
    userId,
    model: modelConfig.displayName,
    prompt: request.prompt.substring(0, 100) + '...',
    creditsRequired,
  });

  try {
    const response = await fetch(`${TOGETHER_CONFIG.baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOGETHER_CONFIG.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(togetherRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Together AI error for ${requestId}:`, response.status, errorText);
      throw new Error(`Image generation failed: ${response.status}`);
    }

    const data = await response.json();

    // Deduct credits
    const deductResult = await CreditManager.deductCredits(
      userId,
      creditsRequired,
      `Image generation - ${modelConfig.displayName}`,
      requestId
    );

    if (!deductResult.success) {
      console.error(`Failed to deduct credits for ${requestId}:`, deductResult.error);
      // Don't fail the response, but log for manual review
    }

    // Log usage
    await CreditManager.logUsage(userId, modelConfig.id, creditsRequired, {
      type: 'image_generation',
      model: modelConfig.displayName,
      prompt: request.prompt,
      width: request.width,
      height: request.height,
      steps: request.steps,
      requestId,
    });

    return {
      success: true,
      data: {
        images: data.data || [],
        created: data.created || Date.now(),
        _credits: {
          used: creditsRequired,
          remaining: creditCheck.currentBalance - creditsRequired,
        },
      },
    };

  } catch (error) {
    console.error(`Image generation error for ${requestId}:`, error);
    throw error;
  }
}

/**
 * Generate videos using Together AI
 */
async function generateVideo(
  request: VideoGenerationRequest,
  userId: string,
  requestId: string
) {
  const modelConfig = getModelById(request.model);
  if (!modelConfig || modelConfig.provider !== 'together' || modelConfig.modelType !== 'video') {
    throw new Error('Invalid or unsupported video model');
  }

  const creditsRequired = CREDIT_COSTS.VIDEO_GENERATION[request.model as keyof typeof CREDIT_COSTS.VIDEO_GENERATION] || 0;
  if (creditsRequired === 0) {
    throw new Error('Credit cost not defined for this model');
  }

  // Check credits
  const creditCheck = await CreditManager.checkCredits(userId, {
    modelId: request.model,
    operation: 'video',
  });

  if (!creditCheck.canAfford) {
    return {
      error: 'Insufficient credits',
      details: {
        creditsRequired,
        currentBalance: creditCheck.currentBalance,
        message: `You need ${creditsRequired} credits but only have ${creditCheck.currentBalance}`,
      },
      status: 402,
    };
  }

  // Prepare Together AI request
  const togetherRequest = {
    model: modelConfig.modelName,
    prompt: request.prompt,
    width: request.width || 1024,
    height: request.height || 576,
    frames: request.frames || 48,
    steps: request.steps || 20,
    seed: request.seed,
    response_format: 'url',
  };

  console.log(`Processing video generation: ${requestId}`, {
    userId,
    model: modelConfig.displayName,
    prompt: request.prompt.substring(0, 100) + '...',
    creditsRequired,
  });

  try {
    const response = await fetch(`${TOGETHER_CONFIG.baseUrl}/videos/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOGETHER_CONFIG.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(togetherRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Together AI error for ${requestId}:`, response.status, errorText);
      throw new Error(`Video generation failed: ${response.status}`);
    }

    const data = await response.json();

    // Deduct credits
    const deductResult = await CreditManager.deductCredits(
      userId,
      creditsRequired,
      `Video generation - ${modelConfig.displayName}`,
      requestId
    );

    if (!deductResult.success) {
      console.error(`Failed to deduct credits for ${requestId}:`, deductResult.error);
      // Don't fail the response, but log for manual review
    }

    // Log usage
    await CreditManager.logUsage(userId, modelConfig.id, creditsRequired, {
      type: 'video_generation',
      model: modelConfig.displayName,
      prompt: request.prompt,
      width: request.width,
      height: request.height,
      frames: request.frames,
      requestId,
    });

    return {
      success: true,
      data: {
        videos: data.data || [],
        created: data.created || Date.now(),
        _credits: {
          used: creditsRequired,
          remaining: creditCheck.currentBalance - creditsRequired,
        },
      },
    };

  } catch (error) {
    console.error(`Video generation error for ${requestId}:`, error);
    throw error;
  }
}

/**
 * Handle media generation requests
 */
export async function POST(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { type, model, ...parameters } = body;

    if (!type || !model) {
      return NextResponse.json(
        { error: 'Type and model are required' },
        { status: 400 }
      );
    }

    if (!['image', 'video'].includes(type)) {
      return NextResponse.json(
        { error: 'Type must be "image" or "video"' },
        { status: 400 }
      );
    }

    // Validate model configuration
    const modelConfig = getModelById(model);
    if (!modelConfig) {
      return NextResponse.json(
        { error: 'Invalid model specified' },
        { status: 400 }
      );
    }

    // Check Together AI API key
    if (!TOGETHER_CONFIG.apiKey) {
      console.error('Together AI API key not configured');
      return NextResponse.json(
        { error: 'Service configuration error' },
        { status: 500 }
      );
    }

    let result;

    switch (type) {
      case 'image':
        result = await generateImage(
          { model, ...parameters } as ImageGenerationRequest,
          userId,
          requestId
        );
        break;

      case 'video':
        result = await generateVideo(
          { model, ...parameters } as VideoGenerationRequest,
          userId,
          requestId
        );
        break;

      default:
        return NextResponse.json(
          { error: 'Unsupported media type' },
          { status: 400 }
        );
    }

    // Handle credit errors
    if (result.status === 402) {
      return NextResponse.json(result, { status: 402 });
    }

    if (result.error) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      type,
      requestId,
      ...result.data,
    });

  } catch (error) {
    console.error(`Media generation error for ${requestId}:`, error);
    return NextResponse.json(
      {
        error: 'Media generation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        requestId,
      },
      { status: 500 }
    );
  }
}

/**
 * Get available media generation models
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as 'image' | 'video';

    // Get user's plan to filter models
    const userCredits = await CreditManager.getUserCredits(userId);
    const planName = userCredits?.plans?.name || 'free';

    let models;
    if (type === 'image') {
      models = getModelsByProvider('together').filter(m => m.modelType === 'image');
    } else if (type === 'video') {
      models = getModelsByProvider('together').filter(m => m.modelType === 'video');
    } else {
      // Return both types if no specific type requested
      models = getModelsByProvider('together').filter(m =>
        m.modelType === 'image' || m.modelType === 'video'
      );
    }

    // Filter models by plan and check if user has access
    const availableModels = models.filter(model => {
      if (planName === 'free') {
        return model.isFree;
      }
      return model.isActive;
    });

    // Group by type
    const groupedModels = availableModels.reduce((acc, model) => {
      if (!acc[model.modelType]) {
        acc[model.modelType] = [];
      }
      acc[model.modelType].push({
        id: model.id,
        displayName: model.displayName,
        provider: model.provider,
        modelType: model.modelType,
        description: model.description,
        isFree: model.isFree,
        costPerCredit: model.costPerCredit,
        supportedFeatures: model.supportedFeatures,
      });
      return acc;
    }, {} as Record<string, any[]>);

    return NextResponse.json({
      success: true,
      data: {
        models: groupedModels,
        userPlan: planName,
        totalModels: availableModels.length,
        creditCosts: {
          image: CREDIT_COSTS.IMAGE_GENERATION,
          video: CREDIT_COSTS.VIDEO_GENERATION,
        },
      },
    });

  } catch (error) {
    console.error('Error fetching media models:', error);
    return NextResponse.json(
      { error: 'Failed to fetch models' },
      { status: 500 }
    );
  }
}

/**
 * Validate image generation request
 */
function validateImageRequest(request: ImageGenerationRequest): { valid: boolean; error?: string } {
  if (!request.prompt || typeof request.prompt !== 'string') {
    return { valid: false, error: 'Prompt is required and must be a string' };
  }

  if (request.prompt.length < 10) {
    return { valid: false, error: 'Prompt must be at least 10 characters long' };
  }

  if (request.prompt.length > 1000) {
    return { valid: false, error: 'Prompt must be less than 1000 characters' };
  }

  if (request.width && (request.width < 256 || request.width > 2048)) {
    return { valid: false, error: 'Width must be between 256 and 2048 pixels' };
  }

  if (request.height && (request.height < 256 || request.height > 2048)) {
    return { valid: false, error: 'Height must be between 256 and 2048 pixels' };
  }

  if (request.steps && (request.steps < 1 || request.steps > 50)) {
    return { valid: false, error: 'Steps must be between 1 and 50' };
  }

  return { valid: true };
}

/**
 * Validate video generation request
 */
function validateVideoRequest(request: VideoGenerationRequest): { valid: boolean; error?: string } {
  if (!request.prompt || typeof request.prompt !== 'string') {
    return { valid: false, error: 'Prompt is required and must be a string' };
  }

  if (request.prompt.length < 10) {
    return { valid: false, error: 'Prompt must be at least 10 characters long' };
  }

  if (request.prompt.length > 500) {
    return { valid: false, error: 'Prompt must be less than 500 characters' };
  }

  if (request.width && (request.width < 256 || request.width > 1024)) {
    return { valid: false, error: 'Width must be between 256 and 1024 pixels' };
  }

  if (request.height && (request.height < 256 || request.height > 1024)) {
    return { valid: false, error: 'Height must be between 256 and 1024 pixels' };
  }

  if (request.frames && (request.frames < 16 || request.frames > 120)) {
    return { valid: false, error: 'Frames must be between 16 and 120' };
  }

  if (request.steps && (request.steps < 1 || request.steps > 30)) {
    return { valid: false, error: 'Steps must be between 1 and 30' };
  }

  return { valid: true };
}

/**
 * Get generation status (for long-running jobs)
 */
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get('request_id');

    if (!requestId) {
      return NextResponse.json(
        { error: 'Request ID is required' },
        { status: 400 }
      );
    }

    // Check usage logs for this request
    const usageLogs = await CreditManager.getUsageLogs(userId, 10, 0);
    const log = usageLogs.find(log =>
      log.request_data.requestId === requestId
    );

    if (!log) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        requestId,
        status: 'completed',
        creditsUsed: log.credits_used,
        createdAt: log.created_at,
        model: log.model?.display_name,
        type: log.request_data.type,
      },
    });

  } catch (error) {
    console.error('Error checking generation status:', error);
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500 }
    );
  }
}