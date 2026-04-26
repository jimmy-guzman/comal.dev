"use client";

import { AlertCircleIcon, RefreshCwIcon } from "lucide-react";

import type { ChatErrorKind } from "@/lib/chat/errors";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export interface ErrorPartData {
  kind: ChatErrorKind;
  message: string;
  originalMessage?: string;
  retryable: boolean;
  statusCode?: number;
  suggestModelSwitch: boolean;
  title: string;
}

interface ErrorPartProps {
  canRetry: boolean;
  data: ErrorPartData;
  onRetry?: () => void;
}

export const ErrorPart = ({ canRetry, data, onRetry }: ErrorPartProps) => {
  const showRetry = canRetry && data.retryable && onRetry !== undefined;

  return (
    <Alert variant="destructive">
      <AlertCircleIcon />
      <AlertTitle>{data.title}</AlertTitle>
      <AlertDescription>
        <p>{data.message}</p>
        {data.suggestModelSwitch ? (
          <p>Switch to a different model from the selector below.</p>
        ) : null}
      </AlertDescription>
      {showRetry ? (
        <div className="mt-2">
          <Button onClick={onRetry} size="sm" variant="outline">
            <RefreshCwIcon />
            Retry
          </Button>
        </div>
      ) : null}
    </Alert>
  );
};
