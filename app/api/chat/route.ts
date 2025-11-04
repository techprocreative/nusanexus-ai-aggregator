import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { CreditManager } from '@/utils/creditManager';
import { getModelById, getModelsByProvider } from '@/utils/models';
import { ChatRequest, ChatResponse, CreditError } from '@/types/credits';
import { validateCreditRequest, formatCreditError } from '@/utils/creditManager';

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
  together: {
    baseUrl: 'https://api.together.xyz/v1',
    apiKey: process.env.TOGETHER_API_KEY,
    headers: {},
  },
} as const;

/**
 * Handle chat completion requests
 */
export async function POST(request: NextRequest) {
  let userId: string | null = null;
  let requestId: string = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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
    const body: ChatRequest = await request.json();
    const { model, messages, stream = false, ...parameters } = body;

    if (!model || !messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Model and messages are required' },
        { status: 400 }
      );
    }

    // Get model configuration
    const modelConfig = getModelById(model);
    if (!modelConfig) {
      return NextResponse.json(
        { error: 'Invalid model specified' },
        { status: 400 }
      );
    }

    if (modelConfig.modelType !== 'chat') {
      return NextResponse.json(
        { error: 'Specified model is not a chat model' },
        { status: 400 }
      );
    }

    const provider = PROVIDER_CONFIGS[modelConfig.provider];
    if (!provider.apiKey) {
      console.error(`API key not configured for provider: ${modelConfig.provider}`);
      return NextResponse.json(
        { error: 'Provider configuration error' },
        { status: 500 }
      );
    }

    // Estimate token count for credit calculation
    const estimatedTokens = estimateTokenCount(messages);
    const creditCheck = await CreditManager.checkCredits(userId, {
      modelId: modelConfig.id,
      tokens: estimatedTokens,
      operation: 'chat',
    });

    if (!creditCheck.canAfford) {
      return NextResponse.json(
        {
          error: 'Insufficient credits',
          details: {
            creditsRequired: creditCheck.creditsRequired,
            currentBalance: creditCheck.currentBalance,
            message: `You need ${creditCheck.creditsRequired} credits but only have ${creditCheck.currentBalance}`,
          },
        },
        { status: 402 } // Payment Required
      );
    }

    // Prepare provider request
    const providerRequest = {
      model: modelConfig.modelName,
      messages,
      stream,
      temperature: parameters.temperature || 0.7,
      max_tokens: parameters.max_tokens || 2048,
      top_p: parameters.top_p || 1,
      frequency_penalty: parameters.frequency_penalty || 0,
      presence_penalty: parameters.presence_penalty || 0,
      ...(modelConfig.provider === 'openrouter' && {
        // OpenRouter specific parameters
        models: [modelConfig.modelName],
        route: 'fallback',
      }),
    };

    console.log(`Processing chat request: ${requestId}`, {
      userId,
      model: modelConfig.displayName,
      provider: modelConfig.provider,
      estimatedTokens,
      creditsRequired: creditCheck.creditsRequired,
      stream,
    });

    // Handle streaming response
    if (stream) {
      return handleStreamingResponse(
        providerRequest,
        provider,
        userId,
        requestId,
        modelConfig,
        creditCheck.creditsRequired
      );
    }

    // Handle non-streaming response
    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
        ...provider.headers,
      },
      body: JSON.stringify(providerRequest),
    });

    if (!response.ok) {
      console.error(`Provider error for ${requestId}:`, response.status, await response.text());
      return NextResponse.json(
        { error: 'AI provider error', status: response.status },
        { status: response.status }
      );
    }

    const data: ChatResponse = await response.json();
    const actualTokens = data.usage?.total_tokens || estimatedTokens;
    const actualCreditsNeeded = Math.ceil((actualTokens / 1000) * 1); // 1 credit per 1K tokens

    console.log(`Chat response received: ${requestId}`, {
      actualTokens,
      estimatedTokens,
      actualCreditsNeeded,
      creditsDeducted: creditCheck.creditsRequired,
    });

    // Deduct credits (use estimated credits to avoid undercharging)
    const deductResult = await CreditManager.deductCredits(
      userId,
      creditCheck.creditsRequired,
      `Chat completion - ${modelConfig.displayName}`,
      requestId
    );

    if (!deductResult.success) {
      console.error(`Failed to deduct credits for ${requestId}:`, deductResult.error);
      // Don't fail the response, but log for manual review
    }

    // Log usage
    await CreditManager.logUsage(userId, modelConfig.id, creditCheck.creditsRequired, {
      type: 'chat',
      model: modelConfig.displayName,
      provider: modelConfig.provider,
      tokens: actualTokens,
      messages: messages.map(m => ({ role: m.role, length: m.content.length })),
      requestId,
    });

    // Return response with credit info
    return NextResponse.json({
      ...data,
      _credits: {
        used: creditCheck.creditsRequired,
        remaining: creditCheck.currentBalance - creditCheck.creditsRequired,
        tokens: actualTokens,
      },
    });

  } catch (error) {
    console.error(`Chat API error for ${requestId}:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Handle streaming chat responses
 */
async function handleStreamingResponse(
  providerRequest: any,
  provider: any,
  userId: string,
  requestId: string,
  modelConfig: any,
  creditsRequired: number
) {
  try {
    // Deduct credits upfront for streaming
    const deductResult = await CreditManager.deductCredits(
      userId,
      creditsRequired,
      `Chat completion (streaming) - ${modelConfig.displayName}`,
      requestId
    );

    if (!deductResult.success) {
      return NextResponse.json(
        { error: 'Failed to process payment for streaming request' },
        { status: 402 }
      );
    }

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
        ...provider.headers,
      },
      body: JSON.stringify({ ...providerRequest, stream: true }),
    });

    if (!response.ok) {
      // Refund credits on error
      await CreditManager.refundCredits(
        userId,
        creditsRequired,
        `Streaming error refund - ${modelConfig.displayName}`,
        requestId
      );

      return NextResponse.json(
        { error: 'AI provider error', status: response.status },
        { status: response.status }
      );
    }

    // Create a readable stream
    const reader = response.body?.getReader();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    if (!reader) {
      return NextResponse.json(
        { error: 'Stream not available' },
        { status: 500 }
      );
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          let buffer = '';
          let totalTokens = 0;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.trim() === '') continue;
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;

                try {
                  const parsed = JSON.parse(data);
                  totalTokens = parsed.usage?.total_tokens || totalTokens;

                  // Forward the chunk to client
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                } catch (parseError) {
                  console.error('Error parsing streaming chunk:', parseError);
                }
              }
            }
          }

          // Send final chunk with credit info
          const finalChunk = {
            _credits: {
              used: creditsRequired,
              tokens: totalTokens,
              requestId,
            },
          };

          controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalChunk)}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();

          // Log usage after stream completes
          await CreditManager.logUsage(userId, modelConfig.id, creditsRequired, {
            type: 'chat_streaming',
            model: modelConfig.displayName,
            provider: modelConfig.provider,
            tokens: totalTokens,
            requestId,
          });

        } catch (error) {
          console.error(`Streaming error for ${requestId}:`, error);

          // Refund credits on streaming error
          await CreditManager.refundCredits(
            userId,
            creditsRequired,
            `Streaming error refund - ${modelConfig.displayName}`,
            requestId
          );

          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error(`Error setting up stream for ${requestId}:`, error);
    return NextResponse.json(
      { error: 'Failed to setup streaming' },
      { status: 500 }
    );
  }
}

/**
 * Get available models
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
    const type = searchParams.get('type') as 'chat' | 'image' | 'video';

    // Get user's plan to filter models
    const userCredits = await CreditManager.getUserCredits(userId);
    const planName = userCredits?.plans?.name || 'free';

    let models;
    if (type) {
      models = getModelsByProvider('openrouter').filter(m => m.modelType === type);
    } else {
      models = getModelsByProvider('openrouter').filter(m => m.modelType === 'chat');
    }

    // Filter models by plan
    const availableModels = models.filter(model => {
      if (planName === 'free') {
        return model.isFree;
      }
      return model.isActive;
    });

    return NextResponse.json({
      success: true,
      data: {
        models: availableModels.map(model => ({
          id: model.id,
          displayName: model.displayName,
          provider: model.provider,
          modelType: model.modelType,
          description: model.description,
          maxTokens: model.maxTokens,
          isFree: model.isFree,
          costPerCredit: model.costPerCredit,
        })),
        userPlan: planName,
        totalModels: availableModels.length,
      },
    });

  } catch (error) {
    console.error('Error fetching models:', error);
    return NextResponse.json(
      { error: 'Failed to fetch models' },
      { status: 500 }
    );
  }
}

/**
 * Estimate token count for messages
 * This is a rough estimation - in production you might want to use a proper tokenizer
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
 * Validate chat request
 */
function validateChatRequest(body: any): { valid: boolean; error?: string } {
  if (!body.model) {
    return { valid: false, error: 'Model is required' };
  }

  if (!body.messages || !Array.isArray(body.messages)) {
    return { valid: false, error: 'Messages must be an array' };
  }

  if (body.messages.length === 0) {
    return { valid: false, error: 'At least one message is required' };
  }

  for (const message of body.messages) {
    if (!message.role || !message.content) {
      return { valid: false, error: 'Each message must have role and content' };
    }

    if (!['system', 'user', 'assistant'].includes(message.role)) {
      return { valid: false, error: 'Invalid message role' };
    }
  }

  if (body.temperature !== undefined && (body.temperature < 0 || body.temperature > 2)) {
    return { valid: false, error: 'Temperature must be between 0 and 2' };
  }

  if (body.max_tokens !== undefined && (body.max_tokens < 1 || body.max_tokens > 32000)) {
    return { valid: false, error: 'Max tokens must be between 1 and 32000' };
  }

  return { valid: true };
}