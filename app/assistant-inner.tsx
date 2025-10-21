"use client";

import { useEffect, useRef } from "react";
import { ThreadMessage, useThread } from "@assistant-ui/react";
import { Thread } from "@/components/assistant-ui/thread";
import { SimpleConversation, useSimpleConversations } from "@/hooks/use-simple-conversations";
import { Message } from "ai/react";
import { usePrevious } from "@/hooks/use-previous";

interface AssistantInnerProps {
  currentConversation: SimpleConversation | null | undefined;
  updateConversationTitle: (id: string, title: string) => void;
  onSwitchThread?: () => void;
}

export const AssistantInner = ({ currentConversation, updateConversationTitle, onSwitchThread }: AssistantInnerProps) => {
  const { messages } = useThread();
  const { updateConversationMessages } = useSimpleConversations();
  const lastGeneratedTitle = useRef<string | null>(null);
  const prevConversation = usePrevious(currentConversation);
  const prevMessages = usePrevious(messages);
  const THREAD_CACHE_PREFIX = 'sprychat-thread-cache-';

  // 保存上一个对话的消息
  useEffect(() => {
    if (prevConversation && prevConversation.id !== currentConversation?.id) {
      const messagesToSave = prevMessages?.filter((m) => m.role === 'user' || m.role === 'assistant');
      if (messagesToSave && messagesToSave.length > 0) {
        const convertedMessages: Message[] = messagesToSave
          .map((m: ThreadMessage) => ({
            id: m.id,
            role: m.role,
            content: m.content.map(c => c.type === 'text' ? c.text : '').join(''),
            createdAt: m.createdAt,
          }))
          // Filter out assistant messages with empty content to prevent API errors
          .filter((m) => m.role === 'user' || (m.role === 'assistant' && m.content.trim() !== ''));
        console.log(`Saving previous conversation: ${prevConversation.id} with ${convertedMessages.length} messages`);
        updateConversationMessages(prevConversation.id, convertedMessages);
      }
    }
  }, [currentConversation, prevConversation, prevMessages, updateConversationMessages]);

  // 将当前对话的消息实时写入缓存，供切换/新建前保存使用
  useEffect(() => {
    if (!currentConversation) return;
    if (typeof window === 'undefined') return;
    try {
      const serialized = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m: ThreadMessage) => ({
          id: m.id,
          role: m.role,
          content: m.content.map(c => c.type === 'text' ? c.text : '').join(''),
          createdAt: m.createdAt,
        }))
        // Filter out assistant messages with empty content to prevent API errors
        .filter((m) => m.role === 'user' || (m.role === 'assistant' && m.content.trim() !== ''));
      localStorage.setItem(THREAD_CACHE_PREFIX + currentConversation.id, JSON.stringify(serialized));
    } catch (e) {
      console.warn('Failed to cache thread messages', e);
    }
  }, [messages, currentConversation?.id]);

  // 在会话切换或页面关闭时，使用缓存持久化当前会话消息（避免在卸载阶段更新状态）
  useEffect(() => {
    const persistFromCache = (conversationId?: string | null) => {
      if (!conversationId) return;
      if (typeof window === 'undefined') return;
      try {
        const cached = localStorage.getItem(THREAD_CACHE_PREFIX + conversationId);
        if (!cached) return;
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          updateConversationMessages(conversationId, parsed);
        }
      } catch (e) {
        console.warn('Failed to persist from cache', e);
      }
    };

    const prevId = prevConversation?.id;
    // 当会话即将切换时，先持久化前一个会话
    if (prevId && prevId !== currentConversation?.id) {
      persistFromCache(prevId);
    }

    // 在刷新/关闭页面时持久化当前会话
    const beforeUnload = () => persistFromCache(currentConversation?.id ?? null);
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', beforeUnload);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeunload', beforeUnload);
      }
      // 注意：不要在卸载阶段调用更新状态的方法，防止产生卸载-挂载更新循环
    };
  }, [currentConversation?.id, prevConversation?.id, updateConversationMessages]);

  // 监听外部触发的立即持久化事件（例如切换模型前）
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const persistNow = () => {
      if (!currentConversation) return;
      try {
        const serialized = messages
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m: ThreadMessage) => ({
            id: m.id,
            role: m.role,
            content: m.content.map(c => c.type === 'text' ? c.text : '').join(''),
            createdAt: m.createdAt,
          }))
          // Filter out assistant messages with empty content to prevent API errors
          .filter((m) => m.role === 'user' || (m.role === 'assistant' && m.content.trim() !== ''));
        updateConversationMessages(currentConversation.id, serialized as any);
        // 同步写入缓存，保持一致
        localStorage.setItem(THREAD_CACHE_PREFIX + currentConversation.id, JSON.stringify(serialized));
        // eslint-disable-next-line no-console
        console.log('[AssistantInner] Persisted active conversation by external event:', currentConversation.id, 'messages:', serialized.length);
      } catch (e) {
        console.warn('Failed to persist active conversation on event', e);
      }
    };
    window.addEventListener('sprychat:persist-active-conversation', persistNow as EventListener);
    return () => {
      window.removeEventListener('sprychat:persist-active-conversation', persistNow as EventListener);
    };
  }, [currentConversation?.id, messages, updateConversationMessages]);

  // 当切换到新会话（尤其是空会话）时，强制切换到新线程，确保空白界面
  useEffect(() => {
    if (!currentConversation) return;
    if (onSwitchThread) {
      onSwitchThread();
    }
  }, [currentConversation?.id]);

  // 自动生成标题
  useEffect(() => {
    if (currentConversation?.title === "新对话" && messages.length > 1) {
        const firstUserMessage = messages.find(m => m.role === 'user');
        if (firstUserMessage) {
          const content = firstUserMessage.content.map(c => c.type === 'text' ? c.text : '').join('');
          if (content) {
            const title = content.substring(0, 20);
            if (title && title !== lastGeneratedTitle.current) {
              console.log('Auto-generating title:', title);
              lastGeneratedTitle.current = title;
              updateConversationTitle(currentConversation.id, title);
            }
          }
        }
    }
  }, [messages, currentConversation, updateConversationTitle]);

  return <Thread />;
};
