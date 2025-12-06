import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  CheckIcon,
  XCircle,
  ChevronsUpDown,
  XIcon,
  WandSparkles,
  Plus,
  Minus,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

/**
 * Enum representing the three possible states of a tag
 */
export enum TagState {
  NONE = "none",
  INCLUDE = "include",
  EXCLUDE = "exclude",
}

/**
 * Variants for the tags-selector component to handle different styles.
 * Uses class-variance-authority (cva) to define different styles based on tag state.
 */
const tagSelectorVariants = cva(
  "m-1 transition ease-in-out delay-150 hover:-translate-y-1 hover:scale-110 duration-300",
  {
    variants: {
      state: {
        [TagState.INCLUDE]:
          "border-foreground/10 bg-primary text-primary-foreground hover:bg-primary/80",
        [TagState.EXCLUDE]:
          "border-foreground/10 bg-destructive text-destructive-foreground hover:bg-destructive/80",
        [TagState.NONE]:
          "border-foreground/10 bg-card text-foreground hover:bg-card/80",
      },
    },
    defaultVariants: {
      state: TagState.NONE,
    },
  }
);

/**
 * Props for TagsSelector component
 */
interface TagsSelectorProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof tagSelectorVariants> {
  /**
   * An array of tag objects to be displayed in the tags-selector component.
   * Each tag object has a label, value, and an optional icon.
   */
  options: {
    /** The text to display for the option. */
    label: string;
    /** The unique value associated with the option. */
    value: string;
    /** Optional icon component to display alongside the option. */
    icon?: React.ComponentType<{ className?: string }>;
  }[];

  /**
   * Callback function triggered when the selected values change.
   * Receives two arrays - included tags and excluded tags.
   */
  onValueChange: (includedTags: string[], excludedTags: string[]) => void;

  /** The default included values when the component mounts. */
  defaultIncluded?: string[];

  /** The default excluded values when the component mounts. */
  defaultExcluded?: string[];

  /**
   * Placeholder text to be displayed when no values are selected.
   * Optional, defaults to "Select tags".
   */
  placeholder?: string;

  /**
   * Animation duration in seconds for the visual effects (e.g., bouncing badges).
   * Optional, defaults to 0 (no animation).
   */
  animation?: number;

  /**
   * Maximum number of items to display. Extra selected items will be summarized.
   * Optional, defaults to 3.
   */
  maxCount?: number;

  /**
   * The modality of the popover. When set to true, interaction with outside elements
   * will be disabled and only popover content will be visible to screen readers.
   * Optional, defaults to false.
   */
  modalPopover?: boolean;

  /**
   * If true, renders the tags-selector component as a child of another component.
   * Optional, defaults to false.
   */
  asChild?: boolean;

  /**
   * Additional class names to apply custom styles to the tags-selector component.
   * Optional, can be used to add custom styles.
   */
  className?: string;

  /**
   * If true, hides the search input in the dropdown.
   * Optional, defaults to false.
   */
  disableSearch?: boolean;

  /**
   * If true, hides the footer with Clear and Close buttons.
   * Optional, defaults to false.
   */
  disableFooter?: boolean;

  /**
   * If true, displays the selected values as text on a single line instead of badges.
   * Optional, defaults to false.
   */
  isCompact?: boolean;
}

export const TagsSelector = React.forwardRef<
  HTMLButtonElement,
  TagsSelectorProps
>(
  (
    {
      options,
      onValueChange,
      defaultIncluded = [],
      defaultExcluded = [],
      placeholder = "Select tags",
      animation = 0,
      maxCount = 3,
      modalPopover = false,
      asChild = false,
      className,
      disableSearch = false,
      disableFooter = false,
      isCompact = false,
      ...props
    },
    ref
  ) => {
    // Store the state of each tag as a map of tag value to TagState
    const [tagStates, setTagStates] = React.useState<Record<string, TagState>>(
      () => {
        const states: Record<string, TagState> = {};

        // Set initial states based on default included and excluded values
        options.forEach((option) => {
          if (defaultIncluded.includes(option.value)) {
            states[option.value] = TagState.INCLUDE;
          } else if (defaultExcluded.includes(option.value)) {
            states[option.value] = TagState.EXCLUDE;
          } else {
            states[option.value] = TagState.NONE;
          }
        });

        return states;
      }
    );

    const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);
    const [isAnimating, setIsAnimating] = React.useState(false);

    // Calculate included and excluded tags based on tag states
    const includedTags = React.useMemo(
      () =>
        Object.entries(tagStates)
          .filter(([_, state]) => state === TagState.INCLUDE)
          .map(([value]) => value),
      [tagStates]
    );

    const excludedTags = React.useMemo(
      () =>
        Object.entries(tagStates)
          .filter(([_, state]) => state === TagState.EXCLUDE)
          .map(([value]) => value),
      [tagStates]
    );

    // Calculate all selected tags (both included and excluded)
    const selectedTags = React.useMemo(
      () => [...includedTags, ...excludedTags],
      [includedTags, excludedTags]
    );

    // Update parent component when selections change
    React.useEffect(() => {
      onValueChange(includedTags, excludedTags);
    }, [includedTags, excludedTags, onValueChange]);

    const handleInputKeyDown = (
      event: React.KeyboardEvent<HTMLInputElement>
    ) => {
      if (event.key === "Enter") {
        setIsPopoverOpen(true);
      } else if (event.key === "Backspace" && !event.currentTarget.value) {
        // Remove the last selected tag (regardless of include/exclude state)
        if (selectedTags.length > 0) {
          const lastTag = selectedTags[selectedTags.length - 1];
          const newTagStates = { ...tagStates };
          newTagStates[lastTag] = TagState.NONE;
          setTagStates(newTagStates);
        }
      }
    };

    const cycleTagState = (tagValue: string) => {
      const currentState = tagStates[tagValue] || TagState.NONE;
      const newTagStates = { ...tagStates };

      // Cycle through states: NONE -> INCLUDE -> EXCLUDE -> NONE
      switch (currentState) {
        case TagState.NONE:
          newTagStates[tagValue] = TagState.INCLUDE;
          break;
        case TagState.INCLUDE:
          newTagStates[tagValue] = TagState.EXCLUDE;
          break;
        case TagState.EXCLUDE:
          newTagStates[tagValue] = TagState.NONE;
          break;
      }

      setTagStates(newTagStates);
    };

    const getStateIcon = (state: TagState) => {
      switch (state) {
        case TagState.INCLUDE:
          return <Plus className="h-4 w-4" />;
        case TagState.EXCLUDE:
          return <Minus className="h-4 w-4" />;
        default:
          return null;
      }
    };

    const handleClear = () => {
      const newTagStates: Record<string, TagState> = {};
      options.forEach((option) => {
        newTagStates[option.value] = TagState.NONE;
      });
      setTagStates(newTagStates);
    };

    const handleTogglePopover = () => {
      setIsPopoverOpen((prev) => !prev);
    };

    // Clear extra options exceeding maxCount
    const clearExtraOptions = () => {
      const newTagStates = { ...tagStates };

      // Keep only the first maxCount selected tags
      let count = 0;

      for (const [value, state] of Object.entries(newTagStates)) {
        if (state !== TagState.NONE) {
          count++;
          if (count > maxCount) {
            newTagStates[value] = TagState.NONE;
          }
        }
      }

      setTagStates(newTagStates);
    };

    return (
      <Popover
        open={isPopoverOpen}
        onOpenChange={setIsPopoverOpen}
        modal={modalPopover}
      >
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            {...props}
            onClick={handleTogglePopover}
            className={cn(
              "flex w-full p-1 rounded-md border min-h-10 h-auto items-center justify-between bg-inherit hover:bg-inherit [&_svg]:pointer-events-auto",
              className
            )}
          >
            {selectedTags.length > 0 ? (
              <div className="flex justify-between items-center w-full">
                {isCompact ? (
                  <div className="flex items-center overflow-hidden">
                    <span className="text-sm truncate mx-3 text-muted-foreground">
                      {selectedTags
                        .slice(0, maxCount)
                        .map((value) => {
                          const option = options.find((o) => o.value === value);
                          const state = tagStates[value];
                          const statePrefix =
                            state === TagState.INCLUDE ? "+" : "-";
                          return `${statePrefix}${option?.label}`;
                        })
                        .join(", ")}
                      {selectedTags.length > maxCount &&
                        `, +${selectedTags.length - maxCount} more`}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center">
                    {selectedTags.slice(0, maxCount).map((value) => {
                      const option = options.find((o) => o.value === value);
                      const state = tagStates[value];
                      const IconComponent = option?.icon;
                      return (
                        <Badge
                          key={value}
                          className={cn(
                            isAnimating ? "animate-bounce" : "",
                            tagSelectorVariants({ state })
                          )}
                          style={{ animationDuration: `${animation}s` }}
                        >
                          {getStateIcon(state)}
                          {IconComponent && (
                            <IconComponent className="h-4 w-4 mx-1" />
                          )}
                          {option?.label}
                          <XCircle
                            className="ml-2 h-4 w-4 cursor-pointer"
                            onClick={(event) => {
                              event.stopPropagation();
                              const newTagStates = { ...tagStates };
                              newTagStates[value] = TagState.NONE;
                              setTagStates(newTagStates);
                            }}
                          />
                        </Badge>
                      );
                    })}
                    {selectedTags.length > maxCount && (
                      <Badge
                        className={cn(
                          "bg-transparent text-foreground border-foreground/1 hover:bg-transparent",
                          isAnimating ? "animate-bounce" : ""
                        )}
                        style={{ animationDuration: `${animation}s` }}
                      >
                        {`+ ${selectedTags.length - maxCount} more`}
                        <XCircle
                          className="ml-2 h-4 w-4 cursor-pointer"
                          onClick={(event) => {
                            event.stopPropagation();
                            clearExtraOptions();
                          }}
                        />
                      </Badge>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <XIcon
                    className="h-4 mx-2 cursor-pointer text-muted-foreground"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleClear();
                    }}
                  />
                  <Separator
                    orientation="vertical"
                    className="flex min-h-6 h-full"
                  />
                  <ChevronsUpDown className="h-4 mx-2 cursor-pointer text-muted-foreground" />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between w-full mx-auto">
                <span className="text-sm text-muted-foreground mx-3">
                  {placeholder}
                </span>
                <ChevronsUpDown className="h-4 cursor-pointer text-muted-foreground mx-2" />
              </div>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0"
          align="start"
          sideOffset={5}
          onEscapeKeyDown={() => setIsPopoverOpen(false)}
          style={{ width: "var(--radix-popover-trigger-width)" }}
        >
          <Command>
            {!disableSearch && (
              <CommandInput
                placeholder="Search tags..."
                onKeyDown={handleInputKeyDown}
              />
            )}
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup>
                {/* <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  Click to toggle: None → Include → Exclude → None  
                </div> */}
                {selectedTags.length > 0 && (
                    <div className="flex flex-wrap items-center border-b pb-0.5">
                    {selectedTags.map((value) => {
                      const option = options.find((o) => o.value === value);
                      const state = tagStates[value];
                      const IconComponent = option?.icon;
                      return (
                        <Badge
                          key={value}
                          className={cn(
                            isAnimating ? "animate-bounce" : "",
                            tagSelectorVariants({ state })
                          )}
                          style={{ animationDuration: `${animation}s` }}
                        >
                          {/* {getStateIcon(state)}
                          {IconComponent && (
                            <IconComponent className="h-4 w-4 mx-1" />
                          )} */}
                          {option?.label}
                          <XCircle
                            className="ml-2 h-4 w-4 cursor-pointer"
                            onClick={(event) => {
                              event.stopPropagation();
                              const newTagStates = { ...tagStates };
                              newTagStates[value] = TagState.NONE;
                              setTagStates(newTagStates);
                            }}
                          />
                        </Badge>
                      );
                    })}
                  </div>
                )}
                
                {options.map((option) => {
                  const state = tagStates[option.value] || TagState.NONE;
                  return (
                    <CommandItem
                      key={option.value}
                      onSelect={() => cycleTagState(option.value)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-center justify-center">
                        {state === TagState.INCLUDE && (
                          <Plus className="h-4 w-4 text-primary" />
                        )}
                        {state === TagState.EXCLUDE && (
                          <Minus className="h-4 w-4 text-destructive" />
                        )}
                        {state === TagState.NONE && (
                          <div className="h-4 w-4 opacity-50" />
                        )}
                      </div>
                      {option.icon && (
                        <option.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                      )}
                      <span
                        className={cn(
                          state === TagState.INCLUDE && "text-primary",
                          state === TagState.EXCLUDE && "text-destructive",
                          state === TagState.NONE && "text-muted-foreground"
                        )}
                      >
                        {option.label}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              <CommandSeparator />
              {!disableFooter && (
                <CommandGroup>
                  <div className="flex items-center justify-between">
                    {selectedTags.length > 0 && (
                      <>
                        <CommandItem
                          onSelect={handleClear}
                          className="flex-1 justify-center cursor-pointer"
                        >
                          Clear
                        </CommandItem>
                        <Separator
                          orientation="vertical"
                          className="flex min-h-6 h-full"
                        />
                      </>
                    )}
                    <CommandItem
                      onSelect={() => setIsPopoverOpen(false)}
                      className="flex-1 justify-center cursor-pointer max-w-full"
                    >
                      Close
                    </CommandItem>
                  </div>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
        {animation > 0 && selectedTags.length > 0 && (
          <WandSparkles
            className={cn(
              "cursor-pointer my-2 text-foreground bg-background w-3 h-3",
              isAnimating ? "" : "text-muted-foreground"
            )}
            onClick={() => setIsAnimating(!isAnimating)}
          />
        )}
      </Popover>
    );
  }
);

TagsSelector.displayName = "TagsSelector";