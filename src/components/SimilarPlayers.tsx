import { Box, HStack, VStack, Text, Spinner } from "@chakra-ui/react";
import { useState, useEffect, useTransition } from "react";
import { Link } from "react-router-dom";
import type { RoleConfig } from "../roles";
import { STAT_LABELS } from "../roles";
import { findSimilarPlayers, type SimilarPlayer } from "../utils/similarity";
import { Tooltip } from "./ui/tooltip";

interface PercentileBlockProps {
  percentile: number;
  statKey: string;
}

function PercentileBlock({ percentile, statKey }: PercentileBlockProps) {
  const safePercentile = percentile ?? 0;
  const color = safePercentile < 30 ? "red" : safePercentile < 60 ? "yellow" : "green";
  const label = STAT_LABELS[statKey] ?? statKey;

  return (
    <Tooltip content={`${label}: ${safePercentile.toFixed(0)}%`}>
      <Box
        w="10px"
        h="10px"
        bg={`${color}.500`}
        borderRadius="xs"
        flexShrink={0}
        cursor="default"
      />
    </Tooltip>
  );
}

interface SimilarPlayersProps {
  playerUid: number;
  roleConfig: RoleConfig;
  cohort: Record<string, unknown>[];
  targetPercentiles: Record<string, number>;
}

export function SimilarPlayers({
  playerUid,
  roleConfig,
  cohort,
  targetPercentiles,
}: SimilarPlayersProps) {
  const [similarPlayers, setSimilarPlayers] = useState<SimilarPlayer[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(() => {
      if (cohort.length < 2) {
        setSimilarPlayers([]);
      } else {
        const results = findSimilarPlayers(
          playerUid,
          targetPercentiles,
          cohort,
          roleConfig.statKeys,
          5
        );
        setSimilarPlayers(results);
      }
    });
  }, [playerUid, targetPercentiles, cohort, roleConfig.statKeys]);

  if (isPending) {
    return (
      <Box mt={4}>
        <Text fontSize="sm" fontWeight="medium" mb={2}>
          Similar Players
        </Text>
        <HStack gap={2}>
          <Spinner size="sm" colorPalette="glaucous" />
          <Text fontSize="xs" color="fg.muted">
            Finding similar players...
          </Text>
        </HStack>
      </Box>
    );
  }

  if (similarPlayers.length === 0) {
    return (
      <Box mt={4}>
        <Text fontSize="sm" fontWeight="medium" mb={2}>
          Similar Players
        </Text>
        <Text fontSize="xs" color="fg.muted">
          Not enough players in cohort for comparison
        </Text>
      </Box>
    );
  }

  return (
    <Box mt={4}>
      <Text fontSize="sm" fontWeight="medium" mb={2}>
        Similar Players
      </Text>
      <VStack align="stretch" gap={1}>
        {similarPlayers.map((similar) => (
          <HStack key={similar.uid} gap={2}>
            <Box w="160px" flexShrink={0} overflow="hidden">
              <Link to={`/players/${similar.uid}`}>
                <Text
                  fontSize="xs"
                  color="glaucous.400"
                  _hover={{ textDecoration: "underline" }}
                  truncate
                >
                  {similar.name}
                </Text>
              </Link>
              <Text fontSize="xs" color="fg.muted" truncate>
                {similar.club}
              </Text>
            </Box>
            <HStack gap="2px" flexShrink={0}>
              {roleConfig.statKeys.map((key) => (
                <PercentileBlock
                  key={key}
                  statKey={key}
                  percentile={similar.percentiles[key]}
                />
              ))}
            </HStack>
          </HStack>
        ))}
      </VStack>
    </Box>
  );
}
