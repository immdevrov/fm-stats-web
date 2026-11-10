import { useState } from "react";
import { Input, Text, VStack, type InputProps } from "@chakra-ui/react";
import { formatMoneyExact, parseMoney, toEditText } from "../utils/money";
import { formatWage } from "../utils/utils";

interface MoneyInputProps extends Omit<InputProps, "value" | "onChange" | "onFocus" | "onBlur"> {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  onBlur?: () => void;
}

export function MoneyInput({ value, onChange, onBlur, ...inputProps }: MoneyInputProps) {
  const [text, setText] = useState<string | null>(null);
  const editing = text !== null;
  const parsed = editing && text.trim() !== "" ? parseMoney(text) : undefined;

  const display = editing ? text : value === undefined ? "" : formatWage(value);

  return (
    <VStack align="stretch" gap={0.5}>
      <Input
        {...inputProps}
        value={display}
        onFocus={() => setText(value === undefined ? "" : toEditText(value))}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          if (next.trim() === "") onChange(undefined);
          else {
            const amount = parseMoney(next);
            if (amount !== null) onChange(amount);
          }
        }}
        onBlur={() => {
          setText(null);
          onBlur?.();
        }}
      />
      {editing && parsed !== undefined && (
        <Text fontSize="xs" color={parsed === null ? "spicyPaprika.500" : "fg.muted"}>
          {parsed === null ? "Not an amount" : `= ${formatMoneyExact(parsed)}`}
        </Text>
      )}
    </VStack>
  );
}
