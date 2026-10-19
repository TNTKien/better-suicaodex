import Link from "next/link"
import { tz } from "@date-fns/tz"
import { format, parseISO } from "date-fns"
import { groupPath } from "@workspace/catalog/routing"
import { AssetImage } from "@workspace/ui/components/asset-image"
import type { components } from "@/src/lib/generated/api"
import { hvnAvatarSrc } from "@/lib/avatar"

type PublicProfile = components["schemas"]["PublicProfile"]
const countFormat = new Intl.NumberFormat("vi-VN")

export function ProfileInfo({
  id,
  profile,
}: {
  id: string
  profile: PublicProfile
}) {
  return (
    <section
      className="hvn-login-panel min-w-0"
      aria-labelledby="profile-info-heading"
    >
      <h1
        id="profile-info-heading"
        className="hvn-login-heading hvn-login-heading-main wrap-break-word"
      >
        Tường nhà {profile.name}
      </h1>
      <div className="px-3 py-3 sm:px-4">
        <header className="flex flex-col items-start gap-3 sm:flex-row">
          <AssetImage
            src={hvnAvatarSrc(profile.image)}
            fallbackSrc="/brand/mac_dinh.webp"
            alt={`Ảnh đại diện ${profile.name}`}
            width={128}
            height={128}
            className="size-24 shrink-0 rounded-[3px] border border-white object-cover sm:size-32"
            eager
          />
          <div className="min-w-0 py-2">
            <h2 className="text-2xl font-bold wrap-break-word sm:text-[28px]">
              {profile.name}
            </h2>
            {profile.verified ? (
              <p className="mt-1 flex items-center gap-1 font-bold text-[#00bfff]">
                <AssetImage
                  src="/brand/huanchuong.webp"
                  alt=""
                  width={20}
                  height={20}
                  className="size-5 object-contain"
                />
                Đã xác minh
              </p>
            ) : null}
          </div>
        </header>
        <fieldset className="mt-6 min-w-0 border border-[#444444] px-3 pt-1 pb-5 sm:px-6">
          <legend className="px-0.5 text-lg font-bold text-[#888888]">
            Thông tin cá nhân
          </legend>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-2 text-sm sm:text-base">
            <dt className="font-bold text-[#888888]">ID:</dt>
            <dd className="min-w-0 wrap-anywhere text-[#888888]">{id}</dd>
            <dt className="font-bold text-[#888888]">Nhóm dịch:</dt>
            <dd className="flex min-w-0 flex-col gap-1 wrap-anywhere">
              {profile.groups.length
                ? profile.groups.map((group) => (
                    <span key={group.id}>
                      <Link
                        href={groupPath(group.id, group.slug)}
                        prefetch={false}
                        className="text-[#00bfff] hover:underline"
                      >
                        {group.name}
                      </Link>
                      {group.isLeader ? " (Trưởng nhóm)" : null}
                    </span>
                  ))
                : "Chưa tham gia nhóm dịch"}
            </dd>
            <dt className="font-bold text-[#888888]">Gia nhập:</dt>
            <dd>
              <time dateTime={profile.createdAt}>
                {format(parseISO(profile.createdAt), "HH:mm - dd/MM/yyyy", {
                  in: tz("Asia/Ho_Chi_Minh"),
                })}
              </time>
            </dd>
            <dt className="font-bold text-[#888888]">Đã bình luận:</dt>
            <dd>{countFormat.format(profile.commentCount)}</dd>
            <dt className="font-bold text-[#888888]">Giới thiệu:</dt>
            <dd className="min-w-0 wrap-anywhere whitespace-pre-wrap">
              {profile.bio || "Chưa có giới thiệu"}
            </dd>
          </dl>
        </fieldset>
      </div>
    </section>
  )
}
