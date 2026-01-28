import { Table as ChakraTable, Box } from "@chakra-ui/react";
import { useState } from "react";
import { Tooltip } from "./tooltip";

export type SortDirection = "asc" | "desc";

export interface Column<T> {
  key: keyof T;
  header: string;
  headerTooltip?: string;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
  sortable?: boolean;
  highlighted?: boolean;
  width?: string;
}

interface TablePropsBase<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
}

interface UncontrolledTableProps<T> extends TablePropsBase<T> {
  defaultSortKey?: keyof T;
  defaultSortDirection?: SortDirection;
  sortKey?: never;
  sortDirection?: never;
  onSortChange?: never;
}

interface ControlledTableProps<T> extends TablePropsBase<T> {
  sortKey: keyof T;
  sortDirection: SortDirection;
  onSortChange: (key: keyof T, direction: SortDirection) => void;
  defaultSortKey?: never;
  defaultSortDirection?: never;
}

type TableProps<T> = UncontrolledTableProps<T> | ControlledTableProps<T>;

function isControlled<T>(
  props: TableProps<T>
): props is ControlledTableProps<T> {
  return "onSortChange" in props && props.onSortChange !== undefined;
}

export function Table<T extends Record<string, unknown>>(props: TableProps<T>) {
  const { data, columns, onRowClick } = props;

  // Internal state for uncontrolled mode
  const [internalSortKey, setInternalSortKey] = useState<keyof T | undefined>(
    isControlled(props) ? undefined : props.defaultSortKey
  );
  const [internalSortDirection, setInternalSortDirection] =
    useState<SortDirection>(
      isControlled(props) ? "desc" : (props.defaultSortDirection ?? "desc")
    );

  // Use controlled or uncontrolled values
  const sortKey = isControlled(props) ? props.sortKey : internalSortKey;
  const sortDirection = isControlled(props)
    ? props.sortDirection
    : internalSortDirection;

  const handleSort = (key: keyof T) => {
    const newDirection =
      sortKey === key ? (sortDirection === "asc" ? "desc" : "asc") : "desc";

    if (isControlled(props)) {
      props.onSortChange(key, newDirection);
    } else {
      setInternalSortKey(key);
      setInternalSortDirection(newDirection);
    }
  };

  // Only sort internally for uncontrolled mode
  const displayData = isControlled(props)
    ? data
    : [...data].sort((a, b) => {
      if (!sortKey) return 0;

      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;

      if (aVal instanceof Date && bVal instanceof Date) {
        return sortDirection === "asc"
          ? aVal.getTime() - bVal.getTime()
          : bVal.getTime() - aVal.getTime();
      }

      if (typeof aVal === "boolean" && typeof bVal === "boolean") {
        const aNum = aVal ? 1 : 0;
        const bNum = bVal ? 1 : 0;
        return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
      }

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
      <ChakraTable.Root size="sm" borderWidth="1px" borderRadius="md">
        <ChakraTable.Header>
          <ChakraTable.Row>
            {columns.map((column) => (
              <ChakraTable.ColumnHeader
                key={String(column.key)}
                cursor={column.sortable !== false ? "pointer" : "default"}
                onClick={() =>
                  column.sortable !== false && handleSort(column.key)
                }
                _hover={
                  column.sortable !== false ? { bg: "bg.muted" } : undefined
                }
                userSelect="none"
                borderRightWidth="1px"
                borderColor="border.emphasized"
                bg={column.highlighted ? "glaucous.900/10" : undefined}
                width={column.width}
                whiteSpace={column.width ? "normal" : undefined}
              >
                {column.headerTooltip ? (
                  <Tooltip content={column.headerTooltip}>
                    <span>
                      {column.header}
                      {column.sortable !== false && getSortIndicator(column.key)}
                    </span>
                  </Tooltip>
                ) : (
                  <>
                    {column.header}
                    {column.sortable !== false && getSortIndicator(column.key)}
                  </>
                )}
              </ChakraTable.ColumnHeader>
            ))}
          </ChakraTable.Row>
        </ChakraTable.Header>
        <ChakraTable.Body>
          {displayData.map((row, index) => (
            <ChakraTable.Row
              key={index}
              bg={index % 2 === 0 ? "bg.muted" : "bg"}
              cursor={onRowClick ? "pointer" : "default"}
              _hover={{ bg: "glaucous.900/20" }}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((column) => (
                <ChakraTable.Cell
                  key={String(column.key)}
                  borderRightWidth="1px"
                  borderColor="border.emphasized"
                  width={column.width}
                >
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
