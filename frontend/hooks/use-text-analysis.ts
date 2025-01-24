import { useState, useCallback } from "react";
import axios, { AxiosError } from "axios";
import { AnalysisResult, OutputStyle } from "@/types/text-analysis";
import { config } from "@/lib/config";

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
    outputStyle: "professional",
    focusAreas: ["grammar", "style", "structure"],
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
        const response = await axios.post<AnalysisResult>(
          `${config.apiUrl}/api/v1/text/analyze`,
          {
            text: state.text,
            style: state.outputStyle,
            focus_areas: state.focusAreas,
          },
          {
            timeout: 10000,
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (response.data.error) {
          throw new Error(response.data.error);
        }

        const pros: string[] = [];
        const cons: string[] = [];
        let score = 0;

        if (response.data.analysis) {
          if (response.data.analysis.grammar?.issues) {
            const grammarScore = Math.max(
              0,
              100 - response.data.analysis.grammar.issues.length * 10
            );
            score += grammarScore;

            if (response.data.analysis.grammar.issues.length === 0) {
              pros.push("Grammar: Excellent grammar usage");
            } else if (response.data.analysis.grammar.issues.length <= 2) {
              pros.push(
                "Grammar: Generally good grammar with minor improvements possible"
              );
            }

            response.data.analysis.grammar.issues.forEach((issue) => {
              cons.push(`Grammar: ${issue.text} - ${issue.explanation}`);
            });
          }

          if (response.data.analysis.style?.suggestions) {
            const styleScore = Math.max(
              0,
              100 - response.data.analysis.style.suggestions.length * 10
            );
            score += styleScore;

            response.data.analysis.style.suggestions.forEach((sugg) => {
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
            });

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

          if (response.data.analysis.structure?.flow_issues) {
            const structureScore = Math.max(
              0,
              100 - response.data.analysis.structure.flow_issues.length * 10
            );
            score += structureScore;

            if (response.data.analysis.structure.flow_issues.length === 0) {
              pros.push("Structure: Excellent text organization and flow");
            } else if (
              response.data.analysis.structure.flow_issues.length <= 2
            ) {
              pros.push(
                "Structure: Generally good organization with minor improvements possible"
              );
            }

            response.data.analysis.structure.flow_issues.forEach((issue) => {
              cons.push(`Structure: ${issue.location} - ${issue.suggestion}`);
            });
          }
        }

        if (response.data.text_stats?.readability_score > 70) {
          pros.push(
            `Readability: Text is easy to read and understand (${response.data.text_stats.readability_score}% readability score)`
          );
        }

        setState((prev) => ({
          ...prev,
          analysis: {
            ...response.data,
            style_feedback:
              response.data.style_feedback || getDefaultStyleFeedback(),
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
        if (
          error instanceof AxiosError &&
          (error.code === "ECONNABORTED" || error.code === "ERR_NETWORK")
        ) {
          setTimeout(() => {
            analyzeText(retryAttempt + 1);
          }, Math.min(1000 * Math.pow(2, retryAttempt), 8000));
          return;
        }

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
      let timeoutId: NodeJS.Timeout;
      setState((prev) => {
        if (prev.text === text) return prev;
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(analyzeText, 1000);
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
