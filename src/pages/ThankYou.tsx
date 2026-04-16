import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

const ThankYou = () => {
  useEffect(() => {
    document.title = "Спасибо за поддержку — Фонд «Лига»";
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="max-w-lg w-full text-center card-light p-10 md:p-12">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <Heart className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
          Спасибо за поддержку ❤️
        </h1>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          Ваш вклад помогает выпускникам лицея «Лига» воплощать важные проекты.
          Мы свяжемся с вами после подтверждения платежа.
        </p>
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link to="/">Вернуться на главную</Link>
        </Button>
      </div>
    </main>
  );
};

export default ThankYou;
