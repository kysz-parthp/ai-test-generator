import { z } from 'zod'
import { createLLMClient, getDefaultModel } from './llmClient'

// Schema for multiple choice (single answer)
// Note: correctOptionIndex uses 0-based indexing internally, but will be converted to 1-based for display
const MultipleChoiceQuestionSchema = z.object({
  questionType: z.literal('multiple_choice'),
  questionText: z.string(),
  options: z.array(z.string()).min(2),
  correctOptionIndex: z.number().int().min(0).nullable().optional(),
  // Track if answer was provided in source (not inferred)
  answerProvided: z.boolean().optional(),
})

// Schema for multiple answer (multiple correct answers)
const MultipleAnswerQuestionSchema = z.object({
  questionType: z.literal('multiple_answer'),
  questionText: z.string(),
  options: z.array(z.string()).min(2),
      correctAnswers: z.union([
        z.array(z.number().int().min(0)),
        z.string(), // Allow string format for concatenated digits like "13", "3456"
      ]).nullable().optional(),
  answerProvided: z.boolean().optional(),
})

// Schema for fill in the blank
const FillBlankQuestionSchema = z.object({
  questionType: z.literal('fill_blank'),
  questionText: z.string(),
  correctText: z.string().nullable().optional(),
  answerProvided: z.boolean().optional(),
})

// Schema for descriptive/essay questions
const DescriptiveQuestionSchema = z.object({
  questionType: z.literal('descriptive'),
  questionText: z.string(),
  sampleAnswer: z.string().nullable().optional(),
  answerProvided: z.boolean().optional(),
})

// Schema for true/false questions
const TrueFalseQuestionSchema = z.object({
  questionType: z.literal('true_false'),
  questionText: z.string(),
  correctAnswer: z.boolean().nullable().optional(), // true or false
  answerProvided: z.boolean().optional(),
})

// Schema for matching questions (e.g., "Author — Book")
// correctMatches can be string format from LLM ("1-3, 2-1, 3-2") or array format (after conversion)
const MatchingQuestionSchema = z.object({
  questionType: z.literal('matching'),
  questionText: z.string(), // Instruction text
  leftColumn: z.array(z.string()).min(2), // Left column items
  rightColumn: z.array(z.string()).min(2), // Right column items
  correctMatches: z.union([
    z.string(), // Format: "1-3, 2-1, 3-2" (1-based indices) - from LLM
    z.array(z.object({
    leftIndex: z.number().int().min(0),
    rightIndex: z.number().int().min(0),
    })) // Array format - after conversion
  ]).nullable().optional(),
  answerProvided: z.boolean().optional(),
})

// Schema for composite questions (MCQ + fill-in-the-blank)
const CompositeQuestionSchema = z.object({
  questionType: z.literal('composite'),
  questionText: z.string(), // Main instruction
  options: z.array(z.string()).min(2), // Multiple choice options
  correctOptionIndex: z.number().int().min(0).nullable().optional(),
  fillInPrompt: z.string(), // Additional prompt for fill-in part
  fillInCorrectText: z.string().nullable().optional(), // Correct answer for fill-in part
  answerProvided: z.boolean().optional(),
})

// Schema for sequencing/ordering questions
const SequencingQuestionSchema = z.object({
  questionType: z.literal('sequencing'),
  questionText: z.string(), // Instruction text
  items: z.array(z.string()).min(2), // Items to sequence/order
  correctOrder: z.array(z.number().int().min(0)).nullable().optional(), // Array of 0-based indices representing correct order
  answerProvided: z.boolean().optional(),
})

// Union schema for all question types
const QuestionSchema = z.discriminatedUnion('questionType', [
  MultipleChoiceQuestionSchema,
  MultipleAnswerQuestionSchema,
  FillBlankQuestionSchema,
  DescriptiveQuestionSchema,
  TrueFalseQuestionSchema,
  MatchingQuestionSchema,
  CompositeQuestionSchema,
  SequencingQuestionSchema,
])

const QuestionsResponseSchema = z.object({
  questions: z.array(QuestionSchema),
  invalidQuestions: z.array(z.object({
    questionNumber: z.string().optional(),
    reason: z.string(),
    rawText: z.string(),
  })).optional(), // Questions that couldn't be parsed due to missing/ambiguous answers
})

export type ParsedQuestion = z.infer<typeof QuestionSchema>

/**
 * Cleans the LLM response by removing markdown code blocks and extra whitespace
 * Also fixes common JSON issues like unescaped control characters
 */
function cleanJsonResponse(responseText: string): string {
  let cleaned = responseText.trim()
  
  // Remove markdown code blocks (```json ... ``` or ``` ... ```)
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '')
  cleaned = cleaned.replace(/\n?```\s*$/i, '')
  
  // Remove any leading/trailing whitespace
  cleaned = cleaned.trim()
  
  // Try to find JSON object if there's extra text
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    cleaned = jsonMatch[0]
  }
  
  // Fix unescaped control characters in JSON strings
  // We need to escape control characters that appear inside string literals
  // Strategy: Find all string literals and escape control characters within them
  let result = ''
  let inString = false
  let escapeNext = false
  
  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i]
    const code = char.charCodeAt(0)
    
    if (escapeNext) {
      // We're escaping the next character, so just add it as-is
      result += char
      escapeNext = false
      continue
    }
    
    if (char === '\\') {
      // Escape sequence - don't process the next character
      result += char
      escapeNext = true
      continue
    }
    
    if (char === '"') {
      // Toggle string state
      inString = !inString
      result += char
      continue
    }
    
    if (inString) {
      // We're inside a string literal
      // Check if this is a control character that needs escaping
      if (code >= 0x00 && code <= 0x1F && code !== 0x09 && code !== 0x0A && code !== 0x0D) {
        // Control character that's not tab, newline, or carriage return
        // Escape it as \uXXXX
        result += '\\u' + ('0000' + code.toString(16)).slice(-4)
      } else if (code === 0x09) {
        // Tab - keep as-is or escape as \t
        result += '\\t'
      } else if (code === 0x0A) {
        // Newline - escape as \n
        result += '\\n'
      } else if (code === 0x0D) {
        // Carriage return - escape as \r
        result += '\\r'
      } else {
        result += char
      }
    } else {
      // Outside string literal - add as-is
      result += char
    }
  }
  
  return result
}

/**
 * Converts option labels from letters (A, B, C, D) to numbers (1, 2, 3, 4)
 * This follows Russian test formatting standards.
 * Also removes the label prefix from option text.
 */
function convertOptionLabels(option: string): { label: number; text: string } | null {
  // Match patterns like "A)", "A.", "A)", "B)", etc.
  const letterMatch = option.match(/^([A-Z])\s*[\.\)]\s*(.+)$/i)
  if (letterMatch) {
    const letter = letterMatch[1].toUpperCase()
    const text = letterMatch[2].trim()
    const label = letter.charCodeAt(0) - 'A'.charCodeAt(0) + 1 // A=1, B=2, C=3, D=4
    if (label >= 1 && label <= 26) {
      return { label, text }
    }
  }
  
  // Match patterns like "1.", "2)", etc. (already numeric)
  const numberMatch = option.match(/^(\d+)\s*[\.\)]\s*(.+)$/)
  if (numberMatch) {
    const label = parseInt(numberMatch[1], 10)
    const text = numberMatch[2].trim()
    return { label, text }
  }
  
  // If no label found, return as-is with label 0 (will be handled)
  return { label: 0, text: option.trim() }
}

/**
 * Removes parenthetical option lists from question text to avoid duplication.
 * Matches patterns like "(1) option A 2) option B 3) option C 4) option D"
 * or "(A) option A (B) option B (C) option C (D) option D"
 * Handles Russian format where only first option has opening parenthesis: (1) text 2) text 3) text 4) text
 */
function removeParentheticalOptions(questionText: string): string {
  let cleaned = questionText
  
  // Pattern 1: (1) text 2) text 3) text 4) text) - Russian format with closing paren
  // Matches: opening paren, number, closing paren, text, then 2-4 more numbered options, closing paren
  // This handles the exact format: "(1) верно только А 2) верно только Б 3) верны оба суждения 4) оба суждения неверны)"
  cleaned = cleaned.replace(/\((\d+)\)\s*[^)]+(\s+\d+\)\s*[^)]+){2,}\)/gi, '')
  
  // Pattern 2: (1) text 2) text 3) text 4) text - Russian format without closing paren (if at end)
  // Only match if it's at the end of the text and has at least 3 options
  cleaned = cleaned.replace(/\((\d+)\)\s*[^)]+(\s+\d+\)\s*[^)]+){2,}\s*$/gi, '')
  
  // Pattern 3: (A) text (B) text (C) text (D) text - all with parentheses
  cleaned = cleaned.replace(/\(([A-D])\)\s*[^)]+(\s+\([A-D]\)\s*[^)]+){2,}\)/gi, '')
  
  // Pattern 4: (1. text 2. text 3. text 4. text) - with periods
  cleaned = cleaned.replace(/\((\d+\.\s*[^)]+(\s+\d+\.\s*[^)]+){2,})\)/gi, '')
  
  // Pattern 5: (A. text B. text C. text D. text) - letters with periods
  cleaned = cleaned.replace(/\(([A-D]\.\s*[^)]+(\s+[A-D]\.\s*[^)]+){2,})\)/gi, '')
  
  // Pattern 6: Remove standalone numbered/lettered lists at the end that duplicate options
  // This catches cases like "Question text 1) option 2) option 3) option 4) option"
  // Look for 3+ consecutive numbered items at the end
  cleaned = cleaned.replace(/(\s+\d+[\.\)]\s+[^\d]+){3,}\s*$/gi, '')
  
  // Pattern 7: Remove lettered lists at the end (A) B) C) D) format
  cleaned = cleaned.replace(/(\s+[A-D][\.\)]\s+[^A-D]+){3,}\s*$/gi, '')
  
  // Clean up any double spaces, trailing/leading parentheses, commas, or periods
  cleaned = cleaned.replace(/\s+/g, ' ').trim()
  cleaned = cleaned.replace(/^\s*[\(\),\.]\s*|\s*[\(\),\.]\s*$/g, '')
  
  return cleaned
}

/**
 * Converts matching question string format "1-3, 2-1, 3-2" to array format
 * [{leftIndex: 0, rightIndex: 2}, {leftIndex: 1, rightIndex: 0}, ...]
 * String format uses 1-based indices, array format uses 0-based indices.
 */
function parseMatchingString(matchesString: string | null | undefined): Array<{ leftIndex: number; rightIndex: number }> | null {
  if (!matchesString) return null
  
  try {
    const pairs = matchesString.split(',').map(pair => pair.trim())
    const result: Array<{ leftIndex: number; rightIndex: number }> = []
    
    for (const pair of pairs) {
      const match = pair.match(/^(\d+)\s*-\s*(\d+)$/)
      if (match) {
        const leftIndex = parseInt(match[1], 10) - 1 // Convert 1-based to 0-based
        const rightIndex = parseInt(match[2], 10) - 1 // Convert 1-based to 0-based
        result.push({ leftIndex, rightIndex })
      }
    }
    
    return result.length > 0 ? result : null
  } catch (error) {
    console.warn('Failed to parse matching string:', matchesString, error)
    return null
  }
}

/**
 * Parses answer strings like "13" (meaning options 1 and 3) or "1,3" or "[1,3]"
 * and converts them to 0-based indices array [0, 2].
 * Handles various formats:
 * - "13" -> [0, 2] (concatenated digits)
 * - "1,3" -> [0, 2] (comma-separated)
 * - "[1,3]" -> [0, 2] (JSON array string)
 * - "[0,2]" -> [0, 2] (already 0-based)
 */
function parseMultipleAnswerString(answerString: string | number[] | null | undefined): number[] | null {
  if (!answerString) return null
  
  // If already an array, check if it needs conversion
  if (Array.isArray(answerString)) {
    if (answerString.length === 0) return null
    
    // Check if values are out of bounds (indicating 1-based that needs conversion)
    // If any value equals or exceeds a reasonable option count (e.g., 6+), it's likely 1-based
    // But if values are 0-5 range, they could be either, so check the pattern
    
    // If array contains 0, it might be already 0-based OR incorrectly parsed concatenated digits
    // Example: LLM might parse "13" as [0, 1] (wrong) when it should be [0, 2]
    // We can't reliably detect this without the original string format
    // So we'll keep it as-is, but log a warning if it looks suspicious
    const hasZero = answerString.includes(0)
    if (hasZero) {
      // Check if array looks like consecutive numbers [0, 1, 2] which might indicate mis-parsing
      // But we can't be sure, so we'll keep it as-is
      // The real fix is ensuring LLM returns string format
      const sorted = [...answerString].sort((a, b) => a - b)
      const isConsecutive = sorted.length > 1 && sorted.every((val, idx) => idx === 0 || val === sorted[idx - 1] + 1)
      if (isConsecutive && sorted.length <= 4) {
        console.warn(`Warning: Array ${JSON.stringify(answerString)} looks like consecutive numbers starting from 0. This might be incorrectly parsed concatenated digits. Consider returning as string format instead.`)
      }
      return answerString.filter(val => val >= 0)
    }
    
    // If no zero and all values >= 1, check if conversion makes sense
    // If max value is >= 6 (typical max options), likely 1-based
    const maxValue = Math.max(...answerString)
    const minValue = Math.min(...answerString)
    
    // If values are 1-5 range, could be either, but if LLM returned array format,
    // it should have already converted. However, if it didn't, we need to convert.
    // More conservative: only convert if we're confident it's 1-based
    // (values like 1,2,3,4,5,6 suggest 1-based numbering)
    if (minValue >= 1 && maxValue <= 10) {
      // Likely 1-based (common in documents: options numbered 1-6)
      // Convert to 0-based
      const converted = answerString.map(val => val - 1).filter(val => val >= 0)
      console.log(`Converting array from 1-based [${answerString.join(', ')}] to 0-based [${converted.join(', ')}]`)
      return converted
    }
    
    // Already 0-based or unusual format
    return answerString.filter(val => val >= 0)
  }
  
  if (typeof answerString !== 'string') return null
  
  try {
    const trimmed = answerString.trim()
    
    // Try parsing as JSON array first
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        // Check if 1-based or 0-based
        const maxValue = Math.max(...parsed)
        if (maxValue >= parsed.length) {
          return parsed.map(val => val - 1).filter(val => val >= 0)
        }
        return parsed.filter(val => val >= 0)
      }
    }
    
    // Try comma-separated format "1,3" or "1, 3"
    if (trimmed.includes(',')) {
      const parts = trimmed.split(',').map(p => parseInt(p.trim(), 10)).filter(n => !isNaN(n))
      if (parts.length > 0) {
        // Assume 1-based, convert to 0-based
        return parts.map(val => val - 1).filter(val => val >= 0)
      }
    }
    
    // Try concatenated digits format "13" (meaning options 1 and 3) or "3456" (options 3,4,5,6)
    // This is common in Russian test formats and other languages
    // IMPORTANT: Each digit represents a separate option number
    const digitMatch = trimmed.match(/^\d+$/)
    if (digitMatch) {
      // Split into individual digits and parse each
      const digits = trimmed.split('').map(d => parseInt(d, 10)).filter(n => !isNaN(n) && n > 0)
      // Convert each digit from 1-based to 0-based
      const result = digits.map(val => val - 1).filter(val => val >= 0)
      console.log(`Parsed concatenated digits "${trimmed}" -> individual digits: [${digits.join(', ')}] -> 0-based indices: [${result.join(', ')}]`)
      if (result.length > 0) {
        return result
      }
    }
    
    // Try single number
    const singleNum = parseInt(trimmed, 10)
    if (!isNaN(singleNum) && singleNum > 0) {
      return [singleNum - 1] // Convert 1-based to 0-based
    }
    
    return null
  } catch (error) {
    console.warn('Failed to parse multiple answer string:', answerString, error)
    return null
  }
}

/**
 * Post-processes questions to convert option labels from letters to numbers
 * and ensures all options are properly formatted.
 */
function postProcessQuestions(questions: ParsedQuestion[]): ParsedQuestion[] {
  return questions.map((question) => {
    // Remove parenthetical option lists from question text for all question types
    let cleanedQuestionText = removeParentheticalOptions(question.questionText)
    
    // Convert options for multiple choice and multiple answer questions
    if (question.questionType === 'multiple_choice' || question.questionType === 'multiple_answer') {
      const processedOptions = question.options.map((opt) => {
        const converted = convertOptionLabels(opt)
        return converted ? converted.text : opt
      })
      
      // For multiple answer questions, parse and normalize the correctAnswers
      if (question.questionType === 'multiple_answer' && question.correctAnswers !== null && question.correctAnswers !== undefined) {
        // Parse and convert correctAnswers to 0-based indices
        // Handles: string "13", string "[1,3]", array [1,3], array [0,2]
        console.log('Processing multiple_answer question. Original correctAnswers:', JSON.stringify(question.correctAnswers), 'Type:', typeof question.correctAnswers)
        const parsedAnswers = parseMultipleAnswerString(question.correctAnswers as any)
        console.log('Parsed answers:', parsedAnswers)
        if (parsedAnswers && parsedAnswers.length > 0) {
          // Ensure all indices are valid (within bounds of options array)
          const validAnswers = parsedAnswers.filter(idx => idx >= 0 && idx < processedOptions.length)
          console.log('Valid answers after filtering:', validAnswers, 'Options count:', processedOptions.length)
          if (validAnswers.length > 0) {
            return {
              ...question,
              questionText: cleanedQuestionText,
              options: processedOptions,
              correctAnswers: validAnswers,
            }
          } else {
            console.warn('Multiple answer question has no valid correct answers after parsing:', question.correctAnswers, 'Parsed:', parsedAnswers, 'Options:', processedOptions.length)
          }
        } else {
          console.warn('Failed to parse correctAnswers for multiple answer question. Original:', question.correctAnswers, 'Type:', typeof question.correctAnswers)
        }
      }
      
      return {
        ...question,
        questionText: cleanedQuestionText,
        options: processedOptions,
      }
    }
    
    // Convert options for composite questions
    if (question.questionType === 'composite') {
      const processedOptions = question.options.map((opt) => {
        const converted = convertOptionLabels(opt)
        return converted ? converted.text : opt
      })
      
      return {
        ...question,
        questionText: cleanedQuestionText,
        options: processedOptions,
      }
    }
    
    // Convert matching question string format to array format
    if (question.questionType === 'matching') {
      let parsedMatches: Array<{ leftIndex: number; rightIndex: number }> | null = null
      
      if (typeof question.correctMatches === 'string') {
        // Convert string format to array format
        parsedMatches = parseMatchingString(question.correctMatches)
      } else if (Array.isArray(question.correctMatches)) {
        // Already in array format, use as-is
        parsedMatches = question.correctMatches
      }
      
      return {
        ...question,
        questionText: cleanedQuestionText,
        correctMatches: parsedMatches,
      } as ParsedQuestion
    }
    
    // Process sequencing questions - ensure items are present
    if (question.questionType === 'sequencing') {
      // Ensure items array exists and has at least 2 items
      if (!question.items || question.items.length < 2) {
        console.warn('Sequencing question missing items array or has less than 2 items')
      }
      
      return {
        ...question,
        questionText: cleanedQuestionText,
      }
    }
    
    // For other question types, just clean the question text
    return {
      ...question,
      questionText: cleanedQuestionText,
    }
  })
}

export async function parseQuestionsFromText(
  text: string
): Promise<ParsedQuestion[]> {
  const client = createLLMClient()
  const provider = (process.env.LLM_PROVIDER || 'openai').toLowerCase()

  const prompt = `You are an AI engine embedded in a test-generation system. Your task is to parse test documents and generate structured tests with ABSOLUTE FIDELITY to the source content.

You must strictly obey ALL rules below. Any violation is considered an error.

═══════════════════════════════════════════════════════════════
0. STRICT SOURCE-ONLY POLICY (ABSOLUTE MANDATORY)
═══════════════════════════════════════════════════════════════

* **USE ONLY INFORMATION FROM THE UPLOADED DOCUMENT**
* **DO NOT INFER, ASSUME, OR ADD ANY CONTENT BEYOND WHAT IS EXPLICITLY MENTIONED**
* **DO NOT USE EXTERNAL KNOWLEDGE OR REASONING TO COMPLETE ANSWERS**
* **DO NOT GENERATE OR CREATE CONTENT THAT IS NOT IN THE DOCUMENT**

* Every piece of information (questions, options, answers, instructions) MUST come directly from the document text.
* If information is missing from the document, mark it as missing - DO NOT fill it in.
* If an answer is not explicitly stated, DO NOT create one - mark the question as invalid.
* Your role is to EXTRACT and STRUCTURE what exists in the document, NOT to add or complete missing information.

═══════════════════════════════════════════════════════════════
1. ANSWER SOURCE OF TRUTH (MANDATORY)
═══════════════════════════════════════════════════════════════

* Every question includes a clearly defined correct answer in the document. Look for answer markers in any language or format (e.g., "Answer:", "Correct Answer:", "Key:", "Correct:", or equivalent terms in other languages, true/false indicators, etc.).

* You MUST ONLY extract and use answers that are EXPLICITLY PROVIDED in the document.

* ❌ NEVER infer, guess, complete, generate, or assume answers.
* ❌ NEVER use your knowledge to determine what the answer "should be".
* ❌ NEVER complete partial answers or fill in missing information.

* If an answer is missing or ambiguous, DO NOT include the question in the "questions" array. Instead, add it to the "invalidQuestions" array with the reason.

* Set "answerProvided": true ONLY if you found an explicit, complete answer in the document. Set it to false if you're including the question without an answer.

═══════════════════════════════════════════════════════════════
2. FULL TASK COMPREHENSION (HOLISTIC PARSING)
═══════════════════════════════════════════════════════════════

* A task may be expressed as:
  - A question
  - A statement
  - An instruction or clarification (e.g., "Choose two answers", "Select all correct statements")

* Treat ALL related text blocks as a single task condition, even if they are:
  - Separated by line breaks
  - Located above or below the main question
  - Placed in different visual sections

* Do NOT rely on punctuation (such as "?") to determine intent.

* Correctly determine FROM THE DOCUMENT:
  - Single-choice vs multiple-choice (based on instructions in the document)
  - Required number of correct answers (based on what the document states)
  - Special constraints or clarifications (extract exactly as written)

═══════════════════════════════════════════════════════════════
3. PRESERVE FULL QUESTION TEXT (NO TRUNCATION)
═══════════════════════════════════════════════════════════════

* Extract and reproduce the ENTIRE question text verbatim FROM THE DOCUMENT.

* ❌ Do NOT shorten, paraphrase, summarize, or omit any part.
* ❌ Do NOT add explanatory text or context that is not in the document.
* ❌ Do NOT complete incomplete sentences or thoughts.

* This includes:
  - Multi-line questions
  - Page-split sentences
  - Text broken by formatting, tables, or layout

* The generated question must be a CONTINUOUS, COMPLETE RECONSTRUCTION of the original text.

* For "questionText", include the FULL instruction/question text, BUT remove any parenthetical option lists or trailing option lists (e.g., "(1) option A 2) option B 3) option C 4) option D" or "1) option A 2) option B 3) option C 4) option D") from the questionText since these will be displayed separately in the options array. This prevents duplication. Preserve all other text verbatim.

* **CRITICAL**: If the question text contains condition items that are ALSO listed as answer choices, you MUST remove them from the questionText to avoid duplication. Only include them in the options array.

* **CRITICAL FOR FILL-IN-THE-BLANK QUESTIONS**: 
  - Include the COMPLETE instruction text
  - Include the ENTIRE passage/text with all blanks (preserve all blank markers as they appear)
  - Include the FULL list of terms/options to choose from (preserve any term lists, option lists, or reference materials)
  - Include any tables or answer formats
  - DO NOT truncate or summarize any part of the fill-in-blank structure
  - The questionText must contain everything a student needs to answer the question

═══════════════════════════════════════════════════════════════
4. ANSWER OPTION LABEL CONVERSION (REQUIRED)
═══════════════════════════════════════════════════════════════

* Convert all option labels from letters to numbers:
  - A → 1
  - B → 2
  - C → 3
  - D → 4

* In the "options" array, include the option text WITHOUT the label prefix (e.g., "A)" or "A.").
* The system will handle label conversion automatically.

* Apply this conversion consistently to:
  - Displayed options
  - Stored answers (convert answer letters to 0-based indices: A=0, B=1, C=2, D=3)

═══════════════════════════════════════════════════════════════
5. MATCHING ("Match the items") TASK HANDLING
═══════════════════════════════════════════════════════════════

* Automatically recognize matching-type tasks (two lists that must be paired).

* Generate a two-column structure exactly matching the document/PDF.

* For "correctMatches", provide a string in the format "1-3, 2-1, 3-2" where numbers are 1-based indices (left-right pairs).

* Example: If left column item 1 matches right column item 3, left item 2 matches right item 1, etc., the format is "1-3, 2-1, 3-2".

═══════════════════════════════════════════════════════════════
6. TRUE/FALSE QUESTION HANDLING
═══════════════════════════════════════════════════════════════

* Automatically recognize true/false questions (questions with only two possible answers, regardless of language).

* Use questionType "true_false" for these questions.

* Set "correctAnswer" to true or false based on the provided answer. Detect the correct answer from the document's answer format, regardless of language.

═══════════════════════════════════════════════════════════════
7. SEQUENCING/ORDERING QUESTION HANDLING
═══════════════════════════════════════════════════════════════

* Automatically recognize sequencing/ordering tasks (questions that require arranging items in a specific order).

* Use questionType "sequencing" for these questions.

* Extract all items that need to be sequenced into the "items" array.

* For "correctOrder", provide an array of 0-based indices representing the correct sequence.
  Example: If items are ["First", "Second", "Third"] and correct order is ["Second", "First", "Third"],
  then correctOrder should be [1, 0, 2] (0-based indices).

* Detect sequencing tasks by identifying instructions that require ordering or arranging items, regardless of language.

* The items array MUST contain all items that need to be sequenced. Without items, sequencing is impossible.

═══════════════════════════════════════════════════════════════
8. OUTPUT INTEGRITY RULES
═══════════════════════════════════════════════════════════════

* Output must be:
  - Structurally identical to the source test
  - Fully deterministic and reproducible
  - Free from hallucination, inference, or assumption
  - Free from truncation or rewording
  - Free from duplication (options should NOT appear in both questionText and options array)
  - Containing ONLY information explicitly present in the uploaded document

* If any rule cannot be satisfied, fail explicitly by adding the question to "invalidQuestions" rather than generating incorrect output or inferring missing information.

═══════════════════════════════════════════════════════════════
RETURN FORMAT
═══════════════════════════════════════════════════════════════

Return a JSON object with this structure:
{
  "questions": [
    {
      "questionType": "multiple_choice" | "multiple_answer" | "fill_blank" | "descriptive" | "true_false" | "matching" | "composite" | "sequencing",
      "questionText": "...",  // FULL, COMPLETE question text verbatim (no truncation, no duplication of options)
      "answerProvided": true | false,  // true if explicit answer found in document
      
      // For multiple_choice:
      "options": ["Option text without label", "Option text", ...],  // Remove "A)", "B)", etc. prefixes
      "correctOptionIndex": 0,  // 0-based index (A=0, B=1, C=2, D=3), null if answer not provided
      
      // For multiple_answer:
      "options": ["Option text", ...],
      "correctAnswers": [0, 2] | "13" | "3456" | "1,3",  // Can be array of 0-based indices OR original string format from document
      // CRITICAL: Extract the answer EXACTLY as it appears in the document (as a string)
      // If document says "3456", return "3456" (string) - do NOT convert to array
      // If document says "13", return "13" (string) - do NOT convert to array  
      // If document says "1,3", return "1,3" (string) - do NOT convert to array
      // The system will parse and convert the string format automatically
      // ONLY return array format if the document itself uses array notation like "[1,3]"
      // Preserve the EXACT format from the document - this ensures all digits are captured correctly
      
      // For fill_blank:
      // questionText must include: instruction + full passage with blanks + list of terms/options
      // Preserve the complete structure as it appears in the document
      "correctText": "answer",  // null if answer not provided
      
      // For descriptive:
      "sampleAnswer": "model answer text"  // null if not provided
      
      // For true_false:
      "correctAnswer": true | false,  // true or false, null if not provided
      
      // For matching:
      "leftColumn": ["Item 1", "Item 2", ...],  // Left column items
      "rightColumn": ["Match 1", "Match 2", ...],  // Right column items
      "correctMatches": "1-3, 2-1, 3-2",  // String format: "left-right pairs" (1-based), null if not provided
      
      // For composite (MCQ + fill-in):
      "options": ["Option text", ...],
      "correctOptionIndex": 0,  // null if not provided
      "fillInPrompt": "Enter the term:",
      "fillInCorrectText": "answer"  // null if not provided
      
      // For sequencing/ordering:
      "items": ["Item 1", "Item 2", ...],  // Items to sequence (REQUIRED - sequencing needs items)
      "correctOrder": [1, 0, 2],  // Array of 0-based indices representing correct order, null if not provided
    }
  ],
  "invalidQuestions": [  // Questions that cannot be parsed due to missing/ambiguous answers
    {
      "questionNumber": "1",
      "reason": "Answer missing or ambiguous",
      "rawText": "Full text of the question that couldn't be parsed"
    }
  ]
}

CRITICAL INSTRUCTIONS:
- **SOURCE-ONLY POLICY**: Use ONLY information and answers explicitly provided in the uploaded document. Do NOT infer, assume, or add any content beyond what is explicitly mentioned.
- Extract answers ONLY from explicit answer markers found in the document (detect answer indicators in any language or format)
- If no answer is found in the document, add to "invalidQuestions" array - DO NOT create or infer an answer
- Preserve ENTIRE question text verbatim FROM THE DOCUMENT - no truncation, no summarization, no additions
- **IMPORTANT**: Remove parenthetical option lists AND trailing option lists from questionText since options are displayed separately. Keep all other question text intact AS IT APPEARS IN THE DOCUMENT.
- **CRITICAL**: If condition items appear BOTH in the question text AND as answer choices, remove them from questionText to avoid duplication. Only include them in the options array.
- **CRITICAL FOR FILL-IN-THE-BLANK**: Include the COMPLETE instruction, the ENTIRE passage with blanks, and the FULL list of terms/options AS THEY APPEAR IN THE DOCUMENT. DO NOT truncate any part of fill-in-blank questions. DO NOT add missing blanks or terms.
- Remove label prefixes from option text in the options array (detect and remove any label format: letters, numbers, symbols, etc.) - but preserve the actual option text exactly as written
- Convert answer identifiers to 0-based indices based on how options are numbered in the document - extract the numbering system FROM THE DOCUMENT
- **CRITICAL FOR MULTIPLE ANSWER QUESTIONS**: Extract the answer EXACTLY as it appears in the document.
  - **MANDATORY FORMAT**: ALWAYS return the answer as a STRING in the exact format from the document
  - If document says "3456", return "3456" (string) - DO NOT convert to array [2,3,4,5] or [3,4,5,6]
  - If document says "13", return "13" (string) - DO NOT convert to array [0,1] or [0,2]
  - If document says "1,3", return "1,3" (string) - DO NOT convert to array
  - If document says "1 3", return "1 3" (string) - preserve the exact format
  - **DO NOT parse concatenated digits yourself** - return the string as-is
  - **DO NOT convert to array format** - the system will parse the string automatically
  - The system's parser will automatically convert string formats to 0-based indices
  - **NEVER return array format** - always return as string to ensure accuracy
  - Do not skip any digits or numbers mentioned in the document answer
- For matching questions, extract the matching format FROM THE DOCUMENT and convert to the required string format "left-right pairs" (1-based indices)
- For true/false questions, use questionType "true_false" and extract correctAnswer FROM THE DOCUMENT'S answer format - do not determine based on question content
- For sequencing questions, use questionType "sequencing", extract all items FROM THE DOCUMENT into "items" array, and extract correctOrder FROM THE DOCUMENT as array of 0-based indices
- **CRITICAL FOR SEQUENCING**: The items array MUST contain all items to sequence AS THEY APPEAR IN THE DOCUMENT. Without items explicitly listed in the document, sequencing is impossible - mark as invalid.
- Treat all related text blocks as a single task condition - but ONLY include text that is actually in the document
- Do NOT infer or guess answers - only extract what is explicitly provided in the document
- Do NOT use external knowledge to complete or verify answers
- **DYNAMIC FORMAT DETECTION**: Analyze the document's answer format and numbering system FROM THE DOCUMENT ITSELF, then convert accordingly. Do not assume a specific format - detect it from the document itself.

Text to parse:
${text}`

  try {
    const completion = await client.chat.completions.create({
      model: getDefaultModel(),
      messages: [
        {
          role: 'system',
          content:
            'You are an AI engine embedded in a test-generation system. Your task is to parse test documents with ABSOLUTE FIDELITY.\n\n' +
            'CRITICAL RULES:\n' +
            '0. STRICT SOURCE-ONLY POLICY: Use ONLY information and answers explicitly provided in the uploaded document. Do NOT infer, assume, or add any content beyond what is explicitly mentioned. Do NOT use external knowledge or reasoning to complete answers.\n' +
            '1. ANSWER SOURCE OF TRUTH: Extract answers ONLY from explicit answer markers found in the document (in any language or format). NEVER infer, guess, generate, or assume answers. If answer is missing from the document, add question to "invalidQuestions" array - DO NOT create an answer.\n' +
            '2. FULL TASK COMPREHENSION: Treat ALL related text blocks as a single task condition, but ONLY include text that is actually present in the document.\n' +
            '3. PRESERVE FULL QUESTION TEXT: Extract ENTIRE question text verbatim FROM THE DOCUMENT - NO truncation, NO summarization, NO paraphrasing, NO additions. CRITICAL: Remove option lists from questionText to avoid duplication (options go in the options array). If condition items appear BOTH in question text AND as answer choices, remove them from questionText. For fill-in-the-blank questions, include the COMPLETE instruction, ENTIRE passage with blanks, and FULL list of terms AS THEY APPEAR IN THE DOCUMENT.\n' +
            '4. ANSWER OPTION LABEL CONVERSION: Detect and remove label prefixes from option text (any format: letters, numbers, symbols). Convert answer identifiers to 0-based indices based on the document\'s numbering system AS IT APPEARS IN THE DOCUMENT.\n' +
            '5. MULTIPLE ANSWER FORMAT: MANDATORY - ALWAYS return answer as STRING in exact format from document. If document says "3456", return "3456" (string, NOT array). If "13", return "13" (string, NOT [0,1] or [0,2]). If "1,3", return "1,3" (string). DO NOT convert to array. DO NOT parse concatenated digits. Return the EXACT string from document. System will parse automatically.\n' +
            '6. MATCHING TASKS: Extract the matching format FROM THE DOCUMENT and convert to string format "left-right pairs" (1-based indices).\n' +
            '7. TRUE/FALSE QUESTIONS: Use questionType "true_false" for true/false questions. Extract the correct answer FROM THE DOCUMENT\'S answer format - do not determine based on question content or external knowledge.\n' +
            '8. DYNAMIC FORMAT DETECTION: Analyze the document\'s answer format, numbering system, and language conventions FROM THE DOCUMENT ITSELF. Do not assume specific formats - detect them from the document itself.\n' +
            '9. OUTPUT INTEGRITY: If any rule cannot be satisfied, fail explicitly by adding to "invalidQuestions" rather than generating incorrect output or inferring missing information. NO DUPLICATION of options in questionText and options array. NO ADDITION of content not in the document.\n\n' +
            'Return valid JSON only. Do not include any text before or after the JSON object.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.1,
      ...(provider !== 'groq' ? { response_format: { type: 'json_object' } } : {}),
      max_tokens: 16000,
    })

    const responseText = completion.choices[0]?.message?.content
    if (!responseText) {
      throw new Error('No response from LLM')
    }

    // Clean the response to remove markdown code blocks
    const cleanedResponse = cleanJsonResponse(responseText)
    
    let parsed
    try {
      parsed = JSON.parse(cleanedResponse)
    } catch (parseError) {
      // Log more details about the error
      const errorPos = parseError instanceof SyntaxError && 'position' in parseError 
        ? (parseError as any).position 
        : null
      
      console.error('Failed to parse JSON.')
      console.error('Error:', parseError instanceof Error ? parseError.message : 'Unknown error')
      if (errorPos !== null) {
        console.error('Error position:', errorPos)
        const start = Math.max(0, errorPos - 100)
        const end = Math.min(cleanedResponse.length, errorPos + 100)
        console.error('Context around error:', cleanedResponse.substring(start, end))
      }
      console.error('First 1000 chars of cleaned response:', cleanedResponse.substring(0, 1000))
      console.error('First 1000 chars of raw response:', responseText.substring(0, 1000))
      
      // Try a more aggressive fix: replace problematic control characters
      try {
        // Replace all control characters except \n, \r, \t with spaces
        const fixedResponse = cleanedResponse.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ')
        parsed = JSON.parse(fixedResponse)
        console.warn('Successfully parsed after aggressive control character removal')
      } catch (secondError) {
        throw new Error(`Invalid JSON response from LLM: ${parseError instanceof Error ? parseError.message : 'Unknown error'}. Position: ${errorPos || 'unknown'}`)
      }
    }

    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      throw new Error('LLM response missing questions array')
    }

    // Log invalid questions if any
    if (parsed.invalidQuestions && Array.isArray(parsed.invalidQuestions) && parsed.invalidQuestions.length > 0) {
      console.warn(`⚠️  ${parsed.invalidQuestions.length} question(s) could not be parsed due to missing or ambiguous answers:`)
      parsed.invalidQuestions.forEach((invalid: any) => {
        console.warn(`  - Question ${invalid.questionNumber || 'unknown'}: ${invalid.reason || 'Unknown reason'}`)
      })
    }

    // Validate questions
    const validated = QuestionsResponseSchema.parse(parsed)
    
    // Log multiple answer questions before post-processing
    validated.questions.forEach((q, idx) => {
      if (q.questionType === 'multiple_answer') {
        console.log(`Question ${idx + 1} (multiple_answer) - Before post-processing:`)
        console.log(`  correctAnswers:`, q.correctAnswers, `Type:`, typeof q.correctAnswers, `IsArray:`, Array.isArray(q.correctAnswers))
        console.log(`  options count:`, q.options?.length)
      }
    })
    
    // Post-process questions to convert option labels and clean up
    const processedQuestions = postProcessQuestions(validated.questions)
    
    // Log multiple answer questions after post-processing
    processedQuestions.forEach((q, idx) => {
      if (q.questionType === 'multiple_answer') {
        console.log(`Question ${idx + 1} (multiple_answer) - After post-processing:`)
        console.log(`  correctAnswers:`, q.correctAnswers, `Type:`, typeof q.correctAnswers, `IsArray:`, Array.isArray(q.correctAnswers))
        console.log(`  options count:`, q.options?.length)
      }
    })
    
    return processedQuestions
  } catch (error: any) {
    console.error('Error parsing questions:', error)
    
    // Provide more detailed error information
    if (error?.response?.status === 401 || error?.status === 401) {
      throw new Error('Invalid API key. Please check your GROK_API_KEY in the .env file and ensure it is valid and active.')
    }
    if (error?.response?.status === 400 || error?.status === 400) {
      const errorMessage = error?.response?.data?.error?.message || error?.message || 'Bad request'
      throw new Error(`API request failed: ${errorMessage}`)
    }
    
    throw new Error(
      `Failed to extract questions: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}
