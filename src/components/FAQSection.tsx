import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  {
    q: "Как помочь фонду?",
    a: "Вы можете сделать пожертвование через форму на сайте или перевести средства по банковским реквизитам фонда. Любая сумма важна и помогает нам продолжать нашу работу.",
  },
  {
    q: "Можно ли перевести по реквизитам?",
    a: "Да, все реквизиты фонда указаны на нашем сайте в разделе «Реквизиты». Вы можете перевести средства через любой банк или мобильное приложение.",
  },
  {
    q: "Когда появится онлайн-оплата?",
    a: "Мы работаем над подключением онлайн-оплаты через ЮKassa. Это позволит делать пожертвования картой прямо на сайте. Следите за обновлениями!",
  },
  {
    q: "Куда идут средства?",
    a: "Все средства направляются на поддержку учеников лицея, развитие образовательных программ, инфраструктуру и инициативы сообщества выпускников. Мы публикуем отчёты о расходовании.",
  },
];

const FAQSection = () => (
  <section id="faq" className="py-24 md:py-32 bg-muted/30">
    <div className="container max-w-2xl">
      <div className="text-center mb-16">
        <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">Ответы</p>
        <h2 className="text-3xl md:text-4xl font-bold text-foreground">Частые вопросы</h2>
      </div>

      <Accordion type="single" collapsible className="space-y-3">
        {faqs.map((faq, i) => (
          <AccordionItem
            key={i}
            value={`faq-${i}`}
            className="bg-card rounded-2xl border border-border/50 px-6 overflow-hidden"
          >
            <AccordionTrigger className="text-left font-medium text-foreground hover:no-underline py-5">
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
