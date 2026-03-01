import { useCallback } from "react";
import useLocalStorage from "./use-local-storage";

type ReadingHistory = {
  chapterId: string;
  chapter: string | null;
  updatedAt: string;
};

const MAX_HISTORY = 100;

export default function useReadingHistory() {
  const [history, setHistory] = useLocalStorage<Record<string, ReadingHistory>>(
    "dev_history",
    {}
  );

  const addHistory = useCallback(
    (mangaId: string, manga: ReadingHistory) => {
      setHistory((value) => {
        const newHistory = { ...value, [mangaId]: manga };
        const mangaIds = Object.keys(newHistory);
        if (mangaIds.length > MAX_HISTORY) {
          delete newHistory[mangaIds[0]];
        }
        return newHistory;
      });
    },
    [setHistory]
  );

  const removeHistory = (mangaId: string) => {
    setHistory((value) => {
      const newHistory = { ...value };
      delete newHistory[mangaId];
      return newHistory;
    });
  };

  return { history, setHistory, addHistory, removeHistory };
}
