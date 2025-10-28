"use client";

import {
	SiDiscord,
	SiFacebook,
	SiGithub,
	SiGoogle,
} from "@icons-pack/react-simple-icons";
import {
	BadgeCheck,
	Bell,
	ChevronsUpDown,
	CircleUser,
	CircleUserRound,
	LogIn,
	LogOut,
	SquareUser,
	UserIcon,
} from "lucide-react";
import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuPortal,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";
import { useLocalNotification } from "@/hooks/use-local-notification";
import { cn } from "@/lib/utils";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

export function NavUser() {
	const { isMobile } = useSidebar();
	const { localNotification } = useLocalNotification();
	const { data: session } = useSession();
	const user = session?.user;

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<Dialog>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<SidebarMenuButton
								size="lg"
								className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground overflow-visible"
							>
								{user ? (
									<>
										<div className="relative inline-block">
											{!!localNotification.unread.length && (
												<span className="absolute block rounded-full ring-2 ring-white top-0 left-0 bg-red-500 size-2.5 z-10 animate-bounce duration-250" />
											)}
											<Avatar className="h-8 w-8 rounded-lg">
												<AvatarImage
													src={user.image || ""}
													alt={user.name || ""}
													className="object-cover"
												/>
												<AvatarFallback className="rounded-lg">
													{user && user.name ? user.name.slice(0, 2) : "S"}
												</AvatarFallback>
											</Avatar>
										</div>

										<div className="grid flex-1 text-left text-sm leading-tight">
											<span className="truncate font-semibold">
												{user.name || "Unknown"}
											</span>
											<span className="truncate text-xs">
												{user.email || "Unknown"}
											</span>
										</div>
										<ChevronsUpDown className="ml-auto size-4" />
									</>
								) : (
									<>
										<div className="relative inline-block">
											{!!localNotification.unread.length && (
												<span className="z-10 absolute block rounded-full ring-2 ring-white top-0 left-0 bg-red-500 size-2.5 animate-bounce duration-250" />
											)}
											<Avatar className="h-8 w-8 rounded-lg">
												<AvatarImage
													src="/avatars/doro_think.webp"
													alt=""
													className="object-cover"
												/>
												<AvatarFallback className="rounded-lg">
													S
												</AvatarFallback>
											</Avatar>
										</div>

										<div className="grid flex-1 text-left text-sm leading-tight">
											<span className="truncate font-semibold">
												Bạn chưa đăng nhập
											</span>
											{/* <span className="truncate text-xs">mẹ mày béo</span> */}
										</div>
										<ChevronsUpDown className="ml-auto size-4" />
									</>
								)}
							</SidebarMenuButton>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
							side={isMobile ? "bottom" : "right"}
							align="end"
							sideOffset={4}
						>
							{!!user && (
								<>
									<DropdownMenuLabel className="p-0 font-normal">
										<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
											<Avatar className="h-8 w-8 rounded-lg">
												<AvatarImage
													src={user.image || "/avatars/doro_think.webp"}
													alt={user.name || "Doro"}
													className="object-cover"
												/>
												<AvatarFallback className="rounded-lg">
													{user && user.name ? user.name.slice(0, 2) : "DR"}
												</AvatarFallback>
											</Avatar>
											<div className="grid flex-1 text-left text-sm leading-tight">
												<span className="truncate font-semibold">
													{user.name}
												</span>
												<span className="truncate text-xs">{user.email}</span>
											</div>
										</div>
									</DropdownMenuLabel>
									<DropdownMenuSeparator />
								</>
							)}

							<DropdownMenuGroup>
								{!!user && (
									<DropdownMenuItem>
										<BadgeCheck />
										Tài khoản
									</DropdownMenuItem>
								)}

								<DropdownMenuItem asChild>
									<Link href={"/notifications"}>
										<Bell
											className={cn(
												!!localNotification.unread.length &&
													"animate-bell-shake",
											)}
										/>
										Thông báo
										{!!localNotification.unread.length && (
											<Badge
												className="rounded-full ml-auto min-w-4 h-4 justify-center p-1 text-xs font-normal"
												variant="destructive"
											>
												{localNotification.unread.length <= 10
													? localNotification.unread.length
													: "10+"}
											</Badge>
										)}
									</Link>
								</DropdownMenuItem>
							</DropdownMenuGroup>
							<DropdownMenuSeparator />

							{!user ? (
								<DialogTrigger asChild>
									<DropdownMenuItem className="text-blue-500 focus:bg-blue-500/20 focus:text-blue-500">
										<LogIn />
										Đăng nhập
									</DropdownMenuItem>
								</DialogTrigger>
							) : (
								<DropdownMenuItem
									className="text-red-500 focus:bg-red-500/20 focus:text-red-500"
									onClick={() => signOut()}
								>
									<LogOut />
									Đăng xuất
								</DropdownMenuItem>
							)}
						</DropdownMenuContent>
					</DropdownMenu>

					<DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
						<DialogHeader>
							<DialogTitle>Đăng nhập bằng:</DialogTitle>
							<DialogDescription className="hidden">mẹ mày</DialogDescription>
						</DialogHeader>
						<div className="grid grid-cols-2 gap-2">
							<Button
								className="bg-blue-500 text-white hover:bg-blue-500/80"
								onClick={() =>
									toast.error("Tạm chưa thể đăng nhập bằng Facebook")
								}
							>
								<SiFacebook />
								Facebook
							</Button>
							<Button
								className="bg-[#5865F2] text-white hover:bg-[#5865F2]/80"
								onClick={() => signIn("discord")}
							>
								<SiDiscord /> Discord
							</Button>

							<Button
								className="text-white bg-stone-800  hover:bg-stone-800/80"
								onClick={() => signIn("google")}
								// onClick={() =>
								//   toast.error("Tạm chưa thể đăng nhập bằng Google")
								// }
							>
								<SiGoogle /> Google
							</Button>

							<Button
								className="bg-slate-700  text-white hover:bg-slate-700/80"
								onClick={() => signIn("github")}
								// onClick={() =>
								//   toast.error("Tạm chưa thể đăng nhập bằng Github")
								// }
							>
								<SiGithub /> Github
							</Button>
						</div>
					</DialogContent>
				</Dialog>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
