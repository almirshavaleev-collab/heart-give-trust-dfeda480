import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, ListOrdered, Repeat, Award, Settings, LogOut, Menu, X, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import RequireAuth from "@/components/account/RequireAuth";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { cn } from "@/lib/utils";

const items = [
  { to: "/account/overview", label: "Обзор", icon: LayoutDashboard },
  { to: "/account/donations", label: "Пожертвования", icon: ListOrdered },
  { to: "/account/subscriptions", label: "Регулярная помощь", icon: Repeat },
  { to: "/account/achievements", label: "Достижения", icon: Award },
  { to: "/account/settings", label: "Настройки", icon: Settings },
];

function Inner() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [openMobile, setOpenMobile] = useState(false);

  const NavItems = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex flex-col gap-1 p-3">
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )
          }
        >
          <Icon className="h-4 w-4" />
          {label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen flex flex-col bg-secondary/20">
      <Header />
      <div className="flex-1 container py-24 md:py-28">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Mobile top bar */}
          <div className="md:hidden flex items-center justify-between bg-background rounded-2xl p-3 border border-border">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <Heart className="w-4 h-4 text-primary" />
              </div>
              <span className="font-semibold text-sm">Личный кабинет</span>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setOpenMobile((v) => !v)} aria-label="Меню кабинета">
              {openMobile ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </Button>
          </div>
          {openMobile && (
            <div className="md:hidden bg-background rounded-2xl border border-border overflow-hidden">
              <NavItems onNavigate={() => setOpenMobile(false)} />
              <div className="p-3 border-t">
                <Button variant="ghost" className="w-full justify-start gap-3" onClick={() => { signOut(); navigate("/"); }}>
                  <LogOut className="h-4 w-4" /> Выйти
                </Button>
              </div>
            </div>
          )}

          {/* Sidebar (desktop) */}
          <aside className="hidden md:flex md:w-64 shrink-0 flex-col bg-background border border-border rounded-2xl overflow-hidden h-fit sticky top-24">
            <div className="p-5 border-b">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Heart className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-sm">Личный кабинет</h2>
                  <p className="text-xs text-muted-foreground">Жертвователь</p>
                </div>
              </div>
            </div>
            <NavItems />
            <div className="p-3 border-t">
              <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground" onClick={() => { signOut(); navigate("/"); }}>
                <LogOut className="h-4 w-4" /> Выйти
              </Button>
            </div>
          </aside>

          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default function AccountLayout() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  );
}