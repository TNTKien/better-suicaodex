"use client";

import { useRouter } from "next/navigation";
import useSWR from "swr";
import ResultTabs from "@/components/Search/Result/result-tabs";
import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from "@/components/ui/pagination";
import { useConfig } from "@/hooks/use-config";
import { getMangasByTag } from "@/lib/mangadex/tag";

interface TagPageProps {
	id: string;
	page: number;
}

export default function TagPage({ id, page }: TagPageProps) {
	const offset = (page - 1) * 32;
	const [config] = useConfig();
	const router = useRouter();

	const { data, error, isLoading } = useSWR(
		["tag", id, 32, offset, config.translatedLanguage, config.r18],
		([, id, limit, offset, language, r18]) =>
			getMangasByTag(id, limit, offset, language, r18),
	);
	const totalPages = Math.ceil((data?.total || 0) / 32);
	const handlePageChange = (newPage: number) => {
		router.push(`/tag/${id}/?page=${newPage}`);
	};

	return (
		<>
			<ResultTabs mangas={data?.mangas} isError={error} isLoading={isLoading} />
			{totalPages > 1 && (
				<Pagination className="mt-4">
					<PaginationContent>
						<PaginationPrevious
							className="w-8 h-8"
							onClick={() => handlePageChange(page - 1)}
							disabled={page === 1}
						/>

						{totalPages <= 7 ? (
							// Show all pages if total is 7 or less
							Array.from({ length: totalPages }, (_, i) => (
								<PaginationItem key={i + 1}>
									<PaginationLink
										className="w-8 h-8"
										isActive={i + 1 === page}
										onClick={() => handlePageChange(i + 1)}
									>
										{i + 1}
									</PaginationLink>
								</PaginationItem>
							))
						) : page <= 4 ? (
							// Near start: show 1, 2, 3, 4, 5, ..., lastPage
							<>
								{[1, 2, 3, 4, 5].map((num) => (
									<PaginationItem key={num}>
										<PaginationLink
											className="w-8 h-8"
											isActive={num === page}
											onClick={() => handlePageChange(num)}
										>
											{num}
										</PaginationLink>
									</PaginationItem>
								))}
								<PaginationEllipsis />
								<PaginationItem>
									<PaginationLink
										className="w-8 h-8"
										onClick={() => handlePageChange(totalPages)}
									>
										{totalPages}
									</PaginationLink>
								</PaginationItem>
							</>
						) : page >= totalPages - 3 ? (
							// Near end: show 1, ..., lastPage-4, lastPage-3, lastPage-2, lastPage-1, lastPage
							<>
								<PaginationItem>
									<PaginationLink
										className="w-8 h-8"
										onClick={() => handlePageChange(1)}
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
											isActive={num === page}
											onClick={() => handlePageChange(num)}
										>
											{num}
										</PaginationLink>
									</PaginationItem>
								))}
							</>
						) : (
							// Middle: show 1, ..., page-1, page, page+1, ..., lastPage
							<>
								<PaginationItem>
									<PaginationLink
										className="w-8 h-8"
										onClick={() => handlePageChange(1)}
									>
										1
									</PaginationLink>
								</PaginationItem>
								<PaginationEllipsis />
								{[page - 1, page, page + 1].map((num) => (
									<PaginationItem key={num}>
										<PaginationLink
											className="w-8 h-8"
											isActive={num === page}
											onClick={() => handlePageChange(num)}
										>
											{num}
										</PaginationLink>
									</PaginationItem>
								))}
								<PaginationEllipsis />
								<PaginationItem>
									<PaginationLink
										className="w-8 h-8"
										onClick={() => handlePageChange(totalPages)}
									>
										{totalPages}
									</PaginationLink>
								</PaginationItem>
							</>
						)}

						<PaginationNext
							className="w-8 h-8"
							onClick={() => handlePageChange(page + 1)}
							disabled={page === totalPages}
						/>
					</PaginationContent>
				</Pagination>
			)}
		</>
	);
}
