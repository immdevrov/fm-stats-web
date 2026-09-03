import { Box, Container, Text } from "@chakra-ui/react";

export function RosterErrorNotice({ error }: { error: string }) {
  return (
    <Box minH="100vh" p={8}>
      <Container maxW="container.xl">
        <Box p={4} borderRadius="md" bg="red.500" color="white">
          <Text fontWeight="medium">
            Your imported data could not be read ({error}). Nothing has been lost — go to Import
            and load the file again to get back in.
          </Text>
        </Box>
      </Container>
    </Box>
  );
}
