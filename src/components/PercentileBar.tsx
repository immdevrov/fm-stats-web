import { Box, HStack, Text } from "@chakra-ui/react";

interface PercentileBarProps {
  label: string;
  value: number;
  percentile: number;
  formatValue?: (v: number) => string;
}

export function PercentileBar({
  label,
  value,
  percentile,
  formatValue,
}: PercentileBarProps) {
  const color = percentile < 30 ? "red" : percentile < 60 ? "yellow" : "green";

  return (
    <HStack gap={2}>
      <Text w="120px" fontSize="xs" flexShrink={0}>
        {label}
      </Text>
      <Box flex={1} h="12px" bg="bg.muted" borderRadius="sm" overflow="hidden">
        <Box
          w={`${percentile}%`}
          h="100%"
          bg={`${color}.500`}
          borderRadius="sm"
        />
      </Box>
      <Text w="32px" fontSize="xs" textAlign="right" flexShrink={0}>
        {percentile.toFixed(0)}
      </Text>
      <Text w="50px" fontSize="xs" color="fg.muted" textAlign="right" flexShrink={0}>
        {formatValue?.(value) ?? value.toFixed(2)}
      </Text>
    </HStack>
  );
}
