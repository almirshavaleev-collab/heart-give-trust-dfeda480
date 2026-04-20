import { Link } from "react-router-dom";
import { ShieldCheck, ArrowRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

const DetailsSection = () => (
  <section id="details" className="py-24 md:py-32 section-alt">
    <div className="container max-w-3xl">
      <div className="card-light p-8 md:p-12 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-accent/10 text-accent mb-6">
          <ShieldCheck className="w-7 h-7" />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
          Благотворительный фонд «Выпускники Лицея «ЛИГА»
        </h2>
        <p className="text-sm md:text-base text-muted-foreground mb-8">
          Официально зарегистрированная организация
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button asChild variant="outline">
            <a href="#community">
              О фонде
              <ArrowRight className="w-4 h-4 ml-1" />
            </a>
          </Button>
          <Button asChild>
            <Link to="/requisites">
              <FileText className="w-4 h-4 mr-1" />
              Реквизиты
            </Link>
          </Button>
        </div>
      </div>
    </div>
  </section>
);

export default DetailsSection;
