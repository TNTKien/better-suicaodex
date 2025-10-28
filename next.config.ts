import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	/* config options here */
	images: {
		qualities: [25, 50, 75, 100],
		remotePatterns: [
			{
				protocol: "https",
				hostname: "api.suicaodex.com",
				port: "",
				pathname: "/covers/**",
				search: "",
			},
			{
				protocol: "https",
				hostname: "api2.suicaodex.com",
				port: "",
				pathname: "/covers/**",
				search: "",
			},
			{
				protocol: "https",
				hostname: "clf.suicaodex.com",
				port: "",
				pathname: "/covers/**",
				search: "",
			},
		],
	},
	rewrites: async () => [
		{
			source: "/manga-sitemap.xml",
			destination: "/manga-sitemap",
		},
		{
			source: "/manga-sitemap-:page.xml",
			destination: "/manga-sitemap/:page",
		},
	],
	async headers() {
		return [
			{
				source: "/:path*",
				headers: [
					{
						key: "Referrer-Policy",
						value: "no-referrer", // Don't send Referer: localhost:3000 when calling the image API.
					},
				],
			},
		];
	},
};

export default nextConfig;
