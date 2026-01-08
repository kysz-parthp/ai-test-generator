# Troubleshooting Guide

## Common Errors and Solutions

### "Invalid question format received from LLM"

This error occurs when the AI cannot properly parse questions from your document. Here's how to fix it:

#### Possible Causes:

1. **Unclear question format** - Questions don't have clear structure
2. **Missing answers** - Questions don't have clearly marked correct answers
3. **Complex formatting** - Document has unusual formatting that confuses the parser
4. **Mixed languages** - Document contains multiple languages (the AI works best with English)

#### Solutions:

1. **Check your document format:**
   ```
   ✅ Good format:
   Question 1: What is 2+2?
   A) 3
   B) 4
   C) 5
   D) 6
   Answer: B

   ❌ Bad format:
   Q1 2+2? A3 B4 C5 D6 AnsB
   ```

2. **Ensure answers are clearly marked:**
   - Use words like "Answer:", "Correct:", "Key:", or "Solution:"
   - Make sure the answer matches one of the options

3. **For multiple answer questions:**
   ```
   Question: Which are prime numbers? (Select all)
   A) 2
   B) 4
   C) 5
   D) 7
   Correct Answers: A, C, D
   ```

4. **For fill-in-the-blank:**
   ```
   Question: The capital of France is _____.
   Answer: Paris
   ```

5. **Try these fixes:**
   - Simplify the document format
   - Ensure all questions have clear answers
   - Remove any special characters or formatting
   - Convert PDF to TXT if possible
   - Ensure document is in English (or clearly structured)

### "No questions found in the document"

This means the AI couldn't identify any questions in your document.

**Solutions:**
- Ensure your document actually contains questions
- Use clear question markers (Question 1, Q1, etc.)
- Make sure questions are formatted clearly
- Check that the document text was extracted correctly

### "Failed to parse questions"

This is a general parsing error.

**Solutions:**
- Try uploading the file again
- Check your internet connection
- Ensure your OpenAI API key is valid
- Try a different file format (TXT instead of PDF)

## Best Practices for Document Format

### Recommended Format:

```
Test Title

Question 1: What is the capital of France?
A) London
B) Berlin
C) Paris
D) Madrid
Answer: C

Question 2: Which numbers are even? (Select all that apply)
A) 2
B) 3
C) 4
D) 5
Correct Answers: A, C

Question 3: The largest planet in our solar system is _____.
Answer: Jupiter
```

### Tips:

1. **Use clear labels:** Question 1, Question 2, etc.
2. **Label options:** A), B), C), D) or 1), 2), 3), 4)
3. **Mark answers clearly:** Answer:, Correct:, Key:, etc.
4. **One question per section:** Separate questions clearly
5. **Consistent formatting:** Use the same format throughout

## Still Having Issues?

If you continue to experience errors:

1. **Check the server logs** - Look for detailed error messages
2. **Try a simpler document** - Test with the example-test.txt file first
3. **Verify file format** - Ensure TXT, DOCX, or PDF
4. **Check file size** - Keep files under 10MB
5. **Contact support** - Share the error message and document format

## Error Improvements

The system now includes:
- ✅ Better error messages
- ✅ Automatic retry on parsing errors
- ✅ More detailed validation
- ✅ Helpful error descriptions
- ✅ Logging for debugging










