import { useEffect, useRef, useState } from 'react';

import './Countdown.scss';

type CountdownProps = {
  targetDate: string | Date;
  onComplete?: () => void;
};

type TimeLeft = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

function getTimeLeft(targetDate: string | Date): TimeLeft {
  const difference = new Date(targetDate).getTime() - Date.now();

  if (difference <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    };
  }

  return {
    days: Math.floor(difference / (1000 * 60 * 60 * 24)),

    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),

    minutes: Math.floor((difference / (1000 * 60)) % 60),

    seconds: Math.floor((difference / 1000) % 60),
  };
}

function formatNumber(value: number) {
  return String(value).padStart(2, '0');
}

export default function Countdown({ targetDate, onComplete }: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(targetDate));

  // Чтобы onComplete не вызвался много раз
  const hasCompleted = useRef(false);

  useEffect(() => {
    const updateCountdown = () => {
      const nextTimeLeft = getTimeLeft(targetDate);

      setTimeLeft(nextTimeLeft);

      const isFinished =
        nextTimeLeft.days === 0 && nextTimeLeft.hours === 0 && nextTimeLeft.minutes === 0 && nextTimeLeft.seconds === 0;

      if (isFinished && !hasCompleted.current) {
        hasCompleted.current = true;

        onComplete?.();
      }
    };

    updateCountdown();

    const interval = window.setInterval(updateCountdown, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [targetDate, onComplete]);

  return (
    <section className="countdown">
      <div className="countdown__inner">
        <div className="countdown__item">
          <span className="countdown__number">{formatNumber(timeLeft.days)}</span>

          <span className="countdown__label">дней</span>
        </div>

        <span className="countdown__separator">:</span>

        <div className="countdown__item">
          <span className="countdown__number">{formatNumber(timeLeft.hours)}</span>

          <span className="countdown__label">часов</span>
        </div>

        <span className="countdown__separator">:</span>

        <div className="countdown__item">
          <span className="countdown__number">{formatNumber(timeLeft.minutes)}</span>

          <span className="countdown__label">минут</span>
        </div>

        <span className="countdown__separator">:</span>

        <div className="countdown__item">
          <span className="countdown__number">{formatNumber(timeLeft.seconds)}</span>

          <span className="countdown__label">секунд</span>
        </div>
      </div>
    </section>
  );
}
