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
  correctAnswers: z.array(z.number().int().min(0)).nullable().optional(),
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

// Union schema for all question types
const QuestionSchema = z.discriminatedUnion('questionType', [
  MultipleChoiceQuestionSchema,
  MultipleAnswerQuestionSchema,
  FillBlankQuestionSchema,
  DescriptiveQuestionSchema,
  TrueFalseQuestionSchema,
  MatchingQuestionSchema,
  CompositeQuestionSchema,
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
  
  return cleaned
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
1. ANSWER SOURCE OF TRUTH (MANDATORY)
═══════════════════════════════════════════════════════════════

* Every question includes a clearly defined correct answer in the document (e.g., "Answer: ...", "Correct Answer: ...", "Key: ...", "Correct: ...", "Верно" / "Неверно" for true/false).

* You MUST ONLY extract and use this provided answer.

* ❌ NEVER infer, guess, complete, or generate answers.

* If an answer is missing or ambiguous, DO NOT include the question in the "questions" array. Instead, add it to the "invalidQuestions" array with the reason.

* Set "answerProvided": true ONLY if you found an explicit answer in the document. Set it to false if you're including the question without an answer.

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

* Correctly determine:
  - Single-choice vs multiple-choice
  - Required number of correct answers
  - Special constraints or clarifications

═══════════════════════════════════════════════════════════════
3. PRESERVE FULL QUESTION TEXT (NO TRUNCATION)
═══════════════════════════════════════════════════════════════

* Extract and reproduce the ENTIRE question text verbatim.

* ❌ Do NOT shorten, paraphrase, summarize, or omit any part.

* This includes:
  - Multi-line questions
  - Page-split sentences
  - Text broken by formatting, tables, or layout

* The generated question must be a CONTINUOUS, COMPLETE RECONSTRUCTION of the original text.

* For "questionText", include the FULL instruction/question text, BUT remove any parenthetical option lists or trailing option lists (e.g., "(1) option A 2) option B 3) option C 4) option D" or "1) option A 2) option B 3) option C 4) option D") from the questionText since these will be displayed separately in the options array. This prevents duplication. Preserve all other text verbatim.

* **CRITICAL**: If the question text contains condition items (e.g., "А) statement 1 Б) statement 2") that are ALSO listed as answer choices, you MUST remove them from the questionText to avoid duplication. Only include them in the options array.

* **CRITICAL FOR FILL-IN-THE-BLANK QUESTIONS**: 
  - Include the COMPLETE instruction text
  - Include the ENTIRE passage/text with all blanks (e.g., ___________(А), ___________(Б), etc.)
  - Include the FULL list of terms/options to choose from (e.g., "ПЕРЕЧЕНЬ ТЕРМИНОВ:")
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

* Automatically recognize true/false questions (questions with only two possible answers: true or false, yes or no, верно or неверно).

* Use questionType "true_false" for these questions.

* Set "correctAnswer" to true or false based on the provided answer.

* Common indicators: "Верно/Неверно", "True/False", "Yes/No", "Да/Нет"

═══════════════════════════════════════════════════════════════
7. OUTPUT INTEGRITY RULES
═══════════════════════════════════════════════════════════════

* Output must be:
  - Structurally identical to the source test
  - Fully deterministic and reproducible
  - Free from hallucination
  - Free from truncation or rewording
  - Free from duplication (options should NOT appear in both questionText and options array)

* If any rule cannot be satisfied, fail explicitly by adding the question to "invalidQuestions" rather than generating incorrect output.

═══════════════════════════════════════════════════════════════
RETURN FORMAT
═══════════════════════════════════════════════════════════════

Return a JSON object with this structure:
{
  "questions": [
    {
      "questionType": "multiple_choice" | "multiple_answer" | "fill_blank" | "descriptive" | "true_false" | "matching" | "composite",
      "questionText": "...",  // FULL, COMPLETE question text verbatim (no truncation, no duplication of options)
      "answerProvided": true | false,  // true if explicit answer found in document
      
      // For multiple_choice:
      "options": ["Option text without label", "Option text", ...],  // Remove "A)", "B)", etc. prefixes
      "correctOptionIndex": 0,  // 0-based index (A=0, B=1, C=2, D=3), null if answer not provided
      
      // For multiple_answer:
      "options": ["Option text", ...],
      "correctAnswers": [0, 2],  // Array of 0-based indices, null if answer not provided
      
      // For fill_blank:
      // questionText must include: instruction + full passage with blanks + list of terms
      // Example: "Вставьте в текст... PASSAGE WITH BLANKS... ПЕРЕЧЕНЬ ТЕРМИНОВ: 1) term1 2) term2..."
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
- Extract answers ONLY from explicit markers like "Answer:", "Correct Answer:", "Key:", "Correct:", "Верно", "Неверно"
- If no answer is found, add to "invalidQuestions" array
- Preserve ENTIRE question text verbatim - no truncation, no summarization
- **IMPORTANT**: Remove parenthetical option lists AND trailing option lists from questionText (e.g., "(1) option A 2) option B 3) option C 4) option D" or "1) option A 2) option B") since options are displayed separately. Keep all other question text intact.
- **CRITICAL**: If condition items appear BOTH in the question text AND as answer choices, remove them from questionText to avoid duplication. Only include them in the options array.
- **CRITICAL FOR FILL-IN-THE-BLANK**: Include the COMPLETE instruction, the ENTIRE passage with blanks, and the FULL list of terms/options. DO NOT truncate any part of fill-in-blank questions.
- Remove label prefixes (A), B), etc.) from option text in the options array
- Convert answer letters to 0-based indices (A=0, B=1, C=2, D=3)
- For matching questions, use string format "1-3, 2-1" for correctMatches
- For true/false questions, use questionType "true_false" and set correctAnswer to true or false
- Treat all related text blocks as a single task condition
- Do NOT infer or guess answers - only extract what is explicitly provided

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
            '1. ANSWER SOURCE OF TRUTH: Only extract answers explicitly provided in the document (e.g., "Answer:", "Correct Answer:", "Key:", "Верно", "Неверно"). NEVER infer, guess, or generate answers. If answer is missing, add question to "invalidQuestions" array.\n' +
            '2. FULL TASK COMPREHENSION: Treat ALL related text blocks as a single task condition, even if separated by line breaks or in different sections.\n' +
            '3. PRESERVE FULL QUESTION TEXT: Extract ENTIRE question text verbatim - NO truncation, NO summarization, NO paraphrasing. CRITICAL: Remove option lists from questionText to avoid duplication (options go in the options array). If condition items appear BOTH in question text AND as answer choices, remove them from questionText. For fill-in-the-blank questions, include the COMPLETE instruction, ENTIRE passage with blanks, and FULL list of terms.\n' +
            '4. ANSWER OPTION LABEL CONVERSION: Remove label prefixes (A), B), etc.) from option text. Convert answer letters to 0-based indices (A=0, B=1, C=2, D=3).\n' +
            '5. MATCHING TASKS: Use string format "1-3, 2-1" for correctMatches (1-based indices).\n' +
            '6. TRUE/FALSE QUESTIONS: Use questionType "true_false" for true/false questions. Set correctAnswer to true or false.\n' +
            '7. OUTPUT INTEGRITY: If any rule cannot be satisfied, fail explicitly by adding to "invalidQuestions" rather than generating incorrect output. NO DUPLICATION of options in questionText and options array.\n\n' +
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
      console.error('Failed to parse JSON. Raw response:', responseText.substring(0, 500))
      throw new Error(`Invalid JSON response from LLM: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`)
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
    
    // Post-process questions to convert option labels and clean up
    const processedQuestions = postProcessQuestions(validated.questions)
    
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
