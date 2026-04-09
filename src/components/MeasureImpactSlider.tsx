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
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Area,
  ComposedChart,
  ReferenceLine,
} from "recharts";
import { AlertTriangle, Info, Sparkles, Target, Zap } from "lucide-react";

export interface Measure {
  id: string;
  name: string;
  status: "implemented" | "new" | "deleted";
  aleAfter: number;
  effectiveness: number;
  cost: number;
  order: number;
  implementedAt: string; // ISO date or YYYY-MM
}

export interface RiskEvent {
  id: string;
  date: string; // ISO date or YYYY-MM
  amount: number; // loss amount
  description: string;
}

export interface AleHistoryPoint {
  month: string; // YYYY-MM
  ale: number;
}

interface MeasureImpactSliderProps {
  riskId: string;
  aleBase: number;
  measures: Measure[];
  events?: RiskEvent[];
  aleHistory?: AleHistoryPoint[];
  onMeasureClick?: (measureId: string) => void;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M ₽`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K ₽`;
  return `${value.toFixed(0)} ₽`;
}

function parseMonth(dateStr: string): string {
  return dateStr.slice(0, 7); // YYYY-MM
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const months = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
  return `${months[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
}

function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

interface TimelinePoint {
  month: string;
  monthIdx: number;
  ale: number;
  measureId?: string;
  measureName?: string;
  measureStatus?: Measure["status"];
  isMeasure: boolean;
  events: RiskEvent[];
}

export default function MeasureImpactSlider({
  riskId,
  aleBase,
  measures,
  events = [],
  aleHistory = [],
  onMeasureClick,
}: MeasureImpactSliderProps) {
  const activeMeasures = useMemo(
    () =>
      measures
        .filter((m) => m.status !== "deleted")
        .sort((a, b) => a.order - b.order),
    [measures]
  );

  // Build timeline data
  const { timelineData, minMonth, maxMonth, measureMonthIndices, firstMeasureIdx } = useMemo(() => {
    if (activeMeasures.length === 0) {
      return { timelineData: [], minMonth: "", maxMonth: "", measureMonthIndices: [], firstMeasureIdx: 0 };
    }

    // Get all measure months
    const measureMonths = activeMeasures.map((m) => parseMonth(m.implementedAt));
    const eventMonths = events.map((e) => parseMonth(e.date));
    const historyMonths = aleHistory.map((h) => h.month);

    const allMonths = [...measureMonths, ...eventMonths, ...historyMonths].sort();
    
    // Determine range: start 2 months before first measure (for pre-measure view), end 2 months after last
    const firstMeasureMonth = measureMonths[0];
    const lastMonth = allMonths[allMonths.length - 1];
    
    const rangeStart = addMonths(firstMeasureMonth, -3);
    const rangeEnd = addMonths(lastMonth, 2);
    
    const totalMonths = monthsBetween(rangeStart, rangeEnd);
    
    // Build month-by-month data
    const data: TimelinePoint[] = [];
    const mIndices: number[] = [];
    
    // Create a map of history ALE values
    const historyMap = new Map<string, number>();
    aleHistory.forEach((h) => historyMap.set(h.month, h.ale));
    
    // Create a map of events by month
    const eventsByMonth = new Map<string, RiskEvent[]>();
    events.forEach((e) => {
      const m = parseMonth(e.date);
      if (!eventsByMonth.has(m)) eventsByMonth.set(m, []);
      eventsByMonth.get(m)!.push(e);
    });
    
    // Create a sorted list of measure implementations with their ALE impact
    const measureTimeline = activeMeasures.map((m) => ({
      month: parseMonth(m.implementedAt),
      aleAfter: m.aleAfter,
      id: m.id,
      name: m.name,
      status: m.status,
      effectiveness: m.effectiveness,
    }));
    
    let fmi = 0;
    
    for (let i = 0; i <= totalMonths; i++) {
      const currentMonth = addMonths(rangeStart, i);
      
      // Determine which measure is the latest active at this month
      const activeMeasuresAtMonth = measureTimeline.filter(
        (mt) => mt.month <= currentMonth
      );
      
      // Determine ALE at this month
      let ale: number;
      if (activeMeasuresAtMonth.length === 0) {
        // Before any measure - use history or aleBase
        ale = historyMap.get(currentMonth) ?? aleBase;
      } else {
        const lastActiveMeasure = activeMeasuresAtMonth[activeMeasuresAtMonth.length - 1];
        ale = lastActiveMeasure.aleAfter;
      }
      
      // Check if a measure was implemented this month
      const measureThisMonth = measureTimeline.find((mt) => mt.month === currentMonth);
      
      if (measureThisMonth) {
        mIndices.push(i);
        if (mIndices.length === 1) fmi = i;
      }
      
      data.push({
        month: currentMonth,
        monthIdx: i,
        ale,
        measureId: measureThisMonth?.id,
        measureName: measureThisMonth?.name,
        measureStatus: measureThisMonth?.status,
        isMeasure: !!measureThisMonth,
        events: eventsByMonth.get(currentMonth) || [],
      });
    }
    
    return {
      timelineData: data,
      minMonth: rangeStart,
      maxMonth: rangeEnd,
      measureMonthIndices: mIndices,
      firstMeasureIdx: fmi,
    };
  }, [aleBase, activeMeasures, events, aleHistory]);

  const [sliderValue, setSliderValue] = useState(timelineData.length - 1);

  // Calculate which measures are active at current slider position
  const currentPoint = timelineData[sliderValue] ?? timelineData[timelineData.length - 1];
  
  // Determine the effective ALE: if slider is between measures, use previous measure's ALE
  const effectiveAle = useMemo(() => {
    if (!currentPoint) return aleBase;
    
    // Find the last measure at or before current position
    const lastMeasureBeforeCurrent = measureMonthIndices
      .filter((idx) => idx <= sliderValue)
      .pop();
    
    if (lastMeasureBeforeCurrent === undefined) return aleBase;
    
    // Check if there's at least one event after this measure and before/at slider
    const measureMonth = timelineData[lastMeasureBeforeCurrent]?.month;
    const nextMeasureIdx = measureMonthIndices.find((idx) => idx > lastMeasureBeforeCurrent);
    
    // Find events between last measure and current position
    const eventsInRange = timelineData
      .slice(lastMeasureBeforeCurrent + 1, sliderValue + 1)
      .some((p) => p.events.length > 0);
    
    // If no events after this measure yet, use previous measure's ALE
    if (!eventsInRange && lastMeasureBeforeCurrent === measureMonthIndices[measureMonthIndices.length - 1]) {
      // This is the last measure - just show its ALE
      return timelineData[lastMeasureBeforeCurrent].ale;
    }
    
    return currentPoint.ale;
  }, [currentPoint, sliderValue, measureMonthIndices, timelineData, aleBase]);

  const activeMeasuresAtSlider = useMemo(() => {
    if (!currentPoint) return [];
    return activeMeasures.filter((m) => {
      const mMonth = parseMonth(m.implementedAt);
      return mMonth <= currentPoint.month;
    });
  }, [currentPoint, activeMeasures]);

  const totalCost = useMemo(
    () => activeMeasuresAtSlider.reduce((sum, m) => sum + m.cost, 0),
    [activeMeasuresAtSlider]
  );

  const impact = aleBase - effectiveAle;
  const efficiency = aleBase > 0 ? ((impact / aleBase) * 100).toFixed(1) : "0";
  const roi =
    totalCost > 0
      ? (((impact - totalCost) / totalCost) * 100).toFixed(0)
      : "—";
  const payback =
    impact > 0 && totalCost > 0
      ? (totalCost / (impact / 12)).toFixed(1)
      : "—";
  const isNegative = effectiveAle > aleBase;

  // Visible events up to slider position
  const visibleEvents = useMemo(
    () =>
      timelineData
        .slice(0, sliderValue + 1)
        .flatMap((p) => p.events),
    [timelineData, sliderValue]
  );

  const handleSliderChange = useCallback(
    (val: number[]) => {
      const target = Math.max(val[0], firstMeasureIdx);
      setSliderValue(target);
    },
    [firstMeasureIdx]
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

  // Chart data: only show up to slider for the filled area
  // Forecast grows ~8% per year from aleBase starting at the first month
  const monthlyGrowthRate = 0.08 / 12;
  const chartDataFull = timelineData.map((p, i) => ({
    name: monthLabel(p.month),
    month: p.month,
    ale: p.ale,
    aleVisible: i <= sliderValue ? p.ale : undefined,
    aleFuture: i >= sliderValue ? p.ale : undefined,
    forecast: Math.round(aleBase * (1 + monthlyGrowthRate * i)),
    idx: i,
  }));

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
          <div className="min-w-[320px]" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartDataFull}
                margin={{ top: 20, right: 10, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10 }}
                  className="fill-muted-foreground"
                  interval={Math.max(0, Math.floor(chartDataFull.length / 8))}
                />
                <YAxis
                  tickFormatter={(v) => formatCurrency(v)}
                  tick={{ fontSize: 11 }}
                  width={70}
                  className="fill-muted-foreground"
                />
                {/* Forecast line (прогноз потерь без мер) */}
                <Area
                  type="monotone"
                  dataKey="forecast"
                  fill="none"
                  stroke="hsl(var(--risk-negative) / 0.4)"
                  strokeWidth={1.5}
                  strokeDasharray="6 3"
                  animationDuration={300}
                  dot={false}
                  label={({ index, x, y, value }: any) => {
                    if (index !== chartDataFull.length - 1) return null;
                    return (
                      <text
                        x={x}
                        y={y - 8}
                        textAnchor="end"
                        fill="hsl(var(--risk-negative))"
                        fontSize={10}
                        fontWeight={500}
                      >
                        Прогноз потерь
                      </text>
                    );
                  }}
                />
                {/* Measure implementation lines */}
                {timelineData
                  .filter((p) => p.isMeasure)
                  .map((p) => (
                    <ReferenceLine
                      key={p.measureId}
                      x={monthLabel(p.month)}
                      stroke={
                        p.measureStatus === "new"
                          ? "hsl(var(--risk-warning))"
                          : "hsl(var(--risk-base))"
                      }
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{
                        value: p.measureName?.slice(0, 20) ?? "",
                        position: "insideTopLeft",
                        style: {
                          fontSize: 9,
                          fill:
                            p.measureStatus === "new"
                              ? "hsl(var(--risk-warning))"
                              : "hsl(var(--risk-base))",
                        },
                      }}
                    />
                  ))}
                {/* Visible ALE area */}
                <Area
                  type="stepAfter"
                  dataKey="aleVisible"
                  fill="hsl(var(--risk-positive) / 0.15)"
                  stroke="hsl(var(--risk-positive))"
                  strokeWidth={2}
                  animationDuration={300}
                  connectNulls={false}
                />
                {/* Future ALE (dimmed) */}
                <Area
                  type="stepAfter"
                  dataKey="aleFuture"
                  fill="hsl(var(--risk-neutral) / 0.08)"
                  stroke="hsl(var(--risk-neutral) / 0.3)"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  animationDuration={300}
                  connectNulls={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Timeline slider */}
        <div className="space-y-3 px-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <span>{monthLabel(timelineData[firstMeasureIdx]?.month ?? minMonth)}</span>
            <div className="flex-1" />
            <span>{monthLabel(maxMonth)}</span>
          </div>
          <Slider
            value={[sliderValue]}
            onValueChange={handleSliderChange}
            min={firstMeasureIdx}
            max={timelineData.length - 1}
            step={1}
            className="w-full"
          />

          {/* Measure markers on slider */}
          <div className="relative h-6">
            {measureMonthIndices.map((idx) => {
              const m = timelineData[idx];
              const pct =
                timelineData.length > 1
                  ? ((idx - firstMeasureIdx) / (timelineData.length - 1 - firstMeasureIdx)) * 100
                  : 0;
              return (
                <Tooltip key={m.measureId}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => {
                        setSliderValue(idx);
                        if (m.measureId && onMeasureClick) onMeasureClick(m.measureId);
                      }}
                      className="absolute -translate-x-1/2 flex flex-col items-center gap-0.5"
                      style={{ left: `${pct}%` }}
                    >
                      <span
                        className={`h-2.5 w-2.5 rounded-full border-2 transition-all ${
                          idx <= sliderValue
                            ? m.measureStatus === "new"
                              ? "bg-risk-warning border-risk-warning/50"
                              : "bg-risk-base border-risk-base/50"
                            : "bg-risk-neutral/30 border-risk-neutral/20"
                        }`}
                      />
                      <span
                        className={`text-[9px] whitespace-nowrap ${
                          idx <= sliderValue
                            ? "text-foreground font-medium"
                            : "text-muted-foreground"
                        }`}
                      >
                        {m.measureStatus === "new" && "✨ "}
                        М{measureMonthIndices.indexOf(idx) + 1}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                    <p className="font-medium">{m.measureName}</p>
                    <p>ALE после: {formatCurrency(m.ale)}</p>
                    <p>{monthLabel(m.month)}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>

        {/* Current position info */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            {monthLabel(currentPoint?.month ?? minMonth)}
          </span>
          <span>·</span>
          <span>
            Активных мер: {activeMeasuresAtSlider.length} из {activeMeasures.length}
          </span>
          {visibleEvents.length > 0 && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1 text-risk-negative">
                <Zap className="h-3 w-3" />
                {visibleEvents.length} инцидент(ов)
              </span>
            </>
          )}
        </div>

        {/* KPI Metrics + Measure contributions */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border border-border bg-risk-bg">
            <CardContent className="grid grid-cols-2 gap-3 p-4">
              <MetricBox
                label="Снижение потерь"
                value={formatCurrency(Math.abs(impact))}
                sub={`${efficiency}%`}
                negative={isNegative}
              />
              <MetricBox label="Затраты" value={formatCurrency(totalCost)} />
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

          <div className="hidden md:block">
            <MeasureList
              measures={activeMeasures}
              aleBase={aleBase}
              currentMonth={currentPoint?.month ?? ""}
              onMeasureClick={onMeasureClick}
            />
          </div>
        </div>

        {/* Events list */}
        {visibleEvents.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Zap className="h-3 w-3 text-risk-negative" />
              Инциденты в периоде
            </p>
            <div className="space-y-1.5">
              {visibleEvents.slice(-5).map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between rounded-lg border border-risk-negative/20 bg-risk-negative/5 px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-muted-foreground">
                      {monthLabel(parseMonth(e.date))}
                    </span>
                    <span className="truncate">{e.description}</span>
                  </div>
                  <span className="text-risk-negative font-medium shrink-0 ml-2">
                    -{formatCurrency(e.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mobile accordion */}
        <div className="md:hidden">
          <Accordion type="single" collapsible>
            <AccordionItem value="measures" className="border-none">
              <AccordionTrigger className="py-2 text-sm font-medium">
                Вклад мер ({activeMeasuresAtSlider.length})
              </AccordionTrigger>
              <AccordionContent>
                <MeasureList
                  measures={activeMeasures}
                  aleBase={aleBase}
                  currentMonth={currentPoint?.month ?? ""}
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
  currentMonth,
  onMeasureClick,
}: {
  measures: Measure[];
  aleBase: number;
  currentMonth: string;
  onMeasureClick?: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Вклад мер</p>
      {measures.map((m, i) => {
        const prevAle = i === 0 ? aleBase : measures[i - 1].aleAfter;
        const delta = prevAle - m.aleAfter;
        const isActive = parseMonth(m.implementedAt) <= currentMonth;
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
                : "border-border bg-card hover:bg-accent/50 opacity-50"
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
              <Badge variant={m.status as any}>{statusLabel}</Badge>
            </div>
          </button>
        );
      })}
    </div>
  );
}
