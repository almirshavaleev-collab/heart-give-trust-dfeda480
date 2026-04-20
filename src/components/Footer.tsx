import { Link } from "react-router-dom";
import { ShieldCheck, Phone, Mail, MapPin } from "lucide-react";
import logoH from "@/assets/logo_h.svg";

type FooterLink = { label: string; to?: string; href?: string; external?: boolean };

const columns: { title: string; links: FooterLink[] }[] = [
  {
    title: "Сборы",
    links: [
      { label: "Все сборы", to: "/campaigns" },
      { label: "Завершенные", to: "/campaigns?status=completed" },
    ],
  },
  {
    title: "О фонде",
    links: [
      { label: "О фонде", href: "/#community" },
      { label: "Реквизиты", href: "/#details" },
      { label: "Документы", href: "/#legal" },
    ],
  },
  {
    title: "Помощь",
    links: [
      { label: "Как помочь", href: "/#donate" },
      { label: "Частые вопросы", href: "/#faq" },
    ],
  },
  {
    title: "Отчеты",
    links: [
      { label: "Ежемесячные", href: "/#legal" },
      { label: "Годовые", href: "/#legal" },
      { label: "Фото/видео отчеты", href: "/#legal" },
    ],
  },
];

const renderLink = (link: FooterLink) => {
  const className =
    "text-sm text-muted-foreground hover:text-foreground transition-colors";
  if (link.to) {
    return (
      <Link to={link.to} className={className}>
        {link.label}
      </Link>
    );
  }
  return (
    <a
      href={link.href}
      className={className}
      {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {link.label}
    </a>
  );
};

const PaymentBadge = ({ label }: { label: string }) => (
  <div className="h-7 px-3 flex items-center justify-center rounded-md border border-border bg-card text-[11px] font-semibold tracking-wide text-muted-foreground">
    {label}
  </div>
);

const Footer = () => (
  <footer className="border-t border-border bg-secondary/40">
    <div className="container py-14 md:py-16">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 lg:gap-10">
        {columns.map((col) => (
          <div key={col.title} className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-foreground mb-1">
              {col.title}
            </h3>
            {col.links.map((l) => (
              <div key={l.label}>{renderLink(l)}</div>
            ))}
          </div>
        ))}

        <div className="flex flex-col gap-3 col-span-2 md:col-span-3 lg:col-span-1">
          <h3 className="text-sm font-semibold text-foreground mb-1">Контакты</h3>
          <a
            href="tel:+78553370480"
            className="flex items-start gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Phone className="w-4 h-4 mt-0.5 shrink-0" />
            +7 (8553) 337-04-80
          </a>
          <a
            href="mailto:licey-1.alm@tatar.ru"
            className="flex items-start gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors break-all"
          >
            <Mail className="w-4 h-4 mt-0.5 shrink-0" />
            licey-1.alm@tatar.ru
          </a>
          <a
            href="https://yandex.ru/maps/?text=Альметьевск%2C%20ул.%20Ризы%20Фахретдина%2C%2067"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
            г. Альметьевск, ул. Ризы Фахретдина, 67
          </a>
        </div>
      </div>

      <div className="mt-12 pt-8 border-t border-border flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="flex items-start gap-3">
          <img src={logoH} alt="Фонд «Выпускники Лицея ЛИГА»" className="h-10 w-auto" />
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-semibold text-foreground">
              Благотворительный фонд «Выпускники Лицея «ЛИГА»
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-accent" />
              Официально зарегистрированная организация
            </p>
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} Фонд «Выпускники Лицея «ЛИГА»
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <PaymentBadge label="МИР" />
          <PaymentBadge label="VISA" />
          <PaymentBadge label="MasterCard" />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
        <Link to="/offer" className="hover:text-foreground transition-colors">
          Публичная оферта
        </Link>
        <Link to="/privacy-consent" className="hover:text-foreground transition-colors">
          Согласие на обработку персональных данных
        </Link>
      </div>
    </div>
  </footer>
);

export default Footer;
