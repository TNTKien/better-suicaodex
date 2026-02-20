import { SidebarProvider } from "@/components/ui/sidebar";

export default function ReaderLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="border-grid flex flex-1 flex-col">
        <main className="flex-1">{children}</main>
      </div>
      {/* <AppSidebar side="left" /> */}
    </SidebarProvider>
  );
}
