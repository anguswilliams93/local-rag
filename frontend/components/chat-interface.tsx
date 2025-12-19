"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChatMessage, ChatResponse, chatApi, conversationApi, Conversation, Message as ApiMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PaperPlaneTilt, CircleNotch, User, Robot, File, SidebarSimple } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { ConversationList } from "./conversation-list";

interface Message extends ChatMessage {
  id: string;
  sources?: ChatResponse["sources"];
  isStreaming?: boolean;
}

interface ChatInterfaceProps {
  agentId: string;
  agentName: string;
}

export function ChatInterface({ agentId, agentName }: ChatInterfaceProps) {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(typeof window !== 'undefined' && window.innerWidth >= 768);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Handle responsive sidebar on resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setShowSidebar(false);
      }
    };
    window.addEventListener('resize', handleResize);
    // Initial check
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Create conversation mutation
  const createConversation = useMutation({
    mutationFn: (title?: string) => conversationApi.create(agentId, title),
    onSuccess: (newConversation) => {
      queryClient.invalidateQueries({ queryKey: ["conversations", agentId] });
      setConversationId(newConversation.id);
    },
  });

  // Load conversation when selected
  const handleSelectConversation = async (conversation: Conversation | null) => {
    if (!conversation) {
      // New chat - clear everything
      setConversationId(null);
      setMessages([]);
      return;
    }

    try {
      const fullConversation = await conversationApi.get(agentId, conversation.id);
      setConversationId(fullConversation.id);

      // Convert API messages to local format
      if (fullConversation.messages) {
        const loadedMessages: Message[] = fullConversation.messages.map((m: ApiMessage) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          sources: m.sources || undefined,
        }));
        setMessages(loadedMessages);
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error("Error loading conversation:", error);
    }
  };

  const handleNewChat = () => {
    setConversationId(null);
    setMessages([]);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "",
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput("");
    setIsLoading(true);

    // Get or create conversation ID
    let activeConversationId = conversationId;

    if (!activeConversationId) {
      // Create a new conversation with first message as title
      const title = userMessage.content.slice(0, 100);
      const newConversation = await createConversation.mutateAsync(title);
      activeConversationId = newConversation.id;
      setConversationId(activeConversationId);
    }

    // Get chat history for context (only if not using conversation_id)
    // Since we're using conversation_id, the backend will load history
    const chatHistory: ChatMessage[] = [];

    try {
      // Use streaming with conversation_id
      chatApi.stream(
        agentId,
        userMessage.content,
        chatHistory,
        // onChunk
        (chunk) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessage.id
                ? { ...m, content: m.content + chunk }
                : m
            )
          );
        },
        // onSources
        (sources) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessage.id ? { ...m, sources } : m
            )
          );
        },
        // onDone
        () => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessage.id ? { ...m, isStreaming: false } : m
            )
          );
          setIsLoading(false);
          // Refresh conversation list to update "updated_at"
          queryClient.invalidateQueries({ queryKey: ["conversations", agentId] });
        },
        // onError
        (errorMessage) => {
          console.error("Stream error:", errorMessage);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessage.id
                ? {
                    ...m,
                    content: `Error: ${errorMessage}`,
                    isStreaming: false,
                  }
                : m
            )
          );
          setIsLoading(false);
        },
        activeConversationId
      );
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessage.id
            ? { ...m, content: "Error: Failed to get response.", isStreaming: false }
            : m
        )
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-12rem)]">
      {/* Conversation Sidebar */}
      {showSidebar && (
        <div className="w-64 border-r flex-shrink-0">
          <ConversationList
            agentId={agentId}
            selectedId={conversationId || undefined}
            onSelect={handleSelectConversation}
            onNewChat={handleNewChat}
          />
        </div>
      )}

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header with toggle */}
        <div className="p-2 border-b flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSidebar(!showSidebar)}
            className="h-8 w-8"
          >
            <SidebarSimple className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {conversationId ? "Chat" : "New Chat"}
          </span>
        </div>

        {/* Messages */}
        <div className="flex-1 p-4 overflow-y-auto" ref={scrollRef}>
          <div className="space-y-4 w-full max-w-4xl mx-auto">
            {messages.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Robot className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>Ask {agentName} anything based on your documents.</p>
              </div>
            )}
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3 w-full max-w-[90%]",
                  message.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                )}
              >
                <div className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                  message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                )}>
                  {message.role === "user" ? <User className="h-4 w-4" /> : <Robot className="h-4 w-4" />}
                </div>
                <div className="space-y-2 flex-1 min-w-0">
                  <div className={cn(
                    "p-4 rounded-lg",
                    message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}>
                    {message.role === "user" ? (
                      <p className="whitespace-pre-wrap text-base leading-relaxed">{message.content}</p>
                    ) : (
                      <div className="prose prose-base dark:prose-invert max-w-none text-foreground
                        [&>*:first-child]:mt-0 [&>*:last-child]:mb-0
                        [&_p]:my-3 [&_p]:leading-7 [&_p]:text-base
                        [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2
                        [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-2
                        [&_li]:my-1 [&_li]:text-base [&_li]:leading-7
                        [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-3
                        [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-5 [&_h2]:mb-2
                        [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2
                        [&_strong]:font-bold
                        [&_code]:bg-background/50 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono
                        [&_pre]:bg-background/50 [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:my-4
                        [&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:my-4
                        [&_hr]:my-4 [&_hr]:border-border
                        [&_table]:w-full [&_table]:text-sm [&_table]:my-4
                        [&_th]:border [&_th]:border-border [&_th]:px-3 [&_th]:py-2 [&_th]:bg-background/30 [&_th]:font-semibold
                        [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                      </div>
                    )}
                    {message.isStreaming && (
                      <span className="inline-block w-1.5 h-5 ml-1 bg-current animate-pulse" />
                    )}
                  </div>
                  {message.sources && message.sources.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(
                        message.sources.reduce((acc, source) => {
                          const filename = source.filename || "Unknown";
                          acc[filename] = (acc[filename] || 0) + 1;
                          return acc;
                        }, {} as Record<string, number>)
                      ).map(([filename, count]) => (
                        <Badge key={filename} variant="outline" className="text-[10px] flex items-center gap-1">
                          <File className="h-3 w-3" />
                          {filename} ({count} {count === 1 ? "chunk" : "chunks"})
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Input */}
        <div className="p-4 border-t">
          <form onSubmit={handleSubmit} className="relative w-full max-w-4xl mx-auto">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="min-h-[100px] pr-12 resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            <Button
              type="submit"
              size="icon"
              className="absolute right-2 bottom-2"
              disabled={!input.trim() || isLoading}
            >
              {isLoading ? <CircleNotch className="h-4 w-4 animate-spin" /> : <PaperPlaneTilt className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
