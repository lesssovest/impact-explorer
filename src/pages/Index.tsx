import MeasureImpactSlider from "@/components/MeasureImpactSlider";

const demoMeasures = [
  {
    id: "KUPER-MSR-30",
    name: "Еженедельный пересчет оборотной тары",
    status: "implemented" as const,
    aleAfter: 4_200_000,
    effectiveness: 30,
    cost: 500_000,
    order: 1,
    implementedAt: "2025-03",
  },
  {
    id: "KUPER-MSR-71",
    name: "Идентификация и контроль рисков хищения",
    status: "new" as const,
    aleAfter: 2_500_000,
    effectiveness: 40,
    cost: 800_000,
    order: 2,
    implementedAt: "2025-09",
  },
];

const demoEvents: any[] = [];

const demoAleHistory = [
  { month: "2024-12", ale: 6_200_000 },
  { month: "2025-01", ale: 6_100_000 },
  { month: "2025-02", ale: 6_000_000 },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl p-4 md:p-8 space-y-6">
        <div>
          <p className="text-xs text-muted-foreground">Риск · Активный</p>
          <h1 className="text-2xl font-bold text-foreground mt-1">
            Пр_06 Хищение ТМЦ/имущества
          </h1>
          <p className="text-sm text-muted-foreground">
            Риски внутреннего мошенничества
          </p>
        </div>

        <MeasureImpactSlider
          riskId="PR-06"
          aleBase={6_000_000}
          measures={demoMeasures}
          events={demoEvents}
          aleHistory={demoAleHistory}
          onMeasureClick={(id) => console.log("Navigate to measure:", id)}
        />
      </div>
    </div>
  );
};

export default Index;
