import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const legalDocs = [
  {
    id: "privacy",
    title: "Политика конфиденциальности",
    content: `Фонд «Выпускники Лицея «ЛИГА» (далее — Фонд) обрабатывает персональные данные в соответствии с Федеральным законом №152-ФЗ «О персональных данных». Мы собираем только те данные, которые необходимы для обработки пожертвований: имя, телефон, email. Данные не передаются третьим лицам, за исключением случаев, предусмотренных законодательством РФ. Мы принимаем все необходимые меры для защиты ваших персональных данных от несанкционированного доступа.`,
  },
  {
    id: "terms",
    title: "Пользовательское соглашение",
    content: `Настоящее Пользовательское соглашение регулирует порядок использования сайта Фонда. Пожертвования являются добровольными. Фонд обязуется использовать полученные средства исключительно в уставных целях: поддержка учеников, развитие образовательных программ и инициатив сообщества выпускников. Фонд публикует отчёты о расходовании средств.`,
  },
  {
    id: "refund",
    title: "Возврат средств",
    content: `Возврат пожертвования возможен в течение 10 рабочих дней с момента перевода. Для оформления возврата свяжитесь с нами по email: ilyastgrv@gmail.com или по телефону: +7 (937) 299-31-51. Укажите дату, сумму перевода и реквизиты для возврата. Возврат осуществляется тем же способом, которым было сделано пожертвование.`,
  },
  {
    id: "personal-data",
    title: "Согласие на обработку персональных данных",
    content: `Нажимая кнопку «Поддержать» и отмечая чекбокс согласия, вы даёте своё добровольное согласие на обработку ваших персональных данных (имя, телефон, email) Фондом «Выпускники Лицея «ЛИГА» в целях обработки пожертвования и связи с вами. Вы можете отозвать согласие в любой момент, направив письмо на ilyastgrv@gmail.com.`,
  },
];

const LegalSection = () => (
  <section id="legal" className="py-24 md:py-32">
    <div className="container max-w-2xl">
      <div className="text-center mb-16">
        <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">Документы</p>
        <h2 className="text-3xl md:text-4xl font-bold">Правовая <span className="text-gradient">информация</span></h2>
      </div>

      <Accordion type="single" collapsible className="space-y-3">
        {legalDocs.map((doc) => (
          <AccordionItem
            key={doc.id}
            value={doc.id}
            className="glass-card rounded-2xl px-6 overflow-hidden border-0"
          >
            <AccordionTrigger className="text-left font-medium hover:no-underline py-5">
              {doc.title}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground pb-5 leading-relaxed text-sm">
              {doc.content}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  </section>
);

export default LegalSection;
