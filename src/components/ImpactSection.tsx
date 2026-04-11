import { GraduationCap, School, Lightbulb, Users } from "lucide-react";

const cards = [
  {
    icon: GraduationCap,
    title: "Поддержка учеников",
    text: "Помогаем талантливым ребятам раскрыть свой потенциал через стипендии и образовательные программы",
  },
  {
    icon: School,
    title: "Развитие лицея",
    text: "Инвестируем в инфраструктуру, оборудование и современные технологии обучения",
  },
  {
    icon: Lightbulb,
    title: "Помощь инициативам",
    text: "Поддерживаем проекты выпускников и учеников, направленные на улучшение образования",
  },
  {
    icon: Users,
    title: "Сообщество выпускников",
    text: "Объединяем выпускников разных лет для обмена опытом, наставничества и взаимопомощи",
  },
];

const ImpactSection = () => {
  return (
    <section id="impact" className="py-24 md:py-32">
      <div className="container">
        <div className="text-center mb-16">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">Почему это важно</p>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">Направления нашей работы</h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {cards.map((card, i) => (
            <div
              key={card.title}
              className={`card-elevated bg-card rounded-3xl p-7 border border-border/50 fade-in-up fade-in-up-delay-${i + 1}`}
            >
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
                <card.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg text-foreground mb-2">{card.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{card.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ImpactSection;
