'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Video as VideoIcon, Download, Copy, Settings, Sparkles, Loader2, RefreshCw, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useSubscription } from '@/hooks/useSubscription';
import { CREDIT_COSTS } from '@/app/config/plans';

interface VideoGenRequest {
  model: string;
  prompt: string;
  width?: number;
  height?: number;
  frames?: number;
  steps?: number;
  seed?: number;
}

interface VideoGenResponse {
  videos: Array<{
    url: string;
  }>;
  created: number;
  _credits: {
    used: number;
    remaining: number;
  };
}

interface GenerationJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: VideoGenResponse;
  error?: string;
  startTime: Date;
}

const examplePrompts = [
  "A serene waterfall in a tropical rainforest, sunlight filtering through trees",
  "A futuristic city street at night with flying cars and neon signs",
  "A cat playing with a ball of yarn in a cozy living room",
  "Waves crashing on a sandy beach during sunset",
  "A robot assembling a device in a high-tech factory",
];

const aspectRatios = [
  { label: 'Square (1:1)', width: 1024, height: 1024 },
  { label: 'Portrait (9:16)', width: 576, height: 1024 },
  { label: 'Landscape (16:9)', width: 1024, height: 576 },
];

const frameOptions = [
  { label: 'Short (16 frames)', value: 16 },
  { label: 'Medium (48 frames)', value: 48 },
  { label: 'Long (96 frames)', value: 96 },
];

export function VideoGenForm() {
  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1024x576');
  const [frames, setFrames] = useState(48);
  const [steps, setSteps] = useState(20);
  const [seed, setSeed] = useState<number | undefined>();
  const [currentJob, setCurrentJob] = useState<GenerationJob | null>(null);
  const [completedJobs, setCompletedJobs] = useState<Array<GenerationJob & { result: VideoGenResponse }>>([]);

  const { toast } = useToast();
  const { userPlan, userCredits, canAccessFeature } = useSubscription();

  // Fetch available models
  const { data: modelsData, isLoading: modelsLoading } = useQuery({
    queryKey: ['video-models'],
    queryFn: async () => {
      const response = await fetch('/api/media/generate?type=video');
      if (!response.ok) throw new Error('Failed to fetch models');
      const data = await response.json();
      return data.data;
    },
  });

  const availableModels = modelsData?.models?.video || [];
  const creditCosts = modelsData?.creditCosts?.video || {};

  // Get current aspect ratio dimensions
  const [width, height] = aspectRatio.split('x').map(Number);

  // Calculate credits needed
  const selectedModelCost = creditCosts[selectedModel] || 0;
  const creditsNeeded = selectedModelCost;

  // Poll job status
  const pollJobStatus = async (jobId: string) => {
    try {
      const response = await fetch(`/api/media/generate?request_id=${jobId}`);
      if (!response.ok) throw new Error('Failed to check job status');

      const data = await response.json();

      if (data.success) {
        setCurrentJob(prev => {
          if (!prev || prev.id !== jobId) return prev;

          if (data.data.status === 'completed') {
            const completedJob = {
              ...prev,
              status: 'completed' as const,
              progress: 100,
              result: data.data,
            };

            // Move to completed jobs
            setCompletedJobs(jobs => [completedJob, ...jobs].slice(0, 10)); // Keep last 10 jobs

            toast({
              title: 'Video generated successfully',
              description: `Used ${data.data._credits.used} credits`,
            });

            return null;
          } else if (data.data.status === 'failed') {
            toast({
              title: 'Generation failed',
              description: 'Failed to generate video. Please try again.',
              variant: 'destructive',
            });
            return null;
          }

          return {
            ...prev,
            status: data.data.status,
            progress: Math.min(prev.progress + 10, 90), // Simulate progress
          };
        });
      }
    } catch (error) {
      console.error('Error polling job status:', error);
    }
  };

  // Start polling when job is created
  React.useEffect(() => {
    if (currentJob && currentJob.status === 'pending') {
      const interval = setInterval(() => {
        pollJobStatus(currentJob.id);
      }, 5000); // Poll every 5 seconds

      return () => clearInterval(interval);
    }
  }, [currentJob]);

  // Generate video
  const generateVideo = async () => {
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

    const jobId = `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    setCurrentJob({
      id: jobId,
      status: 'pending',
      progress: 0,
      startTime: new Date(),
    });

    try {
      const request: VideoGenRequest = {
        model: selectedModel,
        prompt: prompt.trim(),
        width,
        height,
        frames,
        steps,
        seed,
      };

      const response = await fetch('/api/media/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'video',
          ...request,
          requestId: jobId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Video generation failed');
      }

      const data = await response.json();

      // For immediate responses (some providers might be fast)
      if (data.requestId && data.data) {
        const completedJob = {
          id: jobId,
          status: 'completed' as const,
          progress: 100,
          result: data.data,
          startTime: new Date(),
        };

        setCompletedJobs(jobs => [completedJob, ...jobs].slice(0, 10));
        setCurrentJob(null);

        toast({
          title: 'Video generated successfully',
          description: `Used ${data.data._credits.used} credits`,
        });
      }

    } catch (error: any) {
      setCurrentJob(null);
      toast({
        title: 'Generation failed',
        description: error.message || 'Failed to generate video',
        variant: 'destructive',
      });
    }
  };

  // Download video
  const downloadVideo = async (videoUrl: string, job: GenerationJob & { result: VideoGenResponse }) => {
    try {
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `generated-video-${job.id}.mp4`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Video downloaded',
        description: 'The video has been downloaded to your device.',
      });
    } catch (error) {
      toast({
        title: 'Download failed',
        description: 'Failed to download the video.',
        variant: 'destructive',
      });
    }
  };

  // Copy video URL
  const copyVideoUrl = async (videoUrl: string) => {
    try {
      await navigator.clipboard.writeText(videoUrl);
      toast({
        title: 'URL copied',
        description: 'Video URL has been copied to clipboard.',
      });
    } catch (error) {
      toast({
        title: 'Copy failed',
        description: 'Failed to copy video URL.',
        variant: 'destructive',
      });
    }
  };

  // Generate random seed
  const generateRandomSeed = () => {
    setSeed(Math.floor(Math.random() * 1000000));
  };

  // Format duration
  const formatDuration = (startTime: Date) => {
    const diff = Date.now() - startTime.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Check if user can access video generation
  if (!canAccessFeature('video_generation')) {
    return (
      <div className="flex h-full items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
        <Card className="w-full max-w-md bg-white/60 backdrop-blur-lg border-white/30">
          <CardHeader className="text-center">
            <VideoIcon className="h-12 w-12 text-purple-600 mx-auto mb-4" />
            <CardTitle>Upgrade to Generate Videos</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600">
              Video generation is only available for Enterprise plans.
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-center space-x-2">
                <Badge variant="secondary">Enterprise</Badge>
                <span>Advanced video generation</span>
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
              <VideoIcon className="h-5 w-5 text-purple-600" />
              <h2 className="text-lg font-semibold text-gray-900">Video Generation</h2>
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
                  <span>Create Video</span>
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
                    placeholder="Describe the video you want to generate..."
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

                  {/* Frames */}
                  <div>
                    <Label className="text-xs text-gray-600">Frames</Label>
                    <Select value={frames.toString()} onValueChange={(value) => setFrames(parseInt(value))}>
                      <SelectTrigger className="bg-white/50 border-white/30 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {frameOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value.toString()}>
                            {option.label}
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
                      max={30}
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
                  onClick={generateVideo}
                  disabled={!prompt.trim() || !selectedModel || currentJob !== null || creditsNeeded > (userCredits?.balance || 0)}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  {currentJob ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Video
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Current Job Status */}
            {currentJob && (
              <Card className="mt-4 bg-white/60 backdrop-blur-lg border-white/30">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Generating Video...</span>
                      <span className="text-xs text-gray-600">{formatDuration(currentJob.startTime)}</span>
                    </div>
                    <Progress value={currentJob.progress} className="h-2" />
                    <p className="text-xs text-gray-600">
                      {currentJob.status === 'pending' && 'Job queued...'}
                      {currentJob.status === 'processing' && 'Processing video...'}
                      {currentJob.status === 'completed' && 'Completed!'}
                      {currentJob.status === 'failed' && 'Generation failed'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Panel - Results */}
          <div className="flex-1 p-6 overflow-y-auto">
            {currentJob && currentJob.status === 'pending' && (
              <div className="flex items-center justify-center h-full">
                <Card className="bg-white/60 backdrop-blur-lg border-white/30 p-8">
                  <div className="text-center space-y-4">
                    <Loader2 className="h-12 w-12 animate-spin text-purple-600 mx-auto" />
                    <h3 className="text-lg font-medium text-gray-900">
                      Generating Your Video...
                    </h3>
                    <p className="text-gray-600 max-w-md">
                      Video generation typically takes 1-3 minutes. This is a complex process that requires significant computational resources.
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-center space-x-2">
                        <Badge variant="outline">Model: {selectedModel}</Badge>
                      </div>
                      <div className="flex items-center justify-center space-x-2">
                        <Badge variant="outline">Frames: {frames}</Badge>
                        <Badge variant="outline">Resolution: {width}x{height}</Badge>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {!currentJob && completedJobs.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <Card className="bg-white/60 backdrop-blur-lg border-white/30 p-8">
                  <div className="text-center space-y-4">
                    <VideoIcon className="h-12 w-12 text-purple-600 mx-auto" />
                    <h3 className="text-lg font-medium text-gray-900">
                      Ready to Create
                    </h3>
                    <p className="text-gray-600 max-w-md">
                      Enter a prompt and select a model to start generating amazing videos with AI. Video generation takes longer than images but creates dynamic content.
                    </p>
                  </div>
                </Card>
              </div>
            )}

            {/* Completed Videos */}
            {completedJobs.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Generated Videos</h3>
                  <Badge variant="outline" className="bg-white/50 text-gray-700">
                    {completedJobs.length} video{completedJobs.length > 1 ? 's' : ''}
                  </Badge>
                </div>

                <div className="space-y-6">
                  {completedJobs.map((job) => (
                    <Card key={job.id} className="bg-white/60 backdrop-blur-lg border-white/30">
                      <CardContent className="p-6">
                        <div className="space-y-4">
                          {/* Video Preview */}
                          <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
                            <video
                              controls
                              className="w-full h-full object-cover"
                              poster="/video-poster.png"
                            >
                              <source src={job.result.videos[0]?.url} type="video/mp4" />
                              Your browser does not support the video tag.
                            </video>
                          </div>

                          {/* Video Info */}
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-gray-900">
                                Generated Video
                              </p>
                              <div className="flex items-center space-x-3 text-xs text-gray-600">
                                <span>Duration: ~2s</span>
                                <span>Frames: {frames}</span>
                                <span>Credits: {job.result._credits.used}</span>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => downloadVideo(job.result.videos[0]?.url, job)}
                                className="bg-white/50 border-white/30 hover:bg-white/70"
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Download
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyVideoUrl(job.result.videos[0]?.url)}
                                className="bg-white/50 border-white/30 hover:bg-white/70"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
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