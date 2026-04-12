import { MapPin, Phone, Mail } from "lucide-react";

const ContactsSection = () => (
  <section id="contacts" className="py-24 md:py-32 section-alt">
    <div className="container max-w-3xl">
      <div className="text-center mb-16">
        <p className="text-sm font-semibold text-accent uppercase tracking-wider mb-3">Связь</p>
        <h2 className="text-3xl md:text-4xl font-bold text-foreground">Контакты</h2>
      </div>

      <div className="grid sm:grid-cols-3 gap-6 mb-10">
        <div className="card-light p-6 text-center">
          <MapPin className="w-6 h-6 text-foreground mx-auto mb-3" />
          <p className="text-xs text-muted-foreground mb-1">Адрес</p>
          <p className="text-sm font-medium text-foreground">г. Альметьевск, ул. Ризы Фахретдина, 67</p>
        </div>
        <div className="card-light p-6 text-center">
          <Phone className="w-6 h-6 text-foreground mx-auto mb-3" />
          <p className="text-xs text-muted-foreground mb-1">Телефон</p>
          <a href="tel:+78553370480" className="text-sm font-medium text-foreground hover:text-accent transition-colors">
            +7 (855) 337-04-80
          </a>
        </div>
        <div className="card-light p-6 text-center">
          <Mail className="w-6 h-6 text-foreground mx-auto mb-3" />
          <p className="text-xs text-muted-foreground mb-1">Email</p>
          <a href="mailto:licey-1.alm@tatar.ru" className="text-sm font-medium text-foreground hover:text-accent transition-colors">
            licey-1.alm@tatar.ru
          </a>
        </div>
      </div>

      <div className="card-light h-64 flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Карта будет добавлена позже</p>
      </div>
    </div>
  </section>
);

export default ContactsSection;
