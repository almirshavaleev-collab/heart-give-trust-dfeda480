import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface DetailRow {
  label: string;
  value: string;
}

const details: DetailRow[] = [
  { label: "Полное наименование", value: "ФОНД «ВЫПУСКНИКИ ЛИЦЕЯ-ИНТЕРНАТА №1 Г. АЛЬМЕТЬЕВСКА»" },
  { label: "ИНН", value: "1644076378" },
  { label: "КПП", value: "164401001" },
  { label: "Р/с", value: "40703810462000000880" },
  { label: "К/с", value: "30101810600000000603" },
  { label: "БИК", value: "049205603" },
  { label: "Банк", value: "Сбербанк, г. Казань" },
  { label: "ОГРН", value: "1161690050741" },
  { label: "Дата регистрации", value: "11.01.2016" },
];

const addresses = [
  { label: "Юридический адрес", value: "Республика Татарстан, Альметьевский район, пгт Нижняя Мактама, ул. Заводская, 12, кв. 37" },
  { label: "Фактический адрес", value: "г. Альметьевск, ул. Тельмана, 55а" },
];

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
      aria-label="Скопировать"
    >
      {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
    </button>
  );
};

const DetailsSection = () => (
  <section id="details" className="py-24 md:py-32">
    <div className="container max-w-3xl">
      <div className="text-center mb-16">
        <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">Банковские данные</p>
        <h2 className="text-3xl md:text-4xl font-bold text-foreground">Реквизиты фонда</h2>
        <p className="mt-3 text-muted-foreground">ФОНД «ВЫПУСКНИКИ ЛИЦЕЯ «ЛИГА»</p>
      </div>

      <div className="bg-card rounded-3xl border border-border/50 overflow-hidden card-elevated">
        <div className="divide-y divide-border/50">
          {details.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-4 px-6 py-4">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground mb-0.5">{row.label}</p>
                <p className="text-sm font-medium text-foreground break-all">{row.value}</p>
              </div>
              <CopyButton text={row.value} />
            </div>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mt-6">
        {addresses.map((addr) => (
          <div key={addr.label} className="bg-card rounded-2xl border border-border/50 p-5 card-elevated">
            <p className="text-xs text-muted-foreground mb-1">{addr.label}</p>
            <p className="text-sm text-foreground leading-relaxed">{addr.value}</p>
            <div className="mt-2 flex justify-end">
              <CopyButton text={addr.value} />
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default DetailsSection;
