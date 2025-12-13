"use client";

import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useLang } from '@/components/i18n/lang';
import { useDoc, useMemoFirebase } from '@/firebase';
import { getFirestore, doc } from 'firebase/firestore';

export default function Testimonials() {
  const { lang } = useLang();
  const firestore = getFirestore();
  const settingsDocRef = useMemoFirebase(() => doc(firestore, 'settings', 'ui'), [firestore]);
  const { data: ui } = useDoc<any>(settingsDocRef);
  const showTestimonials = ui?.showTestimonials !== false; // default: show

  if (!showTestimonials) return null;
  const heading = lang === 'ar' ? 'قصص نجاح الطلاب' : 'Student Success Stories';
  const sub = lang === 'ar' ? 'اقرأ شهادات خريجينا الذين غيّروا مسارهم المهني.' : 'Hear from our graduates who transformed their careers.';
  const testimonials =
    lang === 'ar'
      ? [
          {
            quote:
              'دورة AWS في CloudAI Academy غيّرت مسيرتي تمامًا. انتقلت من مطوّر مبتدئ إلى مهندس سحابة خلال 9 أشهر فقط!',
            author: 'Jessica Smith',
            title: 'مهندس سحابة في TechCorp',
            avatarFallback: 'JS',
            avatarId: 'avatar-jessica',
          },
          {
            quote:
              'كانت المشاريع العملية والإرشاد الذي تلقيته لا يقدّر بثمن. حصلت على وظيفتي المثالية كمهندس تعلم آلي قبل حتى إكمال الدورة.',
            author: 'Michael Rodriguez',
            title: 'مهندس تعلم آلي في DataAI',
            avatarFallback: 'MR',
            avatarId: 'avatar-michael',
          },
          {
            quote:
              'المنهج متوافق تمامًا مع احتياجات السوق. تمكنت من اجتياز شهادة Azure من المحاولة الأولى بفضل CloudAI Academy.',
            author: 'Sarah Johnson',
            title: 'مطوّر حلول سحابية',
            avatarFallback: 'SJ',
            avatarId: 'avatar-sarah',
          },
        ]
      : [
          {
            quote:
              'The AWS course at CloudAI Academy completely transformed my career. I went from a junior developer to a cloud architect in just 9 months!',
            author: 'Jessica Smith',
            title: 'Cloud Architect at TechCorp',
            avatarFallback: 'JS',
            avatarId: 'avatar-jessica',
          },
          {
            quote:
              'The hands-on projects and mentorship I received were invaluable. I landed my dream job as an ML engineer before even completing the course.',
            author: 'Michael Rodriguez',
            title: 'ML Engineer at DataAI',
            avatarFallback: 'MR',
            avatarId: 'avatar-michael',
          },
          {
            quote:
              'The curriculum is perfectly aligned with industry needs. I was able to pass my Azure certification on the first attempt thanks to CloudAI Academy.',
            author: 'Sarah Johnson',
            title: 'Cloud Solutions Developer',
            avatarFallback: 'SJ',
            avatarId: 'avatar-sarah',
          },
        ];
  return (
    <section id="testimonials" className="py-20 md:py-28 bg-background">
      <div className="container">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="font-headline text-3xl md:text-4xl font-bold">
            {heading}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            {sub}
          </p>
        </div>
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {testimonials.map((testimonial) => {
            const avatarImage = PlaceHolderImages.find(
              (img) => img.id === testimonial.avatarId
            );
            return (
              <Card
                key={testimonial.author}
                className="p-6 relative border-l-4 border-accent"
              >
                <div className="absolute top-4 left-6 text-accent/10 text-8xl font-serif font-bold -z-10">
                  “
                </div>
                <CardContent className="p-0 z-10 relative">
                  <p className="italic text-foreground mb-6">
                    {testimonial.quote}
                  </p>
                  <div className="flex items-center gap-4">
                    <Avatar>
                      {avatarImage && (
                        <AvatarImage
                          src={avatarImage.imageUrl}
                          alt={testimonial.author}
                          data-ai-hint={avatarImage.imageHint}
                        />
                      )}
                      <AvatarFallback>
                        {testimonial.avatarFallback}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{testimonial.author}</p>
                      <p className="text-sm text-muted-foreground">
                        {testimonial.title}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
