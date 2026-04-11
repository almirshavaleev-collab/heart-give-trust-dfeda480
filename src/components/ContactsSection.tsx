import { MapPin, Phone, Mail } from "lucide-react";

const ContactsSection = () => (
  <section id="contacts" className="py-24 md:py-32">
    <div className="container max-w-3xl">
      <div className="text-center mb-16">
        <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">Связь</p>
        <h2 className="text-3xl md:text-4xl font-bold text-foreground">Контакты</h2>
      </div>

      <div className="grid sm:grid-cols-3 gap-6 mb-10">
        <div className="bg-card rounded-2xl border border-border/50 p-6 text-center card-elevated">
          <MapPin className="w-6 h-6 text-primary mx-auto mb-3" />
          <p className="text-xs text-muted-foreground mb-1">Адрес</p>
          <p className="text-sm font-medium text-foreground">г. Альметьевск, ул. Ризы Фахретдина, 67</p>
        </div>
        <div className="bg-card rounded-2xl border border-border/50 p-6 text-center card-elevated">
          <Phone className="w-6 h-6 text-primary mx-auto mb-3" />
          <p className="text-xs text-muted-foreground mb-1">Телефон</p>
          <a href="tel:+78553370480" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
            +7 (855) 337-04-80
          </a>
        </div>
        <div className="bg-card rounded-2xl border border-border/50 p-6 text-center card-elevated">
          <Mail className="w-6 h-6 text-primary mx-auto mb-3" />
          <p className="text-xs text-muted-foreground mb-1">Email</p>
          <a href="mailto:licey-1.alm@tatar.ru" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
            licey-1.alm@tatar.ru
          </a>
        </div>
      </div>

      {/* Map placeholder */}
      <div className="bg-muted rounded-3xl h-64 flex items-center justify-center border border-border/50">
        <p className="text-muted-foreground text-sm">Карта будет добавлена позже</p>
      </div>
    </div>
  </section>
);

export default ContactsSection;
