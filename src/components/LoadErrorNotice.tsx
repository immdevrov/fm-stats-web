import { Box, Text } from "@chakra-ui/react";

export function LoadErrorNotice({ what, error }: { what: string; error: string }) {
  return (
    <Box p={4} borderRadius="md" bg="red.500" color="white">
      <Text fontWeight="medium">
        {what} could not be read ({error}). Nothing has been changed — reload the page to try again.
      </Text>
    </Box>
  );
}
