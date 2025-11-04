'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Send, Loader2, Sparkles, Copy, Check, RefreshCw, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useSubscription } from '@/hooks/useSubscription';
import { getModelsByProvider, filterModelsByPlan } from '@/utils/models';
import { CreditManager } from '@/utils/creditManager';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  model?: string;
  tokens?: number;
  credits?: number;
  isStreaming?: boolean;
}

interface ChatSettings {
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  stream: boolean;
}

const defaultSettings: ChatSettings = {
  temperature: 0.7,
  maxTokens: 2048,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
  stream: true,
};

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState<ChatSettings>(defaultSettings);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { toast } = useToast();
  const { userPlan, userCredits } = useSubscription();
  const queryClient = useQueryClient();

  // Fetch available models
  const { data: modelsData, isLoading: modelsLoading } = useQuery({
    queryKey: ['chat-models'],
    queryFn: async () => {
      const response = await fetch('/api/chat');
      if (!response.ok) throw new Error('Failed to fetch models');
      const data = await response.json();
      return data.data;
    },
  });

  const availableModels = modelsData?.models || [];

  // Auto-select first available model
  useEffect(() => {
    if (availableModels.length > 0 && !selectedModel) {
      setSelectedModel(availableModels[0].id);
    }
  }, [availableModels, selectedModel]);

  // Scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Handle message copy
  const copyMessage = useCallback(async (content: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
      toast({
        title: 'Message copied',
        description: 'The message has been copied to your clipboard.',
      });
    } catch (error) {
      toast({
        title: 'Copy failed',
        description: 'Failed to copy message to clipboard.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  // Regenerate response
  const regenerateResponse = useCallback(async (messageIndex: number) => {
    if (messageIndex === 0 || messages[messageIndex].role !== 'assistant') return;

    const userMessage = messages[messageIndex - 1];
    if (!userMessage) return;

    // Remove the current assistant response and any subsequent messages
    const newMessages = messages.slice(0, messageIndex);
    setMessages(newMessages);

    // Resend the user message to get a new response
    await sendMessage(userMessage.content, true);
  }, [messages]);

  // Send message function
  const sendMessage = useCallback(async (messageContent?: string, isRegeneration = false) => {
    const content = messageContent || input.trim();
    if (!content || !selectedModel || isLoading) return;

    // Create new user message
    const userMessage: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      role: 'user',
      content,
      timestamp: new Date(),
    };

    // Create assistant message placeholder for streaming
    const assistantMessage: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      model: selectedModel,
      isStreaming: true,
    };

    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setInput('');
    setIsLoading(true);

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      const requestBody = {
        model: selectedModel,
        messages: [
          ...(messages.length > 0 ? messages.filter(m => m.role !== 'system') : []),
          { role: 'user', content },
        ],
        stream: settings.stream,
        temperature: settings.temperature,
        max_tokens: settings.maxTokens,
        top_p: settings.topP,
        frequency_penalty: settings.frequencyPenalty,
        presence_penalty: settings.presencePenalty,
      };

      if (settings.stream) {
        // Handle streaming response
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to send message');
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('Stream not available');
        }

        let accumulatedContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);

                if (parsed.choices?.[0]?.delta?.content) {
                  accumulatedContent += parsed.choices[0].delta.content;

                  setMessages(prev => prev.map(msg =>
                    msg.id === assistantMessage.id
                      ? { ...msg, content: accumulatedContent }
                      : msg
                  ));
                }

                // Handle final chunk with credit info
                if (parsed._credits) {
                  setMessages(prev => prev.map(msg =>
                    msg.id === assistantMessage.id
                      ? {
                          ...msg,
                          isStreaming: false,
                          credits: parsed._credits.used,
                          tokens: parsed._credits.tokens,
                        }
                      : msg
                  ));

                  // Update credits in query cache
                  queryClient.invalidateQueries({ queryKey: ['user-credits'] });
                }
              } catch (parseError) {
                console.error('Error parsing streaming chunk:', parseError);
              }
            }
          }
        }
      } else {
        // Handle non-streaming response
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to send message');
        }

        const data = await response.json();

        setMessages(prev => prev.map(msg =>
          msg.id === assistantMessage.id
            ? {
                ...msg,
                content: data.choices?.[0]?.message?.content || '',
                isStreaming: false,
                credits: data._credits?.used,
                tokens: data._credits?.tokens,
              }
            : msg
        ));

        // Update credits in query cache
        queryClient.invalidateQueries({ queryKey: ['user-credits'] });
      }

    } catch (error: any) {
      console.error('Error sending message:', error);

      // Remove the assistant message placeholder if error occurs
      setMessages(prev => prev.filter(msg => msg.id !== assistantMessage.id));

      if (error.name === 'AbortError') {
        toast({
          title: 'Request cancelled',
          description: 'The message was cancelled.',
        });
      } else {
        toast({
          title: 'Error',
          description: error.message || 'Failed to send message',
          variant: 'destructive',
        });
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [input, selectedModel, isLoading, messages, settings, toast, queryClient]);

  // Stop generation
  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // Handle form submission
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  }, [sendMessage]);

  // Handle Enter key in textarea
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  // Get selected model details
  const selectedModelData = availableModels.find(m => m.id === selectedModel);

  return (
    <div className="flex h-full bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
      {/* Chat Container */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="border-b border-white/20 bg-white/30 backdrop-blur-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                <h2 className="text-lg font-semibold text-gray-900">AI Chat</h2>
              </div>

              {selectedModelData && (
                <Badge variant="secondary" className="bg-white/50 text-gray-700">
                  {selectedModelData.displayName}
                </Badge>
              )}

              {userCredits && (
                <Badge variant="outline" className="bg-white/50 text-gray-700 border-white/30">
                  {userCredits.balance} credits
                </Badge>
              )}
            </div>

            <div className="flex items-center space-x-2">
              {/* Model Selector */}
              <Select value={selectedModel} onValueChange={setSelectedModel} disabled={isLoading}>
                <SelectTrigger className="w-64 bg-white/50 border-white/30">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex items-center space-x-2">
                        <span>{model.displayName}</span>
                        {model.isFree && (
                          <Badge variant="secondary" className="text-xs">Free</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Settings Dialog */}
              <Dialog open={showSettings} onOpenChange={setShowSettings}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="bg-white/50 hover:bg-white/70">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-white/90 backdrop-blur-lg border-white/30">
                  <DialogHeader>
                    <DialogTitle>Chat Settings</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Temperature: {settings.temperature}</Label>
                      <Slider
                        value={[settings.temperature]}
                        onValueChange={(value) => setSettings(prev => ({ ...prev, temperature: value[0] }))}
                        max={2}
                        min={0}
                        step={0.1}
                        className="mt-2"
                      />
                    </div>

                    <div>
                      <Label>Max Tokens: {settings.maxTokens}</Label>
                      <Slider
                        value={[settings.maxTokens]}
                        onValueChange={(value) => setSettings(prev => ({ ...prev, maxTokens: value[0] }))}
                        max={4000}
                        min={1}
                        step={100}
                        className="mt-2"
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={settings.stream}
                        onCheckedChange={(checked) => setSettings(prev => ({ ...prev, stream: checked }))}
                      />
                      <Label>Stream responses</Label>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4 max-w-4xl mx-auto">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <Sparkles className="h-12 w-12 text-purple-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Start a conversation
                </h3>
                <p className="text-gray-600">
                  Ask me anything! I'm here to help with your questions.
                </p>
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-2xl rounded-2xl p-4 ${
                      message.role === 'user'
                        ? 'bg-purple-600 text-white ml-auto'
                        : 'bg-white/60 backdrop-blur-sm text-gray-900 border border-white/30'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      {message.role === 'assistant' && (
                        <Avatar className="h-8 w-8 mt-1">
                          <AvatarFallback className="bg-purple-100 text-purple-600 text-sm">
                            AI
                          </AvatarFallback>
                        </Avatar>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="prose prose-sm max-w-none">
                          {message.content || (
                            message.isStreaming && (
                              <div className="flex items-center space-x-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Thinking...</span>
                              </div>
                            )
                          )}
                        </div>

                        {/* Message metadata */}
                        {message.tokens && (
                          <div className="mt-2 flex items-center space-x-4 text-xs opacity-70">
                            <span>{message.tokens} tokens</span>
                            {message.credits && (
                              <span>{message.credits} credits</span>
                            )}
                            <span>{message.timestamp.toLocaleTimeString()}</span>
                          </div>
                        )}
                      </div>

                      {message.role === 'assistant' && (
                        <div className="flex items-center space-x-1 mt-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 hover:bg-white/20"
                                  onClick={() => copyMessage(message.content, message.id)}
                                >
                                  {copiedMessageId === message.id ? (
                                    <Check className="h-3 w-3" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Copy message</p>
                              </TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 hover:bg-white/20"
                                  onClick={() => regenerateResponse(index)}
                                  disabled={isLoading}
                                >
                                  <RefreshCw className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Regenerate response</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="border-t border-white/20 bg-white/30 backdrop-blur-lg p-4">
          <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
            <div className="flex space-x-4">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message here..."
                className="flex-1 min-h-[60px] max-h-32 bg-white/50 border-white/30 resize-none"
                disabled={isLoading}
              />

              <div className="flex flex-col space-y-2">
                <Button
                  type="submit"
                  disabled={!input.trim() || isLoading || !selectedModel}
                  className="px-6 bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>

                {isLoading && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={stopGeneration}
                    className="px-6 bg-white/50 border-white/30 hover:bg-white/70"
                  >
                    Stop
                  </Button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}