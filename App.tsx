import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  Ruler,
  Calculator as CalcIcon,
  Package,
  ShieldCheck,
  DollarSign,
  Save,
  Share2,
  Copy,
  FolderOpen,
  Bookmark,
  HardHat,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PatternIcon } from "@/components/PatternIcons";
import {
  type AreaUnit,
  type LayoutType,
  LAYOUT_OPTIONS,
  cubicYardsFromInches,
  formatCurrency,
  formatNumber,
  getWastePct,
  paverAreaSqft,
  paversForArea,
  roundUpTo,
  toSqft,
} from "@/lib/calculator";
import {
  type LabourMode,
  type SavedEstimate,
  buildShareText,
  formatSavedDate,
  loadEstimates,
  saveEstimates,
} from "@/lib/estimates";
import { useToast } from "@/hooks/use-toast";

type AreaMode = "dimensions" | "area";

type AreaRow = {
  id: string;
  name: string;
  mode: AreaMode;
  length: string;
  width: string;
  value: string;
};

const SAFETY_MARGIN = 0.05;

let nextAreaId = 1;
const newId = () => `area-${nextAreaId++}`;

function makeArea(name: string): AreaRow {
  return {
    id: newId(),
    name,
    mode: "dimensions",
    length: "",
    width: "",
    value: "",
  };
}

function effectiveAreaValue(a: AreaRow): number {
  if (a.mode === "dimensions") {
    const l = parseFloat(a.length);
    const w = parseFloat(a.width);
    if (!isFinite(l) || l <= 0 || !isFinite(w) || w <= 0) return 0;
    return l * w;
  }
  const v = parseFloat(a.value);
  return isFinite(v) && v > 0 ? v : 0;
}

function App() {
  const [unit, setUnit] = useState<AreaUnit>("sqft");
  const [areas, setAreas] = useState<AreaRow[]>([
    makeArea("Patio"),
  ]);
  const [paverWidth, setPaverWidth] = useState<string>("4");
  const [paverLength, setPaverLength] = useState<string>("8");
  const [layout, setLayout] = useState<LayoutType>("running_bond");
  const [baseDepth, setBaseDepth] = useState<string>("4");
  const [sandDepth, setSandDepth] = useState<string>("1");
  const [safetyOn, setSafetyOn] = useState<boolean>(false);
  const [paverPrice, setPaverPrice] = useState<string>("");
  const [basePrice, setBasePrice] = useState<string>("");
  const [sandPrice, setSandPrice] = useState<string>("");
  const [labourMode, setLabourMode] = useState<LabourMode>("rate_per_area");
  const [labourRatePerArea, setLabourRatePerArea] = useState<string>("");
  const [labourHourlyRate, setLabourHourlyRate] = useState<string>("");
  const [labourCrewSize, setLabourCrewSize] = useState<string>("2");
  const [labourHours, setLabourHours] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [savedEstimates, setSavedEstimates] = useState<SavedEstimate[]>([]);

  const { toast } = useToast();

  useEffect(() => {
    setSavedEstimates(loadEstimates());
  }, []);

  const addArea = () => {
    setAreas((prev) => [...prev, makeArea(`Area ${prev.length + 1}`)]);
  };

  const removeArea = (id: string) => {
    setAreas((prev) => (prev.length <= 1 ? prev : prev.filter((a) => a.id !== id)));
  };

  const updateArea = (id: string, patch: Partial<AreaRow>) => {
    setAreas((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  const totals = useMemo(() => {
    const pw = parseFloat(paverWidth);
    const pl = parseFloat(paverLength);
    const bd = parseFloat(baseDepth);
    const sd = parseFloat(sandDepth);
    const margin = safetyOn ? SAFETY_MARGIN : 0;

    const paverSqft = paverAreaSqft(pw, pl);

    let totalSqft = 0;
    let totalPavers = 0;

    for (const a of areas) {
      const v = effectiveAreaValue(a);
      if (v <= 0) continue;
      const sqft = toSqft(v, unit);
      totalSqft += sqft;
      totalPavers += paversForArea(sqft, paverSqft, layout, margin);
    }

    const baseCYRaw = cubicYardsFromInches(totalSqft, bd, margin);
    const sandCYRaw = cubicYardsFromInches(totalSqft, sd, margin);
    const baseCYRounded = roundUpTo(baseCYRaw, 0.5);
    const sandCYRounded = roundUpTo(sandCYRaw, 0.5);

    const paverUnit = parseFloat(paverPrice);
    const baseUnit = parseFloat(basePrice);
    const sandUnit = parseFloat(sandPrice);

    const paverCost =
      isFinite(paverUnit) && paverUnit > 0 ? totalPavers * paverUnit : 0;
    const baseCost =
      isFinite(baseUnit) && baseUnit > 0 ? baseCYRounded * baseUnit : 0;
    const sandCost =
      isFinite(sandUnit) && sandUnit > 0 ? sandCYRounded * sandUnit : 0;
    const materialsCost = paverCost + baseCost + sandCost;

    let labourCost = 0;
    if (labourMode === "rate_per_area") {
      const r = parseFloat(labourRatePerArea);
      if (isFinite(r) && r > 0) {
        const areaInUnit =
          unit === "sqft" ? totalSqft : totalSqft / 10.7639104167;
        labourCost = r * areaInUnit;
      }
    } else {
      const r = parseFloat(labourHourlyRate);
      const c = parseFloat(labourCrewSize);
      const h = parseFloat(labourHours);
      if (isFinite(r) && r > 0 && isFinite(c) && c > 0 && isFinite(h) && h > 0) {
        labourCost = r * c * h;
      }
    }

    const totalCost = materialsCost + labourCost;

    return {
      totalSqft,
      paverSqft,
      totalPavers,
      baseCY: baseCYRaw,
      sandCY: sandCYRaw,
      baseCYRounded,
      sandCYRounded,
      paverCost,
      baseCost,
      sandCost,
      materialsCost,
      labourCost,
      totalCost,
      hasPricing:
        paverCost > 0 || baseCost > 0 || sandCost > 0 || labourCost > 0,
      ready: paverSqft > 0 && totalSqft > 0,
    };
  }, [
    areas,
    unit,
    paverWidth,
    paverLength,
    layout,
    baseDepth,
    sandDepth,
    safetyOn,
    paverPrice,
    basePrice,
    sandPrice,
    labourMode,
    labourRatePerArea,
    labourHourlyRate,
    labourCrewSize,
    labourHours,
  ]);

  const wastePct = Math.round(getWastePct(layout) * 100);
  const totalOverheadPct = wastePct + (safetyOn ? Math.round(SAFETY_MARGIN * 100) : 0);
  const selectedLayout = LAYOUT_OPTIONS.find((o) => o.value === layout);

  const persistEstimates = (next: SavedEstimate[]) => {
    setSavedEstimates(next);
    saveEstimates(next);
  };

  const handleSaveEstimate = () => {
    if (!totals.ready) return;
    const estimate: SavedEstimate = {
      id: `est-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      customerName: customerName.trim() || "Untitled Estimate",
      savedAt: Date.now(),
      unit,
      layout,
      paverWidth,
      paverLength,
      baseDepth,
      sandDepth,
      safetyOn,
      paverPrice,
      basePrice,
      sandPrice,
      labourMode,
      labourRatePerArea,
      labourHourlyRate,
      labourCrewSize,
      labourHours,
      areas: areas.map((a) => ({
        id: a.id,
        name: a.name,
        mode: a.mode,
        length: a.length,
        width: a.width,
        value: a.value,
      })),
      snapshot: {
        totalSqft: totals.totalSqft,
        totalPavers: totals.totalPavers,
        baseCYRounded: totals.baseCYRounded,
        sandCYRounded: totals.sandCYRounded,
        paverCost: totals.paverCost,
        baseCost: totals.baseCost,
        sandCost: totals.sandCost,
        materialsCost: totals.materialsCost,
        labourCost: totals.labourCost,
        totalCost: totals.totalCost,
        wastePct,
        safetyPct: safetyOn ? Math.round(SAFETY_MARGIN * 100) : 0,
        layoutLabel: selectedLayout?.label ?? layout,
      },
    };
    persistEstimates([estimate, ...savedEstimates]);
    toast({
      title: "Estimate saved",
      description: estimate.customerName,
    });
  };

  const handleLoadEstimate = (est: SavedEstimate) => {
    setUnit(est.unit);
    setLayout(est.layout);
    setPaverWidth(est.paverWidth);
    setPaverLength(est.paverLength);
    setBaseDepth(est.baseDepth);
    setSandDepth(est.sandDepth);
    setSafetyOn(est.safetyOn);
    setPaverPrice(est.paverPrice);
    setBasePrice(est.basePrice);
    setSandPrice(est.sandPrice);
    setLabourMode(est.labourMode ?? "rate_per_area");
    setLabourRatePerArea(est.labourRatePerArea ?? "");
    setLabourHourlyRate(est.labourHourlyRate ?? "");
    setLabourCrewSize(est.labourCrewSize ?? "2");
    setLabourHours(est.labourHours ?? "");
    setCustomerName(est.customerName === "Untitled Estimate" ? "" : est.customerName);
    setAreas(
      est.areas.map((a) => ({
        id: a.id,
        name: a.name,
        mode: a.mode ?? (a.length || a.width ? "dimensions" : "area"),
        length: a.length ?? "",
        width: a.width ?? "",
        value: a.value ?? "",
      })),
    );
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    toast({
      title: "Estimate loaded",
      description: est.customerName,
    });
  };

  const handleDeleteEstimate = (id: string) => {
    persistEstimates(savedEstimates.filter((e) => e.id !== id));
    toast({ title: "Estimate deleted" });
  };

  const handleCopyEstimate = async (est: SavedEstimate) => {
    const text = buildShareText(est, formatCurrency, formatNumber);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        toast({
          title: "Copied to clipboard",
          description: "Paste into a text or email.",
        });
        return;
      }
    } catch {
      // fall through
    }
    toast({
      title: "Copy not supported",
      description: "Long-press to copy from the share text.",
      variant: "destructive",
    });
  };

  const handleShareEstimate = async (est: SavedEstimate) => {
    const text = buildShareText(est, formatCurrency, formatNumber);
    const title = `Hardscape Estimate — ${est.customerName}`;
    const navAny = navigator as Navigator & {
      share?: (data: { title?: string; text?: string }) => Promise<void>;
    };
    if (typeof navAny.share === "function") {
      try {
        await navAny.share({ title, text });
        return;
      } catch {
        // user cancelled or share failed; fall back to copy
      }
    }
    await handleCopyEstimate(est);
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen w-full bg-background text-foreground pb-56">
        <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground shrink-0">
              <CalcIcon className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold leading-tight truncate">
                Hardscape Calculator
              </h1>
              <p className="text-sm text-muted-foreground truncate">
                Pavers, base &amp; sand for any project
              </p>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-2xl px-4 pt-5 space-y-5">
          {/* Layout Pattern Gallery */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Ruler className="h-5 w-5 text-primary" />
                Layout Pattern
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {LAYOUT_OPTIONS.map((opt) => {
                  const selected = opt.value === layout;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setLayout(opt.value)}
                      aria-pressed={selected}
                      className={`group relative flex flex-col items-stretch rounded-lg border-2 p-2.5 text-left transition-all hover-elevate ${
                        selected
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border bg-background"
                      }`}
                    >
                      <div
                        className={`aspect-square w-full rounded-md flex items-center justify-center mb-2 overflow-hidden ${
                          selected
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <PatternIcon
                          type={opt.value}
                          className="h-full w-full p-1.5"
                        />
                      </div>
                      <div className="flex items-start justify-between gap-1.5 min-h-[2.5rem]">
                        <span className="text-sm font-bold leading-tight flex-1">
                          {opt.label}
                        </span>
                        <span
                          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold leading-none mt-0.5 tabular-nums ${
                            selected
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          +{Math.round(opt.waste * 100)}%
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {selectedLayout && (
                <p className="text-sm text-muted-foreground leading-snug px-1">
                  <span className="font-semibold text-foreground">
                    {selectedLayout.label}:
                  </span>{" "}
                  {selectedLayout.description}{" "}
                  <span className="text-foreground/80 font-medium">
                    {wastePct}% waste applied.
                  </span>
                </p>
              )}
            </CardContent>
          </Card>

          {/* Material Settings */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="h-5 w-5 text-primary" />
                Material &amp; Depth
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <Label className="text-base font-semibold mb-2 block">
                  Paver Size (inches)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.25"
                    value={paverWidth}
                    onChange={(e) => setPaverWidth(e.target.value)}
                    className="h-14 text-lg font-semibold text-center"
                    placeholder="W"
                    aria-label="Paver width inches"
                  />
                  <span className="text-muted-foreground text-xl font-bold">×</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.25"
                    value={paverLength}
                    onChange={(e) => setPaverLength(e.target.value)}
                    className="h-14 text-lg font-semibold text-center"
                    placeholder="L"
                    aria-label="Paver length inches"
                  />
                  <span className="text-muted-foreground text-base font-medium w-8">in</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-base font-semibold mb-2 block">
                    Base Depth (in)
                  </Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.5"
                    value={baseDepth}
                    onChange={(e) => setBaseDepth(e.target.value)}
                    className="h-14 text-lg font-semibold text-center"
                  />
                </div>
                <div>
                  <Label className="text-base font-semibold mb-2 block">
                    Sand Depth (in)
                  </Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.25"
                    value={sandDepth}
                    onChange={(e) => setSandDepth(e.target.value)}
                    className="h-14 text-lg font-semibold text-center"
                  />
                </div>
              </div>

              {/* Safety margin */}
              <label
                htmlFor="safety-margin"
                className={`flex items-center gap-3 cursor-pointer rounded-lg border p-4 transition-colors hover-elevate ${
                  safetyOn
                    ? "border-primary bg-primary/5"
                    : "border-border bg-background"
                }`}
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-md shrink-0 ${
                    safetyOn
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-base font-semibold leading-tight">
                    Safety Margin
                  </div>
                  <div className="text-sm text-muted-foreground leading-tight mt-0.5">
                    Add 5% extra to all materials
                  </div>
                </div>
                <Switch
                  id="safety-margin"
                  checked={safetyOn}
                  onCheckedChange={setSafetyOn}
                  aria-label="Toggle safety margin"
                />
              </label>
            </CardContent>
          </Card>

          {/* Pricing (optional) */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <DollarSign className="h-5 w-5 text-primary" />
                Pricing
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  Optional
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="paver-price" className="text-sm font-medium">
                  Price per Paver
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">
                    $
                  </span>
                  <Input
                    id="paver-price"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={paverPrice}
                    onChange={(e) => setPaverPrice(e.target.value)}
                    className="h-14 pl-8 text-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="base-price" className="text-sm font-medium">
                    Base / cu yd
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">
                      $
                    </span>
                    <Input
                      id="base-price"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={basePrice}
                      onChange={(e) => setBasePrice(e.target.value)}
                      className="h-14 pl-8 text-lg"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sand-price" className="text-sm font-medium">
                    Sand / cu yd
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">
                      $
                    </span>
                    <Input
                      id="sand-price"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={sandPrice}
                      onChange={(e) => setSandPrice(e.target.value)}
                      className="h-14 pl-8 text-lg"
                    />
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter any unit prices to see material cost. Leave blank to skip.
              </p>
            </CardContent>
          </Card>

          {/* Labour (optional) */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <HardHat className="h-5 w-5 text-primary" />
                Labour
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  Optional
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
                <button
                  type="button"
                  onClick={() => setLabourMode("rate_per_area")}
                  className={`h-11 rounded-md text-sm font-bold transition-colors ${
                    labourMode === "rate_per_area"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover-elevate"
                  }`}
                >
                  Rate per {unit === "sqft" ? "sq ft" : "sq m"}
                </button>
                <button
                  type="button"
                  onClick={() => setLabourMode("hourly")}
                  className={`h-11 rounded-md text-sm font-bold transition-colors ${
                    labourMode === "hourly"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover-elevate"
                  }`}
                >
                  Hourly
                </button>
              </div>

              {labourMode === "rate_per_area" ? (
                <div className="space-y-2">
                  <Label htmlFor="labour-rate" className="text-sm font-medium">
                    Install Rate per {unit === "sqft" ? "sq ft" : "sq m"}
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">
                      $
                    </span>
                    <Input
                      id="labour-rate"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={labourRatePerArea}
                      onChange={(e) => setLabourRatePerArea(e.target.value)}
                      className="h-14 pl-8 text-lg"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Typical install rates range CA$8 – CA$25 per sq ft.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="labour-hourly" className="text-sm font-medium">
                      Hourly Rate per Worker
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">
                        $
                      </span>
                      <Input
                        id="labour-hourly"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={labourHourlyRate}
                        onChange={(e) => setLabourHourlyRate(e.target.value)}
                        className="h-14 pl-8 text-lg"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="labour-crew" className="text-sm font-medium">
                        Crew Size
                      </Label>
                      <Input
                        id="labour-crew"
                        type="number"
                        inputMode="numeric"
                        step="1"
                        min="1"
                        placeholder="2"
                        value={labourCrewSize}
                        onChange={(e) => setLabourCrewSize(e.target.value)}
                        className="h-14 text-lg text-center font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="labour-hours" className="text-sm font-medium">
                        Total Hours
                      </Label>
                      <Input
                        id="labour-hours"
                        type="number"
                        inputMode="decimal"
                        step="0.5"
                        min="0"
                        placeholder="0"
                        value={labourHours}
                        onChange={(e) => setLabourHours(e.target.value)}
                        className="h-14 text-lg text-center font-bold"
                      />
                    </div>
                  </div>
                </div>
              )}

              {totals.labourCost > 0 && (
                <div className="flex items-baseline justify-between rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Labour Subtotal
                  </span>
                  <span className="text-xl font-extrabold text-primary tabular-nums">
                    {formatCurrency(totals.labourCost)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Areas */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Ruler className="h-5 w-5 text-primary" />
                Project Areas
              </CardTitle>
              <div
                role="tablist"
                aria-label="Unit"
                className="inline-flex rounded-md border border-border bg-muted p-0.5"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={unit === "sqft"}
                  onClick={() => setUnit("sqft")}
                  className={`px-4 py-2 text-sm font-bold rounded-sm transition-colors ${
                    unit === "sqft"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  sq ft
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={unit === "sqm"}
                  onClick={() => setUnit("sqm")}
                  className={`px-4 py-2 text-sm font-bold rounded-sm transition-colors ${
                    unit === "sqm"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  sq m
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {areas.map((a, idx) => {
                const lengthLabel = unit === "sqft" ? "ft" : "m";
                const areaLabel = unit === "sqft" ? "sq ft" : "sq m";
                const computed = effectiveAreaValue(a);
                return (
                  <div
                    key={a.id}
                    className="rounded-lg border border-border bg-background p-3 space-y-3"
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        value={a.name}
                        onChange={(e) =>
                          updateArea(a.id, { name: e.target.value })
                        }
                        placeholder={`Area ${idx + 1}`}
                        className="h-12 text-base font-semibold flex-1 min-w-0"
                        aria-label="Area name"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeArea(a.id)}
                        disabled={areas.length <= 1}
                        aria-label="Remove area"
                        className="h-12 w-12 shrink-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>

                    <div
                      role="tablist"
                      aria-label="Input mode"
                      className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1"
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={a.mode === "dimensions"}
                        onClick={() =>
                          updateArea(a.id, { mode: "dimensions" })
                        }
                        className={`h-10 rounded-sm text-sm font-bold transition-colors ${
                          a.mode === "dimensions"
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover-elevate"
                        }`}
                      >
                        Length × Width
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={a.mode === "area"}
                        onClick={() => updateArea(a.id, { mode: "area" })}
                        className={`h-10 rounded-sm text-sm font-bold transition-colors ${
                          a.mode === "area"
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover-elevate"
                        }`}
                      >
                        Total Area
                      </button>
                    </div>

                    {a.mode === "dimensions" ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <Label className="text-xs font-semibold text-muted-foreground mb-1 block uppercase tracking-wide">
                              Length ({lengthLabel})
                            </Label>
                            <Input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="any"
                              value={a.length}
                              onChange={(e) =>
                                updateArea(a.id, { length: e.target.value })
                              }
                              placeholder="0"
                              className="h-16 text-2xl font-bold text-center tabular-nums"
                              aria-label="Length"
                            />
                          </div>
                          <span className="text-muted-foreground text-2xl font-bold pt-6">
                            ×
                          </span>
                          <div className="flex-1">
                            <Label className="text-xs font-semibold text-muted-foreground mb-1 block uppercase tracking-wide">
                              Width ({lengthLabel})
                            </Label>
                            <Input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="any"
                              value={a.width}
                              onChange={(e) =>
                                updateArea(a.id, { width: e.target.value })
                              }
                              placeholder="0"
                              className="h-16 text-2xl font-bold text-center tabular-nums"
                              aria-label="Width"
                            />
                          </div>
                        </div>
                        <div className="flex items-baseline justify-between rounded-md bg-primary/10 border border-primary/30 px-3 py-2">
                          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                            Area
                          </span>
                          <span className="text-xl font-extrabold text-primary tabular-nums">
                            {computed > 0
                              ? `${formatNumber(computed, computed >= 100 ? 0 : 1)} ${areaLabel}`
                              : `— ${areaLabel}`}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="any"
                          value={a.value}
                          onChange={(e) =>
                            updateArea(a.id, { value: e.target.value })
                          }
                          placeholder="0"
                          className="h-16 text-2xl font-bold text-center flex-1 tabular-nums"
                          aria-label="Area size"
                        />
                        <span className="text-base font-semibold text-muted-foreground w-14 text-right">
                          {areaLabel}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}

              <Button
                type="button"
                variant="outline"
                onClick={addArea}
                className="w-full h-14 text-base font-bold border-dashed"
              >
                <Plus className="h-6 w-6 mr-2" />
                Add Another Area
              </Button>
            </CardContent>
          </Card>

          {/* Save Estimate */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bookmark className="h-5 w-5 text-primary" />
                Save Estimate
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="customer-name" className="text-sm font-medium">
                  Customer or Job Name
                </Label>
                <Input
                  id="customer-name"
                  type="text"
                  placeholder="e.g. Smith Driveway"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="h-14 text-lg"
                />
              </div>
              <Button
                type="button"
                onClick={handleSaveEstimate}
                disabled={!totals.ready}
                className="w-full h-14 text-base font-bold"
              >
                <Save className="h-5 w-5 mr-2" />
                {totals.ready ? "Save Estimate" : "Enter values to save"}
              </Button>
            </CardContent>
          </Card>

          {/* Saved Estimates */}
          {savedEstimates.length > 0 && (
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FolderOpen className="h-5 w-5 text-primary" />
                  Saved Estimates
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    {savedEstimates.length}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {savedEstimates.map((est) => (
                  <SavedEstimateRow
                    key={est.id}
                    estimate={est}
                    onLoad={() => handleLoadEstimate(est)}
                    onShare={() => handleShareEstimate(est)}
                    onCopy={() => handleCopyEstimate(est)}
                    onDelete={() => handleDeleteEstimate(est.id)}
                  />
                ))}
              </CardContent>
            </Card>
          )}
        </main>

        {/* Sticky Results */}
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85 shadow-lg">
          <div className="mx-auto max-w-2xl px-4 py-4">
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="text-base font-bold uppercase tracking-wide text-foreground">
                Materials Needed
              </h2>
              <span className="text-sm font-medium text-muted-foreground">
                {totals.ready
                  ? `${formatNumber(totals.totalSqft, 0)} sq ft · +${totalOverheadPct}%`
                  : "Enter values to calculate"}
              </span>
            </div>
            {totals.ready && totals.hasPricing && (
              <div className="mb-3 rounded-lg bg-primary px-4 py-3 text-primary-foreground shadow-sm">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-bold uppercase tracking-wide">
                    Total Cost
                  </span>
                  <span className="text-3xl font-extrabold tabular-nums">
                    {formatCurrency(totals.totalCost)}
                  </span>
                </div>
                {totals.materialsCost > 0 && totals.labourCost > 0 && (
                  <div className="mt-1.5 flex justify-between text-xs font-medium text-primary-foreground/80 tabular-nums">
                    <span>
                      Materials {formatCurrency(totals.materialsCost)}
                    </span>
                    <span>
                      Labour {formatCurrency(totals.labourCost)}
                    </span>
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              <ResultBlock
                label="Pavers"
                value={
                  totals.ready ? totals.totalPavers.toLocaleString() : "—"
                }
                unit="pcs"
                subValue={
                  totals.ready && totals.paverCost > 0
                    ? formatCurrency(totals.paverCost)
                    : undefined
                }
              />
              <ResultBlock
                label="Base"
                value={totals.ready ? formatNumber(totals.baseCYRounded, 1) : "—"}
                unit="cu yd"
                subValue={
                  totals.ready && totals.baseCost > 0
                    ? formatCurrency(totals.baseCost)
                    : undefined
                }
              />
              <ResultBlock
                label="Sand"
                value={totals.ready ? formatNumber(totals.sandCYRounded, 1) : "—"}
                unit="cu yd"
                subValue={
                  totals.ready && totals.sandCost > 0
                    ? formatCurrency(totals.sandCost)
                    : undefined
                }
              />
            </div>
          </div>
        </div>

        <Toaster />
      </div>
    </TooltipProvider>
  );
}

function ResultBlock({
  label,
  value,
  unit,
  subValue,
}: {
  label: string;
  value: string;
  unit: string;
  subValue?: string;
}) {
  return (
    <div className="rounded-lg bg-primary/10 border border-primary/30 px-2 py-3 text-center">
      <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground leading-tight">
        {label}
      </div>
      <div className="text-2xl font-extrabold text-foreground leading-none mt-1 tabular-nums">
        {value}
      </div>
      <div className="text-xs font-medium text-muted-foreground leading-tight mt-1">
        {unit}
      </div>
      {subValue && (
        <div className="text-sm font-bold text-primary leading-none mt-1.5 tabular-nums border-t border-primary/30 pt-1.5">
          {subValue}
        </div>
      )}
    </div>
  );
}

function SavedEstimateRow({
  estimate,
  onLoad,
  onShare,
  onCopy,
  onDelete,
}: {
  estimate: SavedEstimate;
  onLoad: () => void;
  onShare: () => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  const s = estimate.snapshot;
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-bold text-base truncate">
            {estimate.customerName}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {formatSavedDate(estimate.savedAt)} · {s.layoutLabel} ·{" "}
            {formatNumber(s.totalSqft, 0)} sq ft
          </div>
        </div>
        {s.totalCost > 0 && (
          <div className="text-lg font-extrabold text-primary tabular-nums shrink-0">
            {formatCurrency(s.totalCost)}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-muted px-2 py-1 font-medium">
          {s.totalPavers.toLocaleString()} pavers
        </span>
        <span className="rounded-full bg-muted px-2 py-1 font-medium">
          {formatNumber(s.baseCYRounded, 1)} cy base
        </span>
        <span className="rounded-full bg-muted px-2 py-1 font-medium">
          {formatNumber(s.sandCYRounded, 1)} cy sand
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onLoad}
          className="h-11 text-xs font-bold"
        >
          <FolderOpen className="h-4 w-4 mr-1" />
          Open
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onShare}
          className="h-11 text-xs font-bold"
        >
          <Share2 className="h-4 w-4 mr-1" />
          Share
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCopy}
          className="h-11 text-xs font-bold"
        >
          <Copy className="h-4 w-4 mr-1" />
          Copy
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onDelete}
          className="h-11 text-xs font-bold text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default App;
