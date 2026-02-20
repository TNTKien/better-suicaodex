import { AppSidebar } from "@/components/Sidebar/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

export default function ReaderLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider defaultOpen>
      <AppSidebar side="left" />
      <div className="border-grid flex flex-1 flex-col">
        <main className="flex-1">{children}</main>
      </div>
    </SidebarProvider>
  );
}
