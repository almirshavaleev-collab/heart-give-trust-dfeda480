import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Copy, Check } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

interface Row {
  label: string;
  value: string;
}

const orgDetails: Row[] = [
  { label: "Полное наименование", value: "ФОНД «ВЫПУСКНИКИ ЛИЦЕЯ-ИНТЕРНАТА №1 г. АЛЬМЕТЬЕВСКА»" },
  { label: "ИНН", value: "1644076378" },
  { label: "КПП", value: "164401001" },
  { label: "ОГРН", value: "1161690050741" },
  { label: "Юридический адрес", value: "423440, Республика Татарстан, Альметьевский район, пгт Нижняя Мактама, ул. Заводская, дом 12, кв. 37" },
  { label: "Фактический адрес", value: "423450, Республика Татарстан, г. Альметьевск, ул. Тельмана, дом 55а" },
];

const bankDetails: Row[] = [
  { label: "Банк", value: "Отделение «Банк Татарстан» №8610 ПАО СБЕРБАНК г. Казань" },
  { label: "Расчетный счет", value: "40703810462000000880" },
  { label: "Корреспондентский счет", value: "30101810600000000603" },
  { label: "БИК", value: "049205603" },
];

const contactDetails: Row[] = [
  { label: "Телефон", value: "+7 (8553) 440-604" },
  { label: "Email", value: "456004a@mail.ru" },
];

const CopyBtn = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground shrink-0"
      aria-label="Скопировать"
    >
      {copied ? <Check className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4" />}
    </button>
  );
};

const Section = ({ title, rows }: { title: string; rows: Row[] }) => (
  <section className="border border-border rounded-2xl bg-card overflow-hidden">
    <div className="px-6 py-4 border-b border-border bg-secondary/40">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
    </div>
    <dl className="divide-y divide-border">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-1 sm:grid-cols-[220px,1fr,auto] gap-2 sm:gap-4 px-6 py-4 items-start">
          <dt className="text-xs sm:text-sm text-muted-foreground">{r.label}</dt>
          <dd className="text-sm font-medium text-foreground break-words">{r.value}</dd>
          <div className="hidden sm:block"><CopyBtn text={r.value} /></div>
        </div>
      ))}
    </dl>
  </section>
);

const Requisites = () => (
  <div className="min-h-screen flex flex-col">
    <Header />
    <main className="flex-1 pt-24 pb-16">
      <div className="container max-w-3xl">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          На главную
        </Link>

        <header className="mb-10">
          <p className="text-xs font-semibold text-accent uppercase tracking-wider mb-2">
            Официальная информация
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            Реквизиты организации
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Благотворительный фонд «Выпускники Лицея «ЛИГА» — официально зарегистрированная
            некоммерческая организация. Ниже указаны полные реквизиты для перечислений
            и официальной переписки.
          </p>
        </header>

        <div className="space-y-6">
          <Section title="Сведения об организации" rows={orgDetails} />
          <Section title="Банковские реквизиты" rows={bankDetails} />
          <Section title="Контактные данные" rows={contactDetails} />
        </div>
      </div>
    </main>
    <Footer />
  </div>
);

export default Requisites;