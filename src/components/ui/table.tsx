import { Table as ChakraTable, Box } from "@chakra-ui/react";
import { useState } from "react";

export type SortDirection = "asc" | "desc";

export interface Column<T> {
  key: keyof T;
  header: string;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
  sortable?: boolean;
}

interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  defaultSortKey?: keyof T;
  defaultSortDirection?: SortDirection;
}

export function Table<T extends Record<string, unknown>>({
  data,
  columns,
  defaultSortKey,
  defaultSortDirection = "desc",
}: TableProps<T>) {
  const [sortKey, setSortKey] = useState<keyof T | undefined>(defaultSortKey);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultSortDirection);

  const handleSort = (key: keyof T) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDirection("desc");
    }
  };

  const sortedData = [...data].sort((a, b) => {
    if (!sortKey) return 0;

    const aVal = a[sortKey];
    const bVal = b[sortKey];

    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
    }

    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortDirection === "asc"
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    return 0;
  });

  const getSortIndicator = (key: keyof T) => {
    if (sortKey !== key) return null;
    return sortDirection === "asc" ? " ▲" : " ▼";
  };

  return (
    <Box overflowX="auto">
      <ChakraTable.Root size="sm">
        <ChakraTable.Header>
          <ChakraTable.Row>
            {columns.map((column) => (
              <ChakraTable.ColumnHeader
                key={String(column.key)}
                cursor={column.sortable !== false ? "pointer" : "default"}
                onClick={() => column.sortable !== false && handleSort(column.key)}
                _hover={column.sortable !== false ? { bg: "bg.muted" } : undefined}
                userSelect="none"
              >
                {column.header}
                {column.sortable !== false && getSortIndicator(column.key)}
              </ChakraTable.ColumnHeader>
            ))}
          </ChakraTable.Row>
        </ChakraTable.Header>
        <ChakraTable.Body>
          {sortedData.map((row, index) => (
            <ChakraTable.Row key={index}>
              {columns.map((column) => (
                <ChakraTable.Cell key={String(column.key)}>
                  {column.render
                    ? column.render(row[column.key], row)
                    : String(row[column.key] ?? "")}
                </ChakraTable.Cell>
              ))}
            </ChakraTable.Row>
          ))}
        </ChakraTable.Body>
      </ChakraTable.Root>
    </Box>
  );
}
