"use client";

import React, { useState } from "react";
import axios from "axios";
import { ArrowPathIcon, ClipboardIcon } from "@heroicons/react/24/outline";
import { Badge } from "@/components/ui/badge";
import { diffWords, Change } from "diff";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface GrammarIssue {
  type: string;
  text: string;
  explanation: string;
  position?: {
    start: number;
    end: number;
  };
}

interface StyleSuggestion {
  aspect: string;
  current: string;
  improvement: string;
  rationale?: string;
}

interface StructureIssue {
  location: string;
  suggestion: string;
}

interface StyleFeedback {
  tone: string;
  readability_score: number;
  complexity: string;
  style_suggestions: StyleSuggestion[];
}

interface ProactiveFeedback {
  type: string;
  description: string;
  suggestion: string;
  area: string;
}

interface GoalAchievement {
  achieved: boolean;
  score: number;
  remaining_steps: string[];
}

interface Suggestion {
  type: string;
  description: string;
  pros: string[];
  cons: string[];
  implementation: string;
}

interface TextStats {
  word_count: number;
  sentence_count: number;
  avg_word_length: number;
  avg_sentence_length: number;
  readability_score: number;
}

interface ToneAnalysis {
  primary_tone: string;
  tone_scores: {
    [key: string]: number;
  };
}

interface AnalysisResult {
  error?: string;
  grammar_issues: GrammarIssue[];
  suggestions: Suggestion[];
  style_feedback: StyleFeedback;
  improved_text: string;
  proactive_feedback: ProactiveFeedback[];
  goal_achievement: GoalAchievement;
  text_stats: TextStats;
  tone_analysis: ToneAnalysis;
}

interface AnalysisResponse extends AnalysisResult {
  analysis?: {
    grammar?: {
      confidence_score: number;
      issues: GrammarIssue[];
    };
    style?: {
      style_score: number;
      suggestions: StyleSuggestion[];
    };
    structure?: {
      structure_score: number;
      flow_issues: StructureIssue[];
    };
  };
}

type OutputStyle = "grammar" | "friendly" | "professional" | "concise";

const DiffView = ({
  original,
  improved,
}: {
  original: string;
  improved: string;
}) => {
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

export default function Home() {
  const [text, setText] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [outputStyle, setOutputStyle] = useState<OutputStyle>("professional");
  const [focusAreas, setFocusAreas] = useState<string[]>([
    "grammar",
    "style",
    "structure",
  ]);

  const styleOptions: { value: OutputStyle; label: string }[] = [
    { value: "grammar", label: "Fix Grammar" },
    { value: "friendly", label: "Make Friendly" },
    { value: "professional", label: "Make Professional" },
    { value: "concise", label: "Make Concise" },
  ];

  const availableFocusAreas = ["Grammar", "Style", "Structure"];

  const getDefaultStyleFeedback = (): StyleFeedback => ({
    tone: "neutral",
    readability_score: 50,
    complexity: "moderate",
    style_suggestions: [],
  });

  const [textAnalysis, setTextAnalysis] = useState<{
    pros: string[];
    cons: string[];
    score: number;
  }>({
    pros: [],
    cons: [],
    score: 0,
  });

  const analyzeText = async () => {
    if (!text.trim()) return;

    setIsLoading(true);
    try {
      const response = await axios.post<AnalysisResponse>(
        "http://localhost:8000/analyze",
        {
          text,
          style: outputStyle,
          focus_areas: focusAreas,
        }
      );

      if (response.data.error) {
        console.error("Analysis error:", response.data.error);
      }

      // Extract pros and cons from the analysis
      const pros: string[] = [];
      const cons: string[] = [];
      let score = 0;

      if (response.data.analysis) {
        if (response.data.analysis.grammar?.issues) {
          // Start with a high score and deduct for issues
          const grammarScore = Math.max(
            0,
            100 - response.data.analysis.grammar.issues.length * 10
          );
          score += grammarScore;

          // Add positive feedback for good grammar if few issues
          if (response.data.analysis.grammar.issues.length === 0) {
            pros.push("Grammar: Excellent grammar usage");
          } else if (response.data.analysis.grammar.issues.length <= 2) {
            pros.push(
              "Grammar: Generally good grammar with minor improvements possible"
            );
          }

          response.data.analysis.grammar.issues.forEach(
            (issue: GrammarIssue) => {
              cons.push(`Grammar: ${issue.text} - ${issue.explanation}`);
            }
          );
        }
        if (response.data.analysis.style?.suggestions) {
          // Start with a high score and deduct for suggestions
          const styleScore = Math.max(
            0,
            100 - response.data.analysis.style.suggestions.length * 10
          );
          score += styleScore;

          response.data.analysis.style.suggestions.forEach(
            (sugg: StyleSuggestion) => {
              // More lenient condition for pros
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

          // Add default style strength if none found
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
          // Start with a high score and deduct for flow issues
          const structureScore = Math.max(
            0,
            100 - response.data.analysis.structure.flow_issues.length * 10
          );
          score += structureScore;

          // Add positive feedback for good structure if few issues
          if (response.data.analysis.structure.flow_issues.length === 0) {
            pros.push("Structure: Excellent text organization and flow");
          } else if (response.data.analysis.structure.flow_issues.length <= 2) {
            pros.push(
              "Structure: Generally good organization with minor improvements possible"
            );
          }

          response.data.analysis.structure.flow_issues.forEach(
            (issue: StructureIssue) => {
              cons.push(`Structure: ${issue.location} - ${issue.suggestion}`);
            }
          );
        }
      }

      // Add readability strength if score is good
      if (response.data.text_stats?.readability_score > 70) {
        pros.push(
          `Readability: Text is easy to read and understand (${response.data.text_stats.readability_score}% readability score)`
        );
      }

      setTextAnalysis({
        pros,
        cons,
        // Calculate weighted average with a minimum baseline of 60 if there's any content
        score: text.trim() ? Math.max(60, Math.round(score / 3)) : 0,
      });

      setAnalysis({
        ...response.data,
        style_feedback:
          response.data.style_feedback || getDefaultStyleFeedback(),
      });
    } catch (error) {
      console.error("Error analyzing text:", error);
      setAnalysis({
        error: "Failed to analyze text. Please try again.",
        grammar_issues: [],
        improved_text: text,
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
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyText = (textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">
            AI Writing Assistant
          </h1>
          <p className="text-muted-foreground">
            Improve your writing with AI-powered grammar, style analysis, and
            intelligent suggestions
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-4">
            <div className="relative">
              <textarea
                className="w-full h-48 p-4 rounded-lg border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter your text here..."
                disabled={isLoading}
              />
              <div className="absolute bottom-4 right-4 flex items-center space-x-2">
                <select
                  value={outputStyle}
                  onChange={(e) =>
                    setOutputStyle(e.target.value as OutputStyle)
                  }
                  className="w-48 h-10 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={isLoading}
                >
                  {styleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={analyzeText}
                  disabled={isLoading || !text.trim()}
                  className="h-10 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <ArrowPathIcon className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    "Analyze Text"
                  )}
                </button>
              </div>
            </div>

            <Accordion
              type="single"
              collapsible
              className="w-full border border-muted-foreground/20 px-1 rounded-lg"
            >
              <AccordionItem value="focus-areas" className="border-none">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center space-x-3 px-4 py-2 rounded-lg w-full">
                    <span className="text-sm font-medium">Focus Areas</span>
                    <span className="text-sm text-muted-foreground">
                      {focusAreas.length} selected
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pt-4 pb-2">
                    <div className="flex flex-wrap gap-3">
                      {availableFocusAreas.map((area) => {
                        const areaLower = area.toLowerCase();
                        const isSelected = focusAreas.includes(areaLower);
                        return (
                          <button
                            key={area}
                            onClick={() => {
                              if (isSelected) {
                                setFocusAreas(
                                  focusAreas.filter((a) => a !== areaLower)
                                );
                              } else {
                                setFocusAreas([...focusAreas, areaLower]);
                              }
                            }}
                            className={`
                              relative flex items-center gap-2 px-4 py-2 rounded-lg
                              transition-all duration-200 
                              ${
                                isSelected
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted hover:bg-muted/80"
                              }
                            `}
                          >
                            <span className="font-medium text-sm">{area}</span>
                            <div
                              className={`
                              ml-1 size-4 rounded-full border-2 flex items-center justify-center
                              transition-colors duration-200
                              ${
                                isSelected
                                  ? "border-primary-foreground bg-primary-foreground/20"
                                  : "border-muted-foreground/30 group-hover:border-muted-foreground/50"
                              }
                            `}
                            >
                              {isSelected && (
                                <svg
                                  className="size-2.5"
                                  viewBox="0 0 10 10"
                                  fill="currentColor"
                                >
                                  <path
                                    d="M8.5 2.5L3.5 7.5L1.5 5.5"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    fill="none"
                                  />
                                </svg>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-sm text-muted-foreground mt-4">
                      Choose which aspects of your text you want to analyze and
                      improve
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {analysis && (
            <div className="space-y-8 animate-in fade-in-50">
              {analysis.error && (
                <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
                  <p className="text-sm text-destructive">{analysis.error}</p>
                </div>
              )}

              {/* Improved Text */}
              {analysis.improved_text && (
                <div className="rounded-lg border bg-card p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h2 className="text-xl font-semibold">Improved Text</h2>
                    <button
                      onClick={() => copyText(analysis.improved_text)}
                      className="inline-flex items-center justify-center rounded-md bg-orange-500 text-orange-50 px-4 py-2 text-sm font-medium hover:bg-orange-500/90"
                    >
                      <ClipboardIcon className="mr-2 h-4 w-4" />
                      {copySuccess ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div className="rounded-lg bg-muted/50 p-4">
                      <p className="text-sm text-muted-foreground mb-2">
                        Original Text:
                      </p>
                      <p className="font-mono text-sm whitespace-pre-wrap">
                        {text}
                      </p>
                    </div>
                    <div className="rounded-lg bg-primary/5 p-4">
                      <p className="text-sm text-primary mb-2">
                        Improved Version (changes highlighted):
                      </p>
                      <DiffView
                        original={text}
                        improved={analysis.improved_text || text}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Grammar Issues */}
              {analysis.grammar_issues &&
                analysis.grammar_issues.length > 0 && (
                  <div className="rounded-lg border bg-card p-6">
                    <h2 className="text-xl font-semibold mb-4">
                      Grammar & Spelling Issues
                    </h2>
                    <div className="space-y-4">
                      {analysis.grammar_issues.map((issue, index) => (
                        <div
                          key={index}
                          className="rounded-lg bg-destructive/10 p-4"
                        >
                          <div className="flex justify-between items-start">
                            <span className="font-medium text-destructive">
                              {issue.type}
                            </span>
                            {issue.position && (
                              <span className="text-sm text-muted-foreground">
                                Position: {issue.position.start}-
                                {issue.position.end}
                              </span>
                            )}
                          </div>
                          <div className="mt-2 space-y-2">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-muted-foreground">
                                Original:
                              </span>
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
                )}

              {/* Text Analysis Overview */}
              <div className="rounded-lg border bg-card p-6">
                <div className="flex justify-between items-start mb-6">
                  <h2 className="text-xl font-semibold">
                    Text Analysis Overview
                  </h2>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">Overall Score:</span>
                    <Badge variant="default">{textAnalysis.score}%</Badge>
                  </div>
                </div>

                {/* Text Statistics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <div className="p-4 rounded-lg bg-card border">
                    <p className="text-sm font-medium mb-1">Words</p>
                    <p className="text-3xl font-bold">
                      {analysis.text_stats.word_count}
                    </p>
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
                            <span className="text-sm font-medium capitalize">
                              {tone}
                            </span>
                            <span className="text-sm font-medium">
                              {score}%
                            </span>
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
                          Enter some text and click &quot;Analyze Text&quot; to
                          see your writing strengths.
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
                          Enter some text and click &quot;Analyze Text&quot; to
                          see potential improvements.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Goal Achievement */}
              {analysis.goal_achievement && (
                <div className="rounded-lg border bg-card p-6">
                  <h2 className="text-xl font-semibold mb-4">Progress</h2>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-4">
                      <div className="flex-1">
                        <div className="flex justify-between mb-2">
                          <span className="text-sm font-medium">Score</span>
                          <span className="text-sm font-medium">
                            {analysis.goal_achievement.score}%
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-500"
                            style={{
                              width: `${analysis.goal_achievement.score}%`,
                            }}
                          />
                        </div>
                      </div>
                      <Badge
                        variant={
                          analysis.goal_achievement.achieved
                            ? "default"
                            : "secondary"
                        }
                      >
                        {analysis.goal_achievement.achieved
                          ? "Achieved"
                          : "In Progress"}
                      </Badge>
                    </div>
                    {analysis.goal_achievement.remaining_steps.length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-2">Remaining Steps</h3>
                        <ul className="space-y-2">
                          {analysis.goal_achievement.remaining_steps.map(
                            (step: string, index: number) => (
                              <li
                                key={index}
                                className="flex items-start space-x-2 text-muted-foreground"
                              >
                                <span className="select-none">•</span>
                                <span className="text-sm">{step}</span>
                              </li>
                            )
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
