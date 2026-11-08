import type { ReactNode } from "react";
import { Box, Text } from "@chakra-ui/react";
import { STAT_LABELS } from "../roles";
import type { StatGroup } from "../utils/stat-group-mapping";

export function groupTooltip(group: StatGroup): ReactNode {
  return (
    <Box>
      <Text>
        <Text as="span" fontWeight="bold">{group.label}</Text> — {group.description}
      </Text>
      <Text>{group.statKeys.map((key) => STAT_LABELS[key] ?? key).join(" · ")}</Text>
    </Box>
  );
}
