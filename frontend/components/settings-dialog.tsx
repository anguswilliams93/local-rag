"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { settingsApi, AppSettings, SettingsUpdate } from "@/lib/api";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, CheckCircle2, XCircle, Info, Eye, EyeOff, Key } from "lucide-react";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const queryClient = useQueryClient();

  // RAG settings
  const [chunkSize, setChunkSize] = useState(512);
  const [chunkOverlap, setChunkOverlap] = useState(50);
  const [topK, setTopK] = useState(5);

  // API keys
  const [openrouterKey, setOpenrouterKey] = useState("");
  const [googleKey, setGoogleKey] = useState("");
  const [showOpenrouterKey, setShowOpenrouterKey] = useState(false);
  const [showGoogleKey, setShowGoogleKey] = useState(false);

  const { data: settings, isLoading, error } = useQuery({
    queryKey: ["settings"],
    queryFn: settingsApi.get,
    enabled: open,
  });

  useEffect(() => {
    if (settings) {
      setChunkSize(settings.chunk_size);
      setChunkOverlap(settings.chunk_overlap);
      setTopK(settings.top_k_results);
      // Don't populate API keys - user must enter new ones to change
      setOpenrouterKey("");
      setGoogleKey("");
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: (data: SettingsUpdate) => settingsApi.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      // Clear API key inputs after successful save
      setOpenrouterKey("");
      setGoogleKey("");
    },
  });

  const handleSave = () => {
    const updates: SettingsUpdate = {};

    if (chunkSize !== settings?.chunk_size) {
      updates.chunk_size = chunkSize;
    }
    if (chunkOverlap !== settings?.chunk_overlap) {
      updates.chunk_overlap = chunkOverlap;
    }
    if (topK !== settings?.top_k_results) {
      updates.top_k_results = topK;
    }
    if (openrouterKey.trim()) {
      updates.openrouter_api_key = openrouterKey.trim();
    }
    if (googleKey.trim()) {
      updates.google_api_key = googleKey.trim();
    }

    mutation.mutate(updates);
  };

  const hasChanges =
    (settings &&
      (chunkSize !== settings.chunk_size ||
        chunkOverlap !== settings.chunk_overlap ||
        topK !== settings.top_k_results)) ||
    openrouterKey.trim() !== "" ||
    googleKey.trim() !== "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure API keys and RAG settings. Changes are temporary until server restart.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="py-8 text-center">
            <XCircle className="h-8 w-8 mx-auto mb-2 text-destructive" />
            <p className="text-sm text-destructive">Failed to load settings</p>
            <p className="text-xs text-muted-foreground mt-1">
              Make sure the backend server is running
            </p>
          </div>
        ) : settings ? (
          <div className="space-y-6 py-4">
            {/* API Keys Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                <Label className="text-sm font-semibold">API Keys</Label>
              </div>

              {/* OpenRouter API Key */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="openrouterKey" className="text-sm">
                    OpenRouter API Key
                  </Label>
                  <Badge
                    variant={settings.openrouter_configured ? "default" : "destructive"}
                    className="flex items-center gap-1"
                  >
                    {settings.openrouter_configured ? (
                      <>
                        <CheckCircle2 className="h-3 w-3" />
                        Configured
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3 w-3" />
                        Not Set
                      </>
                    )}
                  </Badge>
                </div>
                <div className="relative">
                  <Input
                    id="openrouterKey"
                    type={showOpenrouterKey ? "text" : "password"}
                    placeholder={
                      settings.openrouter_configured
                        ? settings.openrouter_api_key_masked
                        : "sk-or-v1-..."
                    }
                    value={openrouterKey}
                    onChange={(e) => setOpenrouterKey(e.target.value)}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowOpenrouterKey(!showOpenrouterKey)}
                  >
                    {showOpenrouterKey ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Get your key at{" "}
                  <a
                    href="https://openrouter.ai/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground"
                  >
                    openrouter.ai/keys
                  </a>
                </p>
              </div>

              {/* Google API Key */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="googleKey" className="text-sm">
                    Google API Key
                  </Label>
                  <Badge
                    variant={settings.google_api_configured ? "default" : "destructive"}
                    className="flex items-center gap-1"
                  >
                    {settings.google_api_configured ? (
                      <>
                        <CheckCircle2 className="h-3 w-3" />
                        Configured
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3 w-3" />
                        Not Set
                      </>
                    )}
                  </Badge>
                </div>
                <div className="relative">
                  <Input
                    id="googleKey"
                    type={showGoogleKey ? "text" : "password"}
                    placeholder={
                      settings.google_api_configured
                        ? settings.google_api_key_masked
                        : "AIza..."
                    }
                    value={googleKey}
                    onChange={(e) => setGoogleKey(e.target.value)}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowGoogleKey(!showGoogleKey)}
                  >
                    {showGoogleKey ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  For embeddings ({settings.embedding_model}). Get at{" "}
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground"
                  >
                    aistudio.google.com
                  </a>
                </p>
              </div>
            </div>

            <Separator />

            {/* RAG Settings Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4" />
                <Label className="text-sm font-semibold">RAG Settings</Label>
              </div>

              {/* Chunk Size */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="chunkSize" className="text-sm">
                    Chunk Size
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    {chunkSize} characters
                  </span>
                </div>
                <Input
                  id="chunkSize"
                  type="number"
                  min={100}
                  max={4000}
                  step={50}
                  value={chunkSize}
                  onChange={(e) => setChunkSize(parseInt(e.target.value) || 512)}
                />
                <p className="text-xs text-muted-foreground">
                  Smaller = more precise retrieval. Larger = more context per chunk.
                </p>
              </div>

              {/* Chunk Overlap */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="chunkOverlap" className="text-sm">
                    Chunk Overlap
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    {chunkOverlap} characters
                  </span>
                </div>
                <Input
                  id="chunkOverlap"
                  type="number"
                  min={0}
                  max={chunkSize - 1}
                  step={10}
                  value={chunkOverlap}
                  onChange={(e) => setChunkOverlap(parseInt(e.target.value) || 0)}
                />
                <p className="text-xs text-muted-foreground">
                  Overlap helps maintain context across chunk boundaries.
                </p>
              </div>

              {/* Top-K Results */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="topK" className="text-sm">
                    Context Chunks (Top-K)
                  </Label>
                  <span className="text-xs text-muted-foreground">{topK} chunks</span>
                </div>
                <Input
                  id="topK"
                  type="number"
                  min={1}
                  max={20}
                  value={topK}
                  onChange={(e) => setTopK(parseInt(e.target.value) || 5)}
                />
                <p className="text-xs text-muted-foreground">
                  Number of relevant chunks to include in LLM context.
                </p>
              </div>
            </div>

            {mutation.isSuccess && (
              <p className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                Settings saved successfully
              </p>
            )}

            {mutation.isError && (
              <p className="text-sm text-destructive">
                Error saving settings. Please check values and try again.
              </p>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handleSave} disabled={mutation.isPending || !hasChanges}>
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
