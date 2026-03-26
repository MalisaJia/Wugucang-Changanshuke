import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Maximum number of conversations to keep
const MAX_CONVERSATIONS = 10;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  model: string;
  createdAt: string;
  updatedAt: string;
}

interface ChatStore {
  conversations: ChatConversation[];
  activeConversationId: string | null;

  // Actions
  createConversation: (model: string) => string;
  addMessage: (conversationId: string, message: ChatMessage) => void;
  setActiveConversation: (id: string | null) => void;
  deleteConversation: (id: string) => void;
  getActiveConversation: () => ChatConversation | null;
  updateConversationTitle: (id: string, title: string) => void;
  updateConversationModel: (id: string, model: string) => void;
  clearActiveConversation: () => void;
}

// Generate UUID
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeConversationId: null,

      createConversation: (model: string) => {
        const id = generateUUID();
        const now = new Date().toISOString();
        const newConversation: ChatConversation = {
          id,
          title: '', // Will be set when first user message is added
          messages: [],
          model,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => {
          let newConversations = [newConversation, ...state.conversations];
          // Keep only the most recent MAX_CONVERSATIONS
          if (newConversations.length > MAX_CONVERSATIONS) {
            newConversations = newConversations.slice(0, MAX_CONVERSATIONS);
          }
          return {
            conversations: newConversations,
            activeConversationId: id,
          };
        });

        return id;
      },

      addMessage: (conversationId: string, message: ChatMessage) => {
        set((state) => {
          const conversations = state.conversations.map((conv) => {
            if (conv.id === conversationId) {
              const updatedMessages = [...conv.messages, message];
              // Set title from first user message
              let title = conv.title;
              if (!title && message.role === 'user') {
                title = message.content.slice(0, 30);
                if (message.content.length > 30) {
                  title += '...';
                }
              }
              return {
                ...conv,
                messages: updatedMessages,
                title,
                updatedAt: new Date().toISOString(),
              };
            }
            return conv;
          });
          return { conversations };
        });
      },

      setActiveConversation: (id: string | null) => {
        set({ activeConversationId: id });
      },

      deleteConversation: (id: string) => {
        set((state) => {
          const conversations = state.conversations.filter((conv) => conv.id !== id);
          let activeConversationId = state.activeConversationId;
          // If deleting the active conversation, clear it
          if (activeConversationId === id) {
            activeConversationId = null;
          }
          return { conversations, activeConversationId };
        });
      },

      getActiveConversation: () => {
        const state = get();
        if (!state.activeConversationId) return null;
        return state.conversations.find((conv) => conv.id === state.activeConversationId) || null;
      },

      updateConversationTitle: (id: string, title: string) => {
        set((state) => {
          const conversations = state.conversations.map((conv) => {
            if (conv.id === id) {
              return { ...conv, title, updatedAt: new Date().toISOString() };
            }
            return conv;
          });
          return { conversations };
        });
      },

      updateConversationModel: (id: string, model: string) => {
        set((state) => {
          const conversations = state.conversations.map((conv) => {
            if (conv.id === id) {
              return { ...conv, model, updatedAt: new Date().toISOString() };
            }
            return conv;
          });
          return { conversations };
        });
      },

      clearActiveConversation: () => {
        set({ activeConversationId: null });
      },
    }),
    {
      name: 'wuguhub-chat-history',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
