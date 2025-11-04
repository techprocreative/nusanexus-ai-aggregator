import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { CreditManager } from '@/utils/creditManager';
import { getModelById } from '@/utils/models';
import { CompareRequest, CompareResponse } from '@/types/credits';
import { CREDIT_COSTS } from '@/app/config/plans';

// Provider configurations
const PROVIDER_CONFIGS = {
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    headers: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'NusaNexus AI Aggregator',
    },
  },
} as const;

/**
 * Estimate token count for messages
 */
function estimateTokenCount(messages: any[]): number {
  let totalChars = 0;

  for (const message of messages) {
    totalChars += message.content?.length || 0;
    totalChars += message.role?.length || 0;
  }

  // Rough estimation: ~4 characters per token
  return Math.ceil(totalChars / 4);
}

/**
 * Call AI model for comparison
 */
async function callModel(
  modelId: string,
  messages: any[],
  requestId: string
): Promise<any> {
  const modelConfig = getModelById(modelId);
  if (!modelConfig) {
    throw new Error(`Invalid model: ${modelId}`);
  }

  if (modelConfig.modelType !== 'chat') {
    throw new Error(`Model ${modelId} is not a chat model`);
  }

  const provider = PROVIDER_CONFIGS[modelConfig.provider];
  if (!provider.apiKey) {
    throw new Error(`API key not configured for provider: ${modelConfig.provider}`);
  }

  const requestPayload = {
    model: modelConfig.modelName,
    messages,
    temperature: 0.7,
    max_tokens: 2048,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
    ...(modelConfig.provider === 'openrouter' && {
      models: [modelConfig.modelName],
      route: 'fallback',
    }),
  };

  console.log(`Calling model ${modelConfig.displayName} for comparison: ${requestId}`);

  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${provider.apiKey}`,
      'Content-Type': 'application/json',
      ...provider.headers,
    },
    body: JSON.stringify(requestPayload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Model ${modelConfig.displayName} error:`, response.status, errorText);
    throw new Error(`Model ${modelConfig.displayName} failed: ${response.status}`);
  }

  const data = await response.json();
  return {
    modelId,
    modelDisplayName: modelConfig.displayName,
    provider: modelConfig.provider,
    response: data,
    tokensUsed: data.usage?.total_tokens || 0,
  };
}

/**
 * Handle model comparison requests
 */
export async function POST(request: NextRequest) {
  const requestId = `compare_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  let userId: string | null = null;

  try {
    // Authenticate user
    const authResult = await auth();
    userId = authResult.userId;

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: CompareRequest = await request.json();
    const { model1, model2, prompt, parameters = {} } = body;

    if (!model1 || !model2 || !prompt) {
      return NextResponse.json(
        { error: 'Model1, model2, and prompt are required' },
        { status: 400 }
      );
    }

    if (model1 === model2) {
      return NextResponse.json(
        { error: 'Models must be different for comparison' },
        { status: 400 }
      );
    }

    // Get user's plan to check if they have access to compare feature
    const userCredits = await CreditManager.getUserCredits(userId);
    const planName = userCredits?.plans?.name || 'free';

    if (planName === 'free') {
      return NextResponse.json(
        {
          error: 'Compare feature not available',
          details: {
            message: 'Compare feature is only available for Professional and Enterprise plans',
            upgradeUrl: '/pricing',
          },
        },
        { status: 403 }
      );
    }

    // Validate models
    const model1Config = getModelById(model1);
    const model2Config = getModelById(model2);

    if (!model1Config) {
      return NextResponse.json(
        { error: `Invalid model1: ${model1}` },
        { status: 400 }
      );
    }

    if (!model2Config) {
      return NextResponse.json(
        { error: `Invalid model2: ${model2}` },
        { status: 400 }
      );
    }

    // Prepare messages
    const messages = [
      {
        role: 'system',
        content: 'You are a helpful AI assistant. Please provide a clear, concise, and accurate response to the user\'s query.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ];

    // Calculate total credits needed
    const estimatedTokens = estimateTokenCount(messages);
    const chatCreditsPerModel = Math.ceil((estimatedTokens / 1000) * 1); // 1 credit per 1K tokens
    const compareFeatureCredits = CREDIT_COSTS.COMPARE_FEATURE;
    const totalCreditsRequired = (chatCreditsPerModel * 2) + compareFeatureCredits;

    console.log(`Compare request ${requestId}:`, {
      userId,
      model1: model1Config.displayName,
      model2: model2Config.displayName,
      estimatedTokens,
      creditsPerModel: chatCreditsPerModel,
      compareCredits: compareFeatureCredits,
      totalRequired: totalCreditsRequired,
    });

    // Check if user has sufficient credits
    const creditCheck = await CreditManager.checkCredits(userId, {
      modelId: model1,
      tokens: estimatedTokens,
      operation: 'compare',
    });

    if (!creditCheck.canAfford) {
      return NextResponse.json(
        {
          error: 'Insufficient credits',
          details: {
            creditsRequired: totalCreditsRequired,
            currentBalance: creditCheck.currentBalance,
            message: `You need ${totalCreditsRequired} credits for comparison (${chatCreditsPerModel} × 2 models + ${compareFeatureCredits} compare fee) but only have ${creditCheck.currentBalance}`,
          },
        },
        { status: 402 }
      );
    }

    // Call both models in parallel
    console.log(`Starting parallel model calls for ${requestId}`);
    const startTime = Date.now();

    const promises = [
      callModel(model1, messages, requestId),
      callModel(model2, messages, requestId),
    ];

    let results;
    try {
      results = await Promise.all(promises);
    } catch (error) {
      console.error(`Model call failed for ${requestId}:`, error);
      return NextResponse.json(
        {
          error: 'Model comparison failed',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }

    const endTime = Date.now();
    const processingTime = endTime - startTime;

    const [model1Result, model2Result] = results;
    const totalTokensUsed = model1Result.tokensUsed + model2Result.tokensUsed;

    console.log(`Model calls completed for ${requestId}:`, {
      model1Tokens: model1Result.tokensUsed,
      model2Tokens: model2Result.tokensUsed,
      totalTokens: totalTokensUsed,
      processingTime,
    });

    // Deduct credits
    const deductResult = await CreditManager.deductCredits(
      userId,
      totalCreditsRequired,
      `Model comparison - ${model1Config.displayName} vs ${model2Config.displayName}`,
      requestId
    );

    if (!deductResult.success) {
      console.error(`Failed to deduct credits for ${requestId}:`, deductResult.error);
      // Don't fail the response, but log for manual review
    }

    // Log usage for each model
    await CreditManager.logUsage(userId, model1, chatCreditsPerModel, {
      type: 'chat_comparison',
      model: model1Config.displayName,
      provider: model1Config.provider,
      tokens: model1Result.tokensUsed,
      prompt: prompt.substring(0, 100),
      requestId,
      comparisonId: requestId,
    });

    await CreditManager.logUsage(userId, model2, chatCreditsPerModel, {
      type: 'chat_comparison',
      model: model2Config.displayName,
      provider: model2Config.provider,
      tokens: model2Result.tokensUsed,
      prompt: prompt.substring(0, 100),
      requestId,
      comparisonId: requestId,
    });

    // Log compare feature usage
    await CreditManager.logUsage(userId, 'system', compareFeatureCredits, {
      type: 'compare_feature',
      model1: model1Config.displayName,
      model2: model2Config.displayName,
      requestId,
    });

    // Prepare comparison response
    const comparisonData: CompareResponse = {
      model1_response: model1Result.response,
      model2_response: model2Result.response,
      credits_used: totalCreditsRequired,
      processing_time: processingTime,
      metadata: {
        requestId,
        userId,
        model1: {
          id: model1Result.modelId,
          displayName: model1Result.modelDisplayName,
          provider: model1Result.provider,
          tokens: model1Result.tokensUsed,
        },
        model2: {
          id: model2Result.modelId,
          displayName: model2Result.modelDisplayName,
          provider: model2Result.provider,
          tokens: model2Result.tokensUsed,
        },
        prompt: prompt,
        totalTokens: totalTokensUsed,
        estimatedCredits: totalCreditsRequired,
        actualCredits: totalCreditsRequired,
        remainingCredits: creditCheck.currentBalance - totalCreditsRequired,
      },
    };

    return NextResponse.json({
      success: true,
      data: comparisonData,
    });

  } catch (error) {
    console.error(`Compare API error for ${requestId}:`, error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        requestId,
      },
      { status: 500 }
    );
  }
}

/**
 * Get available models for comparison
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

    // Get user's plan
    const userCredits = await CreditManager.getUserCredits(userId);
    const planName = userCredits?.plans?.name || 'free';

    // Check if user has access to compare feature
    if (planName === 'free') {
      return NextResponse.json(
        {
          success: true,
          data: {
            models: [],
            canCompare: false,
            message: 'Compare feature is only available for Professional and Enterprise plans',
            upgradeUrl: '/pricing',
          },
        }
      );
    }

    // Get available chat models
    const response = await fetch(`${request.nextUrl.origin}/api/chat`, {
      headers: {
        Cookie: request.headers.get('Cookie') || '',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch models' },
        { status: 500 }
      );
    }

    const modelsData = await response.json();

    return NextResponse.json({
      success: true,
      data: {
        models: modelsData.data?.models || [],
        canCompare: true,
        userPlan: planName,
        compareCost: CREDIT_COSTS.COMPARE_FEATURE,
        creditCostPerModel: '1 credit per 1K tokens',
      },
    });

  } catch (error) {
    console.error('Error fetching comparison models:', error);
    return NextResponse.json(
      { error: 'Failed to fetch models' },
      { status: 500 }
    );
  }
}

/**
 * Validate compare request
 */
function validateCompareRequest(request: CompareRequest): { valid: boolean; error?: string } {
  if (!request.model1 || !request.model2) {
    return { valid: false, error: 'Both model1 and model2 are required' };
  }

  if (request.model1 === request.model2) {
    return { valid: false, error: 'Models must be different for comparison' };
  }

  if (!request.prompt || typeof request.prompt !== 'string') {
    return { valid: false, error: 'Prompt is required and must be a string' };
  }

  if (request.prompt.length < 10) {
    return { valid: false, error: 'Prompt must be at least 10 characters long' };
  }

  if (request.prompt.length > 2000) {
    return { valid: false, error: 'Prompt must be less than 2000 characters' };
  }

  if (request.parameters?.temperature && (request.parameters.temperature < 0 || request.parameters.temperature > 2)) {
    return { valid: false, error: 'Temperature must be between 0 and 2' };
  }

  if (request.parameters?.max_tokens && (request.parameters.max_tokens < 1 || request.parameters.max_tokens > 8000)) {
    return { valid: false, error: 'Max tokens must be between 1 and 8000' };
  }

  return { valid: true };
}

/**
 * Get comparison statistics
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

    // Get comparison usage logs
    const usageLogs = await CreditManager.getUsageLogs(userId, 100, 0);
    const comparisonLogs = usageLogs.filter(log =>
      log.request_data.type === 'chat_comparison' ||
      log.request_data.type === 'compare_feature'
    );

    // Calculate statistics
    const totalComparisons = new Set(
      comparisonLogs
        .filter(log => log.request_data.type === 'compare_feature')
        .map(log => log.request_data.requestId)
    ).size;

    const totalCreditsUsed = comparisonLogs.reduce((sum, log) => sum + log.credits_used, 0);

    const modelComparisonCount = comparisonLogs
      .filter(log => log.request_data.type === 'chat_comparison')
      .reduce((acc, log) => {
        const model = log.model?.display_name || 'Unknown';
        acc[model] = (acc[model] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const recentComparisons = comparisonLogs
      .filter(log => log.request_data.type === 'compare_feature')
      .slice(0, 10)
      .map(log => ({
        requestId: log.request_data.requestId,
        model1: log.request_data.model1,
        model2: log.request_data.model2,
        creditsUsed: log.credits_used,
        createdAt: log.created_at,
      }));

    return NextResponse.json({
      success: true,
      data: {
        totalComparisons,
        totalCreditsUsed,
        modelComparisonCount,
        recentComparisons,
      },
    });

  } catch (error) {
    console.error('Error fetching comparison statistics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}