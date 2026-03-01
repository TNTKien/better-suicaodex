import { Metadata } from "next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MonitorCog, NotepadText, ServerOffIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
// import Notifications from "@/components/Notifications/notifications";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

// interface pageProps {
//   searchParams: Promise<{
//     [key: string]: string | undefined;
//   }>;
// }

export const metadata: Metadata = {
  title: "Thông báo",
};

export default async function Page() {
  // const { page } = await getSearchParams({ searchParams });
  const tabValues = [
    {
      value: "noti",
      label: "Truyện",
      icon: <NotepadText size={16} className="mr-1" />,
    },
    {
      value: "system",
      label: "Hệ thống",
      icon: <MonitorCog size={16} className="mr-1" />,
    },
  ];
  return (
    <>
      <div>
        <hr className="w-9 h-1 bg-primary border-none" />
        <h1 className="text-2xl font-black uppercase">Thông báo</h1>
      </div>

      <Tabs defaultValue="system" className="mt-4">
        <TabsList className="w-full">
          {tabValues.map((tab) => (
            <TabsTrigger
              key={tab.value}
              className="w-full flex items-center"
              value={tab.value}
            >
              {tab.icon}
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="noti">
          <Empty className="bg-muted/30 h-full mt-2">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ServerOffIcon />
              </EmptyMedia>
              <EmptyTitle>Chức năng tạm thời không khả dụng</EmptyTitle>
              <EmptyDescription className="max-w-xs text-pretty">
                Tạm tắt cái này để bảo trì, chịu khó đợi nhé 🤪
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
          {/* <Accordion
            type="single"
            collapsible
            className="bg-secondary rounded-md px-2 mb-2"
          >
            <AccordionItem value="item-1" className="border-none">
              <AccordionTrigger className="py-2">
                <div className="flex items-center gap-1.5">
                  <CircleHelp size={18} /> Có thể bạn cần biết:
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-2">
                Thông báo truyện mới sẽ được lưu trên thiết bị của bạn; nếu bạn
                xóa dữ liệu trình duyệt, thông báo cũng sẽ bị xóa theo.
                <br />
                Chính vì hạn chế trên, đôi khi sẽ không có thông báo dù truyện
                có chương mới
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          <Notifications page={page} /> */}
        </TabsContent>
        <TabsContent value="system">
          <Alert className="rounded-sm bg-secondary justify-center text-center">
            <AlertDescription className="text-center justify-items-center">
              {" "}
              Không có thông báo nào!
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
    </>
  );
}

// const getSearchParams = async ({ searchParams }: pageProps) => {
//   const params = await searchParams;
//   let page = params["page"] ? parseInt(params["page"]) : 1;
//   if (page < 1) page = 1;

//   return { page };
// };
