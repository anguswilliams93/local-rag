"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { agentApi, Agent } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ModelSelector } from "@/components/model-selector";

interface CreateAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent?: Agent | null;
}

const DEFAULT_SYSTEM_PROMPT = `You are a helpful, knowledgeable assistant. Answer questions based on the provided context from the user's documents.

Guidelines:
- Be concise and accurate in your responses
- If the context doesn't contain relevant information, say so honestly
- Cite specific details from the documents when possible
- Ask clarifying questions if the user's query is ambiguous`;

export function CreateAgentDialog({ open, onOpenChange, agent }: CreateAgentDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [model, setModel] = useState("openai/gpt-4o-mini");
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);

  const queryClient = useQueryClient();

  useEffect(() => {
    if (agent) {
      setName(agent.name);
      setDescription(agent.description || "");
      setModel(agent.model);
      setSystemPrompt(agent.system_prompt || DEFAULT_SYSTEM_PROMPT);
    } else {
      setName("");
      setDescription("");
      setModel("openai/gpt-4o-mini");
      setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
    }
  }, [agent, open]);

  const mutation = useMutation({
    mutationFn: (data: any) => {
      if (agent) {
        return agentApi.update(agent.id, data);
      }
      return agentApi.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      onOpenChange(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      name,
      description,
      model,
      system_prompt: systemPrompt,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{agent ? "Edit Agent" : "Create New Agent"}</DialogTitle>
            <DialogDescription>
              Configure your RAG agent's personality and model.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Knowledge Assistant"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Briefly describe what this agent knows..."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="model">Model</Label>
              <ModelSelector value={model} onValueChange={setModel} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="prompt">System Prompt</Label>
              <Textarea
                id="prompt"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="You are a helpful assistant..."
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : agent ? "Save Changes" : "Create Agent"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
