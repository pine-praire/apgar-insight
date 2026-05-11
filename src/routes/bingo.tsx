import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { collection, addDoc, updateDoc, doc } from "firebase/firestore";
import { auth, db } from "@/integrations/firebase/client";
import { useAuth } from "@/lib/auth";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/bingo")({
  component: BingoPage,
});

const bingoItems = [
  "Устала с утра",
  "Раздражение на всех",
  "Не могу начать",
  "Кусок в горло не лезет",
  "Болит голова",
  "Жду выходных с понедельника",
  "Не хочу никого видеть",
  "Купила курс — не открыла",
  "Работаю много — нет результата",
  "Бессонница",
  "Слезы без причины",
  "Снижен иммунитет",
  "Burn out ★",
  "Цинизм и черный юмор",
  "Все бесполезно",
  "Ничего не радует",
  "Гиперфиксируюсь",
  "Снова набрала проекты",
  "Не помню, зачем работаю",
  "Врезаюсь в косяки",
  "Застывший взгляд",
  "Прокрасти-нирую",
  "Хочу, чтоб все отстали",
  "Плачу в душе",
  "Еда как успокоение",
];

interface Slide {
  id: number;
  title: string;
  source: string;
  dark: boolean;
  accent: string;
  body: string;
}

// accent values are hex so they can be used in template literals for alpha variants
const slides: Slide[] = [
  {
    id: 0,
    title: "Выгорание редко приходит одно",
    source: "Маслач и Джексон, модель MBI, 1981",
    dark: true,
    accent: "#FFC150",
    body: `По данным исследований, выгорание затрагивает от 30 до 67% работающих взрослых в зависимости от профессии.\n\nОно тянет за собой: тревогу, депрессию, нарушения сна, проблемы с телом и отношениями.\n\nПочему все это липнет к выгоранию? Хронический стресс, нарушение саморегуляции, дефицит восстановления и перфекционизм идут рядом.`,
  },
  {
    id: 1,
    title: "Эмоциональное истощение",
    source: "Маслач, 1978 — ~67% работающих взрослых на поздних стадиях",
    dark: true,
    accent: "#FFC150",
    body: `Первый компонент выгорания по Маслач.\n\nНет сил на эмоции. Не потому что черствая — а потому что мозг работает на уровне «крокодила», до лимбической системы просто не доходит.\n\nУстала с утра. К вечеру — ноль.\n\nИ главное — продолжать. Отдыхать некогда.\nКто устал — сама виновата.`,
  },
  {
    id: 2,
    title: "Деперсонализация",
    source: "Маслач и Джексон, MBI — встречается у ~40% с выгоранием",
    dark: false,
    accent: "#DC4F3C",
    body: `Второй компонент. Ты не знаешь, чего хочешь. Кем являешься. Что чувствуешь.\n\nВсе решения принимаются на автопилоте — по старым схемам, записанным давно.\n\nТы позволяешь другим решать за тебя. Это освобождает от ответственности — и одновременно уводит от себя всё дальше.`,
  },
  {
    id: 3,
    title: "Нарушения сна",
    source: "Sonnenschein et al., 2007 — ~60% с выгоранием имеют расстройства сна",
    dark: true,
    accent: "#FFC150",
    body: `При выгорании сон съезжает сразу в нескольких местах.\n\nДолго не можешь заснуть.\nПросыпаешься среди ночи.\nУтром — как будто не спала вообще.\n\nЭто не лень и не слабая нервная система. Кортизол не дает успокоиться — тело не понимает, что опасности нет.`,
  },
  {
    id: 4,
    title: "Тревога и раздражение",
    source: "Schaufeli & Taris, 2014 — тревога сопровождает выгорание в ~50% случаев",
    dark: false,
    accent: "#DC4F3C",
    body: `Все вокруг раздражают. Докапываются. Мешают.\n\nТы всё время в напряжении: не забыла ли, не опоздала ли, не пропустила ли важное.\n\nИ главное — делать. Не останавливаться.\nКто устал — тот слабак.\n\nТревога при выгорании часто выглядит как злость. Или как попытка держать всё под контролем, когда сил уже нет.`,
  },
  {
    id: 5,
    title: "Редукция достижений",
    source: "Маслач, третий компонент MBI — умаление собственного вклада",
    dark: true,
    accent: "#FFC150",
    body: `Третий компонент выгорания.\n\nТы много работаешь — и не видишь в этом смысла. Победы не радуют, неудачи не задевают.\n\nПостепенно мозг начинает ждать не результата, а провала.\n\nДобавь сюда плохой сон, эмоциональные качели и ощущение, что жизнь все время требует больше, чем можешь стабильно выдавать.`,
  },
  {
    id: 6,
    title: "Тело говорит первым",
    source: "Внешние признаки по клинической модели выгорания",
    dark: false,
    accent: "#DC4F3C",
    body: `Тело сигналит раньше, чем ты замечаешь.\n\nОдутловатость лица. Застывший взгляд — глазные мышцы страдают первыми.\nНарушение координации: синяки непонятно откуда, постоянно что-то роняешь.\nРечь становится несвязной.\n\nЕсли видишь в зеркале стеклянный взгляд — это не усталость. Это уже глубокая стадия.`,
  },
  {
    id: 7,
    title: "Стадии выгорания",
    source: "Модель Маслач, адаптация — 4 фазы снижения ресурса",
    dark: true,
    accent: "#FFC150",
    body: `Выгорание развивается в первый раз около двух лет. Каждое следующее — быстрее.\n\n1. Идеализм и чрезмерность — работаешь без остановки, веришь, что так надо.\n2. Истощение — берешь еще курсы, ищешь, что «зажжет».\n3. Потеря цели и цинизм — горизонт планирования 2-3 дня, черный юмор, хочется чтоб все отстали.\n4. Отвращение и депрессия — выйти без помощи почти невозможно.`,
  },
];

function BingoPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [checked, setChecked] = useState(new Set<number>());
  const [activeSlide, setActiveSlide] = useState<number | null>(null);
  const savedDocId = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "login" } });
  }, [loading, user, navigate]);

  const score = checked.size;

  useEffect(() => {
    if (score === 0 || !auth.currentUser) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      try {
        if (!savedDocId.current) {
          const docRef = await addDoc(collection(db, "bingo_results"), {
            userId: currentUser.uid,
            score,
            type: "bingo",
            createdAt: new Date().toISOString(),
          });
          savedDocId.current = docRef.id;
        } else {
          await updateDoc(doc(db, "bingo_results", savedDocId.current), { score });
        }
      } catch (err) {
        console.error("[bingo_results save]", err);
      }
    }, 1500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [score]);

  if (loading || !user) return null;

  const toggle = (i: number) => {
    if (i === 12) return;
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const slide = activeSlide !== null ? slides[activeSlide] : null;

  return (
    <div className="dark" style={{ minHeight: "100vh" }}>
      <div
        style={{
          minHeight: "100vh",
          background: "var(--background)",
          fontFamily: "'Georgia', serif",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "32px 16px 48px",
        }}
      >
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Lora:ital,wght@0,400;0,600;1,400&display=swap');

          .bingo-cell {
            background: var(--card);
            border: 1.5px solid var(--border);
            border-radius: 10px;
            cursor: pointer;
            transition: all 0.18s ease;
            padding: 6px 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            font-family: 'Lora', serif;
            font-size: 10.5px;
            line-height: 1.3;
            color: var(--card-foreground);
            aspect-ratio: 1 / 1;
            user-select: none;
            overflow: hidden;
            word-break: break-word;
          }
          .bingo-cell:hover {
            border-color: var(--primary);
            background: var(--muted);
          }
          .bingo-cell.bingo-checked {
            background: oklch(0.22 0.08 155);
            border-color: var(--primary);
            color: var(--primary);
            font-weight: 600;
          }
          .bingo-cell.bingo-center {
            background: var(--primary);
            border-color: var(--primary);
            color: var(--primary-foreground);
            font-family: 'Bebas Neue', sans-serif;
            font-size: 16px;
            letter-spacing: 1px;
            cursor: default;
            font-weight: 900;
          }
          .bingo-slide-btn {
            background: var(--card);
            border: 1.5px solid var(--border);
            border-radius: 10px;
            padding: 14px 18px;
            cursor: pointer;
            text-align: left;
            transition: all 0.18s ease;
            color: var(--card-foreground);
            font-family: 'Lora', serif;
            width: 100%;
          }
          .bingo-slide-btn:hover {
            border-color: var(--primary);
            background: var(--muted);
          }
          .bingo-slide-btn.bingo-slide-active {
            border-color: var(--primary);
            background: var(--muted);
          }
          .bingo-modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.75);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 100;
            padding: 20px;
          }
          .bingo-modal {
            border-radius: 16px;
            padding: 32px;
            max-width: 480px;
            width: 100%;
            position: relative;
          }
          .bingo-close-btn {
            position: absolute;
            top: 16px;
            right: 16px;
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            opacity: 0.6;
            line-height: 1;
            padding: 4px 8px;
            border-radius: 6px;
            transition: opacity 0.15s;
          }
          .bingo-close-btn:hover { opacity: 1; }
          .bingo-score-bar {
            height: 6px;
            background: var(--muted);
            border-radius: 3px;
            overflow: hidden;
            margin-top: 8px;
          }
          .bingo-score-fill {
            height: 100%;
            background: linear-gradient(90deg, var(--success), var(--primary));
            border-radius: 3px;
            transition: width 0.4s ease;
          }
        `}</style>

        {/* Back button */}
        <div style={{ width: "100%", maxWidth: 540, marginBottom: 16 }}>
          <Button asChild variant="ghost" size="sm" style={{ color: "var(--muted-foreground)" }}>
            <Link to="/dashboard">
              <ArrowLeft className="mr-1 h-4 w-4" />
              На главную
            </Link>
          </Button>
        </div>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: "clamp(36px, 8vw, 64px)",
              color: "var(--destructive)",
              letterSpacing: "3px",
              lineHeight: 1,
              marginBottom: 6,
            }}
          >
            ВЫГОРАНИЕ-БИНГО
          </div>
          <div
            style={{
              fontFamily: "'Lora', serif",
              fontStyle: "italic",
              color: "var(--muted-foreground)",
              fontSize: 14,
              letterSpacing: "0.5px",
            }}
          >
            отметь, что подозрительно знакомо
          </div>
        </div>

        {/* Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 6,
            width: "100%",
            maxWidth: 540,
            marginBottom: 20,
          }}
        >
          {bingoItems.map((item, i) => (
            <div
              key={i}
              className={`bingo-cell ${i === 12 ? "bingo-center" : checked.has(i) ? "bingo-checked" : ""}`}
              onClick={() => toggle(i)}
            >
              {i === 12 ? (
                <span>
                  Burn out
                  <br />★
                </span>
              ) : (
                <span>
                  {checked.has(i) && <span style={{ marginRight: 3 }}>✓</span>}
                  {item === "Прокрасти-нирую" ? (
                    <span style={{ wordBreak: "break-all" }}>
                      Прокрасти-
                      <br />
                      нирую
                    </span>
                  ) : (
                    item
                  )}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Score */}
        <div style={{ width: "100%", maxWidth: 540, marginBottom: 32 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              color: "var(--muted-foreground)",
              fontSize: 12,
              fontFamily: "'Lora', serif",
            }}
          >
            <span>отмечено: {score} из 24</span>
            <span
              style={{
                color:
                  score > 12
                    ? "var(--destructive)"
                    : score > 6
                      ? "var(--warning)"
                      : "var(--success)",
              }}
            >
              {score === 0
                ? "пока ничего"
                : score <= 5
                  ? "стоит понаблюдать"
                  : score <= 12
                    ? "тревожный звоночек"
                    : score <= 18
                      ? "это серьезно"
                      : "срочно нужна пауза"}
            </span>
          </div>
          <div className="bingo-score-bar">
            <div className="bingo-score-fill" style={{ width: `${(score / 24) * 100}%` }} />
          </div>
        </div>

        {/* Divider */}
        <div
          style={{
            width: "100%",
            maxWidth: 540,
            borderTop: "1px solid var(--border)",
            marginBottom: 24,
          }}
        />

        {/* Slides section */}
        <div style={{ width: "100%", maxWidth: 540 }}>
          <div
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 22,
              color: "var(--foreground)",
              letterSpacing: "2px",
              marginBottom: 14,
            }}
          >
            ЧТО ЗА ЭТИМ СТОИТ
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {slides.map((s, i) => (
              <button
                key={s.id}
                className={`bingo-slide-btn ${activeSlide === i ? "bingo-slide-active" : ""}`}
                onClick={() => setActiveSlide(activeSlide === i ? null : i)}
              >
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{s.title}</div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", fontStyle: "italic" }}>
                  {s.source}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Modal */}
        {activeSlide !== null && slide && (
          <div className="bingo-modal-overlay" onClick={() => setActiveSlide(null)}>
            <div
              className="bingo-modal"
              style={{
                background: slide.dark ? "var(--card)" : "#f5f0e8",
                color: slide.dark ? "var(--card-foreground)" : "#1a2235",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="bingo-close-btn"
                style={{ color: slide.dark ? "var(--card-foreground)" : "#1a2235" }}
                onClick={() => setActiveSlide(null)}
              >
                ×
              </button>
              <div
                style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: 28,
                  color: slide.accent,
                  letterSpacing: "1.5px",
                  marginBottom: 6,
                  lineHeight: 1.1,
                  paddingRight: 32,
                }}
              >
                {slide.title}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: slide.dark ? "var(--muted-foreground)" : "#7a6a5a",
                  fontStyle: "italic",
                  marginBottom: 20,
                  fontFamily: "'Lora', serif",
                  borderBottom: `1px solid ${slide.accent}40`,
                  paddingBottom: 12,
                }}
              >
                {slide.source}
              </div>
              <div
                style={{
                  fontFamily: "'Lora', serif",
                  fontSize: 14,
                  lineHeight: 1.75,
                  whiteSpace: "pre-line",
                }}
              >
                {slide.body}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
                <button
                  onClick={() => setActiveSlide(Math.max(0, activeSlide - 1))}
                  disabled={activeSlide === 0}
                  style={{
                    background: "none",
                    border: `1px solid ${slide.accent}60`,
                    borderRadius: 6,
                    color: slide.accent,
                    padding: "6px 14px",
                    cursor: activeSlide === 0 ? "default" : "pointer",
                    opacity: activeSlide === 0 ? 0.3 : 1,
                    fontFamily: "'Lora', serif",
                    fontSize: 12,
                  }}
                >
                  ← назад
                </button>
                <span
                  style={{
                    fontSize: 12,
                    color: slide.dark ? "var(--muted-foreground)" : "#9a8a7a",
                    alignSelf: "center",
                    fontFamily: "'Lora', serif",
                  }}
                >
                  {activeSlide + 1} / {slides.length}
                </span>
                <button
                  onClick={() => setActiveSlide(Math.min(slides.length - 1, activeSlide + 1))}
                  disabled={activeSlide === slides.length - 1}
                  style={{
                    background: "none",
                    border: `1px solid ${slide.accent}60`,
                    borderRadius: 6,
                    color: slide.accent,
                    padding: "6px 14px",
                    cursor: activeSlide === slides.length - 1 ? "default" : "pointer",
                    opacity: activeSlide === slides.length - 1 ? 0.3 : 1,
                    fontFamily: "'Lora', serif",
                    fontSize: 12,
                  }}
                >
                  вперед →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer note */}
        <div
          style={{
            marginTop: 36,
            color: "var(--muted-foreground)",
            fontSize: 11,
            fontFamily: "'Lora', serif",
            fontStyle: "italic",
            textAlign: "center",
            maxWidth: 400,
            opacity: 0.6,
          }}
        >
          Выгорание развивается около двух лет до первого явного эпизода.
          <br />
          Если узнаешь себя в большинстве пунктов — это уже сигнал, не просто усталость.
        </div>
      </div>
    </div>
  );
}
