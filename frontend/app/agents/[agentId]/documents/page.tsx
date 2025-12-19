"use client";

import { useQuery } from "@tanstack/react-query";
import { agentApi } from "@/lib/api";
import { DocumentList } from "@/components/document-list";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Bot, FileText } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function DocumentsPage() {
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
              <h1 className="text-lg font-bold">{agent.name} - Documents</h1>
            </div>
          </div>
          <Button asChild variant="default" size="sm">
            <Link href={`/agents/${id}/chat`}>
              Back to Chat
            </Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">Upload Documents</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Add files to {agent.name}'s knowledge base. The agent will be able to answer questions based on the content of these files.
              </p>
              <FileUpload agentId={id} />
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Knowledge Base</h2>
              <div className="text-sm text-muted-foreground">
                {agent.document_count} files • {agent.total_chunks} chunks
              </div>
            </div>
            <DocumentList agentId={id} />
          </div>
        </div>
      </main>
    </div>
  );
}
