import { useState, useCallback } from "react";
import { AnalysisResult, OutputStyle } from "@/types/text-analysis";
import { WritingAgent } from "@/lib/writing-agent";

interface TextAnalysisState {
  text: string;
  analysis: AnalysisResult | null;
  isLoading: boolean;
  copySuccess: boolean;
  outputStyle: OutputStyle;
  focusAreas: string[];
  textAnalysis: {
    pros: string[];
    cons: string[];
    score: number;
  };
  isStale: boolean;
  error: string | null;
  retryCount: number;
}

export function useTextAnalysis() {
  const [state, setState] = useState<TextAnalysisState>({
    text: "",
    analysis: null,
    isLoading: false,
    copySuccess: false,
    outputStyle: "grammar",
    focusAreas: ["grammar"],
    textAnalysis: {
      pros: [],
      cons: [],
      score: 0,
    },
    isStale: false,
    error: null,
    retryCount: 0,
  });

  const getDefaultStyleFeedback = () => ({
    tone: "neutral",
    readability_score: 50,
    complexity: "moderate",
    style_suggestions: [],
  });

  const analyzeText = useCallback(
    async (retryAttempt = 0) => {
      if (!state.text.trim()) return;
      if (retryAttempt > 2) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error:
            "Failed to connect to the server after multiple attempts. Please try again later.",
          retryCount: 0,
        }));
        return;
      }

      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
        retryCount: retryAttempt,
      }));

      try {
        const writingAgent = new WritingAgent();
        const result = await writingAgent.analyzeText(
          state.text,
          state.outputStyle,
          state.focusAreas
        );

        const pros: string[] = [];
        const cons: string[] = [];
        let score = 0;

        if (result.analysis) {
          if (result.analysis.grammar?.issues) {
            const grammarScore = Math.max(
              0,
              100 - result.analysis.grammar.issues.length * 10
            );
            score += grammarScore;

            if (result.analysis.grammar.issues.length === 0) {
              pros.push("Grammar: Excellent grammar usage");
            } else if (result.analysis.grammar.issues.length <= 2) {
              pros.push(
                "Grammar: Generally good grammar with minor improvements possible"
              );
            }

            result.analysis.grammar.issues.forEach(
              (issue: { text: any; explanation: any }) => {
                cons.push(`Grammar: ${issue.text} - ${issue.explanation}`);
              }
            );
          }

          if (result.analysis.style?.suggestions) {
            const styleScore = Math.max(
              0,
              100 - result.analysis.style.suggestions.length * 10
            );
            score += styleScore;

            result.analysis.style.suggestions.forEach(
              (sugg: { rationale: string; aspect: any; improvement: any }) => {
                if (
                  sugg.rationale?.toLowerCase().includes("good") ||
                  sugg.rationale?.toLowerCase().includes("well") ||
                  sugg.rationale?.toLowerCase().includes("effective") ||
                  sugg.rationale?.toLowerCase().includes("strong") ||
                  sugg.rationale?.toLowerCase().includes("clear")
                ) {
                  pros.push(`Style: ${sugg.aspect} - ${sugg.rationale}`);
                } else {
                  cons.push(`Style: ${sugg.aspect} - ${sugg.improvement}`);
                }
              }
            );

            if (!pros.some((p) => p.startsWith("Style:"))) {
              if (styleScore > 80) {
                pros.push("Style: Writing style is clear and effective");
              } else if (styleScore > 60) {
                pros.push(
                  "Style: Writing style is generally good with room for improvement"
                );
              }
            }
          }

          if (result.analysis.structure?.flow_issues) {
            const structureScore = Math.max(
              0,
              100 - result.analysis.structure.flow_issues.length * 10
            );
            score += structureScore;

            if (result.analysis.structure.flow_issues.length === 0) {
              pros.push("Structure: Excellent text organization and flow");
            } else if (result.analysis.structure.flow_issues.length <= 2) {
              pros.push(
                "Structure: Generally good organization with minor improvements possible"
              );
            }

            result.analysis.structure.flow_issues.forEach(
              (issue: { location: any; suggestion: any }) => {
                cons.push(`Structure: ${issue.location} - ${issue.suggestion}`);
              }
            );
          }
        }

        if (result.text_stats?.readability_score > 70) {
          pros.push(
            `Readability: Text is easy to read and understand (${result.text_stats.readability_score}% readability score)`
          );
        }

        // @ts-expect-error
        setState((prev) => ({
          ...prev,
          analysis: {
            ...result,
            style_feedback: result.style_feedback || getDefaultStyleFeedback(),
          },
          textAnalysis: {
            pros,
            cons,
            score: state.text.trim() ? Math.max(60, Math.round(score / 3)) : 0,
          },
          isStale: false,
          error: null,
          retryCount: 0,
          isLoading: false,
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error:
            error instanceof Error
              ? error.message
              : "An unexpected error occurred",
          analysis: {
            error: "Failed to analyze text. Please try again.",
            grammar_issues: [],
            improved_text: state.text,
            suggestions: [],
            style_feedback: getDefaultStyleFeedback(),
            proactive_feedback: [],
            goal_achievement: {
              achieved: false,
              score: 0,
              remaining_steps: [],
            },
            text_stats: {
              word_count: 0,
              sentence_count: 0,
              avg_word_length: 0,
              avg_sentence_length: 0,
              readability_score: 0,
            },
            tone_analysis: {
              primary_tone: "neutral",
              tone_scores: {
                formal: 0,
                casual: 0,
                technical: 0,
                friendly: 0,
              },
            },
          },
        }));
      }
    },
    [state.text, state.outputStyle, state.focusAreas]
  );

  const setText = useCallback(
    (text: string) => {
      setState((prev) => {
        if (prev.text === text) return prev;
        return { ...prev, text, isStale: true };
      });
    },
    [analyzeText]
  );

  const setOutputStyle = useCallback((style: OutputStyle) => {
    setState((prev) => ({
      ...prev,
      outputStyle: style,
      isStale: prev.analysis !== null,
    }));
  }, []);

  const setFocusAreas = useCallback((areas: string[]) => {
    setState((prev) => ({
      ...prev,
      focusAreas: areas,
      isStale: prev.analysis !== null,
    }));
  }, []);

  const copyText = useCallback((textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy);
    setState((prev) => ({ ...prev, copySuccess: true }));
    const timeoutId = setTimeout(() => {
      setState((prev) => ({ ...prev, copySuccess: false }));
    }, 2000);
    return () => clearTimeout(timeoutId);
  }, []);

  return {
    ...state,
    setText,
    setOutputStyle,
    setFocusAreas,
    copyText,
    analyzeText,
  };
}
