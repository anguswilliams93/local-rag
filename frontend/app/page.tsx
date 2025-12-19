"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { agentApi, Agent } from "@/lib/api";
import { AgentCard } from "@/components/agent-card";
import { CreateAgentDialog } from "@/components/create-agent-dialog";
import { SettingsDialog } from "@/components/settings-dialog";
import { Button } from "@/components/ui/button";
import { Plus, Bot, Loader2, Settings } from "lucide-react";

export default function HomePage() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [editAgent, setEditAgent] = useState<Agent | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["agents"],
    queryFn: agentApi.list,
  });

  const deleteMutation = useMutation({
    mutationFn: agentApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this agent? All documents and chat history will be lost.")) {
      deleteMutation.mutate(id);
    }
  };

  const handleEdit = (agent: Agent) => {
    setEditAgent(agent);
    setCreateDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">Ragooo</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setSettingsDialogOpen(true)}>
              <Settings className="h-4 w-4" />
            </Button>
            <Button onClick={() => { setEditAgent(null); setCreateDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              New Agent
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-destructive">Failed to load agents</p>
            <p className="text-sm text-muted-foreground mt-1">
              Make sure the backend server is running at http://localhost:8000
            </p>
          </div>
        ) : data?.agents.length === 0 ? (
          <div className="text-center py-12">
            <Bot className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h2 className="text-xl font-semibold mb-2">No agents yet</h2>
            <p className="text-muted-foreground mb-4">
              Create your first RAG agent to get started
            </p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Agent
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data?.agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onDelete={() => handleDelete(agent.id)}
                onEdit={() => handleEdit(agent)}
              />
            ))}
          </div>
        )}
      </main>

      <CreateAgentDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        agent={editAgent}
      />

      <SettingsDialog
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
      />
    </div>
  );
}
