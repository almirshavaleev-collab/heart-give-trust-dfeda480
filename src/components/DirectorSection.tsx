import { Phone, Mail, Quote } from "lucide-react";
import directorDesktop from "@/assets/director-800.webp";
import directorMobile from "@/assets/director-480.webp";

const DirectorSection = () => (
  <section className="py-24 md:py-32">
    <div className="container max-w-lg">
      <div className="text-center mb-10">
        <p className="text-sm font-semibold text-accent uppercase tracking-wider mb-3">Руководство</p>
        <h2 className="text-3xl md:text-4xl font-bold text-foreground">Директор фонда</h2>
      </div>

      <div className="card-light p-8 text-center">
        <div className="mx-auto mb-6 w-32 h-40 sm:w-36 sm:h-44 md:w-40 md:h-52 overflow-hidden rounded-2xl shadow-lg ring-1 ring-border bg-secondary">
          <picture>
            <source media="(min-width: 641px)" srcSet={directorDesktop} type="image/webp" />
            <source srcSet={directorMobile} type="image/webp" />
            <img
              src={directorMobile}
              alt="Саитгараев Ильяс — директор фонда"
              width={480}
              height={482}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover object-center"
            />
          </picture>
        </div>
        <h3 className="text-xl font-bold text-foreground">Саитгараев Ильяс</h3>
        <p className="text-muted-foreground text-sm mt-1 max-w-xs mx-auto">
          Директор благотворительного фонда «Выпускники Лицея «ЛИГА»
        </p>

        <figure className="my-6 mx-auto max-w-xs">
          <Quote className="w-5 h-5 text-accent mx-auto mb-2 opacity-70" />
          <blockquote className="text-base font-medium text-foreground italic leading-relaxed">
            «Нормально делай — нормально будет»
          </blockquote>
        </figure>

        <div className="space-y-3 pt-2 border-t border-border">
          <div className="h-2" />
          <a href="tel:+79372993151" className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Phone className="w-4 h-4" />
            +7 (937) 299-31-51
          </a>
          <a href="mailto:ilyastgrv@gmail.com" className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Mail className="w-4 h-4" />
            ilyastgrv@gmail.com
          </a>
        </div>
      </div>
    </div>
  </section>
);

export default DirectorSection;
