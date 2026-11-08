import { Table as ChakraTable, Box, Text } from "@chakra-ui/react";
import { useState } from "react";
import { Tooltip } from "./tooltip";

export type SortDirection = "asc" | "desc";

export interface Column<T> {
  key: keyof T;
  id?: string;
  header: string;
  headerTooltip?: React.ReactNode;
  subheader?: string;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
  cellProps?: (row: T) => React.ComponentProps<typeof ChakraTable.Cell>;
  sortable?: boolean;
  firstSortDirection?: SortDirection;
  highlighted?: boolean;
  width?: string;
}

export type TableRowProps<T> = React.ComponentProps<typeof ChakraTable.Row> & {
  row: T;
};

interface TablePropsBase<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
  filterRow?: React.ReactNode;
  rowProps?: (row: T) => React.ComponentProps<typeof ChakraTable.Row>;
  getRowKey?: (row: T) => React.Key;
  rowComponent?: React.ComponentType<TableRowProps<T>>;
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

// eslint-disable-next-line react-refresh/only-export-components
export function sortRows<T>(
  data: T[],
  key: keyof T | undefined,
  direction: SortDirection
): T[] {
  return [...data].sort((a, b) => {
    if (!key) return 0;

    const aVal = a[key];
    const bVal = b[key];

    if (aVal === null && bVal === null) return 0;
    if (aVal === null) return 1;
    if (bVal === null) return -1;

    if (aVal instanceof Date && bVal instanceof Date) {
      return direction === "asc"
        ? aVal.getTime() - bVal.getTime()
        : bVal.getTime() - aVal.getTime();
    }

    if (typeof aVal === "boolean" && typeof bVal === "boolean") {
      const aNum = aVal ? 1 : 0;
      const bNum = bVal ? 1 : 0;
      return direction === "asc" ? aNum - bNum : bNum - aNum;
    }

    if (typeof aVal === "number" && typeof bVal === "number") {
      return direction === "asc" ? aVal - bVal : bVal - aVal;
    }

    if (typeof aVal === "string" && typeof bVal === "string") {
      return direction === "asc"
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    return 0;
  });
}

export function Table<T extends object>(props: TableProps<T>) {
  const { data, columns, onRowClick, filterRow, rowProps, getRowKey, rowComponent } =
    props;
  const RowComponent = rowComponent;

  const [internalSortKey, setInternalSortKey] = useState<keyof T | undefined>(
    isControlled(props) ? undefined : props.defaultSortKey
  );
  const [internalSortDirection, setInternalSortDirection] =
    useState<SortDirection>(
      isControlled(props) ? "desc" : (props.defaultSortDirection ?? "desc")
    );

  const sortKey = isControlled(props) ? props.sortKey : internalSortKey;
  const sortDirection = isControlled(props)
    ? props.sortDirection
    : internalSortDirection;

  const handleSort = (column: Column<T>) => {
    const key = column.key;
    const newDirection =
      sortKey === key
        ? (sortDirection === "asc" ? "desc" : "asc")
        : (column.firstSortDirection ?? "desc");

    if (isControlled(props)) {
      props.onSortChange(key, newDirection);
    } else {
      setInternalSortKey(key);
      setInternalSortDirection(newDirection);
    }
  };

  const displayData = isControlled(props)
    ? data
    : sortRows(data, sortKey, sortDirection);

  const getSortIndicator = (key: keyof T) => {
    if (sortKey !== key) return null;
    return sortDirection === "asc" ? " ▲" : " ▼";
  };

  const headerLabel = (column: Column<T>) => {
    const title = (
      <>
        {column.header}
        {column.sortable !== false && getSortIndicator(column.key)}
      </>
    );
    if (!column.subheader) return title;
    return (
      <Box>
        <Box whiteSpace="nowrap">{title}</Box>
        <Text fontSize="2xs" fontWeight="normal" color="fg.muted" whiteSpace="nowrap">
          {column.subheader}
        </Text>
      </Box>
    );
  };

  return (
    <Box overflowX="auto">
      <ChakraTable.Root size="sm" borderWidth="1px" borderRadius="md">
        <ChakraTable.Header>
          <ChakraTable.Row>
            {columns.map((column) => (
              <ChakraTable.ColumnHeader
                key={column.id ?? String(column.key)}
                cursor={column.sortable !== false ? "pointer" : "default"}
                onClick={() =>
                  column.sortable !== false && handleSort(column)
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
                    <Box display="flex" alignItems="center" w="100%" h="100%">
                      {headerLabel(column)}
                    </Box>
                  </Tooltip>
                ) : (
                  headerLabel(column)
                )}
              </ChakraTable.ColumnHeader>
            ))}
          </ChakraTable.Row>
          {filterRow}
        </ChakraTable.Header>
        <ChakraTable.Body>
          {displayData.map((row, index) => {
            const rowKey = getRowKey ? getRowKey(row) : index;
            const rowAttrs = {
              bg: index % 2 === 0 ? "bg.muted" : "bg",
              cursor: onRowClick ? "pointer" : "default",
              _hover: { bg: "glaucous.900/20" },
              onClick: () => onRowClick?.(row),
              ...rowProps?.(row),
            };
            const cells = columns.map((column) => (
              <ChakraTable.Cell
                key={column.id ?? String(column.key)}
                borderRightWidth="1px"
                borderColor="border.emphasized"
                width={column.width}
                {...column.cellProps?.(row)}
              >
                {column.render
                  ? column.render(row[column.key], row)
                  : String(row[column.key] ?? "")}
              </ChakraTable.Cell>
            ));
            return RowComponent ? (
              <RowComponent key={rowKey} row={row} {...rowAttrs}>
                {cells}
              </RowComponent>
            ) : (
              <ChakraTable.Row key={rowKey} {...rowAttrs}>
                {cells}
              </ChakraTable.Row>
            );
          })}
        </ChakraTable.Body>
      </ChakraTable.Root>
    </Box>
  );
}
