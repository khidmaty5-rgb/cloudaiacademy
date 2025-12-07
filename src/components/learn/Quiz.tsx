'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { generateQuiz, Question } from '@/ai/flows/quiz-generator';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type QuizProps = {
  lessonContent: string;
};

export default function Quiz({ lessonContent }: QuizProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);

  const handleStartQuiz = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await generateQuiz({ lessonContent });
      setQuestions(result.questions);
    } catch (err) {
      setError('Failed to generate quiz. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerSelect = (questionIndex: number, optionIndex: number) => {
    setSelectedAnswers((prev) => ({ ...prev, [questionIndex]: optionIndex }));
  };

  const handleSubmit = () => {
    let correctAnswers = 0;
    questions.forEach((q, index) => {
      if (selectedAnswers[index] === q.correctOption) {
        correctAnswers++;
      }
    });
    setScore(correctAnswers);
    setIsSubmitted(true);
  };
  
  const handleRestart = () => {
    setQuestions([]);
    setSelectedAnswers({});
    setIsSubmitted(false);
    setCurrentQuestionIndex(0);
    setScore(0);
  }

  if (questions.length === 0) {
    return (
      <div className="text-center p-8">
        {isLoading ? (
          <div>
            <p className="flex justify-center items-center gap-2 text-muted-foreground"><Sparkles className="animate-spin text-accent" />Generating your quiz...</p>
            <Skeleton className="h-32 w-full mt-4" />
          </div>
        ) : (
          <div>
            <h3 className="text-lg font-semibold mb-4">Ready to test your knowledge?</h3>
            <Button onClick={handleStartQuiz}>Start Quiz</Button>
            {error && <p className="text-destructive mt-4">{error}</p>}
          </div>
        )}
      </div>
    );
  }

  if (isSubmitted) {
    const percentage = Math.round((score / questions.length) * 100);
    return (
        <div className="p-4 space-y-6">
            <Card className="text-center p-6">
                <h2 className="text-2xl font-bold">Quiz Complete!</h2>
                <p className="text-4xl font-bold text-accent my-4">{percentage}%</p>
                <p className="text-muted-foreground">You answered {score} out of {questions.length} questions correctly.</p>
                <Button onClick={handleRestart} className="mt-6">Try Again</Button>
            </Card>
            <div className="space-y-4">
                <h3 className="font-bold text-lg">Review Your Answers</h3>
                {questions.map((q, qIndex) => (
                    <Card key={qIndex} className={cn(
                        "p-4 border-l-4",
                        selectedAnswers[qIndex] === q.correctOption ? 'border-green-500' : 'border-destructive'
                    )}>
                        <p className="font-semibold">{qIndex + 1}. {q.questionText}</p>
                        <div className="mt-2 text-sm space-y-2">
                           {q.options.map((option, oIndex) => {
                                const isCorrect = oIndex === q.correctOption;
                                const isSelected = oIndex === selectedAnswers[qIndex];
                               return (
                                <div key={oIndex} className={cn(
                                    "flex items-center gap-2 p-2 rounded-md",
                                    isCorrect && 'bg-green-500/10',
                                    isSelected && !isCorrect && 'bg-destructive/10'
                                )}>
                                    {isCorrect ? <Check className="h-4 w-4 text-green-500" /> : (isSelected ? <X className="h-4 w-4 text-destructive" /> : <div className="w-4 h-4" />)}
                                    <span>{option}</span>
                                </div>
                               )
                           })}
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground p-2 bg-muted/50 rounded-md">{q.explanation}</p>
                    </Card>
                ))}
            </div>
      </div>
    )
  }

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="p-4 space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          Question {currentQuestionIndex + 1} of {questions.length}
        </p>
        <h3 className="font-semibold text-lg mt-1">{currentQuestion.questionText}</h3>
      </div>

      <RadioGroup
        onValueChange={(value) => handleAnswerSelect(currentQuestionIndex, parseInt(value))}
        value={selectedAnswers[currentQuestionIndex]?.toString()}
      >
        <div className="space-y-3">
          {currentQuestion.options.map((option, index) => (
            <Label
              key={index}
              htmlFor={`q${currentQuestionIndex}-o${index}`}
              className="flex items-center gap-3 p-4 rounded-lg border hover:border-accent has-[:checked]:border-accent has-[:checked]:bg-accent/10 transition-colors"
            >
              <RadioGroupItem value={index.toString()} id={`q${currentQuestionIndex}-o${index}`} />
              <span>{option}</span>
            </Label>
          ))}
        </div>
      </RadioGroup>

      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          onClick={() => setCurrentQuestionIndex((prev) => prev - 1)}
          disabled={currentQuestionIndex === 0}
        >
          Previous
        </Button>
        {currentQuestionIndex === questions.length - 1 ? (
          <Button onClick={handleSubmit} disabled={selectedAnswers[currentQuestionIndex] === undefined}>
            Submit
          </Button>
        ) : (
          <Button
            onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
            disabled={selectedAnswers[currentQuestionIndex] === undefined}
          >
            Next
          </Button>
        )}
      </div>
    </div>
  );
}
