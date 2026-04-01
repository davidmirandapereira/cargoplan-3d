import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, Package, BoxIcon, Layers, Globe, CheckCircle2, ArrowRight, Truck, BarChart3, FileSpreadsheet, Shield, Zap, Weight, Lightbulb, FileText, Eye, Settings, ClipboardList } from "lucide-react";
import type { Locale } from "@/i18n";
import { localeNames } from "@/i18n";

export default function LandingPage() {
  const { locale, setLocale, t } = useI18n();

  const features = [
    { icon: Package, title: t.landing.feature1Title, desc: t.landing.feature1Desc },
    { icon: Weight, title: t.landing.feature2Title, desc: t.landing.feature2Desc },
    { icon: Lightbulb, title: t.landing.feature3Title, desc: t.landing.feature3Desc },
    { icon: Eye, title: t.landing.feature4Title, desc: t.landing.feature4Desc },
    { icon: Settings, title: t.landing.feature5Title, desc: t.landing.feature5Desc },
    { icon: Truck, title: t.landing.feature6Title, desc: t.landing.feature6Desc },
    { icon: FileText, title: t.landing.feature7Title, desc: t.landing.feature7Desc },
    { icon: FileSpreadsheet, title: t.landing.feature8Title, desc: t.landing.feature8Desc },
    { icon: Globe, title: t.landing.feature9Title, desc: t.landing.feature9Desc },
  ];

  const steps = [
    { title: t.landing.step1Title, desc: t.landing.step1Desc, icon: ClipboardList },
    { title: t.landing.step2Title, desc: t.landing.step2Desc, icon: Package },
    { title: t.landing.step3Title, desc: t.landing.step3Desc, icon: BarChart3 },
  ];

  const plans = [
    {
      name: t.landing.trialName,
      price: t.landing.trialPrice,
      badge: null,
      features: [t.landing.trialF1, t.landing.trialF2, t.landing.trialF3, t.landing.trialF4],
      cta: t.landing.startTrial,
      highlight: false,
    },
    {
      name: t.landing.basicName,
      price: t.landing.basicPrice,
      badge: t.landing.popular,
      features: [t.landing.basicF1, t.landing.basicF2, t.landing.basicF3, t.landing.basicF4, t.landing.basicF5],
      cta: t.landing.choosePlan,
      highlight: true,
    },
    {
      name: t.landing.proName,
      price: t.landing.proPrice,
      badge: null,
      features: [t.landing.proF1, t.landing.proF2, t.landing.proF3, t.landing.proF4, t.landing.proF5, t.landing.proF6],
      cta: t.landing.choosePlan,
      highlight: false,
    },
  ];

  return (
    <div className="min-h-screen bg-background" data-testid="landing-page">
      <nav className="h-14 border-b bg-card/80 backdrop-blur-sm flex items-center px-4 gap-2 sticky top-0 z-50">
        <div className="flex items-center gap-1.5 font-bold text-lg text-primary mr-3">
          <Calculator className="w-5 h-5" />
          {t.app.title}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
            <SelectTrigger className="h-8 w-[130px] text-xs" data-testid="landing-select-locale">
              <Globe className="w-3.5 h-3.5 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(localeNames) as Locale[]).map((l) => (
                <SelectItem key={l} value={l}>{localeNames[l]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button asChild data-testid="button-login">
            <a href="/api/login">{t.landing.login}</a>
          </Button>
        </div>
      </nav>

      <section className="relative py-16 md:py-24 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-primary/3 to-background" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        <div className="relative max-w-6xl mx-auto grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <Badge variant="secondary" className="mb-4" data-testid="badge-hero">
              <Zap className="w-3 h-3 mr-1" />
              {t.landing.heroBadge}
            </Badge>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-5 leading-tight" data-testid="text-hero-title">
              {t.landing.heroTitle}
            </h1>
            <p className="text-base md:text-lg text-muted-foreground mb-8 leading-relaxed" data-testid="text-hero-subtitle">
              {t.landing.heroSubtitle}
            </p>
            <div className="flex flex-wrap gap-3 mb-8">
              <Button size="lg" asChild data-testid="button-hero-cta">
                <a href="/api/login">
                  {t.landing.startFree}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </a>
              </Button>
              <Button size="lg" variant="outline" asChild data-testid="button-hero-demo">
                <a href="#how-it-works">
                  {t.landing.watchDemo}
                </a>
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: t.landing.heroStat1, value: t.landing.heroStat1Value },
                { label: t.landing.heroStat2, value: t.landing.heroStat2Value },
                { label: t.landing.heroStat3, value: t.landing.heroStat3Value },
              ].map((stat, i) => (
                <div key={i} className="text-center p-3 rounded-lg bg-card border" data-testid={`stat-hero-${i}`}>
                  <div className="text-lg md:text-xl font-bold text-primary">{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="rounded-xl overflow-hidden border shadow-2xl shadow-primary/10">
              <img
                src="/images/hero-cargo-3d.png"
                alt="CargoPlan 3D"
                className="w-full h-auto"
                data-testid="img-hero"
              />
            </div>
            <div className="absolute -bottom-4 -left-4 bg-card border rounded-lg p-3 shadow-lg hidden md:block">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                </div>
                <div>
                  <div className="text-xs font-bold">92.4%</div>
                  <div className="text-[10px] text-muted-foreground">{t.landing.heroStat1}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-4 max-w-6xl mx-auto" id="features">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-3" data-testid="text-features-title">
            {t.landing.featuresTitle}
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {t.landing.featuresSubtitle}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <Card key={i} className="group hover:border-primary/30 transition-colors" data-testid={`card-feature-${i}`}>
              <CardContent className="pt-6">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-base mb-1.5">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="py-16 px-4 bg-muted/30" id="how-it-works">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-3" data-testid="text-how-title">
              {t.landing.howItWorksTitle}
            </h2>
            <p className="text-muted-foreground">
              {t.landing.howItWorksSubtitle}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map((step, i) => (
              <div key={i} className="relative" data-testid={`step-${i}`}>
                <div className="flex flex-col items-center text-center">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4 border-2 border-primary/20">
                    <step.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-bold text-base mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
                {i < 2 && (
                  <div className="hidden md:block absolute top-7 left-[calc(50%+40px)] w-[calc(100%-80px)]">
                    <div className="border-t-2 border-dashed border-primary/20 w-full" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-4" id="pricing">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-10" data-testid="text-pricing-title">
            {t.landing.pricingTitle}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan, i) => (
              <Card
                key={i}
                className={`relative ${plan.highlight ? "border-primary ring-2 ring-primary/20 shadow-lg" : ""}`}
                data-testid={`card-plan-${i}`}
              >
                {plan.badge && (
                  <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2" data-testid={`badge-plan-${i}`}>
                    {plan.badge}
                  </Badge>
                )}
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <p className="text-3xl font-bold text-primary mt-2">{plan.price}</p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 mb-6">
                    {plan.features.map((f, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={plan.highlight ? "default" : "outline"}
                    asChild
                    data-testid={`button-plan-${i}`}
                  >
                    <a href="/api/login">{plan.cta}</a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <footer className="py-8 px-4 border-t text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-1.5 mb-2">
          <Shield className="w-4 h-4" />
          {t.landing.footerSecurity}
        </div>
        <p>&copy; {new Date().getFullYear()} CargoPlan 3D. {t.landing.footerRights}</p>
      </footer>
    </div>
  );
}
