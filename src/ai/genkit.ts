import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

// Provider execution is disabled for the free-plan deployment, even with an old key.
// Re-enabling requires server authorization, rate limits and an approved budget.
const AI_AVAILABLE = false;

export const ai = AI_AVAILABLE
  ? genkit({
      plugins: [googleAI()],
      model: 'googleai/gemini-2.5-flash',
    })
  : {
      definePrompt: (_cfg: any) => {
        return async () => {
          throw new Error('AI_DISABLED');
        };
      },
      defineFlow: (_opts: any, impl: any) => impl,
    };

export { AI_AVAILABLE };
