import { Box, Input, Text, VStack } from "@chakra-ui/react";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";

interface SearchableSelectProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allLabel?: string;
  width?: string;
}

const ITEM_HEIGHT = 32;
const VISIBLE_ITEMS = 8;
const OVERSCAN = 3;

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Search...",
  allLabel = "All",
  width = "200px",
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    const lower = search.toLowerCase();
    return options.filter((opt) => opt.toLowerCase().includes(lower));
  }, [options, search]);

  const allOptions = useMemo(() => ["", ...filteredOptions], [filteredOptions]);

  const totalHeight = allOptions.length * ITEM_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(
    allOptions.length,
    Math.ceil((scrollTop + VISIBLE_ITEMS * ITEM_HEIGHT) / ITEM_HEIGHT) + OVERSCAN
  );
  const visibleOptions = allOptions.slice(startIndex, endIndex);
  const offsetY = startIndex * ITEM_HEIGHT;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const handleSelect = useCallback(
    (opt: string) => {
      onChange(opt);
      setIsOpen(false);
      setSearch("");
    },
    [onChange]
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && listRef.current) {
      listRef.current.scrollTop = 0;
      setScrollTop(0);
    }
  }, [isOpen, search]);

  const displayValue = value || allLabel;

  return (
    <Box position="relative" width={width} ref={containerRef}>
      <Box
        px={3}
        py={2}
        borderWidth="1px"
        borderRadius="md"
        cursor="pointer"
        bg="bg.subtle"
        onClick={() => setIsOpen(!isOpen)}
        _hover={{ borderColor: "fg.muted" }}
      >
        <Text fontSize="sm" truncate>
          {displayValue}
        </Text>
      </Box>

      {isOpen && (
        <VStack
          position="absolute"
          top="100%"
          left={0}
          right={0}
          mt={1}
          bg="bg.panel"
          borderWidth="1px"
          borderRadius="md"
          boxShadow="lg"
          zIndex={10}
          align="stretch"
          gap={0}
        >
          <Box p={2} borderBottomWidth="1px">
            <Input
              size="sm"
              placeholder={placeholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </Box>

          <Box
            ref={listRef}
            maxH={`${VISIBLE_ITEMS * ITEM_HEIGHT}px`}
            overflowY="auto"
            onScroll={handleScroll}
          >
            <Box height={`${totalHeight}px`} position="relative">
              <Box position="absolute" top={`${offsetY}px`} left={0} right={0}>
                {visibleOptions.map((opt) => (
                  <Box
                    key={opt || "__all__"}
                    px={3}
                    py={1}
                    height={`${ITEM_HEIGHT}px`}
                    cursor="pointer"
                    bg={value === opt ? "bg.muted" : "transparent"}
                    _hover={{ bg: "bg.subtle" }}
                    onClick={() => handleSelect(opt)}
                    display="flex"
                    alignItems="center"
                  >
                    <Text fontSize="sm" truncate>
                      {opt || allLabel}
                    </Text>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>

          {filteredOptions.length === 0 && search && (
            <Box px={3} py={2}>
              <Text fontSize="sm" color="fg.muted">
                No matches found
              </Text>
            </Box>
          )}
        </VStack>
      )}
    </Box>
  );
}
