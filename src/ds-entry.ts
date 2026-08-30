export { Provider } from "./components/ui/provider";
export {
  ColorModeProvider,
  ColorModeButton,
  ColorModeIcon,
  LightMode,
  DarkMode,
  useColorMode,
  useColorModeValue,
} from "./components/ui/color-mode";
export type { ColorMode, ColorModeProviderProps } from "./components/ui/color-mode";

export { Table } from "./components/ui/table";
export type { Column, SortDirection } from "./components/ui/table";
export { Tooltip } from "./components/ui/tooltip";
export type { TooltipProps } from "./components/ui/tooltip";
export { ConfirmDialog } from "./components/ui/confirm-dialog";
export type { ConfirmOption } from "./components/ui/confirm-dialog";
export { FileInput } from "./components/ui/file-input";
export { Toaster, toaster } from "./components/ui/toaster";

export { PercentileBar } from "./components/PercentileBar";
export { SearchableSelect } from "./components/SearchableSelect";
export { PlayerAutocomplete } from "./components/PlayerAutocomplete";
export { Navigation } from "./components/Navigation";
export { Layout } from "./components/Layout";

export { customSystem } from "./theme";
export { MemoryRouter, Routes, Route, Link, NavLink, Outlet } from "react-router-dom";

/* Chakra primitives — layout glue for screens built with this DS. */
export {
  Box,
  Flex,
  Stack,
  HStack,
  VStack,
  Grid,
  GridItem,
  SimpleGrid,
  Container,
  Center,
  Spacer,
  Separator,
  Heading,
  Text,
  Badge,
  Button,
  IconButton,
  Input,
  Textarea,
  Checkbox,
  Spinner,
  Card,
  Tabs,
  Progress,
  Alert,
  Portal,
} from "@chakra-ui/react";

/* Views — the app's existing screens, so designs can start from a real panel. */
export { db } from "./services/db";
export { CompareProvider } from "./contexts/CompareContext";
export { PlayerNotesProvider } from "./contexts/PlayerNotesContext";
export { ImportView } from "./views/ImportView";
export { LeaguesView } from "./views/LeaguesView";
export { TeamsView } from "./views/TeamsView";
export { TeamProfileView } from "./views/TeamProfileView";
export { PlayersView } from "./views/PlayersView";
export { PlayerProfileView } from "./views/PlayerProfileView";
export { ScoutingView } from "./views/ScoutingView";
export { CompareView } from "./views/CompareView";
export { ListsView } from "./views/ListsView";
