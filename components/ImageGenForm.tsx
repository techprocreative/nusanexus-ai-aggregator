'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Image as ImageIcon, Download, Copy, Settings, Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useSubscription } from '@/hooks/useSubscription';
import { CREDIT_COSTS } from '@/app/config/plans';

interface ImageGenRequest {
  model: string;
  prompt: string;
  width?: number;
  height?: number;
  steps?: number;
  seed?: number;
  negative_prompt?: string;
  style?: string;
}

interface ImageGenResponse {
  images: Array<{
    url: string;
    b64_json?: string;
  }>;
  created: number;
  _credits: {
    used: number;
    remaining: number;
  };
}

const examplePrompts = [
  "A majestic dragon perched on a crystal mountain at sunset, digital art",
  "A cozy coffee shop with warm lighting, people reading books, watercolor style",
  "Futuristic city with flying cars, neon lights, cyberpunk aesthetic",
  "A serene Japanese garden with cherry blossoms, traditional architecture",
  "Abstract geometric patterns with vibrant colors, modern art style",
];

const aspectRatios = [
  { label: 'Square (1:1)', width: 1024, height: 1024 },
  { label: 'Portrait (3:4)', width: 768, height: 1024 },
  { label: 'Landscape (4:3)', width: 1024, height: 768 },
  { label: 'Wide (16:9)', width: 1024, height: 576 },
];

const stylePresets = [
  { label: 'Realistic', value: 'realistic' },
  { label: 'Digital Art', value: 'digital-art' },
  { label: 'Oil Painting', value: 'oil-painting' },
  { label: 'Watercolor', value: 'watercolor' },
  { label: 'Anime', value: 'anime' },
  { label: '3D Render', value: '3d-render' },
];

export function ImageGenForm() {
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1024x1024');
  const [steps, setSteps] = useState(20);
  const [seed, setSeed] = useState<number | undefined>();
  const [style, setStyle] = useState('realistic');
  const [generatedImages, setGeneratedImages] = useState<ImageGenResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const { toast } = useToast();
  const { userPlan, userCredits, canAccessFeature } = useSubscription();

  // Fetch available models
  const { data: modelsData, isLoading: modelsLoading } = useQuery({
    queryKey: ['image-models'],
    queryFn: async () => {
      const response = await fetch('/api/media/generate?type=image');
      if (!response.ok) throw new Error('Failed to fetch models');
      const data = await response.json();
      return data.data;
    },
  });

  const availableModels = modelsData?.models?.image || [];
  const creditCosts = modelsData?.creditCosts?.image || {};

  // Get current aspect ratio dimensions
  const [width, height] = aspectRatio.split('x').map(Number);

  // Calculate credits needed
  const selectedModelCost = creditCosts[selectedModel] || 0;
  const creditsNeeded = selectedModelCost;

  // Generate image
  const generateImage = async () => {
    if (!prompt.trim() || !selectedModel) {
      toast({
        title: 'Missing information',
        description: 'Please enter a prompt and select a model',
        variant: 'destructive',
      });
      return;
    }

    if (creditsNeeded > (userCredits?.balance || 0)) {
      toast({
        title: 'Insufficient credits',
        description: `You need ${creditsNeeded} credits but only have ${userCredits?.balance || 0}`,
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    setGeneratedImages(null);

    try {
      const request: ImageGenRequest = {
        model: selectedModel,
        prompt: prompt.trim(),
        width,
        height,
        steps,
        seed,
        negative_prompt: negativePrompt.trim() || undefined,
        style,
      };

      const response = await fetch('/api/media/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'image',
          ...request,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Image generation failed');
      }

      const data = await response.json();
      setGeneratedImages(data);

      toast({
        title: 'Image generated successfully',
        description: `Used ${data._credits.used} credits`,
      });

    } catch (error: any) {
      toast({
        title: 'Generation failed',
        description: error.message || 'Failed to generate image',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Download image
  const downloadImage = async (imageUrl: string, index: number) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `generated-image-${Date.now()}-${index + 1}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Image downloaded',
        description: 'The image has been downloaded to your device.',
      });
    } catch (error) {
      toast({
        title: 'Download failed',
        description: 'Failed to download the image.',
        variant: 'destructive',
      });
    }
  };

  // Copy image URL
  const copyImageUrl = async (imageUrl: string) => {
    try {
      await navigator.clipboard.writeText(imageUrl);
      toast({
        title: 'URL copied',
        description: 'Image URL has been copied to clipboard.',
      });
    } catch (error) {
      toast({
        title: 'Copy failed',
        description: 'Failed to copy image URL.',
        variant: 'destructive',
      });
    }
  };

  // Generate random seed
  const generateRandomSeed = () => {
    setSeed(Math.floor(Math.random() * 1000000));
  };

  // Check if user can access image generation
  if (!canAccessFeature('image_generation')) {
    return (
      <div className="flex h-full items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
        <Card className="w-full max-w-md bg-white/60 backdrop-blur-lg border-white/30">
          <CardHeader className="text-center">
            <ImageIcon className="h-12 w-12 text-purple-600 mx-auto mb-4" />
            <CardTitle>Upgrade to Generate Images</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600">
              Image generation is only available for Professional and Enterprise plans.
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-center space-x-2">
                <Badge variant="secondary">Professional</Badge>
                <span>Image generation</span>
              </div>
              <div className="flex items-center justify-center space-x-2">
                <Badge variant="secondary">Enterprise</Badge>
                <span>Advanced image generation</span>
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
              <ImageIcon className="h-5 w-5 text-purple-600" />
              <h2 className="text-lg font-semibold text-gray-900">Image Generation</h2>
              {userCredits && (
                <Badge variant="outline" className="bg-white/50 text-gray-700 border-white/30">
                  {userCredits.balance} credits
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 flex">
          {/* Left Panel - Controls */}
          <div className="w-96 border-r border-white/20 bg-white/20 backdrop-blur-sm p-6 overflow-y-auto">
            <Card className="bg-white/60 backdrop-blur-lg border-white/30">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Sparkles className="h-5 w-5" />
                  <span>Create Image</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Model Selection */}
                <div>
                  <Label className="block text-sm font-medium text-gray-700 mb-2">
                    Model
                  </Label>
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger className="bg-white/50 border-white/30">
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableModels.map((model: any) => (
                        <SelectItem key={model.id} value={model.id}>
                          <div className="flex items-center justify-between w-full">
                            <span>{model.displayName}</span>
                            <Badge variant="outline" className="text-xs">
                              {creditCosts[model.id] || 0} credits
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Prompt */}
                <div>
                  <Label className="block text-sm font-medium text-gray-700 mb-2">
                    Prompt
                  </Label>
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe the image you want to generate..."
                    className="min-h-[100px] bg-white/50 border-white/30"
                  />
                </div>

                {/* Example Prompts */}
                <div>
                  <Label className="block text-sm font-medium text-gray-700 mb-2">
                    Examples
                  </Label>
                  <div className="space-y-1">
                    {examplePrompts.map((examplePrompt, index) => (
                      <Button
                        key={index}
                        variant="ghost"
                        size="sm"
                        onClick={() => setPrompt(examplePrompt)}
                        className="w-full justify-start text-left h-auto p-2 bg-white/30 hover:bg-white/50"
                      >
                        <span className="text-xs truncate">{examplePrompt}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Advanced Settings */}
                <div className="space-y-3">
                  <Label className="block text-sm font-medium text-gray-700">
                    Advanced Settings
                  </Label>

                  {/* Aspect Ratio */}
                  <div>
                    <Label className="text-xs text-gray-600">Aspect Ratio</Label>
                    <Select value={aspectRatio} onValueChange={setAspectRatio}>
                      <SelectTrigger className="bg-white/50 border-white/30 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {aspectRatios.map((ratio) => (
                          <SelectItem key={`${ratio.width}x${ratio.height}`} value={`${ratio.width}x${ratio.height}`}>
                            {ratio.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Style */}
                  <div>
                    <Label className="text-xs text-gray-600">Style</Label>
                    <Select value={style} onValueChange={setStyle}>
                      <SelectTrigger className="bg-white/50 border-white/30 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {stylePresets.map((preset) => (
                          <SelectItem key={preset.value} value={preset.value}>
                            {preset.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Steps */}
                  <div>
                    <Label className="text-xs text-gray-600">Steps: {steps}</Label>
                    <Slider
                      value={[steps]}
                      onValueChange={(value) => setSteps(value[0])}
                      max={50}
                      min={1}
                      step={1}
                      className="mt-1"
                    />
                  </div>

                  {/* Seed */}
                  <div>
                    <Label className="text-xs text-gray-600">Seed (optional)</Label>
                    <div className="flex space-x-2">
                      <Input
                        type="number"
                        value={seed || ''}
                        onChange={(e) => setSeed(e.target.value ? parseInt(e.target.value) : undefined)}
                        placeholder="Random"
                        className="bg-white/50 border-white/30"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={generateRandomSeed}
                        className="bg-white/50 hover:bg-white/70"
                      >
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Negative Prompt */}
                  <div>
                    <Label className="text-xs text-gray-600">Negative Prompt (optional)</Label>
                    <Textarea
                      value={negativePrompt}
                      onChange={(e) => setNegativePrompt(e.target.value)}
                      placeholder="What you don't want in the image..."
                      className="min-h-[60px] bg-white/50 border-white/30 text-sm"
                    />
                  </div>
                </div>

                {/* Credits Info */}
                {creditsNeeded > 0 && (
                  <Alert className="bg-blue-50 border-blue-200">
                    <AlertDescription className="text-blue-800">
                      This will use <strong>{creditsNeeded}</strong> credits.
                      {userCredits && (
                        <span> You have {userCredits.balance} credits available.</span>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Generate Button */}
                <Button
                  onClick={generateImage}
                  disabled={!prompt.trim() || !selectedModel || isGenerating || creditsNeeded > (userCredits?.balance || 0)}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Image
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Results */}
          <div className="flex-1 p-6 overflow-y-auto">
            {isGenerating && (
              <div className="flex items-center justify-center h-full">
                <Card className="bg-white/60 backdrop-blur-lg border-white/30 p-8">
                  <div className="text-center space-y-4">
                    <Loader2 className="h-12 w-12 animate-spin text-purple-600 mx-auto" />
                    <h3 className="text-lg font-medium text-gray-900">
                      Generating Your Image...
                    </h3>
                    <p className="text-gray-600">
                      This may take a few moments. Please be patient.
                    </p>
                  </div>
                </Card>
              </div>
            )}

            {!isGenerating && !generatedImages && (
              <div className="flex items-center justify-center h-full">
                <Card className="bg-white/60 backdrop-blur-lg border-white/30 p-8">
                  <div className="text-center space-y-4">
                    <ImageIcon className="h-12 w-12 text-purple-600 mx-auto" />
                    <h3 className="text-lg font-medium text-gray-900">
                      Ready to Create
                    </h3>
                    <p className="text-gray-600 max-w-md">
                      Enter a prompt and select a model to start generating amazing images with AI.
                    </p>
                  </div>
                </Card>
              </div>
            )}

            {generatedImages && (
              <div className="space-y-4">
                {/* Results Header */}
                <Card className="bg-white/60 backdrop-blur-lg border-white/30">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          Generation Complete
                        </Badge>
                        <span className="text-sm text-gray-600">
                          {generatedImages.images.length} image{generatedImages.images.length > 1 ? 's' : ''} generated
                        </span>
                      </div>
                      <Badge variant="outline" className="bg-purple-100 text-purple-800">
                        {generatedImages._credits.used} credits used
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Generated Images */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {generatedImages.images.map((image, index) => (
                    <Card key={index} className="bg-white/60 backdrop-blur-lg border-white/30">
                      <CardContent className="p-4">
                        <div className="space-y-4">
                          {/* Image */}
                          <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
                            <img
                              src={image.url}
                              alt={`Generated image ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </div>

                          {/* Actions */}
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => downloadImage(image.url, index)}
                              className="flex-1 bg-white/50 border-white/30 hover:bg-white/70"
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyImageUrl(image.url)}
                              className="bg-white/50 border-white/30 hover:bg-white/70"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}