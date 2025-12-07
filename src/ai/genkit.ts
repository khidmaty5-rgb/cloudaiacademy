import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

const AI_AVAILABLE = !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);

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
