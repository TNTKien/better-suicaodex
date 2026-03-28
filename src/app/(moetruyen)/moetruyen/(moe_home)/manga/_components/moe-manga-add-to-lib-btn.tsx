import { Button } from "@/components/ui/button";
import { ListPlus } from "lucide-react";

export default function MoeMangaAddToLibBtn() {
  return (
    <Button
      className="w-9 md:w-auto"
      type="button"
    >
      <ListPlus />
      <span className="hidden md:block">Thêm vào thư viện</span>
    </Button>
  );
}
