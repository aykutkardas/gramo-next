import { Badge } from "@/components/ui/badge";
import { AnalysisResult } from "@/types/text-analysis";

interface TextAnalysisOverviewProps {
  analysis: AnalysisResult;
  textAnalysis: {
    pros: string[];
    cons: string[];
    score: number;
  };
}

export const TextAnalysisOverview = ({
  analysis,
  textAnalysis,
}: TextAnalysisOverviewProps) => {
  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex justify-between items-start mb-6">
        <h2 className="text-xl font-semibold">Text Analysis Overview</h2>
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">Overall Score:</span>
          <Badge variant="default">{textAnalysis.score}%</Badge>
        </div>
      </div>

      {/* Text Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="p-4 rounded-lg bg-card border">
          <p className="text-sm font-medium mb-1">Words</p>
          <p className="text-3xl font-bold">{analysis.text_stats.word_count}</p>
        </div>
        <div className="p-4 rounded-lg bg-card border">
          <p className="text-sm font-medium mb-1">Sentences</p>
          <p className="text-3xl font-bold">
            {analysis.text_stats.sentence_count}
          </p>
        </div>
        <div className="p-4 rounded-lg bg-card border">
          <p className="text-sm font-medium mb-1">Avg. Word Length</p>
          <p className="text-3xl font-bold">
            {analysis.text_stats.avg_word_length}
          </p>
        </div>
        <div className="p-4 rounded-lg bg-card border">
          <p className="text-sm font-medium mb-1">Readability</p>
          <p className="text-3xl font-bold">
            {analysis.text_stats.readability_score}%
          </p>
        </div>
      </div>

      {/* Tone Analysis */}
      <div className="mb-8">
        <div className="flex items-center space-x-2 mb-4">
          <h3 className="text-lg font-semibold">Writing Tone</h3>
          <Badge variant="outline" className="capitalize">
            {analysis.tone_analysis.primary_tone}
          </Badge>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {Object.entries(analysis.tone_analysis.tone_scores).map(
            ([tone, score]) => (
              <div key={tone} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium capitalize">{tone}</span>
                  <span className="text-sm font-medium">{score}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>
            )
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Strengths */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-green-600 dark:text-green-400 flex items-center gap-2">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Writing Strengths
          </h3>
          <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-4 space-y-3">
            {textAnalysis &&
            textAnalysis.pros &&
            textAnalysis.pros.length > 0 ? (
              <ul className="space-y-3">
                {textAnalysis.pros.map((pro: string, idx: number) => {
                  const [category, content] = pro.split(": ");
                  return (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="text-green-600 dark:text-green-400 font-medium min-w-[80px] text-sm">
                        {category}
                      </span>
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {content}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Enter some text and click &quot;Analyze Text&quot; to see your
                writing strengths.
              </p>
            )}
          </div>
        </div>

        {/* Areas for Improvement */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-2">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            Improvement Opportunities
          </h3>
          <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-4 space-y-3">
            {textAnalysis &&
            textAnalysis.cons &&
            textAnalysis.cons.length > 0 ? (
              <ul className="space-y-3">
                {textAnalysis.cons.map((con: string, idx: number) => {
                  const [category, content] = con.split(": ");
                  return (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="text-amber-600 dark:text-amber-400 font-medium min-w-[80px] text-sm">
                        {category}
                      </span>
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {content}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Enter some text and click &quot;Analyze Text&quot; to see
                potential improvements.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
