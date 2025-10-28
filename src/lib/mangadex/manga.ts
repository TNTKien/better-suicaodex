import { siteConfig } from "@/config/site";
import type { Chapter, Manga, MangaStats, MangasStats } from "@/types/types";
import { axiosWithProxyFallback } from "../axios";
import { ArtistParser } from "./artist";
import { AuthorParser } from "./author";
import { ChaptersParser } from "./chapter";
import { TagsParser } from "./tag";

export function MangaParser(data: any): Manga {
	// const titleVi = data.attributes.altTitles.find((item: any) => item.vi)?.vi;
	// let title = titleVi
	//   ? titleVi
	//   : data.attributes.title[Object.keys(data.attributes.title)[0]];

	// if (!title) {
	//   title = data.attributes.altTitles.find((item: any) => item.en)?.en;
	// }

	// const altTitle =
	//   data.attributes.title.en ||
	//   data.attributes.altTitles.find((item: any) => item.en)?.en ||
	//   data.attributes.altTitles.find((item: any) => item.ja)?.ja ||
	//   null;

	const altTitles = data.attributes.altTitles;
	const titles = data.attributes.title;

	const enTitles = [
		...(titles.en ? [titles.en] : []),
		...altTitles.filter((t: any) => t.en).map((t: any) => t.en!),
	];
	const viTitle = altTitles.find((t: any) => t.vi)?.vi || undefined;
	const jaTitle = altTitles.find((t: any) => t.ja)?.ja || undefined;
	const originalTitle = titles[Object.keys(titles)[0]];

	const title = viTitle || enTitles[0] || jaTitle || originalTitle;
	let altTitle: string | null = null;
	if (title == viTitle) {
		altTitle = enTitles[0] || jaTitle || null;
	} else if (title == enTitles[0]) {
		altTitle = enTitles[1] || jaTitle || null;
	} else if (title == jaTitle) {
		altTitle = null;
	}

	const language = data.attributes.availableTranslatedLanguages;
	const description: { language: "vi" | "en"; content: string } = data
		.attributes.description.vi
		? {
				language: "vi",
				content: data.attributes.description.vi,
			}
		: {
				language: "en",
				content: data.attributes.description.en,
			};

	const coverArt = data.relationships.find(
		(item: any) => item.type === "cover_art",
	);
	const author = AuthorParser(data.relationships);
	const artist = ArtistParser(data.relationships);
	const contentRating = data.attributes.contentRating;
	const status = data.attributes.status;
	return {
		id: data.id,
		title: title,
		language: language,
		altTitle: altTitle,
		tags: TagsParser(data.attributes.tags),
		cover: coverArt ? coverArt.attributes.fileName : null,
		author: author,
		artist: artist,
		description: description,
		contentRating: contentRating,
		status: status,
		raw:
			data.attributes.links && data.attributes.links.raw
				? data.attributes.links.raw
				: null,
		finalChapter: data.attributes.lastChapter
			? data.attributes.lastChapter
			: null,
	};
}

export function MangaStatsParser(data: any, id: string): MangaStats {
	const distribution = data.statistics[id].rating.distribution;

	// Find the max value in the distribution
	const max = Math.max(...(Object.values(distribution) as number[]));

	return {
		rating: {
			bayesian: data.statistics[id].rating.bayesian,
			distribution: {
				"1": distribution["1"],
				"2": distribution["2"],
				"3": distribution["3"],
				"4": distribution["4"],
				"5": distribution["5"],
				"6": distribution["6"],
				"7": distribution["7"],
				"8": distribution["8"],
				"9": distribution["9"],
				"10": distribution["10"],
			},
			max: max,
		},
		follows: data.statistics[id].follows,
		comments: data.statistics[id].comments
			? data.statistics[id].comments.repliesCount
			: 0,
	};
}

export async function fetchMangaDetail(id: string): Promise<Manga> {
	const [mangaResponse, stats] = await Promise.all([
		axiosWithProxyFallback({
			url: `/manga/${id}?`,
			method: "get",
			params: {
				includes: ["author", "artist", "cover_art"],
			},
		}),
		getMangaStats(id),
	]);

	const manga = MangaParser(mangaResponse.data);
	manga.stats = stats;

	return manga;
}

export async function getMangaStats(id: string): Promise<MangaStats> {
	try {
		const data = await axiosWithProxyFallback({
			url: `/statistics/manga/${id}`,
			method: "get",
		});
		return MangaStatsParser(data, id);
	} catch (error) {
		console.log(error);
		return {
			rating: {
				bayesian: 0,
				distribution: {
					"1": 0,
					"2": 0,
					"3": 0,
					"4": 0,
					"5": 0,
					"6": 0,
					"7": 0,
					"8": 0,
					"9": 0,
					"10": 0,
				},
				max: 0,
			},
			follows: 0,
			comments: 0,
		};
	}
}

export async function getMangasStats(ids: string[]): Promise<MangasStats[]> {
	try {
		const data = await axiosWithProxyFallback({
			url: `/statistics/manga?`,
			method: "get",
			params: {
				manga: ids,
			},
		});
		return ids.map((id: any) => MangasStatsParser(data, id));
	} catch (error) {
		console.log(error);
		return ids.map(() => ({
			rating: {
				bayesian: 0,
				distribution: {
					"1": 0,
					"2": 0,
					"3": 0,
					"4": 0,
					"5": 0,
					"6": 0,
					"7": 0,
					"8": 0,
					"9": 0,
					"10": 0,
				},
				max: 0,
			},
			follows: 0,
			comments: 0,
		}));
	}
}

export function MangasStatsParser(data: any, id: string): MangasStats {
	return {
		rating: {
			bayesian: data.statistics[id].rating.bayesian,
		},
		follows: data.statistics[id].follows,
		comments: data.statistics[id].comments
			? data.statistics[id].comments.repliesCount
			: 0,
	};
}

export async function getFirstChapter(
	id: string,
	r18: boolean,
): Promise<{
	en: string;
	vi: string;
}> {
	const params = {
		limit: 1,
		contentRating: r18
			? ["safe", "suggestive", "erotica", "pornographic"]
			: ["safe", "suggestive", "erotica"],
		order: {
			volume: "asc",
			chapter: "asc",
		},
	};
	const { data: en } = await axiosWithProxyFallback({
		url: `/manga/${id}/feed`,
		method: "get",
		params: {
			...params,
			translatedLanguage: ["en"],
		},
	});
	const { data: vi } = await axiosWithProxyFallback({
		url: `/manga/${id}/feed`,
		method: "get",
		params: {
			...params,
			translatedLanguage: ["vi"],
		},
	});

	return {
		en: en.data[0]?.id,
		vi: vi.data[0]?.id,
	};
}

export async function FirstViChapter(
	id: string,
	r18: boolean,
): Promise<Chapter> {
	const data = await axiosWithProxyFallback({
		url: `/manga/${id}/feed`,
		method: "get",
		params: {
			limit: 1,
			contentRating: r18
				? ["safe", "suggestive", "erotica", "pornographic"]
				: ["safe", "suggestive", "erotica"],
			order: {
				volume: "asc",
				chapter: "asc",
			},
			translatedLanguage: ["vi"],
			includes: ["scanlation_group", "manga"],
		},
	});
	return ChaptersParser(data.data)[0];
}

export async function FirstEnChapter(
	id: string,
	r18: boolean,
): Promise<Chapter> {
	const data = await axiosWithProxyFallback({
		url: `/manga/${id}/feed`,
		method: "get",
		params: {
			limit: 1,
			contentRating: r18
				? ["safe", "suggestive", "erotica", "pornographic"]
				: ["safe", "suggestive", "erotica"],
			order: {
				volume: "asc",
				chapter: "asc",
			},
			translatedLanguage: ["en"],
			includes: ["scanlation_group", "manga"],
		},
	});
	return ChaptersParser(data.data)[0];
}

export async function SearchManga(
	query: string,
	r18: boolean,
): Promise<Manga[]> {
	const data = await axiosWithProxyFallback({
		url: "/manga?",
		method: "get",
		params: {
			limit: 20,
			title: query,
			contentRating: r18
				? ["safe", "suggestive", "erotica", "pornographic"]
				: ["safe", "suggestive", "erotica"],
			includes: ["author", "artist", "cover_art"],
			order: {
				relevance: "desc",
			},
		},
	});
	const mangas = data.data.map((item: any) => MangaParser(item));
	if (mangas.length === 0) return [];

	const stats = await getMangasStats(mangas.map((manga: Manga) => manga.id));

	return mangas.map((manga: Manga, index: number) => ({
		...manga,
		stats: stats[index],
	}));
}

export async function getPopularMangas(
	language: ("vi" | "en")[],
	r18: boolean,
): Promise<Manga[]> {
	const data = await axiosWithProxyFallback({
		url: `/manga?`,
		method: "get",
		params: {
			limit: 10,
			includes: ["cover_art", "author", "artist"],
			contentRating: r18
				? ["safe", "suggestive", "erotica", "pornographic"]
				: ["safe", "suggestive", "erotica"],
			hasAvailableChapters: "true",
			availableTranslatedLanguage: language,
			order: {
				followedCount: "desc",
			},
			createdAtSince: new Date(new Date().setDate(new Date().getDate() - 30))
				.toISOString()
				.slice(0, 19),
		},
	});

	return data.data.map((item: any) => MangaParser(item));
}

export async function getRecentlyMangas(
	limit: number,
	language: ("vi" | "en")[],
	r18: boolean,
	offset?: number,
): Promise<{
	mangas: Manga[];
	total: number;
}> {
	const max_total = 10000;
	const safeOffset = offset || 0;
	if (limit + safeOffset > max_total) {
		limit = max_total - safeOffset;
	}
	const data = await axiosWithProxyFallback({
		url: `/manga?`,
		method: "get",
		params: {
			limit: limit,
			offset: safeOffset,
			includes: ["cover_art", "author", "artist"],
			availableTranslatedLanguage: language,
			contentRating: r18
				? ["safe", "suggestive", "erotica", "pornographic"]
				: ["safe", "suggestive", "erotica"],
			order: {
				createdAt: "desc",
			},
		},
	});
	const total = data.total > max_total ? max_total : data.total;

	return {
		mangas: data.data.map((item: any) => MangaParser(item)),
		total: total,
	};
}

export async function getTopFollowedMangas(
	language: ("vi" | "en")[],
	r18: boolean,
): Promise<Manga[]> {
	const params: any = {
		limit: 10,
		includes: ["cover_art", "author", "artist"],
		availableTranslatedLanguage: language,
		hasAvailableChapters: "true",
		contentRating: r18
			? ["safe", "suggestive", "erotica", "pornographic"]
			: ["safe", "suggestive", "erotica"],
		order: {
			followedCount: "desc",
		},
	};

	const data = await axiosWithProxyFallback({
		url: `/manga?`,
		method: "get",
		params,
	});

	const mangas = data.data.map((item: any) => MangaParser(item));
	const stats = await getMangasStats(mangas.map((manga: Manga) => manga.id));

	return mangas.map((manga: Manga, index: number) => ({
		...manga,
		stats: stats[index],
	}));
}

export async function getTopRatedMangas(
	language: ("vi" | "en")[],
	r18: boolean,
): Promise<Manga[]> {
	const data = await axiosWithProxyFallback({
		url: `/manga?`,
		method: "get",
		params: {
			limit: 10,
			includes: ["cover_art", "author", "artist"],
			hasAvailableChapters: "true",
			availableTranslatedLanguage: language,
			contentRating: r18
				? ["safe", "suggestive", "erotica", "pornographic"]
				: ["safe", "suggestive", "erotica"],
			order: {
				rating: "desc",
			},
		},
	});

	const mangas = data.data.map((item: any) => MangaParser(item));
	const stats = await getMangasStats(mangas.map((manga: Manga) => manga.id));

	return mangas.map((manga: Manga, index: number) => ({
		...manga,
		stats: stats[index],
	}));
}

export async function getStaffPickMangas(r18: boolean): Promise<Manga[]> {
	const staffPickList = siteConfig.mangadexAPI.staffPickList;
	const seasonalList = siteConfig.mangadexAPI.seasonalList;

	// Randomly choose between staffPickList and seasonalList
	const selectedList = Math.random() < 0.5 ? staffPickList : seasonalList;

	const StaffPickID = await axiosWithProxyFallback({
		url: `/list/${selectedList}`,
		method: "get",
	}).then((res) =>
		res.data.relationships
			.filter((item: any) => item.type === "manga")
			.map((item: any) => item.id),
	);

	const data = await axiosWithProxyFallback({
		url: `/manga?`,
		method: "get",
		params: {
			limit: 32,
			offset:
				selectedList === seasonalList
					? Math.floor(Math.random() * (StaffPickID.length - 32))
					: 0,
			includes: ["cover_art", "author", "artist"],
			// hasAvailableChapters: "true",
			// availableTranslatedLanguage: ["vi"],
			contentRating: r18
				? ["safe", "suggestive", "erotica", "pornographic"]
				: ["safe", "suggestive", "erotica"],
			ids: StaffPickID,
			order: {
				rating: "desc",
			},
		},
	});

	// Parse the data and then shuffle the results before returning
	const mangaResults = data.data.map((item: any) => MangaParser(item));

	// Fisher-Yates shuffle algorithm to randomize the order
	for (let i = mangaResults.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[mangaResults[i], mangaResults[j]] = [mangaResults[j], mangaResults[i]];
	}

	return mangaResults;
}

export async function getCompletedMangas(
	language: ("vi" | "en")[],
	r18: boolean,
): Promise<Manga[]> {
	const data = await axiosWithProxyFallback({
		url: `/manga?`,
		method: "get",
		params: {
			limit: 32,
			includes: ["cover_art", "author", "artist"],
			hasAvailableChapters: "true",
			availableTranslatedLanguage: language,
			contentRating: r18
				? ["safe", "suggestive", "erotica", "pornographic"]
				: ["safe", "suggestive", "erotica"],
			status: ["completed"],
		},
	});

	return data.data.map((item: any) => MangaParser(item));
}

export async function getRecommendedMangas(
	id: string,
	r18: boolean,
): Promise<Manga[]> {
	const rcmData = await axiosWithProxyFallback({
		url: `/manga/${id}/recommendation`,
		method: "get",
	});

	//filter "type": "manga_recommendation"
	const mangaIDs = rcmData.data
		.filter((item: any) => item.type === "manga_recommendation")
		.map((item: any) => item.id.split("_")[1]);

	if (mangaIDs.length === 0) return [];

	const mangasData = await axiosWithProxyFallback({
		url: "/manga",
		method: "get",
		params: {
			limit: 100,
			ids: mangaIDs,
			includes: ["cover_art", "author", "artist"],
			contentRating: r18
				? ["safe", "suggestive", "erotica", "pornographic"]
				: ["safe", "suggestive", "erotica"],
		},
	});

	return mangasData.data.map((m: any) => MangaParser(m));
}

export async function getTotalMangas(): Promise<number> {
	const data = await axiosWithProxyFallback({
		url: `/manga`,
		method: "get",
		params: {
			availableTranslatedLanguage: ["vi"],
		},
	});
	if (data.total > 10000) return 10000;

	return data.total;
}
