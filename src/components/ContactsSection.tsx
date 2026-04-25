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

      <div className="rounded-xl overflow-hidden border border-border shadow-sm">
        <iframe
          title="Карта: г. Альметьевск, ул. Ризы Фахретдина, 67"
          src="https://yandex.ru/map-widget/v1/?text=%D0%B3.%20%D0%90%D0%BB%D1%8C%D0%BC%D0%B5%D1%82%D1%8C%D0%B5%D0%B2%D1%81%D0%BA%2C%20%D1%83%D0%BB.%20%D0%A0%D0%B8%D0%B7%D1%8B%20%D0%A4%D0%B0%D1%85%D1%80%D0%B5%D1%82%D0%B4%D0%B8%D0%BD%D0%B0%2C%2067&z=17"
          className="w-full h-[300px] md:h-[400px] block border-0"
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </div>
  </section>
);

export default ContactsSection;
