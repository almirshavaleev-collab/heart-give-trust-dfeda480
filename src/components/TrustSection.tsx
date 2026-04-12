import { ShieldCheck, Eye, FileText, Phone } from "lucide-react";

const items = [
  { icon: ShieldCheck, title: "Официальная регистрация", text: "Фонд зарегистрирован в Минюсте РФ с 2016 года" },
  { icon: Eye, title: "Прозрачность", text: "Публикуем отчёты о расходовании средств" },
  { icon: FileText, title: "Реальные реквизиты", text: "Все банковские данные доступны на сайте" },
  { icon: Phone, title: "Открытость контактов", text: "Связаться с нами можно по телефону и email" },
];

const TrustSection = () => (
  <section className="py-24 md:py-32">
    <div className="container">
      <div className="text-center mb-16">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border bg-background text-xs text-muted-foreground font-medium mb-6">
          <ShieldCheck className="w-3.5 h-3.5 text-foreground" />
          Официально зарегистрированная организация
        </div>
        <h2 className="text-3xl md:text-4xl font-bold text-foreground">Доверие и прозрачность</h2>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {items.map((item) => (
          <div key={item.title} className="card-light p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
              <item.icon className="w-7 h-7 text-foreground" />
            </div>
            <h3 className="font-semibold mb-1 text-foreground">{item.title}</h3>
            <p className="text-sm text-muted-foreground">{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default TrustSection;
