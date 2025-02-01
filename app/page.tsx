"use client";

import React from "react";
import { ArrowPathIcon } from "@heroicons/react/24/outline/index.js";
import { Github } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { OutputStyle } from "@/types/text-analysis";
import { TextAnalysisOverview } from "@/components/text-analysis/text-analysis-overview";
import { GoalAchievement } from "@/components/text-analysis/goal-achievement";
import { GrammarIssues } from "@/components/text-analysis/grammar-issues";
import { ImprovedText } from "@/components/text-analysis/improved-text";
import { useTextAnalysis } from "@/hooks/use-text-analysis";

export default function Home() {
  const {
    text,
    analysis,
    isLoading,
    copySuccess,
    outputStyle,
    focusAreas,
    textAnalysis,
    setText,
    setOutputStyle,
    setFocusAreas,
    copyText,
    analyzeText,
    isStale,
  } = useTextAnalysis();

  const styleOptions: { value: OutputStyle; label: string }[] = [
    { value: "grammar", label: "Fix Grammar" },
    { value: "friendly", label: "Make Friendly" },
    { value: "professional", label: "Make Professional" },
    { value: "concise", label: "Make Concise" },
  ];

  const availableFocusAreas = ["Grammar", "Style", "Structure"];

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto space-y-12">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-4xl font-bold tracking-tight text-foreground">
              AI Writing Assistant
            </h1>
            <a
              href="https://github.com/onurhan1337/gramo"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Github className="w-5 h-5" />
              GitHub
            </a>
          </div>
          <p className="text-muted-foreground text-lg">
            Improve your writing with AI-powered analysis
          </p>
        </div>

        <div className="space-y-6">
          <div className="space-y-4">
            <div className="relative">
              <textarea
                className="w-full h-48 p-4 rounded-lg border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 hover:border-primary/50 transition-colors duration-200"
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
                  className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 hover:border-primary/50 transition-colors duration-200"
                  disabled={isLoading}
                >
                  {styleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => analyzeText(0)}
                  disabled={isLoading || !text.trim()}
                  className={`
                    inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium
                    transition-colors disabled:pointer-events-none disabled:opacity-50
                    ${
                      isStale && analysis
                        ? "bg-amber-500 hover:bg-amber-500/90 text-amber-50"
                        : "bg-primary hover:bg-primary/90 text-primary-foreground"
                    }
                  `}
                >
                  {isLoading ? (
                    <>
                      <ArrowPathIcon className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : isStale && analysis ? (
                    <>
                      <ArrowPathIcon className="mr-2 h-4 w-4" />
                      Update Analysis
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
              className="w-full"
              value="focus-areas"
            >
              <AccordionItem value="focus-areas">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm">Focus Areas</span>
                    {focusAreas.length > 0 && (
                      <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary ring-1 ring-inset ring-primary/20">
                        {focusAreas.length}
                      </span>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1">
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
                            flex items-center justify-between px-3 py-2 rounded-md text-sm
                            transition-colors duration-200
                            ${
                              isSelected
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted hover:bg-muted/80"
                            }
                          `}
                        >
                          <span>{area}</span>
                          <div
                            className={`
                            h-4 w-4 rounded-full border-2 flex items-center justify-center
                            transition-colors duration-200
                            ${
                              isSelected
                                ? "border-primary-foreground"
                                : "border-muted-foreground/30"
                            }
                          `}
                          >
                            {isSelected && (
                              <div className="h-2 w-2 rounded-full bg-primary-foreground" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {analysis && (
            <div className="space-y-8 animate-in fade-in-50 slide-in-from-bottom-4 duration-700">
              {analysis.error && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
                  <p className="text-sm text-destructive">{analysis.error}</p>
                </div>
              )}

              <ImprovedText
                originalText={text}
                improvedText={analysis.improved_text}
                onCopy={copyText}
                copySuccess={copySuccess}
              />

              <GrammarIssues issues={analysis.grammar_issues} />

              <TextAnalysisOverview
                analysis={analysis}
                textAnalysis={textAnalysis}
              />

              <GoalAchievement goalAchievement={analysis.goal_achievement} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
