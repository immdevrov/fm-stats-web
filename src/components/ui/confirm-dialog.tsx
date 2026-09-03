import { useState } from "react";
import { Dialog, Button, VStack, HStack, Text, Portal } from "@chakra-ui/react";

export interface ConfirmOption {
  label: string;
  value: string;
  description?: string;
}

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void | Promise<void>;
  title: string;
  message: string;
  options: ConfirmOption[];
  busyLabel?: string;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  options,
  busyLabel,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState<string | null>(null);

  const handleConfirm = async (value: string) => {
    setBusy(value);
    try {
      await onConfirm(value);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && busy === null && onClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{title}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <VStack gap={4} align="stretch">
                <Text>{message}</Text>
                <VStack gap={2} align="stretch">
                  {options.map((option) => (
                    <Button
                      key={option.value}
                      variant="outline"
                      onClick={() => handleConfirm(option.value)}
                      disabled={busy !== null && busy !== option.value}
                      loading={busy === option.value}
                      loadingText={busyLabel ?? option.label}
                      justifyContent="flex-start"
                      textAlign="left"
                      h="auto"
                      py={3}
                      px={4}
                    >
                      <VStack align="start" gap={0}>
                        <Text fontWeight="medium">{option.label}</Text>
                        {option.description && (
                          <Text fontSize="sm" color="fg.muted">
                            {option.description}
                          </Text>
                        )}
                      </VStack>
                    </Button>
                  ))}
                </VStack>
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <HStack gap={2}>
                <Button variant="ghost" onClick={onClose} disabled={busy !== null}>
                  Cancel
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
