import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Moon } from 'lucide-react';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// ─── Helpers ──────────────────────────────────────────────────
const toDateStr = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const parseDate = (str) => {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const isSameDay = (a, b) =>
  a && b && a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const isBeforeDay = (a, b) => {
  if (!a || !b) return false;
  const aa = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const bb = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return aa < bb;
};

const isBetween = (d, start, end) => {
  if (!d || !start || !end) return false;
  const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  return dd > s && dd < e;
};

const nightCount = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return 0;
  const a = parseDate(checkIn);
  const b = parseDate(checkOut);
  if (!a || !b) return 0;
  return Math.max(0, Math.round((b - a) / (1000 * 60 * 60 * 24)));
};

const formatDisplayDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = parseDate(dateStr);
  if (!d) return '—';
  const day = d.getDate();
  const month = MONTH_NAMES[d.getMonth()].substring(0, 3);
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
};

// ─── Calendar Grid ────────────────────────────────────────────
const getCalendarDays = (year, month) => {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = [];

  // Leading blanks
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, month, d));

  return days;
};

// ─── Single Month Component ──────────────────────────────────
const MonthGrid = ({ year, month, checkIn, checkOut, hoverDate, today, onDayClick, onDayHover, variant }) => {
  const days = useMemo(() => getCalendarDays(year, month), [year, month]);
  const checkInDate = parseDate(checkIn);
  const checkOutDate = parseDate(checkOut);

  const isDark = variant === 'dark';

  return (
    <div className="drp-month-grid">
      <div className="drp-month-title">
        {MONTH_NAMES[month]} {year}
      </div>

      <div className="drp-day-names">
        {DAY_NAMES.map((d) => (
          <div key={d} className="drp-day-name">{d}</div>
        ))}
      </div>

      <div className="drp-days">
        {days.map((day, i) => {
          if (!day) return <div key={`blank-${i}`} className="drp-day-cell drp-day-blank" />;

          const isPast = isBeforeDay(day, today);
          const isToday = isSameDay(day, today);
          const isStart = isSameDay(day, checkInDate);
          const isEnd = isSameDay(day, checkOutDate);

          // Range logic: use hoverDate as the end if only checkIn is selected
          const rangeEnd = checkOutDate || (checkInDate && hoverDate ? hoverDate : null);
          const actualStart = checkInDate && rangeEnd && isBeforeDay(rangeEnd, checkInDate) ? rangeEnd : checkInDate;
          const actualEnd = checkInDate && rangeEnd && isBeforeDay(rangeEnd, checkInDate) ? checkInDate : rangeEnd;
          const inRange = actualStart && actualEnd && isBetween(day, actualStart, actualEnd);
          const isRangeStart = isSameDay(day, actualStart);
          const isRangeEnd = isSameDay(day, actualEnd);
          const isPreview = !checkOutDate && checkInDate && hoverDate; // in preview mode

          let cellClass = 'drp-day-cell';
          if (isPast) cellClass += ' drp-day-disabled';
          if (isToday) cellClass += ' drp-day-today';
          if (isStart || isEnd) cellClass += ' drp-day-selected';
          if (isRangeStart && !isRangeEnd) cellClass += ' drp-day-range-start';
          if (isRangeEnd && !isRangeStart) cellClass += ' drp-day-range-end';
          if (isRangeStart && isRangeEnd) cellClass += ' drp-day-range-single';
          if (inRange) cellClass += isPreview ? ' drp-day-in-range-preview' : ' drp-day-in-range';
          if (isDark) cellClass += ' drp-dark';

          return (
            <div
              key={day.toISOString()}
              className={cellClass}
              onClick={() => !isPast && onDayClick(day)}
              onMouseEnter={() => !isPast && onDayHover(day)}
            >
              <span className="drp-day-number">{day.getDate()}</span>
              {isToday && <span className="drp-today-dot" />}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Main DateRangePicker Component ──────────────────────────
const DateRangePicker = ({
  checkInDate,
  checkOutDate,
  onCheckInChange,
  onCheckOutChange,
  variant = 'light',
  inline = false
}) => {
  const [isOpen, setIsOpen] = useState(inline);
  const [selecting, setSelecting] = useState('checkIn'); // 'checkIn' or 'checkOut'
  const [hoverDate, setHoverDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = checkInDate ? parseDate(checkInDate) : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const containerRef = useRef(null);
  const today = useMemo(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate());
  }, []);

  const nights = nightCount(checkInDate, checkOutDate);
  const isDark = variant === 'dark';

  // Next month for two-month display
  const nextMonth = useMemo(() => {
    let m = currentMonth.month + 1;
    let y = currentMonth.year;
    if (m > 11) { m = 0; y++; }
    return { year: y, month: m };
  }, [currentMonth]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        if (!inline) setIsOpen(false);
        setHoverDate(null);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- existing, tested behaviour; changing deps could re-trigger effects
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') { 
        if (!inline) setIsOpen(false); 
        setHoverDate(null); 
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- existing, tested behaviour; changing deps could re-trigger effects
  }, []);

  const handleDayClick = (day) => {
    const dateStr = toDateStr(day);

    if (selecting === 'checkIn') {
      onCheckInChange(dateStr);
      // If the selected checkIn is after current checkOut, clear checkOut
      if (checkOutDate && isBeforeDay(parseDate(checkOutDate), day)) {
        onCheckOutChange('');
      }
      setSelecting('checkOut');
    } else {
      // Selecting check-out
      if (checkInDate && isBeforeDay(day, parseDate(checkInDate))) {
        // If clicked before checkIn, reset to use this as new checkIn
        onCheckInChange(dateStr);
        onCheckOutChange('');
        setSelecting('checkOut');
      } else {
        onCheckOutChange(dateStr);
        setSelecting('checkIn');
        // Close after both dates selected, with a small delay for visual feedback
        if (!inline) {
          setTimeout(() => setIsOpen(false), 300);
        }
      }
    }
  };

  const handlePrevMonth = () => {
    setCurrentMonth((prev) => {
      let m = prev.month - 1;
      let y = prev.year;
      if (m < 0) { m = 11; y--; }
      return { year: y, month: m };
    });
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev) => {
      let m = prev.month + 1;
      let y = prev.year;
      if (m > 11) { m = 0; y++; }
      return { year: y, month: m };
    });
  };

  // Can't go before current month
  const canGoPrev = currentMonth.year > today.getFullYear() ||
    (currentMonth.year === today.getFullYear() && currentMonth.month > today.getMonth());

  return (
    <div className={`drp-container h-[100%] ${isDark ? 'drp-variant-dark' : 'drp-variant-light'}`} ref={containerRef}>
      {/* ── Trigger ── */}
      {!inline && (
        <div
          className={`drp-trigger ${isOpen ? 'drp-trigger-active' : ''}`}
          onClick={() => { setIsOpen(!isOpen); setSelecting('checkIn'); }}
          style={{height: '100%'}}
        >
        <div className="drp-trigger-section drp-trigger-checkin">
          <Calendar className="drp-trigger-icon" />
          <div className="drp-trigger-content">
            <span className="drp-trigger-label">Check-in</span>
            <span className="drp-trigger-date">{formatDisplayDate(checkInDate)}</span>
          </div>
        </div>

        {/* Night count badge */}
        <div className="drp-nights-badge">
          {nights > 0 ? (
            <>
              <Moon className="drp-nights-icon" />
              <span>{nights}</span>
            </>
          ) : (
            <span className="drp-nights-arrow">→</span>
          )}
        </div>

        <div className="drp-trigger-section drp-trigger-checkout">
          <Calendar className="drp-trigger-icon" />
          <div className="drp-trigger-content">
            <span className="drp-trigger-label">Check-out</span>
            <span className="drp-trigger-date">{formatDisplayDate(checkOutDate)}</span>
          </div>
        </div>
        </div>
      )}

      {/* ── Calendar Dropdown ── */}
      {(isOpen || inline) && (
        <div className={`drp-dropdown ${inline ? 'drp-inline' : ''}`} style={inline ? { position: 'static', marginTop: 0, boxShadow: 'none' } : {}}>
          {/* Selection indicator */}
          <div className="drp-selection-tabs">
            <button
              className={`drp-tab ${selecting === 'checkIn' ? 'drp-tab-active' : ''}`}
              onClick={() => setSelecting('checkIn')}
            >
              <span className="drp-tab-label">Check-in</span>
              <span className="drp-tab-date">{formatDisplayDate(checkInDate)}</span>
            </button>
            <button
              className={`drp-tab ${selecting === 'checkOut' ? 'drp-tab-active' : ''}`}
              onClick={() => setSelecting('checkOut')}
            >
              <span className="drp-tab-label">Check-out</span>
              <span className="drp-tab-date">{formatDisplayDate(checkOutDate)}</span>
            </button>
            {nights > 0 && (
              <div className="drp-nights-pill">
                <Moon className="w-3 h-3" />
                <span>{nights} night{nights > 1 ? 's' : ''}</span>
              </div>
            )}
          </div>

          {/* Month navigation */}
          <div className="drp-nav">
            <button
              className="drp-nav-btn"
              onClick={handlePrevMonth}
              disabled={!canGoPrev}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button className="drp-nav-btn" onClick={handleNextMonth}>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Two-month calendar grid */}
          <div className="drp-calendars">
            <MonthGrid
              year={currentMonth.year}
              month={currentMonth.month}
              checkIn={checkInDate}
              checkOut={checkOutDate}
              hoverDate={selecting === 'checkOut' ? hoverDate : null}
              today={today}
              onDayClick={handleDayClick}
              onDayHover={setHoverDate}
              variant={variant}
            />
            <MonthGrid
              year={nextMonth.year}
              month={nextMonth.month}
              checkIn={checkInDate}
              checkOut={checkOutDate}
              hoverDate={selecting === 'checkOut' ? hoverDate : null}
              today={today}
              onDayClick={handleDayClick}
              onDayHover={setHoverDate}
              variant={variant}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;
