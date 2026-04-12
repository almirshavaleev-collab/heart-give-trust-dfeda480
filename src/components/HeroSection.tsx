import { useEffect, useRef, useState } from "react";
import { Heart, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroBg from "@/assets/hero-crowd.jpg";

const stats = [
  { value: 9, suffix: "+", label: "лет работы" },
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
      <div className="text-4xl md:text-5xl font-bold text-foreground counter-animate">
        {count}{suffix}
      </div>
      <div className="text-sm text-muted-foreground mt-2">{label}</div>
    </div>
  );
};

const HeroSection = () => {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      {/* Soft background image */}
      <div className="absolute inset-0">
        <img
          src={heroBg}
          alt="Встреча выпускников лицея"
          className="w-full h-full object-cover opacity-[0.08]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/95 to-secondary" />
      </div>

      {/* Subtle accent glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-accent/[0.04] blur-[120px]" />

      <div className="container relative z-10 text-center py-32 md:py-40">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-background text-sm text-muted-foreground font-medium mb-8 fade-in-up">
          <Heart className="w-4 h-4 text-accent" />
          Благотворительный фонд
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight max-w-4xl mx-auto leading-[1.1] text-foreground fade-in-up fade-in-up-delay-1">
          Фонд выпускников лицея
        </h1>

        <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed fade-in-up fade-in-up-delay-2">
          Сообщество, которое продолжает поддерживать и развивать лицей
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10 fade-in-up fade-in-up-delay-3">
          <Button size="xl" asChild>
            <a href="#donate">
              <Heart className="w-5 h-5" />
              Поддержать фонд
            </a>
          </Button>
          <Button variant="outline" size="xl" asChild>
            <a href="#community">
              О фонде
              <ArrowRight className="w-4 h-4" />
            </a>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-8 max-w-md mx-auto mt-20 fade-in-up fade-in-up-delay-4">
          {stats.map((stat) => (
            <AnimatedCounter key={stat.label} target={stat.value} suffix={stat.suffix} label={stat.label} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
