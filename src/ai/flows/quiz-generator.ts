'use server';

// Retained as a safe compatibility boundary for older clients.
// No provider request or fabricated assessment is made in the free-plan deployment.
export type QuizInput = { lessonContent: string };
export type Question = {
  questionText: string;
  options: string[];
  correctOption: number;
  explanation: string;
};
export type QuizOutput = { questions: Question[] };
export async function generateQuiz(_input: QuizInput): Promise<QuizOutput> {
  void _input;
  throw new Error('QUIZ_UNAVAILABLE');
}
