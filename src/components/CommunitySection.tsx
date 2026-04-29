import { GraduationCap, Heart, Lightbulb } from "lucide-react";
import alumniDesktop from "@/assets/alumni-group-1200.webp";
import alumniMobile from "@/assets/alumni-group-700.webp";

const overlayCards = [
  { icon: GraduationCap, title: "Помогаем лицею", text: "Инвестируем в инфраструктуру и образовательные программы" },
  { icon: Heart, title: "Поддерживаем учеников", text: "Стипендии, наставничество и развитие талантов" },
  { icon: Lightbulb, title: "Развиваем инициативы", text: "Проекты выпускников для улучшения образования" },
];

const CommunitySection = () => (
  <section id="community" className="py-24 md:py-32 section-alt">
    <div className="container">
      <div className="text-center mb-16">
        <p className="text-sm font-semibold text-accent uppercase tracking-wider mb-3">Наше сообщество</p>
        <h2 className="text-3xl md:text-4xl font-bold text-foreground">
          Мы — сообщество выпускников
        </h2>
        <p className="mt-4 text-muted-foreground max-w-xl mx-auto leading-relaxed">
          Единство, поддержка и преемственность — мы объединяем выпускников разных лет для развития лицея и помощи ученикам
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-10 items-center">
        {/* Photo */}
        <div className="relative rounded-2xl overflow-hidden">
          <picture>
            <source media="(min-width: 641px)" srcSet={alumniDesktop} type="image/webp" />
            <source srcSet={alumniMobile} type="image/webp" />
            <img
              src={alumniMobile}
              alt="Выпускники лицея на встрече"
              width={1200}
              height={798}
              loading="lazy"
              decoding="async"
              className="w-full h-80 md:h-96 object-cover"
            />
          </picture>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-foreground/60 to-transparent p-6">
            <p className="text-sm text-background font-medium">Традиционная встреча выпускников</p>
          </div>
        </div>

        {/* Cards */}
        <div className="space-y-4">
          {overlayCards.map((card, i) => (
            <div
              key={card.title}
              className={`card-light p-6 fade-in-up fade-in-up-delay-${i + 1}`}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center shrink-0">
                  <card.icon className="w-6 h-6 text-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1 text-foreground">{card.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{card.text}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

export default CommunitySection;
