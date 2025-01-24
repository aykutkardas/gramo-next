import { diffWords, Change } from "diff";

interface DiffViewProps {
  original: string;
  improved: string;
}

export const DiffView = ({ original, improved }: DiffViewProps) => {
  const differences = diffWords(original, improved);

  return (
    <div className="font-mono text-sm whitespace-pre-wrap">
      {differences.map((part: Change, index: number) => (
        <span
          key={index}
          className={
            part.added
              ? "bg-green-500/30 text-green-800 dark:bg-green-950 dark:text-green-200 px-1.5 py-0.5 mx-0.5 rounded font-medium"
              : part.removed
              ? "bg-red-500/30 text-red-800 dark:bg-red-950 dark:text-red-200 px-1.5 py-0.5 mx-0.5 rounded font-medium line-through"
              : "text-foreground"
          }
        >
          {part.value}
        </span>
      ))}
    </div>
  );
};
