"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    id: 1,
    question: "What is Apple TV+?",
    answer:
      "Apple TV+ is a streaming service from Apple. It features exclusive Apple Original shows and movies from some of the industry's top talent, with new premieres arriving each month. Browse all of the available content on Apple TV+ inside the Apple TV app on the Apple TV+ tab or here on tv.apple.com.",
  },
  {
    id: 2,
    question: "How much does Apple TV+ cost?",
    answer:
      "Pricing might vary depending on the offer you choose. (1) If you buy an Apple device, Apple TV+ is included free for 3 months. (2) A monthly subscription is just $9.99 per month after a free seven-day trial. (3) Apple TV+ is included in Apple One, which bundles up to five other Apple services into a single monthly subscription. (4) The Apple Music Student Plan comes with a free subscription to Apple TV+.",
  },
  {
    id: 3,
    question: "Can I get Apple TV+ for free?",
    answer:
      "There are a few ways to try Apple TV+ for free. First, try 7 days of Apple TV+ for free by starting a trial in the Apple TV app on your iPhone, iPad, Apple TV 4K or HD, or on any streaming device. If you've recently purchased Apple hardware that includes a 12-month, 6-month, or 3-month or other complimentary free trial of Apple TV+, this offer will automatically appear in the Apple TV app when signed in to the Apple Account associated with your recent hardware purchase.",
  },
  {
    id: 4,
    question: "Where can I watch Apple TV+?",
    answer:
      "Apple TV+ is an exclusive streaming subscription available in the Apple TV app. You can find Apple TV app on many of your favorite Apple devices. Plus, find the app on many smart TVs, streaming devices, game consoles, and some select cable boxes.",
  },
  {
    id: 5,
    question: "What shows and movies can I watch on Apple TV+?",
    answer:
      "With Apple TV+, you can watch Apple Original shows and movies made exclusively for Apple. New releases are added each month that you can browse in the Apple TV app or on tv.apple.com. You'll find hits like the Emmy-winning show Ted Lasso, critically acclaimed series The Morning Show, and dark comedies like Bad Sisters. Apple TV+ also has popular shows like Severance, Slow Horses, and For All Mankind, as well as films like Academy Award winner for Best Picture CODA and hits like Greyhound, Swan Song, Wolfwalkers, and more.",
  },
  {
    id: 6,
    question: "Can I share Apple TV+ with my family?",
    answer:
      "Yes. Apple TV+ lets you share your subscription with up to five family members.",
  },
];

export default function FAQSection() {
  return (
    <section className="py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-4xl font-bold text-white mb-12 text-center">
          Questions? Answers.
        </h2>

        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq) => (
            <AccordionItem
              key={faq.id}
              value={`item-${faq.id}`}
              className="border-b-gray-700"
            >
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center">
                  <h3 className="text-white font-semibold text-lg text-left">
                    {faq.question}
                  </h3>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-gray-300 leading-relaxed">{faq.answer}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
