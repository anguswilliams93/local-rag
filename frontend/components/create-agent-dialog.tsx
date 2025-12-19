"use client";

import { useState, useEffect, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import { agentApi, documentApi, Agent } from "@/lib/api";
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
import { Card } from "@/components/ui/card";
import { Upload, File, Loader2, CheckCircle2, ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreateAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent?: Agent | null;
}

interface UploadingFile {
  file: File;
  status: "uploading" | "success" | "error";
  error?: string;
}

const DEFAULT_SYSTEM_PROMPT = `You are a helpful, knowledgeable assistant. Answer questions based on the provided context from the user's documents.

Guidelines:
- Be concise and accurate in your responses
- If the context doesn't contain relevant information, say so honestly
- Cite specific details from the documents when possible
- Ask clarifying questions if the user's query is ambiguous`;

export function CreateAgentDialog({ open, onOpenChange, agent }: CreateAgentDialogProps) {
  const [step, setStep] = useState<"details" | "documents">("details");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [model, setModel] = useState("openai/gpt-4o-mini");
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [createdAgentId, setCreatedAgentId] = useState<string | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);

  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      if (agent) {
        setName(agent.name);
        setDescription(agent.description || "");
        setModel(agent.model);
        setSystemPrompt(agent.system_prompt || DEFAULT_SYSTEM_PROMPT);
        setStep("details");
      } else {
        setName("");
        setDescription("");
        setModel("openai/gpt-4o-mini");
        setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
        setStep("details");
        setCreatedAgentId(null);
        setUploadingFiles([]);
      }
    }
  }, [agent, open]);

  const createMutation = useMutation({
    mutationFn: (data: any) => {
      if (agent) {
        return agentApi.update(agent.id, data);
      }
      return agentApi.create(data);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      if (!agent) {
        // New agent - go to document upload step
        setCreatedAgentId(result.id);
        setStep("documents");
      } else {
        // Editing - close dialog
        onOpenChange(false);
      }
    },
  });

  const uploadFile = useCallback(async (file: File, agentId: string) => {
    setUploadingFiles((prev) => [...prev, { file, status: "uploading" }]);
    try {
      await documentApi.upload(agentId, file);
      setUploadingFiles((prev) =>
        prev.map((f) => (f.file === file ? { ...f, status: "success" } : f))
      );
      queryClient.invalidateQueries({ queryKey: ["documents", agentId] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    } catch (error: any) {
      setUploadingFiles((prev) =>
        prev.map((f) =>
          f.file === file ? { ...f, status: "error", error: error.message } : f
        )
      );
    }
  }, [queryClient]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (createdAgentId) {
        acceptedFiles.forEach((file) => uploadFile(file, createdAgentId));
      }
    },
    [createdAgentId, uploadFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "text/plain": [".txt"],
      "text/markdown": [".md"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
  });

  const handleSubmitDetails = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name,
      description,
      model,
      system_prompt: systemPrompt,
    });
  };

  const handleFinish = () => {
    onOpenChange(false);
  };

  const isUploading = uploadingFiles.some((f) => f.status === "uploading");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        {step === "details" ? (
          <form onSubmit={handleSubmitDetails}>
            <DialogHeader>
              <DialogTitle>{agent ? "Edit Agent" : "Create New Agent"}</DialogTitle>
              <DialogDescription>
                {agent ? "Update your agent's configuration." : "Step 1: Configure your RAG agent's personality and model."}
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
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {agent ? "Saving..." : "Creating..."}
                  </>
                ) : agent ? (
                  "Save Changes"
                ) : (
                  <>
                    Next: Add Documents
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Add Documents</DialogTitle>
              <DialogDescription>
                Step 2: Upload documents to your agent's knowledge base. You can also do this later.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div
                {...getRootProps()}
                className={cn(
                  "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                  isDragActive
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50"
                )}
              >
                <input {...getInputProps()} />
                <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {isDragActive ? "Drop files here" : "Drag & drop files, or click to select"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, DOCX, TXT, MD, CSV, Excel
                </p>
              </div>

              {uploadingFiles.length > 0 && (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {uploadingFiles.map((item, i) => (
                    <Card key={i} className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <File className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate">{item.file.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.status === "uploading" && (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                        {item.status === "success" && (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        )}
                        {item.status === "error" && (
                          <span className="text-xs text-destructive">Failed</span>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("details")}
                className="sm:mr-auto"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button type="button" variant="outline" onClick={handleFinish}>
                Skip for Now
              </Button>
              <Button type="button" onClick={handleFinish} disabled={isUploading}>
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : uploadingFiles.length > 0 ? (
                  "Done"
                ) : (
                  "Finish"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
