import Banner from "./manga-banner";

export default function MangaMaintain() {
	return (
		<>
			<Banner src="/images/maintain.webp" />
			<div className="flex flex-col gap-6 mt-[16rem]">
				<p className="uppercase font-black text-3xl drop-shadow-lg text-center">
					MangaDex đang bảo trì, vui lòng quay lại sau!
				</p>
			</div>
		</>
	);
}
