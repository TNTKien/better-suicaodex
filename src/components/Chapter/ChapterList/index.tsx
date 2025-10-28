import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import useSWR from "swr";
import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from "@/components/ui/pagination";
import { getChapterVolume } from "@/lib/mangadex/chapter";
import type { Volume } from "@/types/types";
import { VolumeCard } from "./volume-card";

interface ChapterListProps {
	mangaID: string;
	language: string[];
	limit: number;
	finalChapter?: string;
	r18?: boolean;
	showUnavailable?: boolean;
}

export const ChapterList = ({
	mangaID,
	language,
	limit,
	finalChapter,
	r18,
	showUnavailable,
}: ChapterListProps) => {
	const [currentPage, setCurrentPage] = useState(1);
	const [volume, setVolume] = useState<Volume[]>([]);
	const [totalPages, setTotalPages] = useState(0);
	const offset = (currentPage - 1) * limit;

	const { data, error, isLoading } = useSWR(
		[mangaID, language, limit, offset, r18, showUnavailable],
		([mangaID, language, limit, offset, r18, showUnavailable]) =>
			getChapterVolume(mangaID, language, limit, offset, r18, showUnavailable),
		{
			refreshInterval: 1000 * 60 * 10,
		},
	);

	useEffect(() => {
		if (data) {
			setVolume(data.volumes);
			setTotalPages(Math.ceil(data.total / limit));
		}
	}, [data]);

	if (isLoading)
		return (
			<div className="flex justify-center items-center w-full h-16">
				<Loader2 className="animate-spin w-8 h-8" />
			</div>
		);

	if (error)
		return (
			<div className="flex justify-center items-center w-full h-16 bg-secondary rounded-sm mt-4">
				<p className="font-semibold">Có lỗi xảy ra, vui lòng thử lại sau!</p>
			</div>
		);

	if (data?.total === 0)
		return (
			<div className="flex justify-center items-center w-full h-16 bg-secondary rounded-sm mt-4">
				<p className="font-semibold">Truyện này chưa có chương nào!</p>
			</div>
		);

	return (
		<>
			<div className="flex flex-col gap-0">
				{volume.length > 0 &&
					volume.map((vol) => (
						<VolumeCard
							key={vol.vol}
							volume={vol}
							finalChapter={finalChapter}
						/>
					))}
			</div>

			{totalPages > 1 && (
				<Pagination className="mt-4">
					<PaginationContent>
						<PaginationPrevious
							className="w-8 h-8"
							onClick={() => setCurrentPage((prev) => prev - 1)}
							disabled={currentPage === 1}
						/>

						{totalPages <= 7 ? (
							// Show all pages if total is 7 or less
							Array.from({ length: totalPages }, (_, i) => (
								<PaginationItem key={i + 1}>
									<PaginationLink
										className="w-8 h-8"
										isActive={i + 1 === currentPage}
										onClick={() => setCurrentPage(i + 1)}
									>
										{i + 1}
									</PaginationLink>
								</PaginationItem>
							))
						) : currentPage <= 4 ? (
							// Near start: show 1, 2, 3, 4, 5, ..., lastPage
							<>
								{[1, 2, 3, 4, 5].map((num) => (
									<PaginationItem key={num}>
										<PaginationLink
											className="w-8 h-8"
											isActive={num === currentPage}
											onClick={() => setCurrentPage(num)}
										>
											{num}
										</PaginationLink>
									</PaginationItem>
								))}
								<PaginationEllipsis />
								<PaginationItem>
									<PaginationLink
										className="w-8 h-8"
										onClick={() => setCurrentPage(totalPages)}
									>
										{totalPages}
									</PaginationLink>
								</PaginationItem>
							</>
						) : currentPage >= totalPages - 3 ? (
							// Near end: show 1, ..., lastPage-4, lastPage-3, lastPage-2, lastPage-1, lastPage
							<>
								<PaginationItem>
									<PaginationLink
										className="w-8 h-8"
										onClick={() => setCurrentPage(1)}
									>
										1
									</PaginationLink>
								</PaginationItem>
								<PaginationEllipsis />
								{[
									totalPages - 4,
									totalPages - 3,
									totalPages - 2,
									totalPages - 1,
									totalPages,
								].map((num) => (
									<PaginationItem key={num}>
										<PaginationLink
											className="w-8 h-8"
											isActive={num === currentPage}
											onClick={() => setCurrentPage(num)}
										>
											{num}
										</PaginationLink>
									</PaginationItem>
								))}
							</>
						) : (
							// Middle: show 1, ..., currentPage-1, currentPage, currentPage+1, ..., lastPage
							<>
								<PaginationItem>
									<PaginationLink
										className="w-8 h-8"
										onClick={() => setCurrentPage(1)}
									>
										1
									</PaginationLink>
								</PaginationItem>
								<PaginationEllipsis />
								{[currentPage - 1, currentPage, currentPage + 1].map((num) => (
									<PaginationItem key={num}>
										<PaginationLink
											className="w-8 h-8"
											isActive={num === currentPage}
											onClick={() => setCurrentPage(num)}
										>
											{num}
										</PaginationLink>
									</PaginationItem>
								))}
								<PaginationEllipsis />
								<PaginationItem>
									<PaginationLink
										className="w-8 h-8"
										onClick={() => setCurrentPage(totalPages)}
									>
										{totalPages}
									</PaginationLink>
								</PaginationItem>
							</>
						)}

						<PaginationNext
							className="w-8 h-8"
							onClick={() => setCurrentPage((prev) => prev + 1)}
							disabled={currentPage === totalPages}
						/>
					</PaginationContent>
				</Pagination>
			)}
		</>
	);
};
