"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { documentApi, Document } from "@/lib/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, FileText, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { formatBytes, formatDate } from "@/lib/format";

interface DocumentListProps {
  agentId: string;
}

export function DocumentList({ agentId }: DocumentListProps) {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["documents", agentId],
    queryFn: () => documentApi.list(agentId),
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: string) => documentApi.delete(agentId, docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", agentId] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-destructive">
        <AlertCircle className="h-12 w-12 mx-auto mb-4" />
        <p>Failed to load documents</p>
      </div>
    );
  }

  if (data?.documents.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed rounded-lg">
        <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-20" />
        <p className="text-muted-foreground">No documents uploaded yet.</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Filename</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Chunks</TableHead>
            <TableHead>Uploaded</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.documents.map((doc) => (
            <TableRow key={doc.id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  {doc.original_filename}
                </div>
              </TableCell>
              <TableCell className="uppercase text-[10px]">{doc.file_type}</TableCell>
              <TableCell>{formatBytes(doc.file_size)}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {doc.status === "completed" ? (
                    <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Ready
                    </Badge>
                  ) : doc.status === "processing" ? (
                    <Badge variant="secondary">
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Processing
                    </Badge>
                  ) : doc.status === "failed" ? (
                    <Badge variant="destructive">Failed</Badge>
                  ) : (
                    <Badge variant="outline">Pending</Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>{doc.chunk_count}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {formatDate(doc.created_at)}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteMutation.mutate(doc.id)}
                  disabled={deleteMutation.isPending}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
