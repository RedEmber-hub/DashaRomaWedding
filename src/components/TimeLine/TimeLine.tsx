import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

import './TimeLine.scss';

type TimeLineEvent = {
  time: string;
  title: string;
  description: string;
  image?: string;
};

type TimeLineProps = {
  isStarted: boolean;
};

const events: TimeLineEvent[] = [
  {
    time: '10:20',
    title: 'Торжественная регистрация',
    description: 'Будем рады разделить с вами этот важный и трогательный момент.',
    image: '/rings.svg',
  },
  {
    time: '12:00',
    title: 'Фуршет',
    description: 'Время для общения, лёгких закусок и тёплых поздравлений.',
    image: '/drink.svg',
  },
  {
    time: '13:00',
    title: 'Фотосессия',
    description: 'Сохраним самые красивые моменты этого дня на фотографиях.',
    image: '/camera.svg',
  },
  {
    time: '16:00',
    title: 'Праздничный банкет',
    description: 'Ужин, музыка, танцы и продолжение нашего праздника.',
    image: '/dish.svg',
  },
  {
    time: '21:00',
    title: 'Окончание праздничного дня',
    description: 'Спасибо, что были рядом и разделили этот день вместе с нами.',
    image: '/firework.svg',
  },
];

/*
|--------------------------------------------------------------------------
| Базовая геометрия таймлайна
|--------------------------------------------------------------------------
*/

const SVG_WIDTH = 800;
const POINT_GAP = 320;
const CENTER_X = SVG_WIDTH / 2;
const CURVE_OFFSET = 70;

/*
|--------------------------------------------------------------------------
| Плавность сердца
|--------------------------------------------------------------------------
*/

const HEART_SMOOTHING = 0.08;

/*
|--------------------------------------------------------------------------
| Удар сердца
|--------------------------------------------------------------------------
*/

const HEART_BEAT_DELAY = 120;
const HEART_BEAT_DURATION = 450;

/*
|--------------------------------------------------------------------------
| Создание точек
|--------------------------------------------------------------------------
*/

function createPoints(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const isFirst = index === 0;
    const isLast = index === count - 1;

    let x = CENTER_X;

    if (!isFirst && !isLast) {
      x = index % 2 === 0 ? CENTER_X + CURVE_OFFSET : CENTER_X - CURVE_OFFSET;
    }

    return {
      x,
      y: index * POINT_GAP,
    };
  });
}

/*
|--------------------------------------------------------------------------
| Создание плавной линии
|--------------------------------------------------------------------------
*/

function createPath(points: { x: number; y: number }[]) {
  if (points.length < 2) {
    return '';
  }

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let index = 0; index < points.length - 1; index++) {
    const current = points[index];
    const next = points[index + 1];

    const distanceY = next.y - current.y;

    path += `
      C
        ${current.x} ${current.y + distanceY * 0.5},
        ${next.x} ${next.y - distanceY * 0.5},
        ${next.x} ${next.y}
    `;
  }

  return path;
}

/*
|--------------------------------------------------------------------------
| HH:MM → минуты
|--------------------------------------------------------------------------
*/

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number);

  return hours * 60 + minutes;
}

/*
|--------------------------------------------------------------------------
| Текущее время
|--------------------------------------------------------------------------
*/

function getCurrentMinutes() {
  const now = new Date();

  return now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60 + now.getMilliseconds() / 60000;
}

/*
|--------------------------------------------------------------------------
| Находим длину path в конкретной точке Y
|--------------------------------------------------------------------------
*/

function getPathLengthAtY(path: SVGPathElement, targetY: number) {
  const totalLength = path.getTotalLength();

  let low = 0;
  let high = totalLength;

  for (let index = 0; index < 30; index++) {
    const middle = (low + high) / 2;
    const point = path.getPointAtLength(middle);

    if (point.y < targetY) {
      low = middle;
    } else {
      high = middle;
    }
  }

  return (low + high) / 2;
}

/*
|--------------------------------------------------------------------------
| Реальные длины path в точках событий
|--------------------------------------------------------------------------
*/

function getPointPathLengths(path: SVGPathElement, points: { x: number; y: number }[]) {
  return points.map((point) => getPathLengthAtY(path, point.y));
}

/*
|--------------------------------------------------------------------------
| Время → длина path
|--------------------------------------------------------------------------
*/

function getTimePathLength(currentMinutes: number, pathLengths: number[]) {
  const firstTime = timeToMinutes(events[0].time);
  const lastTime = timeToMinutes(events[events.length - 1].time);

  if (currentMinutes <= firstTime) {
    return pathLengths[0];
  }

  if (currentMinutes >= lastTime) {
    return pathLengths[pathLengths.length - 1];
  }

  for (let index = 0; index < events.length - 1; index++) {
    const startTime = timeToMinutes(events[index].time);

    const endTime = timeToMinutes(events[index + 1].time);

    if (currentMinutes >= startTime && currentMinutes <= endTime) {
      const timeProgress = (currentMinutes - startTime) / (endTime - startTime);

      const segmentStart = pathLengths[index];

      const segmentEnd = pathLengths[index + 1];

      return segmentStart + (segmentEnd - segmentStart) * timeProgress;
    }
  }

  return pathLengths[0];
}

/*
|--------------------------------------------------------------------------
| Scroll → progress
|--------------------------------------------------------------------------
|
| Используем уже трансформированный canvas.
| Поэтому расчёт всегда идёт по фактическому размеру
| таймлайна на текущем экране.
|--------------------------------------------------------------------------
*/

function getScrollProgress(canvas: HTMLElement) {
  const rect = canvas.getBoundingClientRect();

  const viewportCenter = window.innerHeight / 2;

  const progress = (viewportCenter - rect.top) / rect.height;

  return Math.max(0, Math.min(progress, 1));
}

/*
|--------------------------------------------------------------------------
| Компонент
|--------------------------------------------------------------------------
*/

export default function TimeLine({ isStarted }: TimeLineProps) {
  const viewportRef = useRef<HTMLDivElement>(null);

  const canvasRef = useRef<HTMLDivElement>(null);

  const pathRef = useRef<SVGPathElement>(null);

  const targetProgressRef = useRef(0);

  const currentProgressRef = useRef(0);

  const scrollStopTimeoutRef = useRef<number | null>(null);

  const beatTimeoutRef = useRef<number | null>(null);

  const [scale, setScale] = useState(1);

  const [progress, setProgress] = useState(0);

  const [heartPosition, setHeartPosition] = useState({
    x: CENTER_X,
    y: 0,
  });

  const [heartBeat, setHeartBeat] = useState(false);

  const [visibleItems, setVisibleItems] = useState<Set<number>>(new Set());

  const points = createPoints(events.length);

  const timelineHeight = Math.max(events.length - 1, 1) * POINT_GAP;

  const path = createPath(points);

  /*
  |--------------------------------------------------------------------------
  | Адаптивный scale
  |--------------------------------------------------------------------------
  |
  | Десктопная ширина = 800px.
  |
  | Например:
  |
  | 800px → scale 1
  | 600px → scale 0.75
  | 400px → scale 0.5
  | 320px → scale 0.4
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const updateScale = () => {
      const width = viewport.clientWidth;

      const nextScale = Math.min(width / SVG_WIDTH, 1);

      setScale(Math.max(nextScale, 0.35));
    };

    updateScale();

    const resizeObserver = new ResizeObserver(updateScale);

    resizeObserver.observe(viewport);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  /*
  |--------------------------------------------------------------------------
  | Управление сердцем
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    const pathElement = pathRef.current;

    const canvas = canvasRef.current;

    if (!pathElement || !canvas) {
      return;
    }

    const pathLength = pathElement.getTotalLength();

    const pointPathLengths = getPointPathLengths(pathElement, points);

    /*
    |--------------------------------------------------------------------------
    | Scroll target
    |--------------------------------------------------------------------------
    */

    const updateScrollTarget = () => {
      if (isStarted) {
        return;
      }

      targetProgressRef.current = getScrollProgress(canvas);

      /*
      |--------------------------------------------------------------------------
      | Heartbeat
      |--------------------------------------------------------------------------
      */

      if (scrollStopTimeoutRef.current !== null) {
        window.clearTimeout(scrollStopTimeoutRef.current);
      }

      if (beatTimeoutRef.current !== null) {
        window.clearTimeout(beatTimeoutRef.current);
      }

      setHeartBeat(false);

      scrollStopTimeoutRef.current = window.setTimeout(() => {
        setHeartBeat(true);

        beatTimeoutRef.current = window.setTimeout(() => {
          setHeartBeat(false);
        }, HEART_BEAT_DURATION);
      }, HEART_BEAT_DELAY);
    };

    if (!isStarted) {
      updateScrollTarget();

      window.addEventListener('scroll', updateScrollTarget, {
        passive: true,
      });

      window.addEventListener('resize', updateScrollTarget);
    }

    /*
    |--------------------------------------------------------------------------
    | Плавная анимация сердца
    |--------------------------------------------------------------------------
    */

    let animationFrame = 0;

    const animate = () => {
      let targetProgress = targetProgressRef.current;

      /*
      |--------------------------------------------------------------------------
      | После Countdown — управление временем
      |--------------------------------------------------------------------------
      */

      if (isStarted) {
        const currentMinutes = getCurrentMinutes();

        const targetLength = getTimePathLength(currentMinutes, pointPathLengths);

        targetProgress = pathLength > 0 ? targetLength / pathLength : 0;

        targetProgressRef.current = targetProgress;
      }

      /*
      |--------------------------------------------------------------------------
      | Плавное приближение
      |--------------------------------------------------------------------------
      */

      const currentProgress = currentProgressRef.current;

      const nextProgress = currentProgress + (targetProgress - currentProgress) * HEART_SMOOTHING;

      currentProgressRef.current = nextProgress;

      /*
      |--------------------------------------------------------------------------
      | Реальная точка на SVG path
      |--------------------------------------------------------------------------
      */

      const currentLength = pathLength * nextProgress;

      const point = pathElement.getPointAtLength(currentLength);

      setProgress(nextProgress);

      setHeartPosition({
        x: point.x,
        y: point.y,
      });

      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrame);

      window.removeEventListener('scroll', updateScrollTarget);

      window.removeEventListener('resize', updateScrollTarget);

      if (scrollStopTimeoutRef.current !== null) {
        window.clearTimeout(scrollStopTimeoutRef.current);
      }

      if (beatTimeoutRef.current !== null) {
        window.clearTimeout(beatTimeoutRef.current);
      }
    };
  }, [isStarted, scale]);

  /*
  |--------------------------------------------------------------------------
  | Анимация появления событий
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    const items = document.querySelectorAll<HTMLElement>('.timeline__item');

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          const index = Number(entry.target.getAttribute('data-index'));

          setVisibleItems((previous) => {
            const next = new Set(previous);

            next.add(index);

            return next;
          });

          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.2,
        rootMargin: '0px 0px -10% 0px',
      }
    );

    items.forEach((item) => {
      observer.observe(item);
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  /*
  |--------------------------------------------------------------------------
  | Доли точек относительно реальной длины path
  |--------------------------------------------------------------------------
  */

  const pathLength = pathRef.current?.getTotalLength() ?? 1;

  const pointPathLengths = pathRef.current
    ? getPointPathLengths(pathRef.current, points)
    : points.map((_, index) => (index / (points.length - 1)) * pathLength);

  /*
  |--------------------------------------------------------------------------
  | Render
  |--------------------------------------------------------------------------
  */

  return (
    <section ref={viewportRef} className="timeline">
      <div
        className="timeline__stage"
        style={{
          height: `${timelineHeight * scale}px`,
        }}
      >
        <div
          ref={canvasRef}
          className="timeline__canvas"
          style={{
            width: `${SVG_WIDTH}px`,
            height: `${timelineHeight}px`,
            transform: `scale(${scale})`,
          }}
        >
          <div className="timeline__inner">
            {/* Линия */}

            <svg className="timeline__svg" viewBox={`0 0 ${SVG_WIDTH} ${timelineHeight}`} aria-hidden="true">
              {/* Вся линия */}

              <path d={path} className="timeline__path" />

              {/* Пройденная часть */}

              <path
                ref={pathRef}
                d={path}
                className="
                  timeline__path
                  timeline__path--progress
                "
                pathLength={1}
                style={{
                  strokeDasharray: 1,
                  strokeDashoffset: 1 - progress,
                }}
              />
            </svg>

            {/* Точки */}

            {points.map((point, index) => {
              const pointProgress = pointPathLengths[index] / pathLength;

              const isCurrent = Math.abs(progress - pointProgress) < 0.003;

              const isPassed = progress > pointProgress;

              return (
                <div
                  className={[
                    'timeline__point',
                    isPassed ? 'timeline__point--passed' : '',
                    isCurrent ? 'timeline__point--current' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  key={`point-${index}`}
                  style={{
                    left: `${(point.x / SVG_WIDTH) * 100}%`,
                    top: `${point.y}px`,
                  }}
                />
              );
            })}

            {/* События */}

            {events.map((event, index) => {
              const point = points[index];

              const pointX = (point.x / SVG_WIDTH) * 100;

              const side = index % 2 === 0 ? 'right' : 'left';

              const isVisible = visibleItems.has(index);

              return (
                <article
                  className={['timeline__item', `timeline__item--${side}`, isVisible ? 'timeline__item--visible' : '']
                    .filter(Boolean)
                    .join(' ')}
                  data-index={index}
                  key={`${event.time}-${index}`}
                  style={
                    {
                      top: `${point.y}px`,
                      '--point-x': `${pointX}%`,
                      '--animation-delay': `${index * 0.08}s`,
                    } as CSSProperties
                  }
                >
                  <div className="timeline__text">
                    <time className="timeline__time">{event.time}</time>

                    <h3 className="timeline__title">{event.title}</h3>

                    <p className="timeline__description">{event.description}</p>
                  </div>

                  {event.image && (
                    <div className="timeline__image">
                      <img src={event.image} alt="" />
                    </div>
                  )}
                </article>
              );
            })}

            {/* Сердце */}

            <div
              className={['timeline__heart', heartBeat ? 'timeline__heart--beat' : ''].filter(Boolean).join(' ')}
              style={{
                left: `${(heartPosition.x / SVG_WIDTH) * 100}%`,
                top: `${heartPosition.y}px`,
              }}
            >
              ♥
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
