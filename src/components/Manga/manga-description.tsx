import { SiGoogletranslate } from "@icons-pack/react-simple-icons";
import { ChevronsDown, ChevronsUp, Loader2, Undo2 } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import useContentHeight from "@/hooks/use-content-height";
import { cn } from "@/lib/utils";
import type { Manga } from "@/types/types";
import { Button } from "../ui/button";
import MangaSubInfo from "./manga-subinfo";

interface MangaDescriptionProps {
	content: string;
	language: "en" | "vi";
	maxHeight: number;
	manga?: Manga;
}

const MangaDescription = ({
	content,
	language,
	maxHeight,
	manga,
}: MangaDescriptionProps) => {
	const [state, setState] = useState({
		expanded: false,
		translated: false,
		translatedDesc: null as string | null,
		isLoading: false,
	});

	// Use the new useContentHeight hook
	const { contentRef, fullHeight } = useContentHeight({
		expanded: state.expanded,
		dependencies: [state.translated, state.translatedDesc],
	});

	const handleTranslate = async () => {
		if (state.translatedDesc) {
			setState((prev) => ({ ...prev, translated: !prev.translated }));
			return;
		}

		setState((prev) => ({ ...prev, isLoading: true }));
		try {
			const response = await fetch(
				`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(
					content,
				)}`,
			);
			const data = await response.json();
			const translatedText = data[0].map((part: any) => part[0]).join("");
			setState((prev) => ({
				...prev,
				translatedDesc: translatedText,
				translated: true,
			}));
		} catch (error) {
			console.error("Lỗi dịch thuật:", error);
		} finally {
			setState((prev) => ({ ...prev, isLoading: false }));
		}
	};

	const handleExpand = () => {
		setState((prev) => ({ ...prev, expanded: !prev.expanded }));
	};

	return (
		<div className="relative flex flex-col gap-1">
			<div
				className="overflow-hidden transition-[max-height,height] text-sm h-auto"
				style={{
					maxHeight: state.expanded ? fullHeight : maxHeight,
					maskImage:
						state.expanded || fullHeight <= maxHeight
							? "none"
							: "linear-gradient(black 0%, black 60%, transparent 100%)",
				}}
			>
				<div ref={contentRef}>
					{!!content && (
						<ReactMarkdown
							className="flex flex-col gap-3"
							remarkPlugins={[[remarkGfm, { singleTilde: false }]]}
							components={{
								a: ({ href, children }) => (
									<a
										href={href}
										target="_blank"
										rel="noopener noreferrer"
										className="text-primary hover:underline"
									>
										{children}
									</a>
								),
								table: ({ children }) => (
									<table className="table-auto border-collapse border border-secondary rounded-md w-fit">
										{children}
									</table>
								),
								thead: ({ children }) => (
									<thead className="border-b border-secondary">
										{children}
									</thead>
								),
								tr: ({ children }) => (
									<tr className="even:bg-secondary">{children}</tr>
								),
								th: ({ children }) => (
									<th className="px-2 py-1 text-left">{children}</th>
								),
								td: ({ children }) => <td className="px-2 py-1">{children}</td>,
							}}
						>
							{state.translated && state.translatedDesc
								? state.translatedDesc
								: content}
						</ReactMarkdown>
					)}

					{language === "en" && (
						<Button
							size="sm"
							className="rounded-sm text-xs transition opacity-50 hover:opacity-100 mt-2"
							onClick={handleTranslate}
							variant="ghost"
						>
							{state.isLoading ? (
								<Loader2 className="animate-spin" />
							) : state.translated ? (
								<Undo2 />
							) : (
								<SiGoogletranslate size={18} />
							)}
							{state.translated ? "Xem bản gốc" : "Dịch sang tiếng Việt"}
						</Button>
					)}

					{!!manga && (
						<div className={cn("xl:hidden", content ? "py-4" : "pb-2")}>
							<MangaSubInfo manga={manga} />
						</div>
					)}
				</div>
			</div>

			{fullHeight > maxHeight && (
				<div
					className={cn(
						"flex justify-center w-full border-t transition-[border-color]",
						state.expanded ? "border-transparent" : "border-primary",
					)}
				>
					<Button
						size="sm"
						className="rounded-t-none h-4 px-1"
						onClick={handleExpand}
						variant={state.expanded ? "secondary" : "default"}
					>
						{state.expanded ? (
							<>
								<ChevronsUp />
								thu gọn
								<ChevronsUp />
							</>
						) : (
							<>
								<ChevronsDown />
								xem thêm
								<ChevronsDown />
							</>
						)}
					</Button>
				</div>
			)}
		</div>
	);
};

export default MangaDescription;
