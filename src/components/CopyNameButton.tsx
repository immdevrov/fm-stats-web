import { useEffect, useState } from "react";
import { Box, IconButton } from "@chakra-ui/react";
import { LuCheck, LuCopy } from "react-icons/lu";
import { Tooltip } from "./ui/tooltip";
import { toaster } from "./ui/toaster";

export function CopyNameButton({ name }: { name: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <Tooltip content={copied ? "Copied" : "Copy name"}>
      <Box as="span" display="inline-flex">
        <IconButton
          size="2xs"
          variant="ghost"
          color={copied ? "glaucous.400" : "fg.muted"}
          aria-label={`Copy ${name}`}
          onClick={async (e) => {
            e.stopPropagation();
            try {
              await navigator.clipboard.writeText(name);
              setCopied(true);
            } catch {
              toaster.create({ title: "Couldn't copy name", type: "error", duration: 3000 });
            }
          }}
        >
          {copied ? <LuCheck /> : <LuCopy />}
        </IconButton>
      </Box>
    </Tooltip>
  );
}
