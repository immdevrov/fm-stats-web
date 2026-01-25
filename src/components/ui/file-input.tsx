import { Button, Input, VStack, Text } from "@chakra-ui/react";
import { useRef } from "react";

interface FileInputProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  disabled?: boolean;
}

export function FileInput({ onFileSelect, accept, disabled }: FileInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <VStack gap={4}>
      <Input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        display="none"
      />
      <Button
        onClick={handleButtonClick}
        colorPalette="glaucous"
        variant="solid"
        size="lg"
        bg="glaucous.500"
        color="softBlush.50"
        _hover={{ bg: "glaucous.600" }}
        _active={{ bg: "glaucous.700" }}
        disabled={disabled}
        cursor={disabled ? "not-allowed" : "pointer"}
        opacity={disabled ? 0.6 : 1}
      >
        Select File
      </Button>
      <Text fontSize="sm" color="fg.muted">
        Choose an HTML file with player statistics
      </Text>
    </VStack>
  );
}
