import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Types
export interface Agent {
  id: string;
  name: string;
  description: string | null;
  model: string;
  system_prompt: string | null;
  created_at: string;
  updated_at: string;
  document_count: number;
  total_chunks: number;
}

export interface Document {
  id: string;
  agent_id: string;
  original_filename: string;
  file_type: string;
  file_size: number;
  status: "pending" | "processing" | "completed" | "failed";
  error_message: string | null;
  chunk_count: number;
  created_at: string;
  processed_at: string | null;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  response: string;
  sources: {
    filename: string;
    chunk_index: number | null;
    relevance: number | null;
  }[];
  context_used: boolean;
}

export interface Model {
  id: string;
  name: string;
  description?: string | null;
  context_length?: number | null;
  pricing?: {
    prompt?: string | null;
    completion?: string | null;
    image?: string | null;
  } | null;
  architecture?: {
    modality?: string | null;
    input_modalities?: string[] | null;
    output_modalities?: string[] | null;
  } | null;
}

export interface ModelsResponse {
  models: Model[];
  total: number;
}

// Conversation types
export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  sources: ChatResponse["sources"] | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  agent_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages?: Message[];
}

export interface ConversationListResponse {
  conversations: Conversation[];
  total: number;
}

// API Functions
export const agentApi = {
  list: async (): Promise<{ agents: Agent[]; total: number }> => {
    const { data } = await api.get("/agents");
    return data;
  },

  get: async (id: string): Promise<Agent> => {
    const { data } = await api.get(`/agents/${id}`);
    return data;
  },

  create: async (agent: {
    name: string;
    description?: string;
    model?: string;
    system_prompt?: string;
  }): Promise<Agent> => {
    const { data } = await api.post("/agents", agent);
    return data;
  },

  update: async (
    id: string,
    agent: {
      name?: string;
      description?: string;
      model?: string;
      system_prompt?: string;
    }
  ): Promise<Agent> => {
    const { data } = await api.patch(`/agents/${id}`, agent);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/agents/${id}`);
  },
};

export const documentApi = {
  list: async (agentId: string): Promise<{ documents: Document[]; total: number }> => {
    const { data } = await api.get(`/agents/${agentId}/documents`);
    return data;
  },

  upload: async (agentId: string, file: File): Promise<Document> => {
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await api.post(`/agents/${agentId}/documents`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  delete: async (agentId: string, docId: string): Promise<void> => {
    await api.delete(`/agents/${agentId}/documents/${docId}`);
  },
};

export const chatApi = {
  send: async (
    agentId: string,
    query: string,
    history: ChatMessage[] = [],
    conversationId?: string
  ): Promise<ChatResponse> => {
    const { data } = await api.post(`/agents/${agentId}/chat`, {
      query,
      chat_history: history,
      conversation_id: conversationId,
    });
    return data;
  },

  stream: (
    agentId: string,
    query: string,
    history: ChatMessage[] = [],
    onChunk: (chunk: string) => void,
    onSources: (sources: ChatResponse["sources"]) => void,
    onDone: () => void,
    onError: (error: string) => void,
    conversationId?: string
  ) => {
    const controller = new AbortController();

    fetch(`${API_BASE_URL}/agents/${agentId}/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, chat_history: history, conversation_id: conversationId }),
      signal: controller.signal,
    }).then(async (response) => {
      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            onChunk(line.slice(6));
          } else if (line.startsWith("sources: ")) {
            try {
              const sources = JSON.parse(line.slice(9));
              onSources(sources);
            } catch (e) {
              console.error("Error parsing sources", e);
            }
          } else if (line.startsWith("error: ")) {
            try {
              const errorData = JSON.parse(line.slice(7));
              onError(errorData.message || "Unknown error occurred");
            } catch {
              onError(line.slice(7));
            }
          } else if (line.startsWith("done: ")) {
            onDone();
          }
        }
      }
    }).catch((err) => {
      if (err.name !== 'AbortError') {
        onError(err.message || "Network error occurred");
      }
    });

    return () => controller.abort();
  },
};

export const conversationApi = {
  list: async (agentId: string): Promise<ConversationListResponse> => {
    const { data } = await api.get(`/agents/${agentId}/conversations`);
    return data;
  },

  get: async (agentId: string, conversationId: string): Promise<Conversation> => {
    const { data } = await api.get(`/agents/${agentId}/conversations/${conversationId}`);
    return data;
  },

  create: async (agentId: string, title?: string): Promise<Conversation> => {
    const { data } = await api.post(`/agents/${agentId}/conversations`, { title });
    return data;
  },

  update: async (agentId: string, conversationId: string, title: string): Promise<Conversation> => {
    const { data } = await api.patch(`/agents/${agentId}/conversations/${conversationId}`, { title });
    return data;
  },

  delete: async (agentId: string, conversationId: string): Promise<void> => {
    await api.delete(`/agents/${agentId}/conversations/${conversationId}`);
  },
};

export const modelsApi = {
  list: async (): Promise<ModelsResponse> => {
    const { data } = await api.get("/models");
    return data;
  },
};

// Settings types
export interface AppSettings {
  chunk_size: number;
  chunk_overlap: number;
  top_k_results: number;
  embedding_model: string;
  default_model: string;
  openrouter_configured: boolean;
  google_api_configured: boolean;
  openrouter_api_key_masked: string;
  google_api_key_masked: string;
}

export interface SettingsUpdate {
  chunk_size?: number;
  chunk_overlap?: number;
  top_k_results?: number;
  openrouter_api_key?: string;
  google_api_key?: string;
}

export const settingsApi = {
  get: async (): Promise<AppSettings> => {
    const { data } = await api.get("/settings");
    return data;
  },

  update: async (settings: SettingsUpdate): Promise<AppSettings> => {
    const { data } = await api.patch("/settings", settings);
    return data;
  },
};
