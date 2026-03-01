// src/components/Pages/AdvancedSearch/authors-selector.tsx
"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { SearchAuthor, SearchAuthorByIds } from "@/lib/mangadex/author";
import { AsyncMultiSelect } from "@/components/ui/async-multi-select";
import { cn } from "@/lib/utils";
import { Author } from "@/types/types";

interface AuthorOption {
  value: string;
  label: string;
}

interface AuthorsSelectorProps {
  defaultValue?: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
  isCompact?: boolean;
  disableFooter?: boolean;
  showSelectedValue?: boolean;
}

export const AuthorsSelector: React.FC<AuthorsSelectorProps> = ({
  defaultValue = [],
  onValueChange,
  placeholder = "Select authors",
  className,
  isCompact = false,
  disableFooter = false,
  showSelectedValue = false,
}) => {
  const [selectedAuthorIds, setSelectedAuthorIds] = useState<string[]>(defaultValue);
  const [cachedAuthors, setCachedAuthors] = useState<Map<string, AuthorOption>>(new Map());
  const [initialOptionsLoaded, setInitialOptionsLoaded] = useState(false);
  const [hasValidDefaultValues, setHasValidDefaultValues] = useState(true);

  // Pre-load some authors and default selections when component mounts
  useEffect(() => {
    const loadInitialData = async () => {
      // First, load default values if any
      if (defaultValue.length > 0) {
        try {
          const authorsData = await SearchAuthorByIds(defaultValue);
          // Skip mapping if authorsData is empty or undefined
          if (authorsData && authorsData.length > 0) {
            const options = authorsData.map((author: Author) => ({
              value: author.id,
              label: author.name,
            }));

            // Store into our cached authors map
            const newCache = new Map(cachedAuthors);
            options.forEach(opt => newCache.set(opt.value, opt));
            setCachedAuthors(newCache);
          } else {
            // If SearchAuthorByIds returns empty, set flag to not use defaultValue
            setHasValidDefaultValues(false);
          }
        } catch (error) {
          console.error("Error loading initial authors:", error);
          setHasValidDefaultValues(false);
        }
      }

      setInitialOptionsLoaded(true);
    };

    loadInitialData();
  }, [defaultValue]);

  // Convert the cached authors Map to an array for use with AsyncMultiSelect
  const cachedAuthorsArray = Array.from(cachedAuthors.values());

  // Search authors and update the cache
  const handleAuthorSearch = useCallback(async (query: string): Promise<AuthorOption[]> => {
    // If no query, return all cached authors
    if (!query.trim()) {
      return cachedAuthorsArray;
    }

    try {
      const data = await SearchAuthor(query);
      const searchResults = data.map((author) => ({
        value: author.id,
        label: author.name,
      }));

      // Update our cache with the new search results
      if (searchResults.length > 0) {
        const newCache = new Map(cachedAuthors);
        searchResults.forEach(opt => newCache.set(opt.value, opt));
        setCachedAuthors(newCache);
      }

      return searchResults;
    } catch (error) {
      console.error("Error searching for authors:", error);
      return cachedAuthorsArray; // Return cached authors on error
    }
  }, [cachedAuthors, cachedAuthorsArray]);

  const handleValueChange = (ids: string[]) => {
    setSelectedAuthorIds(ids);
    onValueChange(ids);
  };

  // Don't render until initial options are loaded
  if (!initialOptionsLoaded) {
    return null;
  }

  return (
    <AsyncMultiSelect
      loadOptions={handleAuthorSearch}
      onValueChange={handleValueChange}
      defaultValue={hasValidDefaultValues ? selectedAuthorIds : []}
      className={cn("shadow-none", className)}
      disableFooter={disableFooter}
      isCompact={isCompact}
      showSelectedValue={showSelectedValue}
      placeholder={placeholder}
      noResultsMessage="Không có kết quả"
      loadingMessage="Đang tìm..."
      preloadedOptions={cachedAuthorsArray}
    />
  );
};