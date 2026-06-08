import { useState } from 'react';
import Clock from './Clock.jsx';
import ConcentricRings from './ConcentricRings.jsx';
import CalendarView from './CalendarView.jsx';
import MealTracker from './MealTracker.jsx';
import WorkoutTracker from './WorkoutTracker.jsx';
import HabitTracker from './HabitTracker.jsx';

const PORTRAIT_TABS = [
  { id: 'calendar', label: '📅', title: 'Calendar' },
  { id: 'meals',    label: '🍽️', title: 'Meals' },
  { id: 'habits',   label: '✅', title: 'Habits' },
  { id: 'workout',  label: '💪', title: 'Workout' },
];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('calendar');

  return (
    <>
      <div className="dashboard landscape-only">
        <div className="col-left">
          <div className="panel" style={{ flex: 1, overflow: 'hidden' }}>
            <CalendarView />
          </div>
        </div>
        <div className="col-center">
          <div className="panel center-top"><Clock /></div>
          <div className="panel center-rings"><ConcentricRings /></div>
        </div>
        <div className="col-right">
          <div className="panel right-panel"><HabitTracker /></div>
          <div className="panel right-panel"><MealTracker /></div>
          <div className="panel right-panel"><WorkoutTracker /></div>
        </div>
      </div>

      <div className="portrait-layout portrait-only">
        <div className="portrait-top">
          <div className="panel portrait-clock"><Clock /></div>
          <div className="panel portrait-rings"><ConcentricRings /></div>
        </div>
        <div className="portrait-content panel">
          {activeTab === 'calendar' && <CalendarView />}
          {activeTab === 'meals'    && <MealTracker />}
          {activeTab === 'habits'   && <HabitTracker />}
          {activeTab === 'workout'  && <WorkoutTracker />}
        </div>
        <div className="portrait-tabs">
          {PORTRAIT_TABS.map(tab => (
            <button key={tab.id}
              className={`portrait-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}>
              <span className="tab-icon">{tab.label}</span>
              <span className="tab-label">{tab.title}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
