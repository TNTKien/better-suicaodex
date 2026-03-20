import { Metadata } from "next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MonitorCog, NotepadText, ServerOffIcon } from "lucide-react";
// import Notifications from "@/components/Notifications/notifications";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Streamdown } from "streamdown";
const items = [
  {
    value: "data_src_change",
    trigger: "01/03/2026 - Thay đổi nguồn dữ liệu",
    content:
      "Vì nhiều lý do, từ giờ SuicaoDex sẽ sử dụng [WeebDex API](https://api.weebdex.org/docs).\n\nDù sao thì, xin được gửi lời cảm ơn cuối cùng đến đội ngũ MangaDex. Ai cũng liêm cho đến khi liêms 🥀",
  },
  {
    value: "user_data",
    trigger: "01/03/2026 - Tài khoản và dữ liệu người dùng",
    content:
      "Về lý thuyết, tài khoản và dữ liệu người dùng của SuicaoDex là riêng biệt với MangaDex, vì vậy việc đổi API kể trên đúng ra phải ~~không ảnh hưởng gì~~.\n\nNhưng vì tôi code đần nên dữ liệu về truyện đã lưu của bạn sẽ tạm không thể sử dụng được, cụ thể vui lòng xem bên dưới.",
  },
  {
    value: "what_affected",
    trigger: "01/03/2026 - Vậy có những gì bị ảnh hưởng?",
    content:
      "Tôi sẽ cố gắng khắc phục các vấn đề bên dưới trong tương lai, còn tương lai cần hay xa thì chưa biết 🐧 \n\n| Chức năng | Trạng thái | Chi tiết |\n|---|---|---|\n| Link | Tạm khắc phục | - Các link truyện uuid của MangaDex sẽ tự động được chuyển về url mới tương ứng (trừ truyện không có trên WeebDex).<br>Ví dụ: https://suicaodex.com/manga/e1e38166-20e4-4468-9370-187f985c550e → https://suicaodex.com/manga/bx5udigu0h/mato-seihei-no-slave <br>- Link chapter do không có map nên chịu, sẽ dẫn thẳng sang mangadex. |\n| Thư viện | Tạm khắc phục | - Đối với thư viện lưu trên thiết bị trước ngày **02/03/2026** sẽ không hiển thị<br>- Đã khắc phục thư viện trong tài khoản, chức năng này hiện đã hoạt động bình thường, 1 số đầu truyện không có trên WeebDex thì chịu, có thể đợi có hoặc xóa cho rảnh nợ. |\n| Lịch sử đọc | Hạn chế | Lịch sử đọc trước ngày **02/03/2026** sẽ không hiển thị. |\n| Thông báo chương mới | Tạm tắt | Vốn dĩ từ trước đã không ổn, tiện thể tắt luôn để tìm giải pháp tối ưu hơn. |\n| Truyện đề cử & Bảng xếp hạng | Tạm ẩn | WeebDex chỉ mới đi vào hoạt động gần đây, dữ liệu chưa có quá nhiều nên chưa thể tính toán được. |\n| Bình luận | Tạm khắc phục | - Trừ 1 số truyện không/chưa có trên WeebDex, các bình luận **tại truyện** sẽ hiển thị bình thường.<br> - Bình luận trong chapter thì chịu, tạm chưa có giải pháp (vẫn sẽ hiển thị trong mục `Bình luận gần đây` cho đến khi nó trôi mất). |",
  },
];

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
      <div className="px-4 md:px-8 lg:px-12">
        <hr className="w-9 h-1 bg-primary border-none" />
        <h1 className="text-2xl font-black uppercase">Thông báo</h1>
      </div>

      <Tabs defaultValue="system" className="mt-4 px-4 md:px-8 lg:px-12">
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
          <Accordion
            type="multiple"
            className=""
            defaultValue={["data_src_change", "user_data", "what_affected"]}
          >
            {items.map((item) => (
              <AccordionItem key={item.value} value={item.value}>
                <AccordionTrigger className="font-semibold uppercase">
                  {item.trigger}
                </AccordionTrigger>
                <AccordionContent>
                  <Streamdown
                    controls={{ table: false }}
                    linkSafety={{ enabled: false }}
                    className="**:data-[streamdown='table-wrapper']:grid!"
                  >
                    {item.content}
                  </Streamdown>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
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
