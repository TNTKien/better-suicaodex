"use client";

import * as React from "react";
import { CheckCheck, ChevronDown, Eraser } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface FilterDropdownOption {
  value: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface FilterDropdownProps {
  description: string;
  placeholder?: string;
  value: string[];
  options: FilterDropdownOption[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  className?: string;
}

interface SingleFilterDropdownProps {
  description: string;
  placeholder?: string;
  value: string | null;
  options: FilterDropdownOption[];
  onChange: (value: string | null) => void;
  className?: string;
}

function buildSummary(
  value: string[],
  options: FilterDropdownOption[],
  placeholder: string,
) {
  if (value.length === 0) {
    return placeholder;
  }

  const labels = value
    .map(
      (item) => options.find((option) => option.value === item)?.label ?? item,
    )
    .slice(0, 2);

  if (value.length <= 2) {
    return labels.join(", ");
  }

  return `${labels.join(", ")} +${value.length - 2}`;
}

export function FilterDropdown({
  description,
  placeholder = "Mặc định",
  value,
  options,
  onChange,
  disabled,
  className,
}: FilterDropdownProps) {
  const selected = React.useMemo(() => new Set(value), [value]);
  const allValues = React.useMemo(
    () => options.map((option) => option.value),
    [options],
  );

  const summary = React.useMemo(
    () => buildSummary(value, options, placeholder),
    [options, placeholder, value],
  );

  const allSelected = options.length > 0 && value.length === options.length;

  const toggleValue = React.useCallback(
    (nextChecked: boolean, nextValue: string) => {
      if (nextChecked) {
        onChange([...value, nextValue]);
        return;
      }

      onChange(value.filter((item) => item !== nextValue));
    },
    [onChange, value],
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-10 w-full justify-between border-none bg-secondary px-3 text-left shadow-none hover:bg-secondary/80",
            className,
          )}
        >
          <span className="truncate text-sm text-muted-foreground">
            {summary}
          </span>
          <span className="flex items-center gap-2 pl-2">
            {value.length > 0 && (
              <Badge
                variant="secondary"
                className="rounded-sm px-1.5 py-0 text-xs"
              >
                {value.length}
              </Badge>
            )}
            <ChevronDown className="size-4 text-muted-foreground" />
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span>{description}</span>
          {value.length > 0 && (
            <button
              type="button"
              className="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Xóa hết"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onChange([]);
              }}
            >
              <Eraser className="size-4" />
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuCheckboxItem
            checked={allSelected}
            onCheckedChange={(checked) => onChange(checked ? allValues : [])}
            onSelect={(event) => event.preventDefault()}
          >
            <CheckCheck className="size-4 text-muted-foreground" />
            Chọn tất cả
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          {options.map((option) => {
            const Icon = option.icon;

            return (
              <DropdownMenuCheckboxItem
                key={option.value}
                checked={selected.has(option.value)}
                onCheckedChange={(checked) =>
                  toggleValue(checked === true, option.value)
                }
                onSelect={(event) => event.preventDefault()}
              >
                {Icon ? (
                  <Icon className="size-4 text-muted-foreground" />
                ) : null}
                {option.label}
              </DropdownMenuCheckboxItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SingleFilterDropdown({
  description,
  placeholder = "Mặc định",
  value,
  options,
  onChange,
  className,
}: SingleFilterDropdownProps) {
  const selectedOption = options.find((option) => option.value === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-10 w-full justify-between border-none bg-secondary px-3 text-left shadow-none hover:bg-secondary/80",
            className,
          )}
        >
          <span className="truncate text-sm text-muted-foreground">
            {selectedOption?.label ?? placeholder}
          </span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span>{description}</span>
          {value ? (
            <button
              type="button"
              className="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Xóa lựa chọn"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onChange(null);
              }}
            >
              <Eraser className="size-4" />
            </button>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={value ?? ""}
          onValueChange={(nextValue) => onChange(nextValue || null)}
        >
          <DropdownMenuGroup>
            {options.map((option) => {
              const Icon = option.icon;

              return (
                <DropdownMenuRadioItem key={option.value} value={option.value}>
                  {Icon ? (
                    <Icon className="size-4 text-muted-foreground" />
                  ) : null}
                  {option.label}
                </DropdownMenuRadioItem>
              );
            })}
          </DropdownMenuGroup>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
