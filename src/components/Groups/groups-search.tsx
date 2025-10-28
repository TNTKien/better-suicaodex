"use client";

import { ArrowRight, Loader2, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
import { searchGroups } from "@/lib/mangadex/group";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import GroupCards from "./group-cards";

interface GroupsSearchProps {
	page: number;
	q: string;
}

export default function GroupsSearch({ page, q }: GroupsSearchProps) {
	const [inputValue, setInputValue] = useState(q);
	const [debouncedQuery, setDebouncedQuery] = useState(q);
	const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const router = useRouter();

	useEffect(() => {
		// Clear any existing timeout
		if (debounceTimeoutRef.current) {
			clearTimeout(debounceTimeoutRef.current);
		}

		// Set a new timeout to update the query after 500ms of inactivity
		debounceTimeoutRef.current = setTimeout(() => {
			setDebouncedQuery(inputValue);

			// Update URL if needed
			if (inputValue !== q) {
				const params = new URLSearchParams();
				if (inputValue) params.set("q", inputValue);
				if (page && page !== 1) params.set("page", page.toString());
				router.push(`/groups?${params.toString()}`);
			}
		}, 500);

		// Cleanup function to clear the timeout
		return () => {
			if (debounceTimeoutRef.current) {
				clearTimeout(debounceTimeoutRef.current);
			}
		};
	}, [inputValue, page, q, router]);

	const offset = Math.max((page - 1) * 32, 0);
	const { data, error, isLoading } = useSWR(
		["/group", debouncedQuery, 32, offset],
		([, query, limit, offset]) => searchGroups(query, limit, offset),
		{
			refreshInterval: 1000 * 60 * 10,
			revalidateOnFocus: false,
		},
	);
	const totalPages = Math.ceil((data?.total || 0) / 32);
	const handlePageChange = (newPage: number) => {
		const params = new URLSearchParams();
		if (debouncedQuery) params.set("q", debouncedQuery);
		if (newPage && newPage !== 1) params.set("page", newPage.toString());

		router.push(`/groups?${params.toString()}`);
	};

	const handleClear = () => {
		setInputValue("");
		setDebouncedQuery("");
		router.push("/groups");
	};

	return (
		<>
			<div className="relative w-full">
				<Search className="h-4 w-4 absolute left-2 top-1/2 transform -translate-y-1/2" />
				<Input
					className="bg-secondary pl-7 w-full h-10"
					placeholder="Nhập từ khóa..."
					autoComplete="off"
					value={inputValue}
					onChange={(e) => setInputValue(e.target.value)}
				/>

				<Button
					size="icon"
					className="absolute right-1 top-1/2 transform -translate-y-1/2 bg-primary rounded-sm size-8"
					onClick={() => {
						if (inputValue) {
							handleClear();
						}
					}}
				>
					{inputValue ? <X /> : <ArrowRight />}
				</Button>
			</div>

			<div className="mt-4 w-full relative">
				{!!isLoading && (
					<div className="flex justify-center items-center w-full h-16">
						<Loader2 className="animate-spin w-8 h-8" />
					</div>
				)}

				{!!error && (
					<Card className="mt-4 rounded-sm justify-center items-center flex h-16 w-full">
						Lỗi mất rồi 😭
					</Card>
				)}

				{!!data && <GroupCards groups={data.groups} />}
			</div>

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
