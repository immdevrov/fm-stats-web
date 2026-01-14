import { Button, Input, VStack, Text } from "@chakra-ui/react";
import { useRef } from "react";

interface FileInputProps {
  onFileSelect: (file: File) => void;
  accept?: string;
}

export function FileInput({ onFileSelect, accept }: FileInputProps) {
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
      >
        Select File
      </Button>
      <Text fontSize="sm" color="fg.muted">
        Choose a text file with player statistics
      </Text>
    </VStack>
  );
}
