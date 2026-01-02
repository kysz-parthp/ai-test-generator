import OpenAI from 'openai'

type LLMProvider = 'openai' | 'grok' | 'groq'

/**
 * Creates an LLM client based on the configured provider.
 * Supports OpenAI, Grok (xAI), and Groq - all use the same OpenAI SDK interface.
 * 
 * Environment variables:
 * - LLM_PROVIDER: 'openai', 'grok', or 'groq' (defaults to 'openai')
 * - OPENAI_API_KEY: API key for OpenAI
 * - GROK_API_KEY: API key for Grok (xAI)
 * - GROQ_API_KEY: API key for Groq (FREE tier available)
 * - LLM_MODEL: Model name (defaults to provider-specific model)
 */
export function createLLMClient(): OpenAI {
  const provider = (process.env.LLM_PROVIDER || 'openai').toLowerCase() as LLMProvider

  if (provider === 'grok') {
    const apiKey = process.env.GROK_API_KEY || process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('GROK_API_KEY or OPENAI_API_KEY is not set')
    }
    return new OpenAI({
      apiKey,
      baseURL: 'https://api.x.ai/v1',
    })
  }

  if (provider === 'groq') {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      throw new Error('GROQ_API_KEY is not set. Get a free API key from https://console.groq.com')
    }
    return new OpenAI({
      apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    })
  }

  // Default to OpenAI
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set')
  }
  return new OpenAI({
    apiKey,
  })
}

/**
 * Gets the default model name for the configured provider.
 */
export function getDefaultModel(): string {
  const provider = (process.env.LLM_PROVIDER || 'openai').toLowerCase() as LLMProvider
  
  if (provider === 'grok') {
    return process.env.LLM_MODEL || 'grok-beta'
  }
  
  if (provider === 'groq') {
    // Groq free tier models: llama-3.3-70b-versatile, llama-3.1-8b-instant, mixtral-8x7b-32768, gemma2-9b-it
    return process.env.LLM_MODEL || 'llama-3.3-70b-versatile'
  }
  
  return process.env.LLM_MODEL || 'gpt-4-turbo-preview'
}

