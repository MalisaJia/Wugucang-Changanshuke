'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/navigation';
import { getBalance, type Balance } from '@/lib/api/billing';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useChatStore, type ChatMessage } from '@/lib/stores/chat-store';
import {
  Send,
  Bot,
  User,
  Sparkles,
  Wallet,
  ChevronDown,
  AlertTriangle,
  Loader2,
  Plus,
  Trash2,
  MessageSquare,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Info,
} from 'lucide-react';

// API Base URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

// Stream chunk timeout in milliseconds (30 seconds)
const STREAM_CHUNK_TIMEOUT_MS = 30000;

// Default model list - used as fallback when API fetch fails
// TODO: Models will be fetched dynamically from backend API when a JWT-accessible endpoint is added
const DEFAULT_MODELS = [
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
  // New Gemini Models
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'Google', icon: '💎', description: 'Fast multimodal model' },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', provider: 'Google', icon: '💎', description: 'Lightweight & fast' },
  { id: 'gemini-2.5-flash-lite-preview-09-2025', name: 'Gemini 2.5 Flash Lite Preview', provider: 'Google', icon: '💎', description: 'Lite preview version' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google', icon: '💎', description: 'Most capable Gemini' },
  { id: 'gemini-2.5-flash-preview-09-2025', name: 'Gemini 2.5 Flash Preview', provider: 'Google', icon: '💎', description: 'Flash preview version' },
  { id: 'gemini-2.5-flash-nothinking', name: 'Gemini 2.5 Flash NoThinking', provider: 'Google', icon: '💎', description: 'Fast without reasoning' },
  { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image', provider: 'Google', icon: '💎', description: 'Image understanding' },
  // Image Generation Models
  { id: 'flux.1-kontext-pro', name: 'Flux.1 Kontext Pro', provider: 'Black Forest Labs', icon: '🎨', description: 'AI image editing' },
  { id: 'flux-1.1-pro', name: 'Flux 1.1 Pro', provider: 'Black Forest Labs', icon: '🎨', description: 'High-quality image gen' },
  { id: 'doubao-seedream-5-0-260128', name: 'Doubao Seedream 5.0', provider: 'ByteDance', icon: '🎨', description: '豆包绘画 5.0' },
  { id: 'doubao-seedream-4-5-251128', name: 'Doubao Seedream 4.5', provider: 'ByteDance', icon: '🎨', description: '豆包绘画 4.5' },
];

// Get default model (gpt-4o-mini for best value, fallback to first model)
function getDefaultModel(modelList: typeof DEFAULT_MODELS) {
  return modelList.find(m => m.id === 'gpt-4o-mini') || modelList[0];
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  model?: string;
}

// Format relative time
function formatRelativeTime(dateString: string, t: ReturnType<typeof useTranslations>): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return t('justNow');
  if (diffMin < 60) return t('minutesAgo', { count: diffMin });
  if (diffHour < 24) return t('hoursAgo', { count: diffHour });
  if (diffDay < 7) return t('daysAgo', { count: diffDay });
  return date.toLocaleDateString();
}

export default function ChatPage() {
  const t = useTranslations('chat');

  // Chat history store
  const {
    conversations,
    activeConversationId,
    createConversation,
    addMessage,
    setActiveConversation,
    deleteConversation,
    getActiveConversation,
    updateConversationModel,
  } = useChatStore();

  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  // Model list - currently from static defaults, will be replaced with API fetch
  const [models, setModels] = useState(DEFAULT_MODELS);
  const [selectedModel, setSelectedModel] = useState(getDefaultModel(DEFAULT_MODELS));
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Hydration fix for Zustand persist
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Load active conversation messages when switching
  // Skip if currently streaming to avoid overwriting assistant message placeholder
  useEffect(() => {
    if (!isHydrated || isStreaming || isLoading) return;
    const activeConv = getActiveConversation();
    if (activeConv) {
      // Convert stored messages to Message format with IDs and timestamps
      const loadedMessages: Message[] = activeConv.messages.map((msg, index) => ({
        id: `loaded-${activeConv.id}-${index}`,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(activeConv.updatedAt),
        model: msg.role === 'assistant' ? activeConv.model : undefined,
      }));
      setMessages(loadedMessages);
      // Restore model selection
      const modelToSelect = models.find((m) => m.name === activeConv.model);
      if (modelToSelect) {
        setSelectedModel(modelToSelect);
      }
    } else {
      setMessages([]);
    }
  }, [activeConversationId, isHydrated, isStreaming, isLoading, getActiveConversation, models]);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Fetch balance function (reusable)
  const fetchBalance = useCallback(async () => {
    try {
      const data = await getBalance();
      setBalance(data);
    } catch (err) {
      console.error('Failed to fetch balance:', err);
    }
  }, []);

  // Fetch balance on mount
  useEffect(() => {
    const loadBalance = async () => {
      await fetchBalance();
      setBalanceLoading(false);
    };
    loadBalance();
  }, [fetchBalance]);

  // Cleanup AbortController on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
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

    // Create or get conversation ID
    let conversationId = activeConversationId;
    if (!conversationId) {
      conversationId = createConversation(selectedModel.name);
    }

    // Add user message to store
    const chatUserMessage: ChatMessage = {
      role: 'user',
      content: userMessage.content,
    };
    addMessage(conversationId, chatUserMessage);

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
      let streamCompleted = false;

      // Helper function to read with timeout
      const readWithTimeout = async (
        reader: ReadableStreamDefaultReader<Uint8Array>,
        timeoutMs: number
      ): Promise<ReadableStreamReadResult<Uint8Array>> => {
        return new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error('Stream chunk timeout: no data received within timeout period'));
          }, timeoutMs);

          reader.read().then(
            (result) => {
              clearTimeout(timeoutId);
              resolve(result);
            },
            (error) => {
              clearTimeout(timeoutId);
              reject(error);
            }
          );
        });
      };

      try {
        while (true) {
          const { done, value } = await readWithTimeout(reader, STREAM_CHUNK_TIMEOUT_MS);
          if (done) {
            streamCompleted = true;
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                streamCompleted = true;
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

          // Check if we encountered [DONE] in the inner loop
          if (streamCompleted) break;
        }
      } finally {
        // Always release the reader lock
        reader.releaseLock();
      }

      // Save assistant message to store on successful completion
      if (streamCompleted && fullContent && conversationId) {
        const chatAssistantMessage: ChatMessage = {
          role: 'assistant',
          content: fullContent,
        };
        addMessage(conversationId, chatAssistantMessage);
        // Refresh balance after successful completion
        fetchBalance();
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was aborted by user
        return;
      }
      console.error('Chat error:', err);
      // Show specific error message for stream timeout
      if (err instanceof Error && err.message.includes('Stream chunk timeout')) {
        setError(t('streamTimeout'));
      } else {
        setError(t('errorOccurred'));
      }
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
    setActiveConversation(null);
    setMessages([]);
    setError(null);
    setIsLoading(false);
    setIsStreaming(false);
    setIsSidebarOpen(false);
  };

  // Handle select conversation
  const handleSelectConversation = (id: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setActiveConversation(id);
    setError(null);
    setIsLoading(false);
    setIsStreaming(false);
    setIsSidebarOpen(false);
  };

  // Handle delete conversation
  const handleDeleteConversation = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteConversation(id);
  };

  // Handle model change
  const handleModelChange = (model: typeof DEFAULT_MODELS[0]) => {
    setSelectedModel(model);
    setIsModelDropdownOpen(false);
    // Update model in active conversation if exists
    if (activeConversationId) {
      updateConversationModel(activeConversationId, model.name);
    }
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
    <div className="flex h-[calc(100vh-8rem)]">
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="fixed top-20 left-4 z-50 md:hidden p-2 bg-card border border-border rounded-lg shadow-lg"
      >
        {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Sidebar overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed md:relative z-40 h-full bg-gray-50 dark:bg-gray-900 border-r border-border flex flex-col transition-all duration-300 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } ${isDesktopSidebarOpen ? 'w-64' : 'md:w-0 md:overflow-hidden w-64'}`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm text-muted-foreground">{t('chatHistory')}</h2>
            <button
              onClick={() => setIsDesktopSidebarOpen(false)}
              className="hidden md:flex items-center justify-center p-1.5 hover:bg-accent rounded-md transition-colors"
              title={t('collapseHistory')}
            >
              <PanelLeftClose className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
          >
            <Plus className="h-4 w-4" />
            {t('newChat')}
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {!isHydrated ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mx-auto" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              {t('noConversations')}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv.id)}
                  className={`group p-3 cursor-pointer hover:bg-accent transition-colors ${
                    activeConversationId === conv.id
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-l-2 border-blue-500'
                      : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {conv.title || t('untitled')}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{conv.model}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatRelativeTime(conv.updatedAt, t)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleDeleteConversation(e, conv.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-all"
                      title={t('deleteChat')}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* History Tip */}
        <div className="px-3 pb-3">
          <div className="flex items-start gap-2 text-xs text-gray-400 bg-gray-100 dark:bg-gray-800/50 rounded-lg px-3 py-2">
            <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            <span>{t('historyTip')}</span>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 md:ml-0 ml-0">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border px-4 pt-2">
          <div className="flex items-center gap-4">
            {/* Desktop sidebar expand button (shown when collapsed) */}
            {!isDesktopSidebarOpen && (
              <button
                onClick={() => setIsDesktopSidebarOpen(true)}
                className="hidden md:flex items-center justify-center p-2 bg-card border border-border rounded-lg hover:bg-accent transition-colors"
                title={t('expandHistory')}
              >
                <PanelLeftOpen className="h-4 w-4 text-muted-foreground" />
              </button>
            )}

            {/* Spacer for mobile menu button */}
            <div className="w-8 md:hidden" />

            {/* Model Selector */}
            <div className="relative">
              <button
                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:bg-accent transition-colors"
              >
                <span className="text-lg">{selectedModel.icon}</span>
                <span className="font-medium hidden sm:inline">{selectedModel.name}</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isModelDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setIsModelDropdownOpen(false)}
                  />
                  <div className="absolute top-full left-0 mt-2 w-64 bg-card border border-border rounded-lg shadow-lg z-20 max-h-80 overflow-y-auto">
                    <div className="p-2">
                      <p className="text-xs text-muted-foreground px-2 py-1">{t('selectModel')}</p>
                      {models.map((model) => (
                        <button
                          key={model.id}
                          onClick={() => handleModelChange(model)}
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
          </div>

          {/* Balance Display */}
          <Link
            href="/dashboard/billing"
            className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:bg-accent transition-colors"
          >
            <Wallet className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium hidden sm:inline">{t('balance')}:</span>
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
          <div className="mx-4 mt-4 p-4 bg-red-500/10 border border-red-500/50 rounded-lg flex items-center justify-between">
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
          <div className="mx-4 mt-4 p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span className="text-red-500">{error}</span>
            </div>
          </div>
        )}

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto py-4 px-4 space-y-4">
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
        <div className="border-t border-border pt-4 px-4 pb-2">
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
    </div>
  );
}
