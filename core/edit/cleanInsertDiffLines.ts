import { ChatMessage, DiffLine, ILLM, Prediction } from "..";
import {
  filterCodeBlockLines,
  filterEnglishLinesAtEnd,
  filterEnglishLinesAtStart,
  filterLeadingAndTrailingNewLineInsertion,
  removeTrailingWhitespace,
  skipLines,
  stopAtLines,
} from "../autocomplete/filtering/streamTransforms/lineStream";
import { streamDiff } from "../diff/streamDiff";
import { gptEditPrompt } from "../llm/templates/edit";
import { Telemetry } from "../util/posthog";


export type LineStream = AsyncGenerator<string>;

/**
 * Constructs a prompt for the LLM to edit code based on user input.
 * @param prefix - The code that comes before the section to edit
 * @param highlighted - The specific code section to be edited
 * @param suffix - The code that comes after the section to edit
 * @param llm - The LLM interface to use
 * @param userInput - The user's instructions for the edit
 * @param language - The programming language of the code
 * @returns Either a string prompt or array of chat messages
 */
function constructPrompt(
  prefix: string,
  highlighted: string,
  suffix: string,
  llm: ILLM,
  userInput: string,
  language: string | undefined,
): string | ChatMessage[] {
  const template = llm.promptTemplates?.edit ?? gptEditPrompt;
  return llm.renderPromptTemplate(template, [], {
    userInput,
    prefix,
    codeToEdit: highlighted,
    suffix,
    language: language ?? "",
  });
}

/**
 * Adds indentation to each line in a diff stream.
 * Used to preserve the original code's indentation level when making insertions.
 */
export async function* addIndentation(
  diffLineGenerator: AsyncGenerator<DiffLine>,
  indentation: string,
): AsyncGenerator<DiffLine> {
  for await (const diffLine of diffLineGenerator) {
    yield {
      ...diffLine,
      line: indentation + diffLine.line,
    };
  }
}

/**
 * Checks if a model is considered "inept" at code editing.
 * Currently considers any non-GPT and non-Claude model as inept.
 */
function modelIsInept(model: string): boolean {
  return !(model.includes("gpt") || model.includes("claude"));
}

/**
 * Main function that streams diff lines for code fixes.
 * Takes original code context and user input, sends to LLM, and returns
 * a stream of diff lines showing what should be changed.
 *
 * @param prefix - Code before the edit section
 * @param highlighted - The code section being edited
 * @param suffix - Code after the edit section
 * @param llm - The LLM interface to use
 * @param input - User's edit instructions
 * @param newCodeLines - The new code lines to be inserted
 * @param language - Programming language
 * @param onlyOneInsertion - Whether to stop after first insertion
 * @param overridePrompt - Optional custom prompt to use instead of default
 * 
 * @returns AsyncGenerator of DiffLine objects representing the changes
 */
export async function* cleanInsertDiffLines(
  prefix: string,
  highlighted: string,
  suffix: string,
  llm: ILLM,
  input: string,
  newCodeLines: string[],
  language: string | undefined,
  onlyOneInsertion: boolean = false,
  overridePrompt?: ChatMessage[] | undefined,
): AsyncGenerator<DiffLine> {
  // Track telemetry for the edit operation
  void Telemetry.capture(
    "inlineEdit",
    {
      model: llm.model,
      provider: llm.providerName,
    },
    true,
  );

  // Handle the case where there's no highlighted text
  // In this case, we need to determine the line being edited from prefix+suffix
  let oldLines =
    highlighted.length > 0
      ? highlighted.split("\n")
      : // When highlighted is empty, we need to combine last line of prefix and first line of suffix to determine the line being edited
        [(prefix + suffix).split("\n")[prefix.split("\n").length - 1]];

  // But if that line is empty, we can assume we are insertion-only
  if (oldLines.length === 1 && oldLines[0].trim() === "") {
    oldLines = [];
  }

  // Trim end of oldLines, otherwise we have trailing \r on every line for CRLF files
  oldLines = oldLines.map((line) => line.trimEnd());

  // Get the prompt either from override or by constructing it
  const prompt =
    overridePrompt ??
    constructPrompt(prefix, highlighted, suffix, llm, input, language);
  const inept = modelIsInept(llm.model);

  // Set up prediction for the LLM
  const prediction: Prediction = {
    type: "content",
    content: highlighted,
  };

  // Stream the completion from the LLM
  const completion =
    typeof prompt === "string"
      ? llm.streamComplete(prompt, new AbortController().signal, {
          raw: true,
          prediction,
        })
      : llm.streamChat(prompt, new AbortController().signal, {
          prediction,
        });

  // Process the LLM output through a series of filters:
  // let lines = streamLines(completion);
  let lines: LineStream = async function* () {
    const fixLines = newCodeLines;
    for await (const line of fixLines) {
      yield line;
    }
  }();
  // Remove any English text at the start
  lines = filterEnglishLinesAtStart(lines);
  // Extract just the code from any code blocks
  lines = filterCodeBlockLines(lines);
  // Stop at certain marker lines
  lines = stopAtLines(lines, () => {});
  // Skip specified lines
  lines = skipLines(lines);
  // Clean up whitespace
  lines = removeTrailingWhitespace(lines);
  
  // Additional filtering for less capable models
  if (inept) {
    // lines = fixCodeLlamaFirstLineIndentation(lines);
    lines = filterEnglishLinesAtEnd(lines);
  }

  // Generate the diff between old and new code
  let diffLines = streamDiff(oldLines, lines);
  // Remove unnecessary newline insertions
  diffLines = filterLeadingAndTrailingNewLineInsertion(diffLines);

  // Preserve indentation for insertions
  if (highlighted.length === 0) {
    const line = prefix.split("\n").slice(-1)[0];
    const indentation = line.slice(0, line.length - line.trimStart().length);
    diffLines = addIndentation(diffLines, indentation);
  }

  // Stream the diff lines, optionally stopping after first insertion
  let seenGreen = false;
  for await (const diffLine of diffLines) {
    yield diffLine;
    if (diffLine.type === "new") {
      seenGreen = true;
    } else if (onlyOneInsertion && seenGreen && diffLine.type === "same") {
      break;
    }
  }
}
