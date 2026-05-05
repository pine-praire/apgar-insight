import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { collection, addDoc } from "firebase/firestore";
import { auth, db } from "@/integrations/firebase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import {
  PROCRASTINATION_QUESTIONS,
  PROCRASTINATION_TYPES,
  calculateProcrastinationResult,
  type ProcrastinationType,
} from "@/lib/procrastination";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/procrastination")({
  component: ProcrastinationTestPage,
});

function ProcrastinationTestPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<ProcrastinationType[]>([]);
  const [selected, setSelected] = useState<ProcrastinationType | null>(null);
  const [result, setResult] = useState<ProcrastinationType[] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "login" } });
  }, [loading, user, navigate]);

  if (!user) return null;

  const total = PROCRASTINATION_QUESTIONS.length;
  const q = PROCRASTINATION_QUESTIONS[step];
  const progress = ((step + (selected ? 1 : 0)) / total) * 100;

  const next = async () => {
    if (!selected) return;
    const newAnswers = [...answers, selected];

    if (step < total - 1) {
      setAnswers(newAnswers);
      setSelected(null);
      setStep(step + 1);
      return;
    }

    const types = calculateProcrastinationResult(newAnswers);
    setSubmitting(true);

    const currentUser = auth.currentUser;
    if (!currentUser) {
      setSubmitting(false);
      toast.error("Сессия истекла. Войдите снова.");
      navigate({ to: "/auth", search: { mode: "login" } });
      return;
    }

    try {
      await addDoc(collection(db, "procrastination_results"), {
        userId: currentUser.uid,
        types,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[procrastination_results insert]", err);
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSubmitting(false);
    }

    setResult(types);
  };

  const restart = () => {
    setStep(0);
    setAnswers([]);
    setSelected(null);
    setResult(null);
  };

  if (result) {
    return <ResultScreen types={result} onRestart={restart} />;
  }

  return (
    <div className="min-h-screen px-4 py-12" style={{ background: "var(--gradient-soft)" }}>
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between text-sm text-muted-foreground">
          <span>Вопрос {step + 1} из {total}</span>
          <span className="font-medium text-primary">Тест на прокрастинацию</span>
        </div>
        <Progress value={progress} className="mb-8" />

        <div className="rounded-2xl border bg-card p-8" style={{ boxShadow: "var(--shadow-elegant)" }}>
          <h2 className="text-xl font-bold">{q.text}</h2>

          <div className="mt-6 space-y-3">
            {q.options.map((opt, i) => {
              const isSelected = selected === opt.type;
              return (
                <button
                  key={i}
                  onClick={() => setSelected(opt.type)}
                  className={`flex w-full items-start gap-4 rounded-xl border-2 p-4 text-left transition-all ${
                    isSelected ? "border-primary bg-accent" : "border-border hover:border-primary/50"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="text-sm leading-relaxed">{opt.text}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-8 flex justify-between gap-3">
            <Button
              variant="outline"
              onClick={() => {
                if (step === 0) {
                  navigate({ to: "/dashboard" });
                } else {
                  setStep(step - 1);
                  setSelected(answers[step - 1] ?? null);
                  setAnswers(answers.slice(0, step - 1));
                }
              }}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Назад
            </Button>
            <Button onClick={next} disabled={!selected || submitting}>
              {step === total - 1 ? (submitting ? "..." : "Завершить") : "Далее"}
              {step < total - 1 && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultScreen({ types, onRestart }: { types: ProcrastinationType[]; onRestart: () => void }) {
  const isTie = types.length > 1;

  return (
    <div className="min-h-screen px-4 py-12" style={{ background: "var(--gradient-soft)" }}>
      <div className="mx-auto max-w-2xl space-y-6">
        {isTie && (
          <p className="text-center text-sm font-medium text-muted-foreground uppercase tracking-wider">
            У вас два ведущих типа
          </p>
        )}

        {types.map((type) => {
          const info = PROCRASTINATION_TYPES[type];
          return (
            <div key={type} className="rounded-2xl border bg-card p-8" style={{ boxShadow: "var(--shadow-elegant)" }}>
              <div className="text-center">
                <div className="text-6xl">{info.emoji}</div>
                <h2 className="mt-3 text-3xl font-bold">{info.title}</h2>
              </div>
              <p className="mt-6 text-muted-foreground leading-relaxed">{info.description}</p>
              <div className="mt-6 rounded-xl bg-accent/60 p-4">
                <p className="text-sm font-semibold mb-1">Что это значит</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{info.insight}</p>
              </div>
              <div className="mt-6">
                <p className="font-semibold mb-3">Что поможет</p>
                <ul className="space-y-3">
                  {info.tools.map((tool, i) => (
                    <li key={i} className="flex gap-3 text-sm leading-relaxed">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-muted-foreground">{tool}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={onRestart} variant="outline" className="flex-1">
            <RotateCcw className="mr-2 h-4 w-4" />
            Пройти снова
          </Button>
          <Button asChild className="flex-1">
            <Link to="/dashboard">На главную</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
