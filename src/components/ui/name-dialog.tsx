import { useState } from "react";
import { Button, Dialog, HStack, Input, Portal, Text, VStack } from "@chakra-ui/react";

interface NameDialogProps {
  isOpen: boolean;
  title: string;
  initialValue: string;
  validate: (name: string) => string | null;
  onSubmit: (name: string) => void;
  onClose: () => void;
}

export function NameDialog({ isOpen, ...rest }: NameDialogProps) {
  if (!isOpen) return null;
  return <OpenNameDialog {...rest} />;
}

function OpenNameDialog({ title, initialValue, validate, onSubmit, onClose }: Omit<NameDialogProps, "isOpen">) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const message = validate(value);
    if (message) {
      setError(message);
      return;
    }
    onSubmit(value.trim());
    onClose();
  };

  return (
    <Dialog.Root open onOpenChange={(e) => !e.open && onClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{title}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <VStack gap={2} align="stretch">
                <Input
                  aria-label="Name"
                  autoFocus
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value);
                    setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submit();
                  }}
                />
                {error && (
                  <Text fontSize="sm" color="fg.error">
                    {error}
                  </Text>
                )}
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <HStack gap={2}>
                <Button variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                <Button colorPalette="glaucous" onClick={submit}>
                  Save
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
