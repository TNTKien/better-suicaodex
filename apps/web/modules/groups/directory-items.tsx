import Link from "next/link"
import { ExternalLinkIcon, UserPlusIcon, UsersIcon } from "lucide-react"

import type { components } from "@/src/lib/generated/api"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@workspace/ui/components/item"

export function GroupDirectoryItems({
  groups,
  busy = false,
  onJoin,
}: {
  groups: components["schemas"]["TranslationGroupList"]["data"]
  busy?: boolean
  onJoin?: (groupId: string) => void
}) {
  return (
    <ItemGroup className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {groups.map((group) => (
        <Item
          key={group.id}
          render={
            onJoin ? undefined : (
              <Link
                href={`/group/${group.id}/${group.slug}`}
                prefetch={false}
              />
            )
          }
          size="sm"
          className="bg-secondary"
          variant="outline"
        >
          <ItemMedia variant="icon">
            {onJoin ? (
              <Avatar className="rounded-md after:rounded-md">
                <AvatarImage
                  alt=""
                  className="rounded-md"
                  referrerPolicy="no-referrer"
                  src={group.avatarUrl ?? undefined}
                />
                <AvatarFallback className="rounded-md">
                  <UsersIcon aria-hidden="true" />
                </AvatarFallback>
              </Avatar>
            ) : (
              <UsersIcon aria-hidden="true" />
            )}
          </ItemMedia>
          <ItemContent className="min-w-0">
            <ItemTitle className="line-clamp-1 font-semibold">
              {group.name}
            </ItemTitle>
          </ItemContent>
          {onJoin && (
            <ItemActions className="grid w-full grid-cols-1 gap-2 md:grid-cols-2">
              <Link
                href={`/group/${group.id}/${group.slug}`}
                prefetch={false}
                className={buttonVariants({ variant: "outline", size: "sm" })}
                target="_blank"
              >
                <ExternalLinkIcon />
                Xem trang nhóm
              </Link>
              <Button
                type="button"
                size="sm"
                disabled={busy || group.inactive || group.slug === "system"}
                onClick={() => onJoin(group.id)}
              >
                <UserPlusIcon />
                Xin gia nhập
              </Button>
            </ItemActions>
          )}
        </Item>
      ))}
    </ItemGroup>
  )
}
