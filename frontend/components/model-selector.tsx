"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { modelsApi, Model } from "@/lib/api";

interface ModelSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
}

// Extract provider from model ID (e.g., "openai/gpt-4" -> "OpenAI")
function getProvider(modelId: string): string {
  const providerMap: Record<string, string> = {
    "openai": "OpenAI",
    "anthropic": "Anthropic",
    "google": "Google",
    "x-ai": "xAI (Grok)",
    "amazon": "Amazon",
    "deepseek": "DeepSeek",
    "mistralai": "Mistral",
    "meta-llama": "Meta (Llama)",
    "qwen": "Qwen",
    "cohere": "Cohere",
    "perplexity": "Perplexity",
    "nvidia": "NVIDIA",
    "microsoft": "Microsoft",
    "moonshotai": "Moonshot",
    "nousresearch": "Nous Research",
    "01-ai": "01.AI",
    "openrouter": "OpenRouter",
    "neversleep": "NeverSleep",
    "cognitivecomputations": "Cognitive Computations",
    "sao10k": "Sao10K",
    "aetherwiing": "AetherWiing",
    "gryphe": "Gryphe",
    "undi95": "Undi95",
    "thedrummer": "TheDrummer",
    "inflection": "Inflection",
    "databricks": "Databricks",
    "liquid": "Liquid",
    "ai21": "AI21",
    "lynn": "Lynn",
    "aion-labs": "Aion Labs",
    "allenai": "Allen AI",
    "all-hands": "All Hands",
    "arcee": "Arcee",
    "featherless": "Featherless",
    "infermatic": "Infermatic",
    "mancer": "Mancer",
    "nothingiisreal": "NothingIIsReal",
    "pygmalionai": "Pygmalion AI",
    "sophosympatheia": "Sophosympatheia",
    "thebloke": "TheBloke",
    "arliai": "ArliAI",
    "eva-unit-01": "Eva Unit 01",
    "huggingface": "Hugging Face",
    "jondurbin": "Jon Durbin",
    "koboldai": "KoboldAI",
    "lizpreciatior": "Lizpreciatior",
    "minimax": "MiniMax",
    "raifle": "Raifle",
    "teknium": "Teknium",
    "xwin-lm": "XWin LM",
    "zhipu": "Zhipu",
    "black-forest-labs": "Black Forest Labs",
    "bytedance": "ByteDance",
    "together": "Together",
    "fireworks": "Fireworks",
    "rekaai": "Reka AI",
    "xiaomi": "Xiaomi",
  };

  const provider = modelId.split("/")[0];
  return providerMap[provider] || provider.charAt(0).toUpperCase() + provider.slice(1);
}

// Group models by provider
function groupModelsByProvider(models: Model[]): Record<string, Model[]> {
  const groups: Record<string, Model[]> = {};

  for (const model of models) {
    const provider = getProvider(model.id);
    if (!groups[provider]) {
      groups[provider] = [];
    }
    groups[provider].push(model);
  }

  // Sort providers alphabetically, but put popular ones first
  const priorityOrder = ["OpenAI", "Anthropic", "Google", "xAI (Grok)", "DeepSeek", "Mistral", "Meta (Llama)", "Amazon", "Qwen", "Cohere", "NVIDIA", "Perplexity"];
  const sortedGroups: Record<string, Model[]> = {};

  // Add priority providers first
  for (const provider of priorityOrder) {
    if (groups[provider]) {
      sortedGroups[provider] = groups[provider];
    }
  }

  // Add remaining providers alphabetically
  const remainingProviders = Object.keys(groups)
    .filter(p => !priorityOrder.includes(p))
    .sort();

  for (const provider of remainingProviders) {
    sortedGroups[provider] = groups[provider];
  }

  return sortedGroups;
}

// Format pricing for display
function formatPricing(model: Model): string {
  if (!model.pricing?.prompt) return "";
  const prompt = parseFloat(model.pricing.prompt);
  if (prompt === 0) return "Free";
  // Price per million tokens
  const perMillion = prompt * 1000000;
  if (perMillion < 0.01) return `$${(perMillion).toFixed(4)}/M`;
  if (perMillion < 1) return `$${(perMillion).toFixed(2)}/M`;
  return `$${perMillion.toFixed(0)}/M`;
}

export function ModelSelector({ value, onValueChange }: ModelSelectorProps) {
  const [open, setOpen] = React.useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["models"],
    queryFn: modelsApi.list,
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
  });

  const models = data?.models || [];
  const groupedModels = React.useMemo(() => groupModelsByProvider(models), [models]);

  const selectedModel = models.find((model) => model.id === value);
  const selectedProvider = value ? getProvider(value) : "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading models...
            </span>
          ) : selectedModel ? (
            <span className="truncate">
              {selectedModel.name}
              <span className="ml-2 text-muted-foreground text-xs">
                ({selectedProvider})
              </span>
            </span>
          ) : value ? (
            <span className="truncate">
              {value.split("/").pop()}
              <span className="ml-2 text-muted-foreground text-xs">
                ({getProvider(value)})
              </span>
            </span>
          ) : (
            "Select a model..."
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[450px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search models..." />
          <CommandList className="max-h-[400px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : error ? (
              <CommandEmpty>Failed to load models. Check API connection.</CommandEmpty>
            ) : (
              <>
                <CommandEmpty>No model found.</CommandEmpty>
                {Object.entries(groupedModels).map(([provider, providerModels]) => (
                  <CommandGroup key={provider} heading={provider}>
                    {providerModels.map((model) => {
                      const pricing = formatPricing(model);
                      return (
                        <CommandItem
                          key={model.id}
                          value={`${model.name} ${provider} ${model.id}`}
                          onSelect={() => {
                            onValueChange(model.id);
                            setOpen(false);
                          }}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center">
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                value === model.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <span>{model.name}</span>
                          </div>
                          {pricing && (
                            <span className="text-xs text-muted-foreground ml-2">
                              {pricing}
                            </span>
                          )}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                ))}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
