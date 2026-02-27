import { useLocalLibrary } from "@/hooks/use-local-library";
import { useLocalNotification } from "@/hooks/use-local-notification";
import { getMangaCategory, updateMangaCategory } from "@/lib/suicaodex/db";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LibraryType } from "@/types/types";
import {
  Album,
  BellOff,
  BellRing,
  BookmarkCheck,
  ChevronDown,
  CircleUser,
  CloudOff,
  ListCheck,
  ListPlus,
  NotebookPen,
  Phone,
  Smartphone,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@/components/ui/button-group";
import { Spinner } from "@/components/ui/spinner";

type StorageMode = "local" | "account";

interface MangaAddToLibBtnProps {
  mangaId: string;
}

const categoryOptions = [
  {
    value: "none",
    label: "Không",
    icon: <ListPlus />,
    btnLabel: "Thêm vào thư viện",
  },
  {
    value: "following",
    label: "Theo dõi",
    icon: <BookmarkCheck />,
    btnLabel: "Đang theo dõi",
  },
  {
    value: "reading",
    label: "Đang đọc",
    icon: <Album />,
    btnLabel: "Đang đọc",
  },
  {
    value: "plan",
    label: "Đọc sau",
    icon: <NotebookPen />,
    btnLabel: "Đọc sau",
  },
  {
    value: "completed",
    label: "Đã đọc xong",
    icon: <ListCheck />,
    btnLabel: "Đã đọc xong",
  },
];

const storageModeOptions = [
  {
    value: "local" as StorageMode,
    label: "Thiết bị",
    icon: <Smartphone />,
  },
  {
    value: "account" as StorageMode,
    label: "Tài khoản",
    icon: <CircleUser />,
  },
];

export function MangaAddToLibBtn({ mangaId }: MangaAddToLibBtnProps) {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [storageMode, setStorageMode] = useState<StorageMode>("local");
  const [isNotificationEnabled, setIsNotificationEnabled] = useState(false);
  const [accountValue, setAccountValue] = useState<LibraryType | "none">(
    "none",
  );
  const [isFetchingAccount, setIsFetchingAccount] = useState(false);
  const [hasFetchedAccount, setHasFetchedAccount] = useState(false);

  const {
    localLibrary,
    addToLocalCategory,
    removeFromLocalLibrary,
    getLocalCategoryOfId,
  } = useLocalLibrary();

  const {
    localNotification,
    addToLocalNotification,
    removeFromLocalNotification,
    isInLocalNotification,
  } = useLocalNotification();

  const [localValue, setLocalValue] = useState<LibraryType | "none">(
    getLocalCategoryOfId(mangaId) || "none",
  );

  // Sync local value when library changes
  useEffect(() => {
    setLocalValue(getLocalCategoryOfId(mangaId) || "none");
  }, [mangaId, localLibrary]);

  useEffect(() => {
    setIsNotificationEnabled(isInLocalNotification(mangaId));
  }, [mangaId, localNotification]);

  const value = storageMode === "local" ? localValue : accountValue;

  const fetchAccountCategory = async () => {
    if (!session?.user?.id) return;
    setIsFetchingAccount(true);
    try {
      const cat = await getMangaCategory(session.user.id, mangaId);
      setAccountValue((cat.toLowerCase() as LibraryType | "none") ?? "none");
      setHasFetchedAccount(true);
    } catch {
      setAccountValue("none");
    } finally {
      setIsFetchingAccount(false);
    }
  };

  const handleLocalNotificationToggle = (
    v: LibraryType | "none",
    enabled: boolean,
  ) => {
    if (v === "none" || !enabled) {
      return removeFromLocalNotification(mangaId);
    }
    addToLocalNotification(mangaId);
  };

  const handleLocalLibraryAdd = (v: LibraryType | "none") => {
    if (v === "none") {
      removeFromLocalLibrary(mangaId);
      return toast.success(`Đã xóa truyện khỏi thư viện!`);
    }
    addToLocalCategory(mangaId, v);
    return toast.success(
      `Đã thêm truyện vào: ${categoryOptions.find((opt) => opt.value === v)?.label}!`,
    );
  };

  const handleLibraryAdd = async (v: LibraryType | "none") => {
    if (!session || !session.user || !session.user.id) {
      toast.info("Bạn cần đăng nhập để sử dụng chức năng này!");
      return;
    }
    setIsLoading(true);
    try {
      const res = await updateMangaCategory(
        session.user.id,
        mangaId,
        v.toUpperCase() as any,
        "none", // đếch nhớ sao lại code như này 😳
      );
      if (res.status === 200 || res.status === 201) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } catch (error) {
      console.error(error);
      toast.error("Có lỗi xảy ra, vui lòng thử lại sau!");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCategoryChange = async (v: string) => {
    const newValue = v as LibraryType | "none";
    if (storageMode === "local") {
      setLocalValue(newValue);
      handleLocalLibraryAdd(newValue);
    } else {
      setAccountValue(newValue);
      await handleLibraryAdd(newValue);
    }
  };

  const handleStorageModeChange = async (mode: StorageMode) => {
    if (mode === "account" && !session?.user?.id) {
      toast.info("Bạn cần đăng nhập để sử dụng chức năng này!");
      return;
    }
    setStorageMode(mode);
    if (mode === "account" && !hasFetchedAccount) {
      await fetchAccountCategory();
    }
  };

  const handleBellToggle = () => {
    const newState = !isNotificationEnabled;
    setIsNotificationEnabled(newState);
    handleLocalNotificationToggle(value, newState);
    if (newState) {
      toast.success("Đã bật thông báo!");
    } else {
      toast.info("Đã tắt thông báo!");
    }
  };

  const currentCategory = categoryOptions.find((opt) => opt.value === value);
  const currentStorage = storageModeOptions.find(
    (opt) => opt.value === storageMode,
  );

  return (
    <ButtonGroup>
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={isLoading}>
          <Button className="w-9 md:w-auto">
            {currentCategory?.icon}
            <span className="hidden md:inline">
              {currentCategory?.btnLabel}
            </span>
            <ChevronDown className="size-3.5 hidden md:inline" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="space-y-1">
          {categoryOptions.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => handleCategoryChange(option.value)}
              className={value === option.value ? "bg-accent" : ""}
            >
              {option.icon}
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {value !== "none" && (
        <Button
          variant={isNotificationEnabled ? "default" : "secondary"}
          size="icon"
          onClick={handleBellToggle}
          disabled={isLoading}
        >
          {isNotificationEnabled ? (
            <BellRing className=" animate-bell-shake" />
          ) : (
            <BellOff />
          )}
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={isLoading || isFetchingAccount}>
          <Button variant="secondary" size="icon">
            {isFetchingAccount ? <Spinner /> : <>{currentStorage?.icon}</>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="space-y-1">
          {storageModeOptions.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => handleStorageModeChange(option.value)}
              className={storageMode === option.value ? "bg-accent" : ""}
            >
              {option.icon}
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  );
}
