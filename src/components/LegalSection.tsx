import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
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
    content: `Пожертвования являются добровольными и безвозмездными. Возврат средств возможен в исключительных случаях: ошибка при платеже, двойное списание, техническая ошибка. Для оформления возврата свяжитесь с нами по email или телефону, указав дату и сумму платежа. Каждое обращение рассматривается индивидуально.`,
  },
  {
    id: "personal-data",
    title: "Согласие на обработку персональных данных",
    content: `Нажимая кнопку «Поддержать» и отмечая чекбокс согласия, вы даёте своё добровольное согласие на обработку ваших персональных данных (имя, телефон, email) Фондом «Выпускники Лицея «ЛИГА» в целях обработки пожертвования и связи с вами. Вы можете отозвать согласие в любой момент, направив письмо на ilyastgrv@gmail.com.`,
  },
];

const validIds = legalDocs.map((d) => d.id);

const LegalSection = () => {
  const { hash } = useLocation();
  const [openItem, setOpenItem] = useState<string | undefined>(undefined);

  useEffect(() => {
    const id = hash.replace("#", "");
    if (validIds.includes(id)) {
      setOpenItem(id);
      // Defer scroll until after accordion mounts/expands
      setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [hash]);

  return (
  <section id="legal" className="py-24 md:py-32 section-alt scroll-mt-24">
    <div className="container max-w-2xl">
      <div className="text-center mb-16">
        <p className="text-sm font-semibold text-accent uppercase tracking-wider mb-3">Документы</p>
        <h2 className="text-3xl md:text-4xl font-bold text-foreground">Правовая информация</h2>
      </div>

      <Accordion
        type="single"
        collapsible
        className="space-y-3"
        value={openItem}
        onValueChange={setOpenItem}
      >
        {legalDocs.map((doc) => (
          <AccordionItem
            key={doc.id}
            value={doc.id}
            id={doc.id}
            className="card-light px-6 overflow-hidden border-0"
          >
            <AccordionTrigger className="text-left font-medium hover:no-underline py-5 text-foreground">
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
};

export default LegalSection;
