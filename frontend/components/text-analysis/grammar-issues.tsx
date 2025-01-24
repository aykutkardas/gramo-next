import { GrammarIssue } from "@/types/text-analysis";

interface GrammarIssuesProps {
  issues?: GrammarIssue[];
}

export const GrammarIssues = ({ issues = [] }: GrammarIssuesProps) => {
  if (!issues || issues.length === 0) return null;

  return (
    <div className="rounded-lg border bg-card p-6">
      <h2 className="text-xl font-semibold mb-4">Grammar & Spelling Issues</h2>
      <div className="space-y-4">
        {issues.map((issue, index) => (
          <div key={index} className="rounded-lg bg-destructive/10 p-4">
            <div className="flex justify-between items-start">
              <span className="font-medium text-destructive">{issue.type}</span>
              {issue.position && (
                <span className="text-sm text-muted-foreground">
                  Position: {issue.position.start}-{issue.position.end}
                </span>
              )}
            </div>
            <div className="mt-2 space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">Original:</span>
                <span className="font-mono text-sm line-through">
                  {issue.text}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">
                  Explanation:
                </span>
                <span className="font-mono text-sm text-success">
                  {issue.explanation}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
