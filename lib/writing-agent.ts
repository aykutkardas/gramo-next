import { fal } from "@fal-ai/client";

fal.config({
  proxyUrl: "/api/proxy",
});

interface Agent {
  role: string;
  content: string;
}

interface AnalysisResult {
  style_feedback: {
    tone: string;
    readability_score: number;
    complexity: string;
    style_suggestions: never[];
  };
  original_text: string;
  improved_text: string;
  text_stats: any;
  tone_analysis: any;
  analysis: {
    grammar: any;
    style: any;
    structure: any;
  };
  improvements: string[];
}

export function cleanJsonString(s: string): string {
  try {
    s = s.replace(/```(?:json)?/g, "").replace(/```/g, "");

    // Remove any leading/trailing whitespace
    s = s.trim();

    // Fix invalid escape sequences
    s = s.replace(/\\([^"\/bfnrtu\\])/g, "$1");

    // Handle proper escape characters
    const escapes: { [key: string]: string } = {
      '\\"': '"', // Unescape quotes
      "\\n": "\n", // Convert \n to newline
      "\\t": "\t", // Convert \t to tab
      "\\\\": "\\", // Handle escaped backslashes
      "\\/": "/", // Handle escaped forward slashes
      "\\b": "\b", // Handle backspace
      "\\f": "\f", // Handle form feed
      "\\r": "\r", // Handle carriage return
    };
    for (const [escapeFrom, escapeTo] of Object.entries(escapes)) {
      s = s.replace(new RegExp(escapeFrom, "g"), escapeTo);
    }

    // Remove any BOM or special characters
    s = Buffer.from(s, "utf-8").toString("utf-8");

    return s;
  } catch (e) {
    if (e instanceof Error) {
      console.error(`Error cleaning JSON string: ${e.message}`);
    } else {
      console.error("Error cleaning JSON string: Unknown error");
    }
    return s;
  }
}

export function calculateTextStats(text: string): Record<string, number> {
  const words = text.toLowerCase().match(/\b\w+\b/g) || [];
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s);

  const avgWordLength = words.length
    ? words.reduce((sum, word) => sum + word.length, 0) / words.length
    : 0;
  const avgSentenceLength = sentences.length
    ? words.length / sentences.length
    : 0;

  const wordComplexity = words.length
    ? words.filter((word) => word.length > 6).length / words.length
    : 0;
  const sentenceComplexity = sentences.length
    ? sentences.filter((s) => s.split(" ").length > 15).length /
      sentences.length
    : 0;

  let readabilityScore =
    100 -
    (0.2 * avgSentenceLength +
      5.0 * avgWordLength +
      8.0 * wordComplexity +
      6.0 * sentenceComplexity);
  readabilityScore = Math.max(0, Math.min(100, readabilityScore));

  return {
    word_count: words.length,
    sentence_count: sentences.length,
    avg_word_length: parseFloat(avgWordLength.toFixed(1)),
    avg_sentence_length: parseFloat(avgSentenceLength.toFixed(1)),
    readability_score: parseFloat(readabilityScore.toFixed(1)),
  };
}

export function analyzeWritingTone(text: string): Record<string, any> {
  text = text.toLowerCase();

  const tonePatterns: Record<string, RegExp[]> = {
    formal: [
      /\b(therefore|furthermore|consequently|thus|hence|accordingly)\b/g,
      /\b(moreover|nevertheless|however|despite|although|whereas)\b/g,
      /\b(demonstrate|indicate|suggest|conclude|analyze|determine)\b/g,
    ],
    casual: [
      /\b(like|just|pretty|kind of|sort of|you know)\b/g,
      /\b(anyway|basically|actually|literally|stuff|things)\b/g,
      /\b(cool|awesome|nice|great|okay|ok)\b/g,
      /!{2,}|\?{2,}/g,
    ],
    technical: [
      /\b(specifically|particularly|significantly|methodology|implementation)\b/g,
      /\b(system|process|function|data|analysis|result)\b/g,
      /\b(configure|implement|integrate|optimize|validate)\b/g,
    ],
    friendly: [
      /\b(thanks|please|appreciate|welcome|glad|happy)\b/g,
      /\b(love|enjoy|feel|think|believe|hope)\b/g,
      /\b(we|our|us|together|share|help)\b/g,
      /(?:^|\s)(?::\)|:\(|;\)|\(:)(?:\s|$)/g,
    ],
  };

  const toneScores: Record<string, number> = {};
  let totalWeight = 0;

  for (const [tone, patterns] of Object.entries(tonePatterns)) {
    let score = 0;
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      score += matches ? matches.length : 0;
    }

    if (tone === "formal") {
      score *= 1.2;
    } else if (tone === "technical") {
      score *= 1.1;
    }

    toneScores[tone] = score;
    totalWeight += score;
  }

  const baseline = 0.1;
  for (const tone in toneScores) {
    if (totalWeight > 0) {
      toneScores[tone] = Math.round(
        (toneScores[tone] / totalWeight) * 80 + baseline * 20
      );
    } else {
      toneScores[tone] = 25;
    }
  }

  let primaryTone = Object.keys(toneScores).reduce((a, b) =>
    toneScores[a] > toneScores[b] ? a : b
  );
  if (Math.max(...Object.values(toneScores)) < 30) {
    primaryTone = "balanced";
  }

  return {
    primary_tone: primaryTone,
    tone_scores: toneScores,
  };
}

export class WritingAgent {
  private grammarAgent: Agent;
  private styleAgent: Agent;
  private editorAgent: Agent;

  constructor() {
    this.grammarAgent = {
      role: "system",
      content: `You are a Grammar Analysis Agent specialized in identifying and correcting text issues.

TASK:
Analyze the text and provide detailed feedback on grammar, spelling, and punctuation.

OUTPUT FORMAT:
Return a JSON object with this structure:
{
  "analysis": {
    "issues": [
      {
        "type": "grammar/spelling/punctuation",
        "text": "problematic text",
        "correction": "suggested correction",
        "explanation": "why this needs correction"
      }
    ],
    "improved_text": "complete corrected version of the text",
    "confidence_score": 0-100
  }
}`,
    };

    this.styleAgent = {
      role: "system",
      content: `You are a Style Analysis Agent focused on improving writing clarity and impact.

TASK:
Analyze the text's style, tone, and readability.

OUTPUT FORMAT:
Return a JSON object with this structure:
{
  "analysis": {
    "style_score": 0-100,
    "tone": "formal/informal/technical/casual",
    "suggestions": [
      {
        "aspect": "clarity/conciseness/tone/etc",
        "current": "current problematic text",
        "improvement": "suggested improvement",
        "rationale": "why this improvement helps"
      }
    ],
    "improved_text": "complete improved version"
  }
}`,
    };

    this.editorAgent = {
      role: "system",
      content: `You are an Editor Agent specializing in text structure and organization.

TASK:
Analyze the text's structure, flow, and organization.

OUTPUT FORMAT:
Return a JSON object with this structure:
{
  "analysis": {
    "structure_score": 0-100,
    "flow_issues": [
      {
        "type": "transition/paragraph/organization",
        "location": "problematic section",
        "suggestion": "improvement suggestion",
        "rationale": "why this improves the text"
      }
    ],
    "improved_text": "complete restructured version"
  }
}`,
    };
  }

  async analyzeText(
    text: string,
    style?: string,
    focusAreas?: string[]
  ): Promise<AnalysisResult> {
    if (!text.trim()) {
      throw new Error("Text cannot be empty");
    }

    const result: AnalysisResult = {
      original_text: text,
      improved_text: text,
      text_stats: calculateTextStats(text),
      tone_analysis: analyzeWritingTone(text),
      analysis: {
        grammar: null,
        style: null,
        structure: null,
      },
      improvements: [],
      style_feedback: {
        tone: "",
        readability_score: 0,
        complexity: "",
        style_suggestions: [],
      },
    };

    try {
      if (focusAreas?.includes("grammar")) {
        const grammarResponse = await this.processWithAgent(
          this.grammarAgent,
          `Analyze this text and provide detailed grammar feedback: ${text}`
        );
        if (grammarResponse && typeof grammarResponse === "object") {
          result.analysis.grammar = grammarResponse.analysis;
          if (grammarResponse.analysis.improved_text) {
            result.improved_text = grammarResponse.analysis.improved_text;
          }
        }
      }

      if (focusAreas?.includes("style")) {
        const stylePrompt = `Analyze this text for style improvements with focus on ${
          style || "clarity"
        }: ${result.improved_text}`;
        const styleResponse = await this.processWithAgent(
          this.styleAgent,
          stylePrompt
        );
        if (styleResponse && typeof styleResponse === "object") {
          result.analysis.style = styleResponse.analysis;
          if (styleResponse.analysis.improved_text) {
            result.improved_text = styleResponse.analysis.improved_text;
          }
        }
      }

      if (focusAreas?.includes("structure")) {
        const structureResponse = await this.processWithAgent(
          this.editorAgent,
          `Analyze this text for structural improvements: ${result.improved_text}`
        );
        if (structureResponse && typeof structureResponse === "object") {
          result.analysis.structure = structureResponse.analysis;
          if (structureResponse.analysis.improved_text) {
            result.improved_text = structureResponse.analysis.improved_text;
          }
        }
      }

      // Collect improvements
      for (const [area, analysis] of Object.entries(result.analysis)) {
        if (analysis) {
          if (area === "grammar" && analysis.issues) {
            for (const issue of analysis.issues) {
              result.improvements.push(
                `Grammar: ${issue.text} -> ${issue.correction}`
              );
            }
          } else if (area === "style" && analysis.suggestions) {
            for (const sugg of analysis.suggestions) {
              result.improvements.push(
                `Style: ${sugg.aspect} - ${sugg.improvement}`
              );
            }
          } else if (area === "structure" && analysis.flow_issues) {
            for (const issue of analysis.flow_issues) {
              result.improvements.push(`Structure: ${issue.suggestion}`);
            }
          }
        }
      }

      return result;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to analyze text: ${error.message}`);
      } else {
        throw new Error("Failed to analyze text: Unknown error");
      }
    }
  }

  private async processWithAgent(agent: Agent, prompt: string): Promise<any> {
    const maxRetries = 3;
    const baseDelay = 3; // seconds

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        try {
          const result = await fal.subscribe("fal-ai/any-llm", {
            input: {
              model: "anthropic/claude-3.5-sonnet",
              prompt: prompt,
              system_prompt: agent.content,
            },
          });

          const content = result.data.output;

          const cleanedContent = cleanJsonString(content);

          try {
            return JSON.parse(cleanedContent);
          } catch (e1) {
            try {
              return JSON.parse(
                cleanedContent
                  .replace(/\\n/g, "\\n")
                  .replace(/\\'/g, "\\'")
                  .replace(/\\"/g, '\\"')
                  .replace(/\\&/g, "\\&")
                  .replace(/\\r/g, "\\r")
                  .replace(/\\t/g, "\\t")
                  .replace(/\\b/g, "\\b")
                  .replace(/\\f/g, "\\f")
              );
            } catch (e2) {
              try {
                return JSON.parse(
                  cleanedContent.replace(/[\u0000-\u0019]+/g, "")
                );
              } catch (e3) {
                throw new Error("Failed to parse JSON response");
              }
            }
          }
        } catch (e) {
          throw e;
        }
      } catch (e) {
        if (attempt < maxRetries - 1) {
          const waitTime = baseDelay * 2 ** attempt;
          await new Promise((resolve) => setTimeout(resolve, waitTime * 1000));
          continue;
        } else {
          throw e;
        }
      }
    }

    throw new Error("All retry attempts failed");
  }
}
