"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type KeyDialogProps = {} & Parameters<typeof Dialog>[0];

export function KeyDialog({ onOpenChange, open, ...props }: KeyDialogProps) {
  const [falKey, setFalKey] = useState("");

  const handleOnOpenChange = (isOpen: boolean) => {
    onOpenChange?.(isOpen);
  };

  const handleSave = () => {
    localStorage.setItem("falKey", falKey);
    handleOnOpenChange(false);
    setFalKey("");
  };

  return (
    <Dialog {...props} onOpenChange={handleOnOpenChange} open={open}>
      <DialogContent className="flex flex-col max-w-lg h-fit">
        <DialogHeader>
          <DialogTitle className="sr-only">Access Key</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col flex-1 gap-8">
          <h2 className="text-lg font-semibold flex flex-row gap-2">
            Save your own FAL Key
          </h2>
          <div className="flex flex-col gap-4">
            <Input
              placeholder="Your FAL Key"
              value={falKey}
              onChange={(e) => setFalKey(e.target.value)}
            />
          </div>
          <div className="flex-1 flex flex-row items-end justify-center gap-2">
            <button
              onClick={handleSave}
              className="inline-flex items-center justify-center rounded-md bg-orange-500 text-orange-50 px-4 py-2 text-sm font-medium hover:bg-orange-500/90"
            >
              Save
            </button>
          </div>
        </div>

        <DialogFooter>
          <p className="text-muted-foreground text-sm mt-4 w-full text-center">
            You can get your FAL Key from{" "}
            <a
              className="underline underline-offset-2 decoration-foreground/50 text-foreground"
              href="https://fal.ai/dashboard/keys"
            >
              here
            </a>
            .
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
