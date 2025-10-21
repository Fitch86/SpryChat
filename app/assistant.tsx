"use client";

import {
  AssistantRuntimeProvider,
  useLocalRuntime,
} from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { AssistantInner } from "./assistant-inner";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { SettingsDialog } from "@/components/settings-dialog";
import { ModelSelector } from "@/components/model-selector";
import { useSimpleConversations, ConversationsProvider } from "@/hooks/use-simple-conversations";
import { ClientOnly } from "@/components/client-only";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { ReactElement } from "react";
import { SettingsProvider, useSettings, Settings, UpdateSettingsFunction } from "@/hooks/use-settings.tsx";

export function Assistant() {
  return (
    <ClientOnly
      fallback={
        <div className="flex items-center justify-center h-screen">
          <div className="text-muted-foreground">加载中...</div>
        </div>
      }
    >
      <ConversationsProvider>
        <AssistantBody />
      </ConversationsProvider>
    </ClientOnly>
  );
}

function AssistantBody() {
  const { settings, updateSettings, isLoaded: isSettingsLoaded } = useSettings();
  const {
    conversations,
    currentConversation,
    isLoaded: isConversationsLoaded,
    createNewConversation,
    updateConversationTitle,
    updateConversationModel,
  } = useSimpleConversations();
  const isLoaded = isConversationsLoaded && isSettingsLoaded;
  const lastSyncedFromConversation = useRef<string | null>(null); // key: `${convId}:${model}`

  // Resolve initial messages for current conversation (saved first, then cache fallback)
  const initialMessagesResolved = useMemo(() => {
    if (!currentConversation) return [] as any[];
    const saved = (currentConversation.messages || [])
      .filter((m: any) => m.role !== 'data')
      // Filter out assistant messages with empty content to prevent API errors
      .filter((m: any) => m.role === 'user' || (m.role === 'assistant' && m.content?.trim()));
    if (saved.length > 0) return saved;
    if (typeof window === 'undefined') return saved as any[];
    try {
      const cachedStr = localStorage.getItem('sprychat-thread-cache-' + currentConversation.id);
      if (cachedStr) {
        const parsed = JSON.parse(cachedStr);
        if (Array.isArray(parsed)) {
          return parsed
            .filter((m: any) => m.role === 'user' || m.role === 'assistant')
            // Filter out assistant messages with empty content to prevent API errors
            .filter((m: any) => m.role === 'user' || (m.role === 'assistant' && m.content?.trim()));
        }
      }
    } catch {}
    return saved as any[];
  }, [currentConversation?.id, currentConversation?.messages]);

  // 依赖 Provider 层的首帧新建逻辑；此处不再重复新建，避免竞态

  // 当切换会话时，该会话的模型将用于API请求，但不再同步回全局设置以避免循环。
  // 全局模型由 ModelSelector 控制。

  // 如果会话没有模型（老历史），首访时初始化为当前全局模型（一次性），避免后续切换不上模型
  useEffect(() => {
    if (!currentConversation) return;
    if (!currentConversation.model && settings.model) {
      updateConversationModel(currentConversation.id, settings.model);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentConversation?.id]);

  // 不在这里把全局模型写回会话，以避免切换时的循环更新。
  // 会话模型仅在用户在 ModelSelector 中显式更改时更新。

  // 应用主题
  useEffect(() => {
    if (isLoaded) {
      document.documentElement.classList.toggle("dark", settings.theme === "dark");
    }
  }, [settings.theme, isLoaded]);

  if (!isLoaded) {
    return (
      <div className="flex h-dvh w-full items-center justify-center">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex flex-col">
        {/* 固定在顶部的 header */}
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 bg-background border-b transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <ModelSelector />
          </div>
          <div className="ml-auto px-4">
            <SettingsDialog />
          </div>
        </header>
        {/* 内容区域 - Thread 组件内部有自己的滚动 */}
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0 min-h-0">
          {isLoaded && currentConversation ? (
            <RuntimeSection
              key={currentConversation.id}
              currentConversationId={currentConversation.id}
              model={currentConversation.model || settings.model}
              initialMessages={initialMessagesResolved as any}
              render={(runtime) => (
                <AssistantRuntimeProvider runtime={runtime}>
                  <AssistantInner currentConversation={currentConversation} updateConversationTitle={updateConversationTitle} />
                </AssistantRuntimeProvider>
              )}
            />
          ) : null}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function RuntimeSection({
  currentConversationId,
  model,
  initialMessages,
  render,
}: {
  currentConversationId: string;
  model: string;
  initialMessages: any[];
  render: (runtime: any) => ReactElement;
}) {
  const { settings } = useSettings();
  // Create a fresh runtime for each conversation via key on parent
  const runtime = useChatRuntime({
    initialMessages,
    api: "/api/chat",
    headers: {
      'X-API-Key': settings.apiKey,
      'X-Base-URL': settings.baseURL,
      'X-Model': model,
      'X-Title': 'SpryChat',
      // include conversation id to ensure isolation if needed server-side
      'X-Conversation-Id': currentConversationId,
    },
  });
  // Reset thread ONLY for brand new conversations (no messages)
  useLayoutEffect(() => {
    if (!initialMessages || initialMessages.length > 0) return;
    try {
      runtime.switchToNewThread();
      // eslint-disable-next-line no-console
      console.log('[RuntimeSection] switched to new blank thread for', currentConversationId);
    } catch (e) {
      console.warn('Failed to switch to new thread:', e);
    }
  }, [currentConversationId, initialMessages?.length]);
  return render(runtime);
}
