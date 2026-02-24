"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { getTags, groupTags } from "@/lib/mangadex/tag";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import DoroLoading from "#/images/doro-loading.gif";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import NoPrefetchLink from "@/components/Custom/no-prefetch-link";
import { generateSlug } from "@/lib/utils";

export default function TagsPage() {
  const { data, error, isLoading } = useQuery({
    queryKey: ["tags"],
    queryFn: () => getTags(),
  });

  if (isLoading) {
    return (
      <Alert className="rounded-sm border-none mt-4">
        <AlertDescription className="flex justify-center">
          <Image
            src={DoroLoading}
            alt="Loading..."
            unoptimized
            priority
            className="w-20 h-auto"
          />
        </AlertDescription>
      </Alert>
    );
  }

  if (error || !data) {
    return <div>Lỗi mất rồi 😭</div>;
  }

  const groupedTags = groupTags(data);
  //   console.log(groupedTags);

  return (
    <div className="space-y-4">
      {groupedTags.map((group) => (
        <div key={group.group} className="space-y-2">
          <Label className="font-bold text-lg">{group.name}</Label>
          <div className="flex flex-wrap gap-2">
            {group.tags.map((tag) => (
              <Button asChild key={tag.id} variant="secondary" size="sm">
                <NoPrefetchLink href={`/tag/${tag.id}/${generateSlug(tag.name)}`}>
                  {tag.name}
                </NoPrefetchLink>
              </Button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
