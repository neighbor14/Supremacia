import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { useEffect } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useLang } from "./i18n/useI18n";
import { htmlLangAttr } from "./i18n";
import Home from "./pages/Home";
import SetupScreen from "./pages/SetupScreen";
import GameScreen from "./pages/GameScreen";
import Lobby from "./pages/Lobby";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/setup" component={SetupScreen} />
      <Route path="/lobby" component={Lobby} />
      <Route path="/game" component={GameScreen} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Aplica o idioma detectado/salvo ao <html lang> no boot e a cada troca.
  const lang = useLang();
  useEffect(() => {
    document.documentElement.lang = htmlLangAttr(lang);
  }, [lang]);

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
