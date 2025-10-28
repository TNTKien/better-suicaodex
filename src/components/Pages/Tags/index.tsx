"use client";

import Image from "next/image";
import useSWR from "swr";
import DoroLoading from "#/images/doro-loading.gif";
import NoPrefetchLink from "@/components/Custom/no-prefetch-link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { getTags, groupTags } from "@/lib/mangadex/tag";

export default function TagsPage() {
	const { data, error, isLoading } = useSWR(
		["tags"],
		() => getTags(), // Fetch tags data
	);

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
							<Button
								asChild
								key={tag.id}
								variant="secondary"
								className="hover:bg-primary/20"
								size="sm"
							>
								<NoPrefetchLink href={`/tag/${tag.id}`}>
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
