"use client";

import { useState } from "react";
import useSWR from "swr";
import GroupTitleTabs from "@/components/Groups/GroupTitles/group-titles-tabs";
import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from "@/components/ui/pagination";
import { GetAuthorTitles } from "@/lib/mangadex/author";

interface AuthorTitlesProps {
	id: string;
}

export default function AuthorTitles({ id }: AuthorTitlesProps) {
	const [page, setPage] = useState(1);
	const limit = 32;
	const offset = (page - 1) * limit;
	const { data, isLoading, error } = useSWR(
		["author-titles", id, limit, offset],
		([, id, limit, offset]) => GetAuthorTitles(id, limit, offset),
		{
			refreshInterval: 1000 * 60 * 10,
			revalidateOnFocus: false,
		},
	);

	const totalPages = Math.ceil((data?.total || 0) / limit);
	const handlePageChange = (newPage: number) => {
		setPage(newPage);
	};

	return (
		<>
			<GroupTitleTabs
				isError={error}
				isLoading={isLoading}
				mangas={data?.mangas}
			/>

			{totalPages > 1 && (
				<Pagination>
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
