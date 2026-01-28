import { Box, HStack } from "@chakra-ui/react";
import { Outlet } from "react-router-dom";
import { Navigation } from "./Navigation";
import { Toaster } from "./ui/toaster";
import { CompareProvider } from "../contexts/CompareContext";

export function Layout() {
  return (
    <CompareProvider>
      <Box minH="100vh" bg="bg.canvas" color="fg.default">
        <HStack align="stretch" gap={0} h="100vh">
          <Box
            w="12%"
            minW="140px"
            bg="bg.subtle"
            borderRightWidth="1px"
            borderColor="border.emphasized"
            overflowY="auto"
          >
            <Navigation />
          </Box>

          <Box flex={1} overflowY="auto">
            <Outlet />
          </Box>
        </HStack>
        <Toaster />
      </Box>
    </CompareProvider>
  );
}
