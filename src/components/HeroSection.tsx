import { useEffect, useRef, useState } from "react";
import { Heart, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroBg from "@/assets/hero-crowd.jpg";

const stats = [
  { value: 10, suffix: "+", label: "лет работы" },
  { value: 500, suffix: "+", label: "выпускников" },
  { value: 30, suffix: "+", label: "инициатив" },
];

const AnimatedCounter = ({ target, suffix, label }: { target: number; suffix: string; label: string }) => {
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
      <div className="text-5xl md:text-6xl font-bold tracking-tight text-foreground counter-animate">
        {count}{suffix}
      </div>
      <div className="text-sm text-muted-foreground/80 mt-3 font-medium">{label}</div>
    </div>
  );
};

const HeroSection = () => {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      {/* Soft background image + subtle gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-[hsl(216_25%_98%)] to-[hsl(216_25%_96%)]">
        <img
          src={heroBg}
          alt="Встреча выпускников лицея"
          className="w-full h-full object-cover opacity-[0.06]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-secondary/70" />
      </div>

      {/* Subtle accent glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-accent/[0.05] blur-[140px]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] rounded-[50%] bg-primary/[0.025] blur-[100px]" />

      <div className="container relative z-10 text-center py-32 md:py-40">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/60 bg-background/70 backdrop-blur-sm text-xs text-muted-foreground/90 font-medium mb-10 fade-in-up">
          <Heart className="w-3.5 h-3.5 text-accent/80" />
          Благотворительный фонд
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight max-w-[800px] mx-auto leading-[1.05] text-foreground fade-in-up fade-in-up-delay-1">
          «Лига» Фонд Выпускников
        </h1>

        <p className="mt-7 md:mt-8 text-lg md:text-xl text-muted-foreground max-w-[600px] mx-auto leading-relaxed fade-in-up fade-in-up-delay-2">
          Сообщество благодарных выпускников лицея
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mt-12 md:mt-14 fade-in-up fade-in-up-delay-3">
          <Button
            size="xl"
            asChild
            className="h-14 px-12 text-base shadow-md hover:shadow-xl hover:scale-[1.03] transition-all duration-300"
          >
            <a href="#donate">
              <Heart className="w-5 h-5" />
              Стать частью фонда
            </a>
          </Button>
          <Button variant="ghost" size="lg" asChild className="text-muted-foreground hover:text-foreground">
            <a href="#community">
              О фонде
              <ArrowRight className="w-4 h-4" />
            </a>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-8 max-w-lg mx-auto mt-24 md:mt-28 fade-in-up fade-in-up-delay-4">
          {stats.map((stat) => (
            <AnimatedCounter key={stat.label} target={stat.value} suffix={stat.suffix} label={stat.label} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
