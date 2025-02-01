export interface GrammarIssue {
  type: string;
  text: string;
  explanation: string;
  position?: {
    start: number;
    end: number;
  };
}

export interface StyleSuggestion {
  aspect: string;
  current: string;
  improvement: string;
  rationale?: string;
}

export interface StructureIssue {
  location: string;
  suggestion: string;
}

export interface StyleFeedback {
  tone: string;
  readability_score: number;
  complexity: string;
  style_suggestions: StyleSuggestion[];
}

export interface ProactiveFeedback {
  type: string;
  description: string;
  suggestion: string;
  area: string;
}

export interface GoalAchievement {
  achieved: boolean;
  score: number;
  remaining_steps: string[];
}

export interface Suggestion {
  type: string;
  description: string;
  pros: string[];
  cons: string[];
  implementation: string;
}

export interface TextStats {
  word_count: number;
  sentence_count: number;
  avg_word_length: number;
  avg_sentence_length: number;
  readability_score: number;
}

export interface ToneAnalysis {
  primary_tone: string;
  tone_scores: {
    [key: string]: number;
  };
}

export interface AnalysisResult {
  error?: string;
  grammar_issues: GrammarIssue[];
  suggestions: Suggestion[];
  style_feedback: StyleFeedback;
  improved_text: string;
  proactive_feedback: ProactiveFeedback[];
  goal_achievement: GoalAchievement;
  text_stats: TextStats;
  tone_analysis: ToneAnalysis;
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

export type OutputStyle = "grammar" | "friendly" | "professional" | "concise";
