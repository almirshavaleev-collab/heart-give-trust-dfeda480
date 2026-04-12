import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  { q: "Как помочь фонду?", a: "Вы можете сделать пожертвование через форму на сайте или перевести средства по банковским реквизитам фонда. Любая сумма важна." },
  { q: "Можно ли перевести по реквизитам?", a: "Да, все реквизиты фонда указаны в разделе «Реквизиты». Вы можете перевести средства через любой банк или мобильное приложение." },
  { q: "Когда появится онлайн-оплата?", a: "Мы работаем над подключением онлайн-оплаты через ЮKassa. Это позволит делать пожертвования картой прямо на сайте." },
  { q: "Куда идут средства?", a: "Все средства направляются на поддержку учеников лицея, развитие образовательных программ и инициативы сообщества выпускников." },
];

const FAQSection = () => (
  <section id="faq" className="py-24 md:py-32">
    <div className="container max-w-2xl">
      <div className="text-center mb-16">
        <p className="text-sm font-semibold text-accent uppercase tracking-wider mb-3">Ответы</p>
        <h2 className="text-3xl md:text-4xl font-bold text-foreground">Частые вопросы</h2>
      </div>

      <Accordion type="single" collapsible className="space-y-3">
        {faqs.map((faq, i) => (
          <AccordionItem
            key={i}
            value={`faq-${i}`}
            className="card-light px-6 overflow-hidden border-0"
          >
            <AccordionTrigger className="text-left font-medium hover:no-underline py-5 text-foreground">
              {faq.q}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground pb-5 leading-relaxed">
              {faq.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  </section>
);

export default FAQSection;
