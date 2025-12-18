'use server';

/**
 * @fileOverview Personalized learning path generation flow.
 *
 * This file defines a Genkit flow that generates a personalized learning path
 * based on user-provided interests, experience level, and career goals.
 *
 * - generatePersonalizedLearningPath - The main function to trigger the flow.
 * - PersonalizedLearningPathInput - The input type for the flow.
 * - PersonalizedLearningPathOutput - The output type for the flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PersonalizedLearningPathInputSchema = z.object({
  interests: z
    .string()
    .describe("The student's interests, e.g., 'artificial intelligence, cloud computing'."),
  experienceLevel: z
    .enum(['beginner', 'intermediate', 'advanced'])
    .describe('The experience level of the student.'),
  careerGoals: z
    .string()
    .describe("The student's career goals, e.g., 'become a machine learning engineer'."),
  language: z
    .string()
    .describe("The language in which to generate the learning path, e.g., 'English' or 'Arabic'."),
});

export type PersonalizedLearningPathInput = z.infer<
  typeof PersonalizedLearningPathInputSchema
>;

const PersonalizedLearningPathOutputSchema = z.object({
  title: z
    .string()
    .describe('A creative and engaging title for the personalized learning path. For example: "The AI Maverick\'s Journey to Cloud Mastery".'),
  description: z
    .string()
    .describe('A detailed, well-formatted, step-by-step personalized learning path tailored to the student. Include specific courses and projects. Use markdown for formatting.'),
});

export type PersonalizedLearningPathOutput = z.infer<
  typeof PersonalizedLearningPathOutputSchema
>;

export async function generatePersonalizedLearningPath(
  input: PersonalizedLearningPathInput
): Promise<PersonalizedLearningPathOutput> {
  return personalizedLearningPathFlow(input);
}

const prompt = ai.definePrompt({
  name: 'personalizedLearningPathPrompt',
  input: {schema: PersonalizedLearningPathInputSchema},
  output: {schema: PersonalizedLearningPathOutputSchema},
  prompt: `You are an AI learning path generator for a platform called CloudAI Academy. You will take a student's interests, experience level, and career goals and generate a personalized learning path for them.

Generate the entire response in {{{language}}}.

Interests: {{{interests}}}
Experience Level: {{{experienceLevel}}}
Career Goals: {{{careerGoals}}}

Generate a learning path that is tailored to the student's needs and goals. The path should have a catchy title and a detailed description that includes specific courses and projects that the student should complete. The description should be well-formatted using markdown.
`,
});

const personalizedLearningPathFlow = ai.defineFlow(
  {
    name: 'personalizedLearningPathFlow',
    inputSchema: PersonalizedLearningPathInputSchema,
    outputSchema: PersonalizedLearningPathOutputSchema,
  },
  async (
    input: PersonalizedLearningPathInput
  ): Promise<PersonalizedLearningPathOutput> => {
    const {output} = await prompt(input);
    return output!;
  }
);
