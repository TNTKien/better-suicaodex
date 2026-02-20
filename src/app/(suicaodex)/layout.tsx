import { SiteHeader } from "@/components/Navbar/site-header";
import { AppSidebar } from "@/components/Sidebar/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="border-grid flex flex-1 flex-col">
        <SiteHeader />
        <main className="flex-1 py-4 mx-4 md:mx-8 lg:mx-12">{children}</main>
      </div>
      <AppSidebar side="right" />
    </SidebarProvider>
  );
}
