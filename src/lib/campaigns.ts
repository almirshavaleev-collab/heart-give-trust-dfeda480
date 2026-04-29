import campaign1 from "@/assets/campaign-1-800.webp";
import campaign2 from "@/assets/campaign-2-800.webp";
import campaign3 from "@/assets/campaign-3-800.webp";
import campaign4 from "@/assets/campaign-4-800.webp";

export type CampaignStatus = "active" | "completed";

export interface Campaign {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  fullDescription: string;
  beneficiary: string;
  purpose: string;
  image: string;
  // TODO: gallery: string[];
  goalAmount: number;
  collectedAmount: number;
  status: CampaignStatus;
  date: string;
  // TODO: report?: string;
}

export const campaigns: Campaign[] = [
  {
    id: "1",
    slug: "remont-kabinetov",
    title: "Ремонт учебных кабинетов",
    shortDescription: "Обновление классов для комфортного обучения учеников лицея",
    fullDescription:
      "Учебные кабинеты лицея нуждаются в капитальном ремонте: замена напольного покрытия, покраска стен, обновление мебели и освещения. Комфортная среда напрямую влияет на качество обучения и мотивацию учеников. Мы планируем отремонтировать 6 кабинетов к началу нового учебного года.",
    beneficiary: "Ученики лицея-интерната №1 г. Альметьевска",
    purpose: "Создание современной и комфортной образовательной среды",
    image: campaign1,
    goalAmount: 850000,
    collectedAmount: 342000,
    status: "active",
    date: "2026-03-01",
  },
  {
    id: "2",
    slug: "kompyuterny-klass",
    title: "Компьютерный класс",
    shortDescription: "Закупка современных компьютеров для IT-образования",
    fullDescription:
      "Технологическое образование — ключ к будущему. Мы собираем средства на оборудование нового компьютерного класса: 20 современных рабочих станций, проектор, интерактивная доска и сетевое оборудование. Это позволит ученикам изучать программирование, робототехнику и цифровые навыки на профессиональном уровне.",
    beneficiary: "Ученики 7–11 классов лицея",
    purpose: "Развитие IT-компетенций и цифровой грамотности",
    image: campaign2,
    goalAmount: 1200000,
    collectedAmount: 780000,
    status: "active",
    date: "2026-02-15",
  },
  {
    id: "3",
    slug: "stipendii-liceistam",
    title: "Стипендии лицеистам",
    shortDescription: "Поддержка талантливых учеников стипендиями от выпускников",
    fullDescription:
      "Программа стипендий для одарённых учеников лицея, которые демонстрируют выдающиеся результаты в учёбе, науке и олимпиадном движении. Стипендия покрывает расходы на учебные материалы, участие в конкурсах и дополнительное образование. В этом году мы планируем поддержать 15 учеников.",
    beneficiary: "Талантливые ученики лицея с высокими достижениями",
    purpose: "Финансовая поддержка и мотивация одарённых учеников",
    image: campaign3,
    goalAmount: 500000,
    collectedAmount: 425000,
    status: "active",
    date: "2026-01-10",
  },
  {
    id: "4",
    slug: "sportivny-zal",
    title: "Обновление спортзала",
    shortDescription: "Модернизация спортивного зала и закупка инвентаря",
    fullDescription:
      "Спортивный зал лицея требует серьёзного обновления: замена покрытия пола, установка нового оборудования, закупка спортивного инвентаря для секций по баскетболу, волейболу и гимнастике. Здоровье учеников — основа их успешного обучения.",
    beneficiary: "Все ученики лицея",
    purpose: "Создание условий для физического развития и здоровья",
    image: campaign4,
    goalAmount: 650000,
    collectedAmount: 195000,
    status: "active",
    date: "2026-03-20",
  },
];

export function getCampaignBySlug(slug: string): Campaign | undefined {
  return campaigns.find((c) => c.slug === slug);
}

export function getActiveCampaigns(): Campaign[] {
  return campaigns.filter((c) => c.status === "active");
}

export function getOtherCampaigns(currentSlug: string): Campaign[] {
  return campaigns.filter((c) => c.slug !== currentSlug).slice(0, 3);
}

export function formatAmount(amount: number): string {
  return amount.toLocaleString("ru-RU");
}

export function getProgress(campaign: Campaign): number {
  return Math.min(100, Math.round((campaign.collectedAmount / campaign.goalAmount) * 100));
}
