"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useDownloads } from "./useDownloads";
import { DownloadButton } from "./DownloadButton";
import { 
  Download, 
  Trash2, 
  HardDrive, 
  Clock,
  CheckCircle,
  AlertTriangle,
  Pause,
  Play
} from "lucide-react";
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
import { formatDistanceToNow } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

export function DownloadsManagerPage() {
  const {
    downloads,
    queue,
    isLoading,
    storageQuota,
    cacheStats,
    clearAllDownloads,
    refreshData,
  } = useDownloads();

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'downloaded':
        return <CheckCircle className="size-4 text-green-500" />;
      case 'downloading':
        return <Download className="size-4 text-blue-500 animate-pulse" />;
      case 'paused':
        return <Pause className="size-4 text-yellow-500" />;
      case 'queued':
        return <Clock className="size-4 text-purple-500" />;
      case 'error':
        return <AlertTriangle className="size-4 text-red-500" />;
      default:
        return <Download className="size-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'downloaded':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'downloading':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'queued':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
              </CardHeader>
            </Card>
          ))}
        </div>

        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-8 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const totalDownloaded = downloads.filter(d => d.status === 'downloaded').length;
  const totalInProgress = downloads.filter(d => ['downloading', 'queued', 'paused'].includes(d.status)).length;
  const totalSize = downloads.reduce((sum, d) => sum + d.sizeBytes, 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Downloads Manager</h1>
        <p className="text-muted-foreground">
          Manage your offline chapters and monitor storage usage
        </p>
      </div>

      {/* Storage Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Downloaded Chapters</CardTitle>
            <CheckCircle className="size-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDownloaded}</div>
            <p className="text-xs text-muted-foreground">
              {formatBytes(totalSize)} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Download className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalInProgress}</div>
            <p className="text-xs text-muted-foreground">
              {queue.length} in queue
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
            <HardDrive className="size-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatBytes(storageQuota.used)}
            </div>
            <p className="text-xs text-muted-foreground">
              of {formatBytes(storageQuota.quota)} available
            </p>
            {storageQuota.quota > 0 && (
              <Progress 
                value={(storageQuota.used / storageQuota.quota) * 100} 
                className="mt-2"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      {(downloads.length > 0 || queue.length > 0) && (
        <div className="flex items-center gap-2">
          <Button onClick={refreshData} variant="outline">
            Refresh
          </Button>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="size-4 mr-2" />
                Clear All Downloads
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear all downloads?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will delete all downloaded chapters and cancel any downloads in progress. 
                  This will free up {formatBytes(totalSize)} of storage space.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={clearAllDownloads}>
                  Clear All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* Downloads List */}
      {downloads.length === 0 && queue.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Download className="size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No downloads yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Start downloading chapters to read them offline
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Your Downloads</h2>
          
          {downloads.map((chapter) => (
            <Card key={chapter.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0 mr-4">
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusIcon(chapter.status)}
                      <h3 className="font-medium truncate">
                        {chapter.manga?.title || 'Unknown Manga'}
                      </h3>
                      <Badge className={getStatusColor(chapter.status)}>
                        {chapter.status}
                      </Badge>
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        {chapter.vol && chapter.vol !== 'null' && `Vol. ${chapter.vol} `}
                        {chapter.chapter && chapter.chapter !== 'null' && `Ch. ${chapter.chapter}`}
                        {chapter.title && ` - ${chapter.title}`}
                      </p>
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{formatBytes(chapter.sizeBytes)}</span>
                        <span>{chapter.pageUrls.length} pages</span>
                        <span>
                          {formatDistanceToNow(new Date(chapter.updatedAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>

                    {chapter.status === 'downloading' && (
                      <div className="mt-2 space-y-1">
                        <Progress value={chapter.progress * 100} className="w-full" />
                        <p className="text-xs text-muted-foreground">
                          {Math.round(chapter.progress * 100)}% completed
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {chapter.status === 'downloaded' && (
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/chapter/${chapter.id}`}>
                          Read
                        </Link>
                      </Button>
                    )}
                    
                    <DownloadButton 
                      chapterId={chapter.id} 
                      variant="icon"
                      showProgress={false}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Cache Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Cache Statistics</CardTitle>
          <CardDescription>
            Information about your offline storage
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Total Images Cached</dt>
              <dd className="text-2xl font-bold">{cacheStats.entryCount}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Cache Size</dt>
              <dd className="text-2xl font-bold">{formatBytes(cacheStats.totalSize)}</dd>
            </div>
          </div>
          
          {cacheStats.oldestEntry && cacheStats.newestEntry && (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Oldest Entry</dt>
                <dd className="text-sm">
                  {formatDistanceToNow(new Date(cacheStats.oldestEntry), { addSuffix: true })}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Newest Entry</dt>
                <dd className="text-sm">
                  {formatDistanceToNow(new Date(cacheStats.newestEntry), { addSuffix: true })}
                </dd>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}