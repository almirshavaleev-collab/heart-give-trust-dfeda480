import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Menu, X, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoH from "@/assets/logo_h.svg";
import { useAuth } from "@/hooks/useAuth";

const navLinks = [
  { label: "Сообщество", href: "#community" },
  { label: "Помочь", href: "#donate" },
  { label: "Реквизиты", href: "#details" },
  { label: "Контакты", href: "#contacts" },
  { label: "Вопросы", href: "#faq" },
];

const Header = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-background/80 backdrop-blur-xl shadow-sm border-b border-border"
          : "bg-transparent"
      }`}
    >
      <div className="container flex items-center justify-between h-16">
        <Link
          to="/"
          className="flex items-center gap-3 cursor-pointer group hover:opacity-80 transition-opacity"
        >
          <img
            src={logoH}
            alt="Фонд Выпускники Лицея «ЛИГА»"
            className="h-10 md:h-12 w-auto transition-transform duration-200 group-hover:scale-105"
          />
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg"
            >
              {l.label}
            </a>
          ))}
          <Button size="sm" variant="ghost" className="ml-2" asChild>
            <Link to={user ? "/account/overview" : "/auth"}>
              <User className="w-4 h-4 mr-1.5" />
              {user ? "Кабинет" : "Войти"}
            </Link>
          </Button>
          <Button size="sm" className="ml-3" asChild>
            <a href="#donate">Помочь</a>
          </Button>
        </nav>

        <button
          className="md:hidden p-2 text-foreground"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Меню"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-background border-b border-border pb-4">
          <nav className="container flex flex-col gap-1">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg"
              >
                {l.label}
              </a>
            ))}
            <Link
              to={user ? "/account/overview" : "/auth"}
              onClick={() => setMobileOpen(false)}
              className="px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg inline-flex items-center gap-2"
            >
              <User className="w-4 h-4" />
              {user ? "Личный кабинет" : "Войти"}
            </Link>
            <Button size="sm" className="mt-2" asChild>
              <a href="#donate" onClick={() => setMobileOpen(false)}>Помочь</a>
            </Button>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
