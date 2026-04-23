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
      <div className="text-5xl md:text-6xl font-bold tracking-tight text-white counter-animate" style={{ textShadow: "0 2px 10px rgba(0,0,0,0.3)" }}>
        {count}{suffix}
      </div>
      <div className="text-sm text-white/70 mt-3 font-medium" style={{ textShadow: "0 2px 10px rgba(0,0,0,0.3)" }}>{label}</div>
    </div>
  );
};

const HeroSection = () => {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroBg})` }}
        aria-hidden="true"
      />
      {/* Darkening overlay for readability */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(11, 31, 58, 0.6), rgba(11, 31, 58, 0.85))",
        }}
        aria-hidden="true"
      />

      <div className="container relative z-10 text-center py-32 md:py-40">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/20 bg-white/10 backdrop-blur-sm text-xs text-white/85 font-medium mb-10 fade-in-up">
          <Heart className="w-3.5 h-3.5 text-white/90" />
          Благотворительный фонд
        </div>

        <h1
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight max-w-[800px] mx-auto leading-[1.05] text-white fade-in-up fade-in-up-delay-1"
          style={{ textShadow: "0 2px 10px rgba(0,0,0,0.3)" }}
        >
          «Лига» Фонд Выпускников
        </h1>

        <p
          className="mt-7 md:mt-8 text-lg md:text-xl text-white/85 max-w-[600px] mx-auto leading-relaxed fade-in-up fade-in-up-delay-2"
          style={{ textShadow: "0 2px 10px rgba(0,0,0,0.3)" }}
        >
          Тот самый лицей, который растит сильных и осознанных людей
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mt-12 md:mt-14 fade-in-up fade-in-up-delay-3">
          <Button
            size="xl"
            asChild
            className="h-14 px-12 text-base bg-white text-foreground hover:bg-white/90 shadow-lg hover:shadow-2xl hover:scale-[1.03] transition-all duration-300"
          >
            <a href="#donate">
              <Heart className="w-5 h-5" />
              Стать частью фонда
            </a>
          </Button>
          <Button variant="ghost" size="lg" asChild className="text-white/90 hover:text-white hover:bg-white/10">
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
