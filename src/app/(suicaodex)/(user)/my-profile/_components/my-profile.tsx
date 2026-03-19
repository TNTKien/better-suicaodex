import {
  AppWindowIcon,
  BadgeCheck,
  CalendarIcon,
  Fingerprint,
  History,
  Link2,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import { LightRays } from "@/components/ui/light-rays";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { SiDiscord, SiGithub, SiGoogle } from "@icons-pack/react-simple-icons";

interface ProfileDetail {
  label: string;
  value: string;
}

interface MyProfileProps {
  profile: {
    displayName: string;
    email: string;
    avatar: string;
    status: boolean;
    details: ProfileDetail[];
    providers: string[];
  };
}

const detailIcons = {
  "User ID": Fingerprint,
  "Tên hiển thị": User,
  Email: Mail,
  "Ngày tham gia": CalendarIcon,
  "Trạng thái xác thực": ShieldCheck,
  "Cập nhật lần cuối": History,
} as const;

const providerIcons = {
  google: SiGoogle,
  discord: SiDiscord,
  github: SiGithub,
} as const;

export function MyProfile({ profile }: MyProfileProps) {
  return (
    <>
      <Card className="-mt-2 relative overflow-hidden border-none shadow-sm rounded-md">
        <LightRays />
        <CardContent className="relative p-4">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <Avatar className="size-24 sm:size-28 rounded-md">
                <AvatarImage
                  src={profile.avatar}
                  alt={profile.displayName}
                  className="object-cover"
                />
                <AvatarFallback className="rounded-md text-2xl font-black">
                  {profile.displayName.slice(0, 2)}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 space-y-3">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">
                    @{profile.details.find((d) => d.label === "User ID")?.value}
                  </p>
                  <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
                    {profile.displayName}
                  </h2>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant="secondary"
                    className={cn(
                      "rounded-md!",
                      profile.status
                        ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                        : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
                    )}
                  >
                    <BadgeCheck data-icon="inline-start" />
                    {profile.status ? "Đã xác thực" : "Chưa xác thực"}
                  </Badge>

                  <Badge variant="secondary" className="rounded-md!">
                    <Mail data-icon="inline-start" />
                    {profile.email}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {profile.details.map((detail) => {
                const Icon =
                  detailIcons[detail.label as keyof typeof detailIcons] ??
                  Sparkles;

                return (
                  <Item key={detail.label} variant="muted">
                    <ItemMedia variant="icon">
                      <Icon className="size-4 text-primary" />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle className="font-semibold uppercase tracking-[0.2em]">
                        {detail.label}
                      </ItemTitle>
                      <ItemDescription className="break-all">
                        {detail.value}
                      </ItemDescription>
                    </ItemContent>
                  </Item>
                );
              })}

              <Item variant="muted">
                <ItemMedia variant="icon">
                  <Link2 className="size-4 text-primary" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle className="font-semibold uppercase tracking-[0.2em]">
                    Tài khoản liên kết
                  </ItemTitle>
                  <ItemDescription className="hidden" />
                  <div className="flex flex-wrap gap-3">
                    {profile.providers.map((provider) => {
                      const Icon =
                        providerIcons[provider as keyof typeof providerIcons] ??
                        Link2;

                      return (
                        <Badge
                          key={provider}
                          variant="default"
                          className="rounded-md!"
                        >
                          <Icon data-icon="inline-start" />
                          {provider.charAt(0).toUpperCase() + provider.slice(1)}
                        </Badge>
                      );
                    })}
                  </div>
                </ItemContent>
              </Item>
            </div>
          </div>
        </CardContent>
      </Card>

      <Empty className="bg-card shadow-sm rounded-md">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <AppWindowIcon />
          </EmptyMedia>
          <EmptyTitle>Coming soon...</EmptyTitle>
          <EmptyDescription>
            Một số tính năng khác đang được phát triển và sẽ sớm ra mắt. Tạm để
            đây cho đỡ trống!
          </EmptyDescription>
        </EmptyHeader>
        {/* <LightRays /> */}
      </Empty>
    </>
  );
}
