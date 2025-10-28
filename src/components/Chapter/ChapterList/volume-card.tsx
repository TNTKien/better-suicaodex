import { ListTree, ListX } from "lucide-react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import type { Volume } from "@/types/types";
import { ChapterCard } from "./chapter-card";

interface VolumeCardProps {
	volume: Volume;
	finalChapter?: string;
}

const getVolumeRange = (chapters: Volume["chapters"]): string => {
	if (chapters.length === 0) return "No chapters";

	const firstChapter = chapters[0]?.chapter;
	const lastChapter = chapters[chapters.length - 1]?.chapter;

	if (!firstChapter && !lastChapter) return "";
	if (!lastChapter) return `Ch. ${firstChapter}`;
	if (!firstChapter) return `Ch. ${lastChapter}`;

	return `Ch. ${lastChapter} - ${firstChapter}`;
};

export const VolumeCard = ({ volume, finalChapter }: VolumeCardProps) => {
	const volumeLabel = volume.vol ? `Volume ${volume.vol}` : "No Volume";
	const volumeRange = getVolumeRange(volume.chapters);

	return (
		<Accordion type="multiple" defaultValue={["vol"]}>
			<AccordionItem value="vol" className="border-none">
				<AccordionTrigger className="[&>svg]:w-5 [&>svg]:h-5 hover:no-underline">
					<div className="flex gap-0.5 items-center text-base">
						{volumeLabel === "No Volume" ? <ListX /> : <ListTree />}
						{volumeLabel}
					</div>
					<span className="text-muted-foreground font-medium">
						{volumeRange}
					</span>
				</AccordionTrigger>

				{volume.chapters.map((chapter) => (
					<AccordionContent key={chapter.chapter} className="pb-2">
						<ChapterCard chapters={chapter} finalChapter={finalChapter} />
					</AccordionContent>
				))}
			</AccordionItem>
		</Accordion>
	);
};
