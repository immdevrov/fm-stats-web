import { Box, Input, VStack, HStack, Text } from "@chakra-ui/react";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import type { Player } from "../types/types";
import { formatPositions, getEffectivePosition } from "../utils/utils";

interface PlayerAutocompleteProps {
  players: Player[];
  onChange: (player: Player) => void;
  excludeUids: number[];
  placeholder?: string;
  width?: string;
}

const ITEM_HEIGHT = 36;
const VISIBLE_ITEMS = 8;
const OVERSCAN = 3;

export function PlayerAutocomplete({
  players,
  onChange,
  excludeUids,
  placeholder = "Search player...",
  width = "100%",
}: PlayerAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const excludeSet = useMemo(() => new Set(excludeUids), [excludeUids]);

  const filteredPlayers = useMemo(() => {
    const available = players.filter((p) => !excludeSet.has(p.UID));
    if (!search) return available;
    const lower = search.toLowerCase();
    return available.filter(
      (p) =>
        p.Name.toLowerCase().includes(lower) ||
        p.Club.toLowerCase().includes(lower)
    );
  }, [players, excludeSet, search]);

  const totalHeight = filteredPlayers.length * ITEM_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(
    filteredPlayers.length,
    Math.ceil((scrollTop + VISIBLE_ITEMS * ITEM_HEIGHT) / ITEM_HEIGHT) + OVERSCAN
  );
  const visiblePlayers = filteredPlayers.slice(startIndex, endIndex);
  const offsetY = startIndex * ITEM_HEIGHT;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const handleSelect = useCallback(
    (player: Player) => {
      onChange(player);
      setIsOpen(false);
      setSearch("");
    },
    [onChange]
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (isOpen && listRef.current) {
      listRef.current.scrollTop = 0;
      setScrollTop(0);
    }
  }, [isOpen, search]);

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
        <Text fontSize="sm" color="fg.muted">
          + Add player
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
          minW="280px"
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
                {visiblePlayers.map((player) => (
                  <HStack
                    key={player.UID}
                    px={3}
                    height={`${ITEM_HEIGHT}px`}
                    cursor="pointer"
                    _hover={{ bg: "bg.subtle" }}
                    onClick={() => handleSelect(player)}
                    gap={2}
                    alignItems="center"
                  >
                    <Text fontSize="sm" fontWeight="medium" flexShrink={0}>
                      {player.Name}
                    </Text>
                    <Text fontSize="xs" color="fg.muted" truncate>
                      {player.Club}
                    </Text>
                    <Text fontSize="xs" color="fg.muted" flexShrink={0}>
                      {formatPositions(getEffectivePosition(player))}
                    </Text>
                  </HStack>
                ))}
              </Box>
            </Box>
          </Box>

          {filteredPlayers.length === 0 && search && (
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
