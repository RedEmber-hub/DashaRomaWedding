import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

import './TimeLine.scss';

import ringsIcon from '../../assets/icon/rings.svg';
import drinkIcon from '../../assets/icon/drink.svg';
import cameraIcon from '../../assets/icon/camera.svg';
import dishIcon from '../../assets/icon/dish.svg';
import fireworkIcon from '../../assets/icon/firework.svg';

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
    image: ringsIcon,
  },
  {
    time: '12:00',
    title: 'Фуршет',
    description: 'Время для общения, лёгких закусок и тёплых поздравлений.',
    image: drinkIcon,
  },
  {
    time: '13:00',
    title: 'Фотосессия',
    description: 'Сохраним самые красивые моменты этого дня на фотографиях.',
    image: cameraIcon,
  },
  {
    time: '16:00',
    title: 'Праздничный банкет',
    description: 'Ужин, музыка, танцы и продолжение нашего праздника.',
    image: dishIcon,
  },
  {
    time: '21:00',
    title: 'Окончание праздничного дня',
    description: 'Спасибо, что были рядом и разделили этот день вместе с нами.',
    image: fireworkIcon,
  },
];

const SVG_WIDTH = 800;
const POINT_GAP = 320;
const CENTER_X = SVG_WIDTH / 2;
const CURVE_OFFSET = 70;

const HEART_SMOOTHING = 0.08;
const HEART_EPSILON = 0.0005;

const HEART_BEAT_DELAY = 120;
const HEART_BEAT_DURATION = 450;

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

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number);

  return hours * 60 + minutes;
}

function getCurrentMinutes() {
  const now = new Date();

  return now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60 + now.getMilliseconds() / 60000;
}

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

function getPointPathLengths(path: SVGPathElement, points: { x: number; y: number }[]) {
  return points.map((point) => getPathLengthAtY(path, point.y));
}

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

function getScrollProgress(canvas: HTMLElement) {
  const rect = canvas.getBoundingClientRect();

  const viewportCenter = window.innerHeight / 2;

  const progress = (viewportCenter - rect.top) / rect.height;

  return Math.max(0, Math.min(progress, 1));
}

export default function TimeLine({ isStarted }: TimeLineProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const pathRef = useRef<SVGPathElement>(null);
  const progressPathRef = useRef<SVGPathElement>(null);

  const heartRef = useRef<HTMLDivElement>(null);

  const pointRefs = useRef<(HTMLDivElement | null)[]>([]);

  const targetProgressRef = useRef(0);
  const currentProgressRef = useRef(0);

  const scrollStopTimeoutRef = useRef<number | null>(null);

  const beatTimeoutRef = useRef<number | null>(null);

  const [scale, setScale] = useState(1);
  const [heartBeat, setHeartBeat] = useState(false);

  const [visibleItems, setVisibleItems] = useState<Set<number>>(new Set());

  const points = createPoints(events.length);

  const timelineHeight = Math.max(events.length - 1, 1) * POINT_GAP;

  const path = createPath(points);

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

  useEffect(() => {
    const pathElement = pathRef.current;
    const progressPathElement = progressPathRef.current;

    const canvas = canvasRef.current;
    const heartElement = heartRef.current;

    if (!pathElement || !progressPathElement || !canvas || !heartElement) {
      return;
    }

    const pathLength = pathElement.getTotalLength();

    const pointPathLengths = getPointPathLengths(pathElement, points);

    let animationFrame = 0;
    let isAnimating = false;
    let lastRenderedProgress = -1;

    const updateVisuals = (nextProgress: number) => {
      const currentLength = pathLength * nextProgress;

      const point = pathElement.getPointAtLength(currentLength);

      progressPathElement.style.strokeDashoffset = String(1 - nextProgress);

      heartElement.style.transform = `translate3d(${point.x}px, ${point.y}px, 0) ` + 'translate3d(-50%, -50%, 0)';
    };

    const updatePoints = (nextProgress: number) => {
      pointPathLengths.forEach((pointPathLength, index) => {
        const pointElement = pointRefs.current[index];

        if (!pointElement) {
          return;
        }

        const pointProgress = pathLength > 0 ? pointPathLength / pathLength : 0;

        const isCurrent = Math.abs(nextProgress - pointProgress) < 0.003;

        const isPassed = nextProgress > pointProgress;

        pointElement.classList.toggle('timeline__point--passed', isPassed);

        pointElement.classList.toggle('timeline__point--current', isCurrent);
      });
    };

    const animate = () => {
      const targetProgress = targetProgressRef.current;

      const currentProgress = currentProgressRef.current;

      const difference = targetProgress - currentProgress;

      if (Math.abs(difference) < HEART_EPSILON) {
        currentProgressRef.current = targetProgress;

        updateVisuals(targetProgress);
        updatePoints(targetProgress);

        lastRenderedProgress = targetProgress;

        animationFrame = 0;
        isAnimating = false;

        return;
      }

      const nextProgress = currentProgress + difference * HEART_SMOOTHING;

      currentProgressRef.current = nextProgress;

      if (Math.abs(nextProgress - lastRenderedProgress) > 0.0001) {
        updateVisuals(nextProgress);
        updatePoints(nextProgress);

        lastRenderedProgress = nextProgress;
      }

      animationFrame = requestAnimationFrame(animate);
    };

    const startAnimation = () => {
      if (isAnimating) {
        return;
      }

      isAnimating = true;

      animationFrame = requestAnimationFrame(animate);
    };

    const scheduleHeartbeat = () => {
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

    const updateScrollTarget = () => {
      if (isStarted) {
        return;
      }

      const nextTarget = getScrollProgress(canvas);

      targetProgressRef.current = nextTarget;

      startAnimation();
      scheduleHeartbeat();
    };

    let timeInterval: number | null = null;

    if (isStarted) {
      const updateTimeTarget = () => {
        const currentMinutes = getCurrentMinutes();

        const targetLength = getTimePathLength(currentMinutes, pointPathLengths);

        const targetProgress = pathLength > 0 ? targetLength / pathLength : 0;

        targetProgressRef.current = targetProgress;

        startAnimation();
      };

      updateTimeTarget();

      timeInterval = window.setInterval(updateTimeTarget, 250);
    } else {
      updateScrollTarget();

      window.addEventListener('scroll', updateScrollTarget, {
        passive: true,
      });

      window.addEventListener('resize', updateScrollTarget);
    }

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }

      window.removeEventListener('scroll', updateScrollTarget);

      window.removeEventListener('resize', updateScrollTarget);

      if (timeInterval !== null) {
        window.clearInterval(timeInterval);
      }

      if (scrollStopTimeoutRef.current !== null) {
        window.clearTimeout(scrollStopTimeoutRef.current);
      }

      if (beatTimeoutRef.current !== null) {
        window.clearTimeout(beatTimeoutRef.current);
      }
    };
  }, [isStarted, scale]);

  useEffect(() => {
    const root = viewportRef.current;

    if (!root) {
      return;
    }

    const items = root.querySelectorAll<HTMLElement>('.timeline__item');

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
            <svg className="timeline__svg" viewBox={`0 0 ${SVG_WIDTH} ${timelineHeight}`} aria-hidden="true">
              <path d={path} className="timeline__path" />

              <path
                ref={progressPathRef}
                d={path}
                className="
                  timeline__path
                  timeline__path--progress
                "
                pathLength={1}
                style={{
                  strokeDasharray: 1,
                  strokeDashoffset: 1,
                }}
              />

              <path
                ref={pathRef}
                d={path}
                fill="none"
                stroke="none"
                aria-hidden="true"
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  opacity: 0,
                }}
              />
            </svg>

            {points.map((point, index) => (
              <div
                ref={(element) => {
                  pointRefs.current[index] = element;
                }}
                className="timeline__point"
                key={`point-${index}`}
                style={{
                  left: `${(point.x / SVG_WIDTH) * 100}%`,
                  top: `${point.y}px`,
                }}
              />
            ))}

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

            <div ref={heartRef} className="timeline__heart">
              <span
                className={['timeline__heart-inner', heartBeat ? 'timeline__heart-inner--beat' : '']
                  .filter(Boolean)
                  .join(' ')}
              >
                ♥
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
