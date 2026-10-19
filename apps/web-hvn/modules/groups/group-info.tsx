import { AssetImage } from "@workspace/ui/components/asset-image"
import type { components } from "@/src/lib/generated/api"

const countFormat = new Intl.NumberFormat("vi-VN")

export function GroupInfo({
  group,
}: {
  group: components["schemas"]["TranslationGroupDetail"]
}) {
  return (
    <section
      className="hvn-login-panel mb-6"
      aria-labelledby="group-info-heading"
    >
      <h2
        id="group-info-heading"
        className="hvn-login-heading hvn-login-heading-info"
      >
        Thông tin
      </h2>
      <div className="flex flex-col items-start gap-3 px-4 py-4 sm:flex-row sm:gap-4">
        <AssetImage
          src={group.avatarUrl ?? "/brand/mac_dinh.webp"}
          fallbackSrc="/brand/mac_dinh.webp"
          alt={`Ảnh nhóm ${group.name}`}
          width={96}
          height={96}
          className="size-24 shrink-0 rounded-full border-2 border-black object-cover sm:size-26"
          eager
        />
        <div className="min-w-0 text-base leading-6 wrap-break-word">
          <h3 className="text-xl font-bold sm:text-2xl">{group.name}</h3>
          {group.description ? (
            <p className="mt-1 whitespace-pre-wrap">{group.description}</p>
          ) : null}
          <div className="mt-3">
            <p>
              <span className="font-bold">Trưởng nhóm: </span>
              {group.leader || "Chưa xác định"}
            </p>
            {group.links.map((link) => (
              <p key={link.key}>
                <span className="font-bold">{link.label}: </span>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#00bfff] hover:underline break-all"
                >
                  {link.url}
                </a>
              </p>
            ))}
            <p>
              <span className="font-bold">Lượt xem: </span>
              {countFormat.format(group.statistics.views)}
            </p>
            <p>
              <span className="font-bold">Số truyện: </span>
              {countFormat.format(group.statistics.mangaCount)}
            </p>
            <p>
              <span className="font-bold">Số chương: </span>
              {countFormat.format(group.statistics.chapterCount)}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
