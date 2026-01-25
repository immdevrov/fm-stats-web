import { Dialog, Button, VStack, HStack, Text, Portal } from "@chakra-ui/react";

export interface ConfirmOption {
  label: string;
  value: string;
  description?: string;
}

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
  title: string;
  message: string;
  options: ConfirmOption[];
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  options,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
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
                      onClick={() => onConfirm(option.value)}
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
                <Button variant="ghost" onClick={onClose}>
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
