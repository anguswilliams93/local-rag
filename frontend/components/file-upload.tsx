"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { documentApi } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Upload, File, X, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  agentId: string;
}

export function FileUpload({ agentId }: FileUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: (file: File) => documentApi.upload(agentId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", agentId] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles((prev) => [...prev, ...acceptedFiles]);
    acceptedFiles.forEach((file) => {
      uploadMutation.mutate(file);
    });
  }, [agentId, uploadMutation]);

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

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
          isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
        )}
      >
        <input {...getInputProps()} />
        <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
        <p className="text-sm font-medium">
          {isDragActive ? "Drop files here" : "Drag & drop files here, or click to select"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Supported: PDF, DOCX, TXT, MD, CSV, Excel
        </p>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, i) => (
            <Card key={i} className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-3 overflow-hidden">
                <File className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm truncate">{file.name}</span>
              </div>
              <div className="flex items-center gap-2">
                {uploadMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
