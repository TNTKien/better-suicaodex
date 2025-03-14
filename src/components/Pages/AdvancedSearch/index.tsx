"use client";

interface AdvancedSearchProps {
  page: number;
  limit: number;
  q: string;
  author: string;
  content: string;
  status: string;
  demos: string;
  include: string;
  exclude: string;
}

export function AdvancedSearch({
  page,
  limit,
  q,
  author,
  content,
  status,
  demos,
  include,
  exclude,
}: AdvancedSearchProps) {
  return (
    <div>
      <hr className="w-9 h-1 bg-primary border-none" />
      <h1 className="text-2xl font-black uppercase">Tìm kiếm nâng cao</h1>
    </div>
  );
}
