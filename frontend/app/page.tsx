"use client";

import React, { useState } from "react";
import axios from "axios";
import { ArrowPathIcon, ClipboardIcon } from "@heroicons/react/24/outline";

interface GrammarIssue {
  type: string;
  position: {
    start: number;
    end: number;
  };
  original: string;
  suggestion: string;
  explanation: string;
}

interface StyleFeedback {
  tone: string;
  readability_score: number;
  complexity: string;
  sharpness: string;
  fluency: string;
  intonation: string;
  style_suggestions: string[];
}

interface AnalysisResult {
  grammar_issues: GrammarIssue[];
  suggestions: string[];
  style_feedback: StyleFeedback;
  corrected_text: string;
  error?: string;
}

type OutputStyle = "grammar" | "friendly" | "professional" | "concise";

export default function Home() {
  const [text, setText] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [outputStyle, setOutputStyle] = useState<OutputStyle>("grammar");

  const styleOptions: { value: OutputStyle; label: string }[] = [
    { value: "grammar", label: "Fix Grammar" },
    { value: "friendly", label: "Make Friendly" },
    { value: "professional", label: "Make Professional" },
    { value: "concise", label: "Make Concise" },
  ];

  const analyzeText = async () => {
    if (!text.trim()) return;

    setIsLoading(true);
    try {
      const response = await axios.post("http://localhost:8000/analyze", {
        text,
        style: outputStyle,
      });
      setAnalysis(response.data);
    } catch (error) {
      console.error("Error analyzing text:", error);
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
            Grammar Assistant
          </h1>
          <p className="text-muted-foreground">
            Improve your writing with AI-powered grammar and style analysis
          </p>
        </div>

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
                onChange={(e) => setOutputStyle(e.target.value as OutputStyle)}
                className="h-10 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
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
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
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

          {analysis && (
            <div className="space-y-8 animate-in fade-in-50">
              {/* Corrected Text */}
              {analysis.corrected_text && analysis.corrected_text !== text && (
                <div className="rounded-lg border bg-card p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h2 className="text-xl font-semibold">Corrected Text</h2>
                    <button
                      onClick={() => copyText(analysis.corrected_text)}
                      className="inline-flex items-center justify-center rounded-md bg-orange-500 text-orange-50 px-4 py-2 text-sm font-medium hover:bg-orange-500/90"
                    >
                      <ClipboardIcon className="mr-2 h-4 w-4" />
                      {copySuccess ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <p className="font-mono text-sm whitespace-pre-wrap">
                    {analysis.corrected_text}
                  </p>
                </div>
              )}

              {/* Style Feedback */}
              <div className="rounded-lg border bg-card p-6">
                <h2 className="text-xl font-semibold mb-4">Style Analysis</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Tone</p>
                    <p className="font-medium">
                      {analysis.style_feedback.tone}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Readability</p>
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 h-2 rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{
                            width: `${analysis.style_feedback.readability_score}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium">
                        {analysis.style_feedback.readability_score}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Complexity</p>
                    <p className="font-medium">
                      {analysis.style_feedback.complexity}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Sharpness</p>
                    <p className="font-medium">
                      {analysis.style_feedback.sharpness}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Fluency</p>
                    <p className="font-medium">
                      {analysis.style_feedback.fluency}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Intonation</p>
                    <p className="font-medium">
                      {analysis.style_feedback.intonation}
                    </p>
                  </div>
                </div>
              </div>

              {/* Grammar Issues */}
              {analysis.grammar_issues.length > 0 && (
                <div className="rounded-lg border bg-card p-6">
                  <h2 className="text-xl font-semibold mb-4">
                    Grammar & Spelling Issues
                  </h2>
                  <div className="space-y-4">
                    {analysis.grammar_issues.map((issue, index) => (
                      <div
                        key={index}
                        className="rounded-lg bg-destructive/10 p-4 text-destructive dark:text-destructive-foreground"
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-medium">{issue.type}</span>
                          <span className="text-sm opacity-70">
                            Position: {issue.position.start}-
                            {issue.position.end}
                          </span>
                        </div>
                        <p className="mt-2 font-mono text-sm">
                          <span className="line-through">{issue.original}</span>
                          {" → "}
                          <span className="text-success">
                            {issue.suggestion}
                          </span>
                        </p>
                        <p className="mt-1 text-sm opacity-70">
                          {issue.explanation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Style Suggestions */}
              {analysis.style_feedback.style_suggestions.length > 0 && (
                <div className="rounded-lg border bg-card p-6">
                  <h2 className="text-xl font-semibold mb-4">
                    Style Suggestions
                  </h2>
                  <ul className="space-y-2">
                    {analysis.style_feedback.style_suggestions.map(
                      (suggestion, index) => (
                        <li
                          key={index}
                          className="flex items-start space-x-2 text-muted-foreground"
                        >
                          <span className="select-none">•</span>
                          <span>{suggestion}</span>
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}

              {/* General Writing Suggestions */}
              {analysis.suggestions.length > 0 && (
                <div className="rounded-lg border bg-card p-6">
                  <h2 className="text-xl font-semibold mb-4">
                    Writing Suggestions
                  </h2>
                  <ul className="space-y-2">
                    {analysis.suggestions.map((suggestion, index) => (
                      <li
                        key={index}
                        className="flex items-start space-x-2 text-muted-foreground"
                      >
                        <span className="select-none">•</span>
                        <span>{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Error Display */}
              {analysis.error && (
                <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
                  <h3 className="font-semibold text-destructive">Error</h3>
                  <p className="mt-1 text-destructive">{analysis.error}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
