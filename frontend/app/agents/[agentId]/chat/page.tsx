"use client";

import { useQuery } from "@tanstack/react-query";
import { agentApi } from "@/lib/api";
import { ChatInterface } from "@/components/chat-interface";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Bot, Settings } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function ChatPage() {
  const { agentId } = useParams();
  const id = Array.isArray(agentId) ? agentId[0] : agentId;

  const { data: agent, isLoading } = useQuery({
    queryKey: ["agents", id],
    queryFn: () => agentApi.get(id!),
    enabled: !!id,
  });

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!agent || !id) return <div className="p-8 text-destructive">Agent not found</div>;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="icon">
              <Link href="/">
                <ChevronLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <Bot className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-lg font-bold leading-none">{agent.name}</h1>
                <p className="text-xs text-muted-foreground mt-1">
                  {agent.model.split('/').pop()}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/agents/${id}/documents`}>
                Manage Documents
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6 max-w-7xl">
        <ChatInterface agentId={id} agentName={agent.name} />
      </main>
    </div>
  );
}
