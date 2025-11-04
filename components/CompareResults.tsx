'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Play, Copy, Check, RefreshCw, Settings, Sparkles, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useSubscription } from '@/hooks/useSubscription';
import { getModelsByProvider, filterModelsByPlan } from '@/utils/models';

interface CompareRequest {
  model1: string;
  model2: string;
  prompt: string;
  parameters?: {
    temperature?: number;
    max_tokens?: number;
  };
}

interface CompareResponse {
  model1_response: any;
  model2_response: any;
  credits_used: number;
  processing_time: number;
  metadata: {
    model1: {
      id: string;
      displayName: string;
      provider: string;
      tokens: number;
    };
    model2: {
      id: string;
      displayName: string;
      provider: string;
      tokens: number;
    };
    totalTokens: number;
    remainingCredits: number;
  };
}

interface ComparisonState {
  isLoading: boolean;
  result: CompareResponse | null;
  error: string | null;
}

const examplePrompts = [
  "Explain quantum computing in simple terms",
  "Write a short story about a robot discovering emotions",
  "Create a marketing slogan for a sustainable coffee brand",
  "Explain the difference between AI and machine learning",
  "Write a Python function to calculate fibonacci numbers",
];

export function CompareResults() {
  const [selectedModel1, setSelectedModel1] = useState('');
  const [selectedModel2, setSelectedModel2] = useState('');
  const [prompt, setPrompt] = useState('');
  const [comparison, setComparison] = useState<ComparisonState>({
    isLoading: false,
    result: null,
    error: null,
  });
  const [copiedModel, setCopiedModel] = useState<'model1' | 'model2' | null>(null);

  const { toast } = useToast();
  const { userPlan, userCredits, canAccessFeature } = useSubscription();

  // Fetch available models
  const { data: modelsData, isLoading: modelsLoading } = useQuery({
    queryKey: ['compare-models'],
    queryFn: async () => {
      const response = await fetch('/api/compare');
      if (!response.ok) {
        const error = await response.json();
        if (error.error === 'Compare feature not available') {
          throw new Error('upgrade_required');
        }
        throw new Error('Failed to fetch models');
      }
      const data = await response.json();
      return data.data;
    },
    retry: false,
  });

  const availableModels = modelsData?.models || [];
  const canCompare = modelsData?.canCompare && canAccessFeature('compare');

  // Handle model comparison
  const runComparison = async () => {
    if (!selectedModel1 || !selectedModel2 || !prompt.trim()) {
      toast({
        title: 'Missing information',
        description: 'Please select two models and enter a prompt',
        variant: 'destructive',
      });
      return;
    }

    if (selectedModel1 === selectedModel2) {
      toast({
        title: 'Same models selected',
        description: 'Please select two different models to compare',
        variant: 'destructive',
      });
      return;
    }

    setComparison({ isLoading: true, result: null, error: null });

    try {
      const request: CompareRequest = {
        model1: selectedModel1,
        model2: selectedModel2,
        prompt: prompt.trim(),
        parameters: {
          temperature: 0.7,
          max_tokens: 2048,
        },
      };

      const response = await fetch('/api/compare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Comparison failed');
      }

      const data = await response.json();
      setComparison({
        isLoading: false,
        result: data.data,
        error: null,
      });

      toast({
        title: 'Comparison completed',
        description: `Used ${data.data.credits_used} credits`,
      });

    } catch (error: any) {
      setComparison({
        isLoading: false,
        result: null,
        error: error.message || 'Comparison failed',
      });

      if (error.message === 'upgrade_required') {
        toast({
          title: 'Upgrade required',
          description: 'Compare feature is only available for Professional and Enterprise plans',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Comparison failed',
          description: error.message || 'Failed to run comparison',
          variant: 'destructive',
        });
      }
    }
  };

  // Copy response content
  const copyResponse = async (content: string, model: 'model1' | 'model2') => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedModel(model);
      setTimeout(() => setCopiedModel(null), 2000);
      toast({
        title: 'Response copied',
        description: 'The response has been copied to your clipboard.',
      });
    } catch (error) {
      toast({
        title: 'Copy failed',
        description: 'Failed to copy response to clipboard.',
        variant: 'destructive',
      });
    }
  };

  // Get model details
  const model1Data = availableModels.find(m => m.id === selectedModel1);
  const model2Data = availableModels.find(m => m.id === selectedModel2);

  // Show upgrade prompt if user can't access feature
  if (!canCompare && userPlan === 'free') {
    return (
      <div className="flex h-full items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
        <Card className="w-full max-w-md bg-white/60 backdrop-blur-lg border-white/30">
          <CardHeader className="text-center">
            <TrendingUp className="h-12 w-12 text-purple-600 mx-auto mb-4" />
            <CardTitle>Upgrade to Compare Models</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600">
              The model comparison feature is only available for Professional and Enterprise plans.
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-center space-x-2">
                <Badge variant="secondary">Professional</Badge>
                <span>Side-by-side model comparison</span>
              </div>
              <div className="flex items-center justify-center space-x-2">
                <Badge variant="secondary">Enterprise</Badge>
                <span>Advanced comparison features</span>
              </div>
            </div>
            <Button asChild className="w-full bg-purple-600 hover:bg-purple-700">
              <a href="/pricing">Upgrade Plan</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="border-b border-white/20 bg-white/30 backdrop-blur-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <TrendingUp className="h-5 w-5 text-purple-600" />
              <h2 className="text-lg font-semibold text-gray-900">Model Comparison</h2>
              {userCredits && (
                <Badge variant="outline" className="bg-white/50 text-gray-700 border-white/30">
                  {userCredits.balance} credits
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Comparison Setup */}
        <div className="p-6 bg-white/20 backdrop-blur-sm">
          <Card className="bg-white/60 backdrop-blur-lg border-white/30">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Sparkles className="h-5 w-5" />
                <span>Compare AI Models</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Model Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Model
                  </label>
                  <Select value={selectedModel1} onValueChange={setSelectedModel1}>
                    <SelectTrigger className="bg-white/50 border-white/30">
                      <SelectValue placeholder="Select first model" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableModels.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          <div className="flex items-center space-x-2">
                            <span>{model.displayName}</span>
                            <Badge variant="outline" className="text-xs">
                              {model.provider}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {model1Data && (
                    <p className="text-xs text-gray-600 mt-1">
                      {model1Data.description}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Second Model
                  </label>
                  <Select value={selectedModel2} onValueChange={setSelectedModel2}>
                    <SelectTrigger className="bg-white/50 border-white/30">
                      <SelectValue placeholder="Select second model" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableModels
                        .filter(m => m.id !== selectedModel1)
                        .map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            <div className="flex items-center space-x-2">
                              <span>{model.displayName}</span>
                              <Badge variant="outline" className="text-xs">
                                {model.provider}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {model2Data && (
                    <p className="text-xs text-gray-600 mt-1">
                      {model2Data.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Prompt Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prompt
                </label>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Enter a prompt to compare how different models respond..."
                  className="min-h-[100px] bg-white/50 border-white/30"
                />
              </div>

              {/* Example Prompts */}
              <div>
                <p className="text-sm text-gray-600 mb-2">Example prompts:</p>
                <div className="flex flex-wrap gap-2">
                  {examplePrompts.map((examplePrompt, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => setPrompt(examplePrompt)}
                      className="bg-white/50 border-white/30 hover:bg-white/70 text-xs"
                    >
                      {examplePrompt.substring(0, 30)}...
                    </Button>
                  ))}
                </div>
              </div>

              {/* Compare Button */}
              <Button
                onClick={runComparison}
                disabled={!selectedModel1 || !selectedModel2 || !prompt.trim() || comparison.isLoading}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                {comparison.isLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    Comparing Models...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Start Comparison
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Comparison Results */}
        {comparison.error && (
          <div className="p-6">
            <Alert className="bg-red-50 border-red-200">
              <AlertDescription className="text-red-800">
                {comparison.error}
              </AlertDescription>
            </Alert>
          </div>
        )}

        {comparison.result && (
          <div className="flex-1 p-6">
            {/* Results Header */}
            <Card className="mb-4 bg-white/60 backdrop-blur-lg border-white/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      Comparison Complete
                    </Badge>
                    <span className="text-sm text-gray-600">
                      {comparison.result.metadata.totalTokens} total tokens
                    </span>
                    <span className="text-sm text-gray-600">
                      {comparison.result.processing_time}ms processing time
                    </span>
                  </div>
                  <Badge variant="outline" className="bg-purple-100 text-purple-800">
                    {comparison.result.credits_used} credits used
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Model Responses */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Model 1 Response */}
              <Card className="bg-white/60 backdrop-blur-lg border-white/30">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">
                        {comparison.result.metadata.model1.displayName}
                      </CardTitle>
                      <p className="text-sm text-gray-600">
                        {comparison.result.metadata.model1.provider} • {comparison.result.metadata.model1.tokens} tokens
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyResponse(
                        comparison.result!.model1_response.choices?.[0]?.message?.content || '',
                        'model1'
                      )}
                      className="bg-white/50 hover:bg-white/70"
                    >
                      {copiedModel === 'model1' ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="prose prose-sm max-w-none">
                      {comparison.result.model1_response.choices?.[0]?.message?.content}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Model 2 Response */}
              <Card className="bg-white/60 backdrop-blur-lg border-white/30">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">
                        {comparison.result.metadata.model2.displayName}
                      </CardTitle>
                      <p className="text-sm text-gray-600">
                        {comparison.result.metadata.model2.provider} • {comparison.result.metadata.model2.tokens} tokens
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyResponse(
                        comparison.result!.model2_response.choices?.[0]?.message?.content || '',
                        'model2'
                      )}
                      className="bg-white/50 hover:bg-white/70"
                    >
                      {copiedModel === 'model2' ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="prose prose-sm max-w-none">
                      {comparison.result.model2_response.choices?.[0]?.message?.content}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}