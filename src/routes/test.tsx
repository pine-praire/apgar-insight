import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { APGAR_QUESTIONS, type ApgarKey } from "@/lib/apgar";
import { collection, addDoc } from "firebase/firestore";
import { auth, db } from "@/integrations/firebase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/test")({
  component: TestPage,
});

function TestPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<Record<ApgarKey, 0 | 1 | 2>>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "login" } });
  }, [loading, user, navigate]);

  if (!user) return null;

  const q = APGAR_QUESTIONS[step];
  const total = APGAR_QUESTIONS.length;
  const progress = ((step + 1) / total) * 100;
  const current = answers[q.key];

  const next = async () => {
    if (current === undefined) return;
    if (step < total - 1) {
      setStep(step + 1);
      return;
    }
    setSubmitting(true);

    const currentUser = auth.currentUser;
    if (!currentUser) {
      setSubmitting(false);
      toast.error("Сессия истекла. Войдите снова.");
      navigate({ to: "/auth", search: { mode: "login" } });
      return;
    }

    const score = APGAR_QUESTIONS.reduce((sum, qq) => sum + (answers[qq.key] ?? 0), 0);
    const scores = APGAR_QUESTIONS.reduce<Record<string, number>>((acc, qq) => {
      acc[qq.key] = answers[qq.key] ?? 0;
      return acc;
    }, {});

    try {
      const docRef = await addDoc(collection(db, "apgar_results"), {
        userId: currentUser.uid,
        score,
        scores,
        createdAt: new Date().toISOString(),
      });
      navigate({ to: "/result/$id", params: { id: docRef.id } });
    } catch (err) {
      console.error("[apgar_results insert]", err);
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-12" style={{ background: "var(--gradient-soft)" }}>
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between text-sm text-muted-foreground">
          <span>Вопрос {step + 1} из {total}</span>
          <span className="font-mono text-primary">{q.letter}</span>
        </div>
        <Progress value={progress} className="mb-8" />

        <div className="rounded-2xl border bg-card p-8" style={{ boxShadow: "var(--shadow-elegant)" }}>
          <h2 className="text-2xl font-bold">{q.title}</h2>
          <p className="mt-2 text-muted-foreground">{q.subtitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">{q.description}</p>

          <div className="mt-6 space-y-3">
            {q.options.map((opt) => {
              const selected = current === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setAnswers({ ...answers, [q.key]: opt.value })}
                  className={`flex w-full items-start gap-4 rounded-xl border-2 p-4 text-left transition-all ${
                    selected ? "border-primary bg-accent" : "border-border hover:border-primary/50"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold ${
                      selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {opt.value}
                  </span>
                  <span className="text-sm">{opt.label}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-8 flex justify-between gap-3">
            <Button
              variant="outline"
              onClick={() => (step === 0 ? navigate({ to: "/dashboard" }) : setStep(step - 1))}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Назад
            </Button>
            <Button onClick={next} disabled={current === undefined || submitting}>
              {step === total - 1 ? (submitting ? "..." : "Завершить") : "Далее"}
              {step < total - 1 && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
