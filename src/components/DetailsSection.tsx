import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface DetailRow {
  label: string;
  value: string;
}

const orgDetails: DetailRow[] = [
  { label: "Полное наименование", value: "ФОНД «ВЫПУСКНИКИ ЛИЦЕЯ-ИНТЕРНАТА №1 г. АЛЬМЕТЬЕВСКА»" },
  { label: "ИНН", value: "1644076378" },
  { label: "КПП", value: "164401001" },
  { label: "ОГРН", value: "1161690050741" },
];

const bankDetails: DetailRow[] = [
  { label: "Расчетный счет", value: "40703810462000000880" },
  { label: "Корреспондентский счет", value: "30101810600000000603" },
  { label: "БИК", value: "049205603" },
  { label: "Банк", value: "Отделение «Банк Татарстан» №8610 ПАО СБЕРБАНК г. Казань" },
];

const addresses = [
  { label: "Юридический адрес", value: "423440, Республика Татарстан, Альметьевский район, пгт Нижняя Мактама, ул. Заводская, дом 12, кв. 37" },
  { label: "Фактический адрес", value: "423450, Республика Татарстан, г. Альметьевск, ул. Тельмана, дом 55а" },
];

const contacts: DetailRow[] = [
  { label: "Телефон", value: "+7 (8553) 440-604" },
  { label: "Email", value: "456004a@mail.ru" },
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
      className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
      aria-label="Скопировать"
    >
      {copied ? <Check className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4" />}
    </button>
  );
};

const DetailsSection = () => (
  <section id="details" className="py-24 md:py-32 section-alt">
    <div className="container max-w-3xl">
      <div className="text-center mb-16">
        <p className="text-sm font-semibold text-accent uppercase tracking-wider mb-3">Реквизиты организации</p>
        <h2 className="text-3xl md:text-4xl font-bold text-foreground">ФОНД «ВЫПУСКНИКИ ЛИЦЕЯ «ЛИГА»</h2>
      </div>

      <div className="space-y-8">
        {/* Реквизиты организации */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4">Реквизиты организации</h3>
          <div className="card-light overflow-hidden">
            <div className="divide-y divide-border">
              {orgDetails.map((row) => (
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
        </div>

        {/* Банковские реквизиты */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4">Банковские реквизиты</h3>
          <div className="card-light overflow-hidden">
            <div className="divide-y divide-border">
              {bankDetails.map((row) => (
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
        </div>

        {/* Контакты */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4">Контакты</h3>
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            {addresses.map((addr) => (
              <div key={addr.label} className="card-light p-5">
                <p className="text-xs text-muted-foreground mb-1">{addr.label}</p>
                <p className="text-sm leading-relaxed text-foreground">{addr.value}</p>
                <div className="mt-2 flex justify-end">
                  <CopyButton text={addr.value} />
                </div>
              </div>
            ))}
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {contacts.map((contact) => (
              <div key={contact.label} className="card-light p-5">
                <p className="text-xs text-muted-foreground mb-1">{contact.label}</p>
                <p className="text-sm font-medium text-foreground">{contact.value}</p>
                <div className="mt-2 flex justify-end">
                  <CopyButton text={contact.value} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default DetailsSection;
