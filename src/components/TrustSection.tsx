import { ShieldCheck, Eye, FileText, Phone } from "lucide-react";

const items = [
  { icon: ShieldCheck, title: "Официальная регистрация", text: "Фонд зарегистрирован в Минюсте РФ с 2016 года" },
  { icon: Eye, title: "Прозрачность", text: "Публикуем отчёты о расходовании средств" },
  { icon: FileText, title: "Реальные реквизиты", text: "Все банковские данные доступны на сайте" },
  { icon: Phone, title: "Открытость контактов", text: "Связаться с нами можно по телефону и email" },
];

const TrustSection = () => (
  <section className="py-24 md:py-32 bg-muted/40">
    <div className="container">
      <div className="text-center mb-16">
        <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">Доверие и прозрачность</p>
        <h2 className="text-3xl md:text-4xl font-bold text-foreground">Почему нам доверяют</h2>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {items.map((item) => (
          <div key={item.title} className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <item.icon className="w-7 h-7 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">{item.title}</h3>
            <p className="text-sm text-muted-foreground">{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default TrustSection;
