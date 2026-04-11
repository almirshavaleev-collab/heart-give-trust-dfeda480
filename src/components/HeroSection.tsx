import { Heart, ShieldCheck, BarChart3, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

const trustItems = [
  { icon: ShieldCheck, text: "Официально зарегистрированный фонд" },
  { icon: BarChart3, text: "Прозрачная отчётность" },
  { icon: Lock, text: "Безопасные пожертвования (скоро через ЮKassa)" },
];

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center hero-bg overflow-hidden pt-16">
      {/* Decorative shapes */}
      <div className="absolute top-20 right-10 w-72 h-72 rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute bottom-20 left-10 w-96 h-96 rounded-full bg-accent/5 blur-3xl" />

      <div className="container relative z-10 text-center py-20 md:py-32">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/8 border border-primary/10 text-sm text-primary font-medium mb-8 fade-in-up">
          <Heart className="w-4 h-4 fill-primary/30" />
          Благотворительный фонд
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-foreground max-w-4xl mx-auto leading-[1.1] fade-in-up fade-in-up-delay-1">
          Поддержите будущее выпускников лицея
        </h1>

        <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed fade-in-up fade-in-up-delay-2">
          Ваш вклад помогает развивать образовательные инициативы, поддерживать учеников и сохранять сильное сообщество
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10 fade-in-up fade-in-up-delay-3">
          <Button variant="hero" size="xl" asChild>
            <a href="#donate">
              <Heart className="w-5 h-5" />
              Помочь сейчас
            </a>
          </Button>
          <Button variant="hero-outline" size="xl" asChild>
            <a href="#details">Посмотреть реквизиты</a>
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6 mt-12 fade-in-up fade-in-up-delay-4">
          {trustItems.map((item) => (
            <div key={item.text} className="flex items-center gap-2 text-sm text-muted-foreground">
              <item.icon className="w-4 h-4 text-primary/70" />
              {item.text}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
