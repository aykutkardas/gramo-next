import { ClipboardIcon } from "@heroicons/react/24/outline";
import { DiffView } from "./diff-view";

interface ImprovedTextProps {
  originalText: string;
  improvedText: string;
  onCopy: (text: string) => void;
  copySuccess: boolean;
}

export const ImprovedText = ({
  originalText,
  improvedText,
  onCopy,
  copySuccess,
}: ImprovedTextProps) => {
  if (!improvedText) return null;

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-xl font-semibold">Improved Text</h2>
        <button
          onClick={() => onCopy(improvedText)}
          className="inline-flex items-center justify-center rounded-md bg-orange-500 text-orange-50 px-4 py-2 text-sm font-medium hover:bg-orange-500/90"
        >
          <ClipboardIcon className="mr-2 h-4 w-4" />
          {copySuccess ? "Copied!" : "Copy"}
        </button>
      </div>
      <div className="space-y-4">
        <div className="rounded-lg bg-muted/50 p-4">
          <p className="text-sm text-muted-foreground mb-2">Original Text:</p>
          <p className="font-mono text-sm whitespace-pre-wrap">
            {originalText}
          </p>
        </div>
        <div className="rounded-lg bg-primary/5 p-4">
          <p className="text-sm text-primary mb-2">
            Improved Version (changes highlighted):
          </p>
          <DiffView original={originalText} improved={improvedText} />
        </div>
      </div>
    </div>
  );
};
