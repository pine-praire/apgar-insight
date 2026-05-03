export type ApgarKey = "A1" | "P" | "G" | "A2" | "R";

export interface ApgarQuestion {
  key: ApgarKey;
  letter: string;
  title: string;
  subtitle: string;
  description: string;
  options: { value: 0 | 1 | 2; label: string }[];
}

export const APGAR_QUESTIONS: ApgarQuestion[] = [
  {
    key: "A1",
    letter: "A",
    title: "Ampiriens — внешний вид",
    subtitle: "Насколько вы выглядите больным, истощённым, уставшим?",
    description: "Обратите внимание на взгляд, жестикуляцию, речь.",
    options: [
      { value: 0, label: "Выгляжу истощённым, взгляд потухший, нет сил" },
      { value: 1, label: "Заметно уставший, но не критично" },
      { value: 2, label: "Выгляжу энергично, взгляд живой" },
    ],
  },
  {
    key: "P",
    letter: "P",
    title: "Performans — продуктивность",
    subtitle: "Как справляетесь с рабочими задачами?",
    description: "Стресс, дедлайны, перегрузка — оцените текущее состояние.",
    options: [
      { value: 0, label: "Всё занимает намного больше времени, хочется всё бросить" },
      { value: 1, label: "Есть сложности, но на результате не сказываются" },
      { value: 2, label: "Справляюсь с задачами, дедлайны не пугают" },
    ],
  },
  {
    key: "G",
    letter: "G",
    title: "Growth — развитие",
    subtitle: "Есть ли цели? Видите ли смысл?",
    description: "Ошибки — точка роста или источник фрустрации?",
    options: [
      { value: 0, label: "Нет целей, всё кажется бессмысленным" },
      { value: 1, label: "Бывают периоды без мотивации, но в целом двигаюсь" },
      { value: 2, label: "Есть цели, люблю челленджи, ошибки — это опыт" },
    ],
  },
  {
    key: "A2",
    letter: "A",
    title: "Affekt control — контроль эмоций",
    subtitle: "Справляетесь ли с негативом?",
    description: "Или каждая мелочь выбивает из колеи?",
    options: [
      { value: 0, label: "Часто срываюсь, каждая мелочь выбивает из колеи" },
      { value: 1, label: "Обычно справляюсь, но бывают срывы в стрессе" },
      { value: 2, label: "Могу промолчать, экологично переживаю негатив" },
    ],
  },
  {
    key: "R",
    letter: "R",
    title: "Relationships — отношения",
    subtitle: "Отношения с близкими, друзьями.",
    description: "Легко ли просить о помощи?",
    options: [
      { value: 0, label: "Закрылся от людей, просить о помощи невозможно" },
      { value: 1, label: "Общаюсь, но реже; иногда сложно открыться" },
      { value: 2, label: "Поддерживаю связи, легко прошу о помощи" },
    ],
  },
];

export function getVerdict(score: number) {
  if (score <= 4) {
    return {
      level: "critical" as const,
      title: "Требуется срочная помощь",
      short: "Срочная помощь",
      description:
        "Серьёзное истощение — нужен специалист. Возможна госпитализация. Не откладывайте обращение к психологу или врачу.",
    };
  }
  if (score <= 6) {
    return {
      level: "warning" as const,
      title: "Нужна самостоятельная коррекция",
      short: "Самостоятельная коррекция",
      description:
        "Ресурсы есть, но их нужно восполнять осознанно. Применяйте знания курса, выстраивайте режим, отдых, поддерживающие практики.",
    };
  }
  return {
    level: "good" as const,
    title: "Рутинная поддержка",
    short: "Рутинная поддержка",
    description:
      "Хороший уровень — поддерживайте то, что работает. Обратите внимание на параметры с баллом 1, чтобы они не просели.",
  };
}
