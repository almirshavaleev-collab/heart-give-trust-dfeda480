import { Heart } from "lucide-react";

const Footer = () => (
  <footer className="border-t border-border/30 py-10">
    <div className="container">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Heart className="w-4 h-4 text-primary fill-primary/20" />
          © {new Date().getFullYear()} Фонд «Выпускники Лицея «ЛИГА»
        </div>
        <div className="flex flex-wrap items-center gap-6 text-xs text-muted-foreground">
          <a href="#privacy" className="hover:text-foreground transition-colors">Политика конфиденциальности</a>
          <a href="#terms" className="hover:text-foreground transition-colors">Пользовательское соглашение</a>
          <a href="#refund" className="hover:text-foreground transition-colors">Возврат средств</a>
        </div>
      </div>
    </div>
  </footer>
);

export default Footer;
