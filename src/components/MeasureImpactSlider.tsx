import React, { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
  LabelList,
  Line,
  ComposedChart,
  ReferenceLine,
} from "recharts";
import { AlertTriangle, Info, Sparkles, Target } from "lucide-react";

export interface Measure {
  id: string;
  name: string;
  status: "implemented" | "new" | "deleted";
  aleAfter: number;
  effectiveness: number;
  cost: number;
  order: number;
}

interface Scenario {
  position: number;
  label: string;
  shortLabel: string;
  appliedMeasures: string[];
  ale: number;
  totalCost: number;
  measureId?: string;
  measureStatus?: Measure["status"];
  disabled?: boolean;
}

interface MeasureImpactSliderProps {
  riskId: string;
  aleBase: number;
  measures: Measure[];
  onMeasureClick?: (measureId: string) => void;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M ₽`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K ₽`;
  return `${value.toFixed(0)} ₽`;
}

export default function MeasureImpactSlider({
  riskId,
  aleBase,
  measures,
  onMeasureClick,
}: MeasureImpactSliderProps) {
  const activeMeasures = useMemo(
    () =>
      measures
        .filter((m) => m.status !== "deleted")
        .sort((a, b) => a.order - b.order),
    [measures]
  );

  const scenarios: Scenario[] = useMemo(() => {
    let cumCost = 0;
    return activeMeasures.map((m, i) => {
      cumCost += m.cost;
      const disabled = !m.aleAfter && !m.effectiveness;
      return {
        position: i,
        label: activeMeasures
          .slice(0, i + 1)
          .map((_, idx) => `Мера ${idx + 1}`)
          .join(" + "),
        shortLabel: `М${i + 1}`,
        appliedMeasures: activeMeasures.slice(0, i + 1).map((x) => x.id),
        ale: disabled ? (i > 0 ? activeMeasures[i - 1].aleAfter : aleBase) : m.aleAfter,
        totalCost: cumCost,
        measureId: m.id,
        measureStatus: m.status,
        disabled,
      } satisfies Scenario;
    });
  }, [aleBase, activeMeasures]);

  const [position, setPosition] = useState(0);
  const current = scenarios[position] ?? scenarios[0];

  const impact = aleBase - current.ale;
  const efficiency = aleBase > 0 ? ((impact / aleBase) * 100).toFixed(1) : "0";
  const roi =
    current.totalCost > 0
      ? (((impact - current.totalCost) / current.totalCost) * 100).toFixed(0)
      : "—";
  const payback =
    impact > 0 && current.totalCost > 0
      ? (current.totalCost / (impact / 12)).toFixed(1)
      : "—";
  const isNegative = current.ale > aleBase;

  const chartData = useMemo(
    () =>
      scenarios.map((s) => ({
        name: s.shortLabel,
        ale: s.ale,
        position: s.position,
      })),
    [scenarios]
  );

  const handleSliderChange = useCallback(
    (val: number[]) => {
      let target = val[0];
      // Skip disabled positions
      while (target > 0 && scenarios[target]?.disabled) target--;
      setPosition(target);
    },
    [scenarios]
  );

  if (activeMeasures.length === 0) {
    return (
      <Card className="border border-border bg-card">
        <CardContent className="flex items-center gap-3 py-8">
          <Info className="h-5 w-5 text-risk-neutral" />
          <span className="text-muted-foreground">
            Нет реализованных мер для моделирования
          </span>
        </CardContent>
      </Card>
    );
  }

  const maxScenarios = scenarios.length - 1;

  return (
    <Card className="border border-border bg-card overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Target className="h-5 w-5 text-risk-base" />
          Моделирование эффекта мер
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Chart */}
        <div className="w-full overflow-x-auto">
          <div className="min-w-[320px]" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 20, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                <YAxis
                  tickFormatter={(v) => formatCurrency(v)}
                  tick={{ fontSize: 11 }}
                  width={70}
                  className="fill-muted-foreground"
                />
                <ReferenceLine y={aleBase} stroke="hsl(var(--risk-neutral))" strokeDasharray="4 4" />
                <Bar dataKey="ale" radius={[4, 4, 0, 0]} animationDuration={500}>
                  {chartData.map((entry, i) => (
                    <Cell
                      key={entry.position}
                      fill={
                        i === 0
                          ? "hsl(var(--risk-base))"
                          : i <= position
                          ? entry.ale > aleBase
                            ? "hsl(var(--risk-negative))"
                            : "hsl(var(--risk-positive))"
                          : "hsl(var(--risk-neutral) / 0.3)"
                      }
                    />
                  ))}
                  <LabelList
                    dataKey="ale"
                    position="top"
                    formatter={(v: number) => formatCurrency(v)}
                    style={{ fontSize: 11, fill: "hsl(var(--risk-text))" }}
                  />
                </Bar>
                <Line
                  type="monotone"
                  dataKey="ale"
                  stroke="hsl(var(--risk-base))"
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="6 3"
                  animationDuration={500}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Slider */}
        <div className="space-y-3 px-1">
          <Slider
            value={[position]}
            onValueChange={handleSliderChange}
            min={0}
            max={maxScenarios}
            step={1}
            className="w-full"
          />

          {/* Dot labels */}
          <div className="flex justify-between">
            {scenarios.map((s, i) => (
              <Tooltip key={s.position}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => !s.disabled && setPosition(i)}
                    className={`flex flex-col items-center gap-0.5 text-[10px] leading-tight transition-all duration-300 ${
                      s.disabled
                        ? "opacity-40 cursor-not-allowed"
                        : i === position
                        ? "text-risk-base font-semibold scale-110"
                        : "text-muted-foreground hover:text-foreground cursor-pointer"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full transition-all duration-300 ${
                        i === position
                          ? "bg-risk-base ring-2 ring-risk-base/30"
                          : i < position
                          ? "bg-risk-positive"
                          : "bg-risk-neutral/40"
                      }`}
                    />
                    <span className="whitespace-nowrap">
                      {s.measureStatus === "new" && "✨ "}
                      {s.shortLabel}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  <p className="font-medium">{s.label}</p>
                  <p>ALE: {formatCurrency(s.ale)}</p>
                  {s.disabled && (
                    <p className="text-risk-warning">Недостаточно данных</p>
                  )}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>

        {/* KPI Metrics + Measure contributions */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Metrics */}
          <Card className="border border-border bg-risk-bg">
            <CardContent className="grid grid-cols-2 gap-3 p-4">
              <MetricBox
                label="Снижение потерь"
                value={formatCurrency(Math.abs(impact))}
                sub={`${efficiency}%`}
                negative={isNegative}
              />
              <MetricBox label="Затраты" value={formatCurrency(current.totalCost)} />
              <MetricBox
                label="ROI"
                value={roi === "—" ? roi : `${roi}%`}
                negative={Number(roi) < 0}
              />
              <MetricBox
                label="Окупаемость"
                value={payback === "—" ? payback : `${payback} мес`}
              />
            </CardContent>
          </Card>

          {/* Measure contribution list */}
          <div className="hidden md:block">
            <MeasureList
              measures={activeMeasures}
              aleBase={aleBase}
              activePosition={position}
              onMeasureClick={onMeasureClick}
            />
          </div>
        </div>

        {/* Mobile accordion */}
        <div className="md:hidden">
          <Accordion type="single" collapsible>
            <AccordionItem value="measures" className="border-none">
              <AccordionTrigger className="py-2 text-sm font-medium">
                Вклад мер ({activeMeasures.length})
              </AccordionTrigger>
              <AccordionContent>
                <MeasureList
                  measures={activeMeasures}
                  aleBase={aleBase}
                  activePosition={position}
                  onMeasureClick={onMeasureClick}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {isNegative && (
          <div className="flex items-center gap-2 rounded-md border border-risk-negative/30 bg-risk-negative/5 px-3 py-2 text-sm text-risk-negative">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Текущая комбинация мер увеличивает потери
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetricBox({
  label,
  value,
  sub,
  negative,
}: {
  label: string;
  value: string;
  sub?: string;
  negative?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p
        className={`text-lg font-bold leading-tight ${
          negative ? "text-risk-negative" : "text-foreground"
        }`}
      >
        {value}
        {sub && (
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            {sub}
          </span>
        )}
      </p>
    </div>
  );
}

function MeasureList({
  measures,
  aleBase,
  activePosition,
  onMeasureClick,
}: {
  measures: Measure[];
  aleBase: number;
  activePosition: number;
  onMeasureClick?: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Вклад мер</p>
      {measures.map((m, i) => {
        const prevAle = i === 0 ? aleBase : measures[i - 1].aleAfter;
        const delta = prevAle - m.aleAfter;
        const isActive = i < activePosition;
        const statusVariant =
          m.status === "implemented"
            ? "implemented"
            : m.status === "new"
            ? "new"
            : "deleted";
        const statusLabel =
          m.status === "implemented"
            ? "Реализована"
            : m.status === "new"
            ? "Новая"
            : "Удалена";

        return (
          <button
            key={m.id}
            onClick={() => onMeasureClick?.(m.id)}
            className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-all duration-200 ${
              isActive
                ? "border-risk-base/20 bg-risk-base/5"
                : "border-border bg-card hover:bg-accent/50"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {m.status === "new" && (
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-risk-warning" />
              )}
              <span className="truncate">{m.name}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              <span
                className={`text-xs font-medium ${
                  delta >= 0 ? "text-risk-positive" : "text-risk-negative"
                }`}
              >
                {delta >= 0 ? "-" : "+"}
                {formatCurrency(Math.abs(delta))}
              </span>
              <Badge variant={statusVariant as any}>{statusLabel}</Badge>
            </div>
          </button>
        );
      })}
    </div>
  );
}
