"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { conversationApi, Conversation } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PlusCircle,
  ChatCircle,
  DotsThreeVertical,
  Trash,
  Pencil,
} from "@phosphor-icons/react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Input } from "@/components/ui/input";

interface ConversationListProps {
  agentId: string;
  selectedId?: string;
  onSelect: (conversation: Conversation | null) => void;
  onNewChat: () => void;
}

export function ConversationList({
  agentId,
  selectedId,
  onSelect,
  onNewChat,
}: ConversationListProps) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["conversations", agentId],
    queryFn: () => conversationApi.list(agentId),
  });

  const deleteMutation = useMutation({
    mutationFn: (conversationId: string) =>
      conversationApi.delete(agentId, conversationId),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["conversations", agentId] });
      if (selectedId === deletedId) {
        onSelect(null);
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      conversationApi.update(agentId, id, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations", agentId] });
      setEditingId(null);
    },
  });

  const handleStartEdit = (conversation: Conversation) => {
    setEditingId(conversation.id);
    setEditTitle(conversation.title);
  };

  const handleSaveEdit = (id: string) => {
    if (editTitle.trim()) {
      updateMutation.mutate({ id, title: editTitle.trim() });
    } else {
      setEditingId(null);
    }
  };

  const conversations = data?.conversations || [];

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b">
        <Button
          onClick={onNewChat}
          className="w-full justify-start gap-2"
          variant="outline"
        >
          <PlusCircle className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isLoading ? (
            <div className="text-sm text-muted-foreground text-center py-4">
              Loading...
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-4">
              No conversations yet
            </div>
          ) : (
            conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={cn(
                  "group flex items-center gap-2 rounded-md px-2 py-2 hover:bg-primary/10 cursor-pointer",
                  selectedId === conversation.id && "bg-primary/15"
                )}
                onClick={() => onSelect(conversation)}
              >
                <ChatCircle className="h-4 w-4 shrink-0 text-muted-foreground" />

                <div className="flex-1 min-w-0">
                  {editingId === conversation.id ? (
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={() => handleSaveEdit(conversation.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleSaveEdit(conversation.id);
                        } else if (e.key === "Escape") {
                          setEditingId(null);
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="h-6 text-sm"
                      autoFocus
                    />
                  ) : (
                    <>
                      <div className="text-sm font-medium truncate">
                        {conversation.title || "New conversation"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(conversation.updated_at), {
                          addSuffix: true,
                        })}
                      </div>
                    </>
                  )}
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="h-6 w-6 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-accent rounded"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DotsThreeVertical className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEdit(conversation);
                      }}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMutation.mutate(conversation.id);
                      }}
                    >
                      <Trash className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
