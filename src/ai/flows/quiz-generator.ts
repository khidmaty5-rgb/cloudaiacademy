'use server';
/**
 * @fileOverview AI-powered quiz generator for lessons, with safe local fallback
 * when an AI API key is not configured or the AI call fails.
 */

import { ai, AI_AVAILABLE } from '@/ai/genkit';
import { z } from 'zod';

const QuizInputSchema = z.object({
  lessonContent: z.string().describe('The content of the lesson to generate a quiz for.'),
});
export type QuizInput = z.infer<typeof QuizInputSchema>;

const QuestionSchema = z.object({
    questionText: z.string().describe("The text of the quiz question."),
    options: z.array(z.string()).describe("A list of 4 possible answers for the question."),
    correctOption: z.number().describe("The index of the correct option in the 'options' array."),
    explanation: z.string().describe("A brief explanation for why the correct answer is correct.")
});

const QuizOutputSchema = z.object({
  questions: z.array(QuestionSchema).describe('A list of 3-5 quiz questions.'),
});
export type QuizOutput = z.infer<typeof QuizOutputSchema>;
export type Question = z.infer<typeof QuestionSchema>;


export async function generateQuiz(input: QuizInput): Promise<QuizOutput> {
  // If AI is disabled, return a deterministic local quiz
  if (!AI_AVAILABLE) {
    return localFallbackQuiz(input.lessonContent);
  }
  try {
    return await generateQuizFlow(input);
  } catch (e) {
    // Any AI error falls back to a local quiz to avoid 500s
    return localFallbackQuiz(input.lessonContent);
  }
}

const prompt = ai.definePrompt({
  name: 'quizGeneratorPrompt',
  input: { schema: QuizInputSchema },
  output: { schema: QuizOutputSchema },
  prompt: `You are an AI assistant designed to create educational quizzes. Based on the provided lesson content, generate a multiple-choice quiz with 3 to 5 questions to test the user's understanding. For each question, provide 4 options, indicate the correct answer's index, and include a brief explanation for the correct answer.

Lesson Content:
{{{lessonContent}}}
`,
});

const generateQuizFlow = ai.defineFlow(
  {
    name: 'generateQuizFlow',
    inputSchema: QuizInputSchema,
    outputSchema: QuizOutputSchema,
  },
  async (input: QuizInput) => {
    const { output } = await prompt(input);
    return output!;
  }
);

// Local fallback to ensure UI works without AI keys
function localFallbackQuiz(lessonContent: string): QuizOutput {
  const snippet = (lessonContent || '').trim().slice(0, 120) || 'this lesson';
  return {
    questions: [
      {
        questionText: 'What is the main topic introduced in this lesson?',
        options: [
          'The key concept mentioned in the lesson',
          'A completely unrelated concept',
          'Advanced topic beyond the scope of the lesson',
          'A minor detail not covered',
        ],
        correctOption: 0,
        explanation: `Based on the provided content snippet: "${snippet}".`,
      },
      {
        questionText: 'Which option best reflects a correct statement about the lesson content?',
        options: [
          'A statement consistent with the lesson content',
          'A statement that contradicts the lesson content',
          'A vague statement with no relation to the content',
          'A statement about a different subject',
        ],
        correctOption: 0,
        explanation: 'The first option is crafted to align with the lesson material generally.',
      },
      {
        questionText: 'What should be your next step after reading this lesson?',
        options: [
          'Review and practice the demonstrated concept',
          'Ignore the content and move on',
          'Study an unrelated technology',
          'Memorize without understanding',
        ],
        correctOption: 0,
        explanation: 'Practicing the concept aligns with effective learning strategies.',
      },
    ],
  };
}
