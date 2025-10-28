"use client";

import Image from "next/image";
import Link from "next/link";
import BA from "#/images/gacha/ba.png";
import HSR from "#/images/gacha/hsr.webp";
import PKMTCGP from "#/images/gacha/pkmtcg.svg";
import { Button } from "@/components/ui/button";

export default function Gacha() {
	//TODO: padding
	return (
		<div className="flex flex-col space-y-5 py-3">
			{/* Header Section */}
			<div className="relative shadow-md overflow-hidden rounded-xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 dark:from-indigo-500/20 dark:to-purple-500/20 py-6 px-4">
				<div className="absolute inset-0 bg-grid-pattern opacity-10"></div>

				<div className="relative z-10 text-center max-w-3xl mx-auto">
					<div className="inline-block animate-float">
						<span className="inline-block px-4 py-1.5 rounded-full bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 dark:bg-indigo-500/30 text-sm font-medium mb-3">
							SuicaoDex88 - Nhà cái đầu hàng Vi En
						</span>
					</div>

					<h1 className="text-3xl md:text-5xl font-extrabold">
						<span className="bg-gradient-to-tr from-primary to-purple-600 bg-clip-text text-transparent">
							99% người chơi dừng lại trước khi thắng lớn.
						</span>
					</h1>

					{/* <div className="pt-2 flex justify-center space-x-3">
            <div className="h-1.5 w-20 rounded-full bg-indigo-500/60"></div>
            <div className="h-1.5 w-10 rounded-full bg-purple-500/60"></div>
            <div className="h-1.5 w-5 rounded-full bg-pink-500/60"></div>
          </div> */}
				</div>

				<div className="absolute -bottom-6 -right-6 w-32 h-32 bg-gradient-to-br from-indigo-500/30 to-purple-500/30 rounded-full blur-xl"></div>
				<div className="absolute -top-6 -left-6 w-24 h-24 bg-gradient-to-br from-purple-500/30 to-pink-500/30 rounded-full blur-xl"></div>
			</div>

			{/* Cards Container */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-5">
				{/* Pokemon TCG Pocket Card */}
				<Link
					href="/gacha/pkm-tcgp"
					className="group relative bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900 rounded-xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border border-yellow-200 dark:border-yellow-800"
				>
					<div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-10"></div>

					<div className="h-64 w-full flex items-center justify-center p-6 overflow-hidden bg-white/30 dark:bg-black/30">
						<Image
							className="transition-all duration-500 group-hover:scale-110 object-contain max-h-full"
							src={PKMTCGP}
							alt="Pokemon TCG Pocket"
							priority
						/>
					</div>

					<div className="p-5 space-y-3">
						<h3 className="text-xl font-bold text-yellow-800 dark:text-yellow-300 line-clamp-1 break-all">
							Pokémon TCG Pocket
						</h3>
						{/* <p className="text-sm text-gray-600 dark:text-gray-300">Collect digital cards and build your ultimate Pokémon deck!</p> */}
						{/* <Link href="/gacha/pkm-tcgp" className="block"> */}
						<Button className="w-full bg-yellow-500 hover:bg-yellow-600 text-white">
							Mở pack ngay
						</Button>
						{/* </Link> */}
					</div>
				</Link>

				{/* Honkai Star Rail Card */}
				<Link
					href="/gacha/hsr"
					className="group relative bg-gradient-to-br from-blue-50 to-purple-100 dark:from-blue-950 dark:to-purple-900 rounded-xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border border-blue-200 dark:border-blue-800"
				>
					<div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-10"></div>

					<div className="h-64 w-full flex items-center justify-center p-6 overflow-hidden bg-white/30 dark:bg-black/30">
						<Image
							className="transition-all duration-500 group-hover:scale-110 object-contain max-h-full"
							src={HSR}
							alt="Honkai Star Rail"
							priority
						/>
					</div>

					<div className="p-5 space-y-3">
						<h3 className="text-xl font-bold text-blue-800 dark:text-blue-300 line-clamp-1 break-all">
							Honkai Star Rail
						</h3>
						{/* <p className="text-sm text-gray-600 dark:text-gray-300">Embark on an interstellar adventure with powerful characters!</p> */}
						{/* <Link href="/gacha/hsr" className="block"> */}
						<Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
							100 roll free (riu 100%)
						</Button>
						{/* </Link> */}
					</div>
				</Link>

				{/* Blue Archive Card */}
				<Link
					href="/gacha/blue-archive"
					className="group relative bg-gradient-to-br from-sky-50 to-indigo-100 dark:from-sky-950 dark:to-indigo-900 rounded-xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border border-sky-200 dark:border-sky-800"
				>
					<div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-10"></div>

					<div className="h-64 w-full flex items-center justify-center p-6 overflow-hidden bg-white/30 dark:bg-black/30">
						<Image
							className="transition-all duration-500 group-hover:scale-110 object-contain max-h-full"
							src={BA}
							alt="Blue Archive"
							priority
						/>
					</div>

					<div className="p-5 space-y-3">
						<h3 className="text-xl font-bold text-sky-800 dark:text-sky-300 line-clamp-1 break-all">
							Blue Archive
						</h3>
						{/* <p className="text-sm text-gray-600 dark:text-gray-300">Recruit students and form the ultimate tactical team!</p> */}
						{/* <Link href="/gacha/ba" className="block"> */}
						<Button className="w-full bg-sky-500 hover:bg-sky-600 text-white">
							Uhhoohhh!!! 🦀🦀😭😭😭
						</Button>
						{/* </Link> */}
					</div>
				</Link>
			</div>
		</div>
	);
}
