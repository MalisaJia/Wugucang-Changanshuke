'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/navigation';
import { getBalance, type Balance } from '@/lib/api/billing';
import { useAuthStore } from '@/lib/stores/auth-store';
import {
  Send,
  Bot,
  User,
  Sparkles,
  RefreshCw,
  Wallet,
  ChevronDown,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

// API Base URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

// Predefined model list - grouped by provider
const MODELS = [
  // OpenAI Models
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', icon: '🤖', description: 'Flagship multimodal model' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', icon: '🤖', description: 'Lightweight & efficient' },
  // GPT-4.1 Series (new generation)
  { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'OpenAI', icon: '🤖', description: 'Latest with 1M context' },
  { id: 'gpt-4.1-2025-04-14', name: 'GPT-4.1 (2025-04-14)', provider: 'OpenAI', icon: '🤖', description: 'GPT-4.1 April snapshot' },
  { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', provider: 'OpenAI', icon: '🤖', description: 'Compact GPT-4.1' },
  { id: 'gpt-4.1-mini-2025-04-14', name: 'GPT-4.1 Mini (2025-04-14)', provider: 'OpenAI', icon: '🤖', description: 'Mini April snapshot' },
  { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', provider: 'OpenAI', icon: '🤖', description: 'Ultra-fast & cheap' },
  { id: 'gpt-4.1-nano-2025-04-14', name: 'GPT-4.1 Nano (2025-04-14)', provider: 'OpenAI', icon: '🤖', description: 'Nano April snapshot' },
  // GPT-3.5 Series
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OpenAI', icon: '🤖', description: 'Classic fast model' },
  { id: 'gpt-3.5-turbo-0125', name: 'GPT-3.5 Turbo 0125', provider: 'OpenAI', icon: '🤖', description: 'Latest 3.5 snapshot' },
  { id: 'gpt-3.5-turbo-1106', name: 'GPT-3.5 Turbo 1106', provider: 'OpenAI', icon: '🤖', description: 'Nov 2023 snapshot' },
  { id: 'gpt-3.5-turbo-16k', name: 'GPT-3.5 Turbo 16K', provider: 'OpenAI', icon: '🤖', description: '16K context window' },
  { id: 'gpt-3.5-turbo-16k-0613', name: 'GPT-3.5 Turbo 16K 0613', provider: 'OpenAI', icon: '🤖', description: '16K June 2023' },
  // Anthropic Models
  { id: 'claude-opus-4-6', name: 'Claude Opus 4', provider: 'Anthropic', icon: '🧠', description: 'Most powerful reasoning' },
  { id: 'claude-opus-4-6-thinking', name: 'Claude Opus 4 Thinking', provider: 'Anthropic', icon: '🧠', description: 'Extended thinking mode' },
  { id: 'claude-sonnet-4-6-thinking', name: 'Claude Sonnet 4 Thinking', provider: 'Anthropic', icon: '🧠', description: 'Balanced with thinking' },
  // Google Models
  { id: 'gemini-2.5-flash-thinking', name: 'Gemini 2.5 Flash Thinking', provider: 'Google', icon: '💎', description: 'Fast reasoning model' },
];

// Default model index (gpt-4o-mini for best value)
const DEFAULT_MODEL_INDEX = 1;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  model?: string;
}

export default function ChatPage() {
  const t = useTranslations('chat');
  
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [selectedModel, setSelectedModel] = useState(MODELS[DEFAULT_MODEL_INDEX]);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Fetch balance on mount
  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const data = await getBalance();
        setBalance(data);
      } catch (err) {
        console.error('Failed to fetch balance:', err);
      } finally {
        setBalanceLoading(false);
      }
    };
    fetchBalance();
  }, []);

  // Generate unique message ID
  const generateId = () => `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Handle send message
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading || isStreaming) return;
    
    // Get JWT token from auth store
    const token = useAuthStore.getState().accessToken;
    if (!token) {
      setError(t('notLoggedIn'));
      return;
    }
    
    if (balance && balance.amount_balance <= 0) {
      setError(t('insufficientBalance'));
      return;
    }

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setError(null);
    setIsLoading(true);

    // Create assistant message placeholder
    const assistantMessage: Message = {
      id: generateId(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      model: selectedModel.name,
    };
    setMessages((prev) => [...prev, assistantMessage]);

    // Build conversation history
    const conversationHistory = [...messages, userMessage].map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    try {
      abortControllerRef.current = new AbortController();
      setIsStreaming(true);

      // Use JWT authenticated endpoint instead of API Key endpoint
      const token = useAuthStore.getState().accessToken;
      const response = await fetch(`${API_BASE_URL}/api/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          model: selectedModel.id,
          messages: conversationHistory,
          stream: true,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              break;
            }
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                fullContent += content;
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastIndex = newMessages.length - 1;
                  if (newMessages[lastIndex]?.role === 'assistant') {
                    newMessages[lastIndex] = {
                      ...newMessages[lastIndex],
                      content: fullContent,
                    };
                  }
                  return newMessages;
                });
              }
            } catch {
              // Ignore JSON parse errors
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was aborted
        return;
      }
      console.error('Chat error:', err);
      setError(t('errorOccurred'));
      // Remove the empty assistant message
      setMessages((prev) => prev.filter((msg) => msg.id !== assistantMessage.id));
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle new chat
  const handleNewChat = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setMessages([]);
    setError(null);
    setIsLoading(false);
    setIsStreaming(false);
  };

  // Format timestamp
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Format balance (cents to yuan)
  const formatCurrency = (cents: number) => {
    return `¥${(cents / 100).toFixed(2)}`;
  };

  // Check if can chat
  const canChat = !balanceLoading && balance && balance.amount_balance > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-4">
          {/* Model Selector */}
          <div className="relative">
            <button
              onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:bg-accent transition-colors"
            >
              <span className="text-lg">{selectedModel.icon}</span>
              <span className="font-medium">{selectedModel.name}</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isModelDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setIsModelDropdownOpen(false)} 
                />
                <div className="absolute top-full left-0 mt-2 w-64 bg-card border border-border rounded-lg shadow-lg z-20">
                  <div className="p-2">
                    <p className="text-xs text-muted-foreground px-2 py-1">{t('selectModel')}</p>
                    {MODELS.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => {
                          setSelectedModel(model);
                          setIsModelDropdownOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left hover:bg-accent transition-colors ${
                          selectedModel.id === model.id ? 'bg-accent' : ''
                        }`}
                      >
                        <span className="text-lg">{model.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{model.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{model.provider} · {model.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* New Chat Button */}
          <button
            onClick={handleNewChat}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            {t('newChat')}
          </button>
        </div>

        {/* Balance Display */}
        <Link
          href="/dashboard/billing"
          className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:bg-accent transition-colors"
        >
          <Wallet className="h-4 w-4 text-green-500" />
          <span className="text-sm font-medium">{t('balance')}:</span>
          {balanceLoading ? (
            <span className="text-sm text-muted-foreground">...</span>
          ) : (
            <span className="text-sm font-bold text-green-500">
              {balance ? formatCurrency(balance.amount_balance) : '¥0.00'}
            </span>
          )}
        </Link>
      </div>

      {/* Alert Messages */}
      {balance && balance.amount_balance <= 0 && !balanceLoading && (
        <div className="mt-4 p-4 bg-red-500/10 border border-red-500/50 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <span className="text-red-500">{t('insufficientBalance')}</span>
          </div>
          <Link
            href="/dashboard/billing"
            className="px-4 py-2 bg-red-500 text-white font-medium rounded-lg hover:bg-red-400 transition-colors"
          >
            {t('rechargeNow')}
          </Link>
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <span className="text-red-500">{error}</span>
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Sparkles className="h-12 w-12 text-primary mb-4" />
            <h2 className="text-xl font-semibold mb-2">{t('welcome')}</h2>
            <p className="text-muted-foreground max-w-md">
              {t('selectModel')} {selectedModel.name}
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              {/* Avatar */}
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                {message.role === 'user' ? (
                  <User className="h-4 w-4" />
                ) : (
                  <Bot className="h-4 w-4" />
                )}
              </div>

              {/* Message Content */}
              <div
                className={`max-w-[70%] ${
                  message.role === 'user' ? 'text-right' : ''
                }`}
              >
                {message.role === 'assistant' && message.model && (
                  <span className="text-xs text-muted-foreground mb-1 block">
                    {message.model}
                  </span>
                )}
                <div
                  className={`inline-block px-4 py-3 rounded-2xl ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  {message.content || (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('thinking')}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground mt-1 block">
                  {formatTime(message.timestamp)}
                </span>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-border pt-4">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={t('typeMessage')}
            disabled={!canChat || isStreaming}
            rows={1}
            className="w-full px-4 py-3 pr-14 bg-card border border-border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed text-lg"
            style={{ minHeight: '56px', maxHeight: '200px' }}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || !canChat || isStreaming}
            className="absolute right-2 bottom-2 p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading || isStreaming ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
