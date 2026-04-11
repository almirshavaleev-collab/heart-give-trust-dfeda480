import { User, Phone, Mail } from "lucide-react";

const DirectorSection = () => (
  <section className="py-24 md:py-32 bg-muted/30">
    <div className="container max-w-lg">
      <div className="text-center mb-10">
        <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">Руководство</p>
        <h2 className="text-3xl md:text-4xl font-bold text-foreground">Директор фонда</h2>
      </div>

      <div className="bg-card rounded-3xl border border-border/50 p-8 text-center card-elevated">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
          <User className="w-10 h-10 text-primary" />
        </div>
        <h3 className="text-xl font-bold text-foreground">Саитгараев Ильяс</h3>
        <p className="text-muted-foreground text-sm mt-1 mb-6">Директор благотворительного фонда</p>

        <div className="space-y-3">
          <a
            href="tel:+79372993151"
            className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Phone className="w-4 h-4 text-primary" />
            +7 (937) 299-31-51
          </a>
          <a
            href="mailto:ilyastgrv@gmail.com"
            className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Mail className="w-4 h-4 text-primary" />
            ilyastgrv@gmail.com
          </a>
        </div>
      </div>
    </div>
  </section>
);

export default DirectorSection;
