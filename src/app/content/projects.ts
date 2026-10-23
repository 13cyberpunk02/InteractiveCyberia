/**
 * Your projects. This one list feeds both the "Проекты" page and the glowing panels in the 3D city
 * (the first five are shown there), so edit it here only.
 */
export interface Project {
  code: string;
  name: string;
  /** "в работе", "готов", "прототип"… */
  status: string;
  /** one line: what it does, so that a non-programmer understands */
  what: string;
  /** why you built it: the problem it solves or what you learned */
  why: string;
  stack: string[];
  github?: string;
  demo?: string;
  /** neon colour of its panel in the city */
  color?: string;
}

export const PROJECTS: Project[] = [
  {
    code: 'PRJ-01',
    name: 'CVPN',
    status: 'Готово.',
    color: '#3ef2ff',
    what: 'Десктопный клиент sing-box для Windows.',
    why: 'Полгода назад я захотел свой клиент для sing-box под Windows. Не потому, что существующие плохи - nekoray, hiddify и v2rayN работают, а потому, что хотелось понять, как всё устроено внутри, и получить полный контроль над генерацией конфигурации.',
    stack: ['C#', '.NET', 'WPF', 'sing-box'],
    github: 'https://github.com/13cyberpunk02/CVPN',
    demo: 'https://github.com/13cyberpunk02/CVPN/releases',
  },
  {
    code: 'PRJ-02',
    name: 'Chameleon',
    status: 'прототип',
    color: '#ff3ea5',
    what: 'Экспериментальный протокол обхода блокировок на C#/.NET.',
    why: 'Не ещё одна обёртка над TLS, а попытка спроектировать транспорт, устойчивый сразу по всем осям, по которым современные системы фильтрации (в т.ч. российский ТСПУ) отличают туннель от обычного трафика.',
    stack: ['C#', 'MVVM', 'Avalonia', '.NET'],
    github: 'https://github.com/13cyberpunk02/Chameleon',
    demo: 'пока в разработке, но можно клонировать и использовать уже. Есть Десктоп и Android приложение.',
  },
  {
    code: 'PRJ-03',
    name: 'Gorod-TV',
    status: 'готов',
    color: '#ffc46b',
    what: 'IPTV-приложение «Город ТВ» — сервис цифрового телевидения от провайдера Инфо-Лан. Кроссплатформенное приложение на .NET MAUI: версия для смартфонов и порт под Android TV.',
    why: 'До недавнего времени не было новой версии под Android TV, поэтому написал для опыта.',
    stack: ['MAUI', 'MVVM', '.NET'],
    github: 'https://github.com/13cyberpunk02/Gorod-TV',
    demo: 'https://github.com/13cyberpunk02/Gorod-TV/releases/tag/alpha',
  },
  {
    code: 'PRJ-04',
    name: 'FileSignatureChecker',
    status: 'готов',
    color: '#69319a',
    what: 'WPF приложение для проверки соответствия файлов и их электронных подписей между XML документом и файловой системой.',
    why: 'Данная программа облегчает перед подачей пояснительной записки в экспертизу, можно через него прогнать и проверить, каждый файл, был ли обновлен, и соответствует ли действительности.',
    stack: ['WPF', 'MVVM', 'CommunityToolkit.Mvvm', '.NET'],
    github: 'https://github.com/13cyberpunk02/FileSignatureChecker',
    demo: 'можно склонировать и самому собрать',
  },
  {
    code: 'PRJ-04',
    name: 'FileSignatureChecker',
    status: 'готов',
    color: '#1cccbc',
    what: 'Этот сайт: 3D-город, где каждая страница — отдельная локация.',
    why: 'Хотел разобраться в WebGL и сделать портфолио, которое запоминается.',
    stack: ['Angular', 'TypeScript', 'Three.js', 'GLSL'],
    github: 'https://github.com/13cyberpunk02/InteractiveCyberia',
    demo: 'https://cv.cyberius.site',
  },
];
