"use client";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useChapterDownload } from "./useDownloads";
import { 
  Download, 
  Pause, 
  Play, 
  X, 
  Check, 
  AlertTriangle,
  Trash2 
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface DownloadButtonProps {
  chapterId: string;
  variant?: "default" | "icon" | "badge";
  size?: "sm" | "default" | "lg" | "icon";
  className?: string;
  showProgress?: boolean;
  showText?: boolean;
}

export function DownloadButton({ 
  chapterId, 
  variant = "default",
  size = "default",
  className,
  showProgress = true,
  showText = true,
}: DownloadButtonProps) {
  const {
    status,
    isLoading,
    downloadChapter,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    deleteChapter,
  } = useChapterDownload(chapterId);

  const [isActionLoading, setIsActionLoading] = useState(false);

  const handleAction = async (action: () => Promise<void>, successMessage?: string) => {
    if (isActionLoading) return;
    
    setIsActionLoading(true);
    try {
      await action();
      if (successMessage) {
        toast.success(successMessage);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsActionLoading(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getButtonContent = () => {
    if (isLoading || isActionLoading) {
      return {
        icon: <Download className="animate-spin" />,
        text: "Loading...",
        disabled: true,
      };
    }

    if (!status || status.status === 'not-downloaded') {
      return {
        icon: <Download />,
        text: "Download",
        onClick: () => handleAction(() => downloadChapter(), "Download started"),
        disabled: false,
      };
    }

    switch (status.status) {
      case 'queued':
        return {
          icon: <X />,
          text: "Queued",
          onClick: () => handleAction(() => cancelDownload(), "Download cancelled"),
          disabled: false,
        };
      
      case 'downloading':
        return {
          icon: <Pause />,
          text: `${Math.round(status.progress * 100)}%`,
          onClick: () => handleAction(() => pauseDownload(), "Download paused"),
          disabled: false,
        };
      
      case 'paused':
        return {
          icon: <Play />,
          text: `Paused (${Math.round(status.progress * 100)}%)`,
          onClick: () => handleAction(() => resumeDownload(), "Download resumed"),
          disabled: false,
        };
      
      case 'downloaded':
        return {
          icon: <Check />,
          text: showText ? `Downloaded (${formatBytes(status.sizeBytes)})` : "Downloaded",
          onClick: undefined,
          disabled: false,
          variant: "secondary" as const,
        };
      
      case 'error':
        return {
          icon: <AlertTriangle />,
          text: "Error",
          onClick: () => handleAction(() => downloadChapter(), "Retrying download"),
          disabled: false,
          variant: "destructive" as const,
        };
      
      default:
        return {
          icon: <Download />,
          text: "Download",
          onClick: () => handleAction(() => downloadChapter(), "Download started"),
          disabled: false,
        };
    }
  };

  const buttonContent = getButtonContent();

  if (variant === "badge") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn(
              "inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium",
              status?.status === 'downloaded' ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" :
              status?.status === 'downloading' ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" :
              status?.status === 'paused' ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" :
              status?.status === 'queued' ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" :
              status?.status === 'error' ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" :
              "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
              className
            )}>
              <span className="size-3">
                {buttonContent.icon}
              </span>
              {showText && (
                <span className="truncate">
                  {buttonContent.text}
                </span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{buttonContent.text}</p>
            {status && showProgress && status.status === 'downloading' && (
              <Progress value={status.progress * 100} className="w-32 mt-1" />
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (variant === "icon") {
    const IconButton = (
      <Button
        size="icon"
        variant={buttonContent.variant || "outline"}
        disabled={buttonContent.disabled}
        onClick={buttonContent.onClick}
        className={className}
      >
        {buttonContent.icon}
      </Button>
    );

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {IconButton}
          </TooltipTrigger>
          <TooltipContent>
            <p>{buttonContent.text}</p>
            {status && showProgress && status.status === 'downloading' && (
              <Progress value={status.progress * 100} className="w-32 mt-1" />
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Default variant
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Button
          size={size}
          variant={buttonContent.variant || "default"}
          disabled={buttonContent.disabled}
          onClick={buttonContent.onClick}
          className={className}
        >
          {buttonContent.icon}
          {showText && (
            <span className="ml-2">
              {buttonContent.text}
            </span>
          )}
        </Button>

        {status?.status === 'downloaded' && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="icon" variant="ghost">
                <Trash2 className="size-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete downloaded chapter?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove the chapter from your device and free up {formatBytes(status.sizeBytes)} of storage.
                  You can download it again later.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleAction(() => deleteChapter(), "Chapter deleted")}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {status && showProgress && status.status === 'downloading' && (
        <div className="space-y-1">
          <Progress value={status.progress * 100} className="w-full" />
          <div className="text-xs text-muted-foreground text-center">
            {Math.round(status.progress * 100)}% completed
          </div>
        </div>
      )}
    </div>
  );
}