import { SiteHeader } from "@/components/Navbar/site-header";
import { AppSidebar } from "@/components/Sidebar/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

export default function ReaderLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider
      defaultOpen
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 100)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <div className="border-grid flex flex-1 flex-col">{children}</div>
      <AppSidebar side="right" />
      {/* <div className="border-grid flex flex-1 flex-col">{children}</div>
      <AppSidebar side="right" /> */}
      {children}
    </SidebarProvider>
  );
}
