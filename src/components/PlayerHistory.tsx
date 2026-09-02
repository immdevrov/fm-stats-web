import { useEffect, useState } from "react";
import { Box, Heading, Spinner, Table, Text, VStack } from "@chakra-ui/react";
import { db } from "../services/db";
import { ROLE_CONFIG, STAT_LABELS } from "../roles";
import { isoToDisplay } from "../utils/import-date";
import type { PlayerHistoryEntry } from "../types/snapshot";

function statValue(entry: PlayerHistoryEntry, roleKey: string | null, statKey: string): string {
  const config = ROLE_CONFIG.find((role) => role.key === roleKey);
  if (!config || !config.RoleClass.isRole(entry.player)) return "—";
  const role = new config.RoleClass(entry.player) as unknown as Record<string, unknown>;
  const value = role[statKey];
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toFixed(2);
}

export function PlayerHistory({ uid, roleKey }: { uid: number; roleKey: string | null }) {
  const [entries, setEntries] = useState<PlayerHistoryEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    db.getPlayerHistory(uid).then((rows) => {
      if (!cancelled) setEntries(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  if (entries === null) return <Spinner size="sm" colorPalette="glaucous" />;
  if (entries.length <= 1) return null;

  const statKeys = ROLE_CONFIG.find((role) => role.key === roleKey)?.statKeys ?? [];

  return (
    <Box borderWidth="1px" borderRadius="md" p={2}>
      <VStack align="stretch" gap={2}>
        <Heading size="sm" color="fg.emphasized">
          History
        </Heading>
        <Text fontSize="sm" color="fg.muted">
          Raw per-90 figures as imported. These are not percentiles — league quality drifts
          between dates.
        </Text>

        <Box overflowX="auto">
          <Table.Root size="sm">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Date</Table.ColumnHeader>
                <Table.ColumnHeader>Club</Table.ColumnHeader>
                <Table.ColumnHeader>Age</Table.ColumnHeader>
                <Table.ColumnHeader>Starts</Table.ColumnHeader>
                <Table.ColumnHeader>Mins</Table.ColumnHeader>
                {statKeys.map((key) => (
                  <Table.ColumnHeader key={key}>{STAT_LABELS[key] ?? key}</Table.ColumnHeader>
                ))}
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {entries.map((entry) => (
                <Table.Row key={entry.snapshot.id}>
                  <Table.Cell whiteSpace="nowrap">
                    {entry.snapshot.date ? isoToDisplay(entry.snapshot.date) : "Undated"}
                  </Table.Cell>
                  <Table.Cell>{entry.player.Club}</Table.Cell>
                  <Table.Cell>{entry.player.Age}</Table.Cell>
                  <Table.Cell>{entry.player.Starts}</Table.Cell>
                  <Table.Cell>{entry.player.Mins}</Table.Cell>
                  {statKeys.map((key) => (
                    <Table.Cell key={key}>{statValue(entry, roleKey, key)}</Table.Cell>
                  ))}
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Box>
      </VStack>
    </Box>
  );
}
