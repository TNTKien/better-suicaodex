import { SiteHeader } from "@/components/layout/navbar/site-header";
import { AppSidebar } from "@/components/layout/sidebar/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { MoetruyenHeader } from "./_components/moetruyen-header";

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="border-grid flex flex-1 flex-col">
        <MoetruyenHeader />
        <main className="flex-1 py-4">{children}</main>
      </div>
      <AppSidebar side="right" />
    </SidebarProvider>
  );
}
