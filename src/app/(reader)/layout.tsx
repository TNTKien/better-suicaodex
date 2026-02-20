import { SidebarProvider } from "@/components/ui/sidebar-2-reader";

export default function ReaderLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider
      defaultOpen
      className=""
    >
      {children}
    </SidebarProvider>
  );
}
