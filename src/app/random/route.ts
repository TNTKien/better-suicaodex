"use server";

import { redirect } from "next/navigation";
import { getRandomManga } from "@/lib/mangadex/random";
export async function GET() {
	const res = await getRandomManga(true);

	if (!res || !res.id) {
		redirect("/manga/e1e38166-20e4-4468-9370-187f985c550e");
	}

	redirect(`/manga/${res.id}`);
}
