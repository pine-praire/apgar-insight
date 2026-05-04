import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Cookie } from "lucide-react";

const STORAGE_KEY = "cookie-consent";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
  }, []);

  const respond = (accepted: boolean) => {
    localStorage.setItem(STORAGE_KEY, accepted ? "accepted" : "declined");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card px-4 py-4 shadow-lg md:px-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Cookie className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="text-sm text-muted-foreground">
            Мы используем файлы cookie для корректной работы сервиса.{" "}
            <Link to="/privacy" className="text-primary underline underline-offset-2">
              Политика конфиденциальности
            </Link>
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="outline" onClick={() => respond(false)}>
            Отклонить
          </Button>
          <Button size="sm" onClick={() => respond(true)}>
            Принять
          </Button>
        </div>
      </div>
    </div>
  );
}
