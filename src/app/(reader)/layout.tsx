import { SidebarProvider } from "@/components/ui/sidebar-2-reader";

//TODO: fix folder structure

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
          "--sidebar-width": "calc(var(--spacing) * 95)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >

      {children}
    </SidebarProvider>
  );
}
