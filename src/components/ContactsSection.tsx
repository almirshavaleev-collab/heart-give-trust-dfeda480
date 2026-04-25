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
          src="https://yandex.ru/map-widget/v1/?ll=52.297000%2C54.901300&z=17&pt=52.297000%2C54.901300%2Cpm2rdm&l=map"
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
