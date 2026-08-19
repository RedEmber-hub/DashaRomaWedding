import { useState } from 'react';

import './App.scss';

import TimeLine from './components/TimeLine/TimeLine';
import Countdown from './components/Countdown/Countdown';
import timelineFlowers from './assets/img/timeline-1200.png';

export default function App() {
  const [isTimelineStarted, setIsTimelineStarted] = useState(false);

  return (
    <div className="app">
      <div className="app__main">
        <p className="app__main-title">ВМЕСТЕ И НАВСЕГДА</p>

        <span className="app__main-name">
          РОМАН <span className="app__main-name-amp">&</span> ДАРЬЯ
        </span>

        <p className="app__main-description">БУДЕМ СЧАСТЛИВЫ РАЗДЕЛИТЬ ЭТОТ ДЕНЬ С ВАМИ</p>

        <span className="app__main-date">5 СЕНТЯБРЯ 2026</span>

        <p className="app__main-time">СУББОТА 10:20</p>

        <p className="app__main-time">Шипиловский проезд, дом 27</p>

        <p className="app__main-subtitle">ЖДЁМ ВАС</p>

        <div className="app__main-countdown">
          <Countdown
            targetDate="2026-09-05T10:20:00"
            onComplete={() => {
              setIsTimelineStarted(true);
            }}
          />
        </div>
      </div>

      <div className="app__timeline">
        <h1 className="app__timeline-title">Свадебное расписание</h1>

        <TimeLine isStarted={isTimelineStarted} />

        <div className="app__flowers" aria-hidden="true">
          <img src={timelineFlowers} alt="" />
        </div>
      </div>
    </div>
  );
}
