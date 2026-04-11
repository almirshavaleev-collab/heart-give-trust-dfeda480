import { useEffect, useRef, useState } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroBg from "@/assets/hero-crowd.jpg";

const stats = [
  { value: 9, suffix: "+", label: "лет работы" },
  { value: 500, suffix: "+", label: "выпускников" },
  { value: 30, suffix: "+", label: "инициатив" },
];

const AnimatedCounter = ({ target, suffix }: { target: number; suffix: string }) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          let start = 0;
          const step = Math.max(1, Math.floor(target / 40));
          const interval = setInterval(() => {
            start += step;
            if (start >= target) {
              setCount(target);
              clearInterval(interval);
            } else {
              setCount(start);
            }
          }, 30);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return (
    <div ref={ref} className="text-center">
      <div className="text-3xl md:text-4xl font-bold text-gradient counter-animate">
        {count}{suffix}
      </div>
      <div className="text-sm text-muted-foreground mt-1">{stats.find(s => s.value === target)?.label}</div>
    </div>
  );
};

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0">
        <img
          src={heroBg}
          alt="Встреча выпускников лицея"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/90 via-background/70 to-background" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/60 to-transparent" />
      </div>

      {/* Glow accents */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/5 blur-[120px]" />
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 rounded-full bg-ring/5 blur-[100px]" />

      <div className="container relative z-10 text-center py-32 md:py-40">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card text-sm text-primary font-medium mb-8 fade-in-up">
          <Heart className="w-4 h-4 fill-primary/30" />
          Благотворительный фонд
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight max-w-4xl mx-auto leading-[1.1] fade-in-up fade-in-up-delay-1">
          Фонд выпускников{" "}
          <span className="text-gradient">лицея</span>
        </h1>

        <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed fade-in-up fade-in-up-delay-2">
          Сообщество, которое продолжает поддерживать и развивать лицей
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10 fade-in-up fade-in-up-delay-3">
          <Button variant="hero" size="xl" asChild>
            <a href="#donate">
              <Heart className="w-5 h-5" />
              Поддержать фонд
            </a>
          </Button>
          <Button variant="hero-outline" size="xl" asChild>
            <a href="#details">Реквизиты</a>
          </Button>
        </div>

        {/* Floating stats */}
        <div className="grid grid-cols-3 gap-6 max-w-lg mx-auto mt-16 fade-in-up fade-in-up-delay-4">
          {stats.map((stat) => (
            <AnimatedCounter key={stat.label} target={stat.value} suffix={stat.suffix} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
