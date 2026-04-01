import { useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe, Loader2 } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import ProductsPage from "@/pages/products";
import BoxTypesPage from "@/pages/box-types";
import PalletTypesPage from "@/pages/pallet-types";
import OrdersPage from "@/pages/orders";
import SettingsPage from "@/pages/settings";
import LandingPage from "@/pages/landing";
import { I18nContext, getTranslations, localeNames, useI18n, type Locale } from "@/i18n";
import { useAuth } from "@/hooks/use-auth";

function AuthenticatedShell() {
  const { locale, setLocale } = useI18n();

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between h-12 px-3 border-b bg-card shrink-0">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
              <SelectTrigger className="h-8 w-[130px] text-xs" data-testid="select-locale">
                <Globe className="w-3.5 h-3.5 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(localeNames) as Locale[]).map((l) => (
                  <SelectItem key={l} value={l}>{localeNames[l]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </header>
          <main className="flex-1 overflow-auto">
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/products" component={ProductsPage} />
              <Route path="/boxes" component={BoxTypesPage} />
              <Route path="/pallets" component={PalletTypesPage} />
              <Route path="/orders" component={OrdersPage} />
              <Route path="/settings" component={SettingsPage} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppRouter() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" data-testid="loading-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LandingPage />;
  }

  return <AuthenticatedShell />;
}

function App() {
  const [locale, setLocale] = useState<Locale>("pt");
  const t = getTranslations(locale);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <AppRouter />
        </TooltipProvider>
      </QueryClientProvider>
    </I18nContext.Provider>
  );
}

export default App;
