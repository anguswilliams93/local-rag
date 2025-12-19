import { Agent } from "@/lib/api";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, MessageSquare, Settings, Trash2, Calendar } from "lucide-react";
import { formatDate } from "@/lib/format";
import Link from "next/link";

interface AgentCardProps {
  agent: Agent;
  onDelete: () => void;
  onEdit: () => void;
}

export function AgentCard({ agent, onDelete, onEdit }: AgentCardProps) {
  return (
    <Card className="flex flex-col h-full hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-xl">{agent.name}</CardTitle>
          <Badge variant="secondary">{agent.model.split('/').pop()}</Badge>
        </div>
        <CardDescription className="line-clamp-2 min-h-[2.5rem]">
          {agent.description || "No description provided."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span>{agent.document_count} Documents</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>Created {formatDate(agent.created_at)}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="grid grid-cols-2 gap-2">
        <Button asChild variant="default" className="w-full">
          <Link href={`/agents/${agent.id}/chat`}>
            <MessageSquare className="h-4 w-4 mr-2" />
            Chat
          </Link>
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link href={`/agents/${agent.id}/documents`}>
            <FileText className="h-4 w-4 mr-2" />
            Docs
          </Link>
        </Button>
        <Button variant="ghost" size="sm" onClick={onEdit} className="w-full">
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete} className="w-full text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </Button>
      </CardFooter>
    </Card>
  );
}
