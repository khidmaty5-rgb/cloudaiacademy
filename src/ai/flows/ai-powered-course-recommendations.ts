'use server';
/**
 * @fileOverview AI-powered course recommendations based on learning history and career goals.
 *
 * - getCourseRecommendations - A function that generates course recommendations.
 * - CourseRecommendationsInput - The input type for the getCourseRecommendations function.
 * - CourseRecommendationsOutput - The return type for the getCourseRecommendations function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CourseRecommendationsInputSchema = z.object({
  learningHistory: z
    .string()
    .describe('The user\'s learning history of already enrolled courses. This is a comma separated list of course titles.'),
  careerGoals: z.string().describe('The career goals of the user.'),
  inDemandSkills: z.string().describe('The current in-demand skills for AI and cloud computing jobs')
});
export type CourseRecommendationsInput = z.infer<typeof CourseRecommendationsInputSchema>;

const CourseRecommendationsOutputSchema = z.object({
  courseRecommendations: z.array(z.string()).describe('A list of recommended courses. Do not recommend courses that are already in the learning history.'),
});
export type CourseRecommendationsOutput = z.infer<typeof CourseRecommendationsOutputSchema>;

export async function getCourseRecommendations(input: CourseRecommendationsInput): Promise<CourseRecommendationsOutput> {
  return getCourseRecommendationsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'courseRecommendationsPrompt',
  input: {schema: CourseRecommendationsInputSchema},
  output: {schema: CourseRecommendationsOutputSchema},
  prompt: `You are an AI assistant designed to provide personalized course recommendations based on a user's learning history, career goals, and current industry demands.\n\nLearning History: {{{learningHistory}}}\nCareer Goals: {{{careerGoals}}}\nIn-Demand Skills: {{{inDemandSkills}}}\n\nBased on this information, recommend a list of courses that would be most beneficial for the user. Do not recommend courses that the user is already enrolled in (from the Learning History). List only the course names, nothing else. Enclose the courses in a JSON array.\n`,
});

const getCourseRecommendationsFlow = ai.defineFlow(
  {
    name: 'getCourseRecommendationsFlow',
    inputSchema: CourseRecommendationsInputSchema,
    outputSchema: CourseRecommendationsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
