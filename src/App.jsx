import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase } from './supabase';
import './App.css';

const VIEW_PIN = '1414';

// ── Strip EXIF by re-drawing image on canvas ───────────────
function stripExif(file) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        resolve(new File([blob], file.name, { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.9);
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  });
}

// ── Constants ──────────────────────────────────────────────
// Use noon to avoid UTC midnight → EST rollback issues
const SUMMIT_DAY = new Date('2026-04-14T12:00:00');
const TRIP_END = new Date('2026-04-14T12:00:00');
const START_DATE = new Date('2026-03-21T12:00:00');

const ITINERARY = [
  { date: 'April 12', label: 'Travel day' },
  { date: 'April 13', label: 'Antigua exploration' },
  { date: 'April 14', label: 'Hike begins' },
  { date: 'April 15', label: 'Summit day 🌋' },
  { date: 'April 16', label: 'Descent' },
  { date: 'April 17', label: 'Recovery & explore' },
  { date: 'April 18', label: 'Departure' },
];

const TAPE_STYLES = ['tape-top-left', 'tape-top-right', 'tape-both', 'tape-center'];

const TAPE_COLORS = [
  'rgba(224, 160, 48, 0.35)',   // gold
  'rgba(45, 106, 79, 0.3)',     // jade green
  'rgba(204, 85, 68, 0.3)',     // rose
  'rgba(184, 200, 216, 0.4)',   // sky blue
  'rgba(196, 101, 42, 0.3)',    // terracotta
  'rgba(221, 184, 138, 0.4)',   // tan
  'rgba(122, 26, 32, 0.25)',    // deep red
  'rgba(240, 224, 106, 0.35)',  // yellow
];

// ── Helpers ────────────────────────────────────────────────
function toDateKey(d) {
  // Force Eastern Time so "today" flips at midnight EST, not UTC
  const est = new Date(d.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const y = est.getFullYear();
  const m = String(est.getMonth() + 1).padStart(2, '0');
  const day = String(est.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getDaysBetween(a, b) {
  return Math.ceil((b - a) / (1000 * 60 * 60 * 24));
}

function getAllDates() {
  const dates = [];
  const startKey = toDateKey(START_DATE);
  const endKey = toDateKey(TRIP_END);
  // Generate dates from string keys to avoid timezone drift
  const cur = new Date(startKey + 'T12:00:00');
  const end = new Date(endKey + 'T12:00:00');
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function seededRandom(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function getRotation(dateKey) {
  const seed = dateKey.split('-').reduce((a, b) => a + parseInt(b), 0);
  return (seededRandom(seed) * 6 - 3).toFixed(1);
}

function getTapeStyle(dateKey) {
  const seed = dateKey.split('-').reduce((a, b) => a * parseInt(b), 1);
  return TAPE_STYLES[Math.abs(seed) % TAPE_STYLES.length];
}

function getTapeColor(dateKey) {
  const seed = dateKey.split('-').reduce((a, b) => a + parseInt(b), 0);
  return TAPE_COLORS[Math.abs(seed * 7) % TAPE_COLORS.length];
}

function formatDateLabel(dateKey) {
  const d = new Date(dateKey + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function getDayNumber(dateKey) {
  const d = new Date(dateKey + 'T12:00:00');
  const start = new Date(toDateKey(START_DATE) + 'T12:00:00');
  return getDaysBetween(start, d) + 1;
}

// ── Mountain Trail SVG ─────────────────────────────────────
function MountainTrail({ progress, filled, total, daysUntilSummit }) {
  const trailPath = "M 30 280 Q 60 260 50 240 Q 35 220 65 200 Q 90 185 75 160 Q 55 140 80 120 Q 100 105 90 85 Q 75 65 100 50 Q 120 38 130 20";
  const pathLength = 420;
  const hikerOffset = progress * pathLength;

  return (
    <div className="trail-container">
      <svg viewBox="0 0 200 300" className="trail-svg" aria-label={`Progress: ${filled} of ${total} days logged`}>
        {/* Mountain silhouette */}
        <path d="M 0 300 L 60 100 L 80 140 L 130 20 L 170 120 L 200 300 Z" fill="var(--volcanic-black)" opacity="0.12" />
        {/* Snow cap */}
        <path d="M 110 40 L 130 20 L 148 55 L 135 50 L 125 58 Z" fill="var(--parchment)" opacity="0.5" />

        {/* Trail background (dashed) */}
        <path d={trailPath} fill="none" stroke="var(--terracotta)" strokeWidth="3" strokeDasharray="6 4" opacity="0.3" strokeLinecap="round" />
        {/* Trail progress (solid) */}
        <path d={trailPath} fill="none" stroke="var(--terracotta)" strokeWidth="3.5" strokeLinecap="round"
          strokeDasharray={pathLength} strokeDashoffset={pathLength - hikerOffset}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }} />

        {/* Start marker */}
        <circle cx="30" cy="280" r="4" fill="var(--jade)" />
        <text x="42" y="284" className="trail-label" fill="var(--jade)">Start</text>

        {/* Summit flag */}
        <g transform="translate(130, 12)">
          <line x1="0" y1="0" x2="0" y2="-14" stroke="var(--terracotta)" strokeWidth="1.5" />
          <polygon points="0,-14 12,-10 0,-6" fill="var(--terracotta)" />
        </g>

        {/* Hiker dot */}
        <circle r="6" fill="var(--terracotta)" stroke="var(--parchment)" strokeWidth="2"
          style={{ transition: 'all 0.8s ease' }}>
          <animateMotion dur="0.01s" fill="freeze" keyPoints={`${progress};${progress}`} keyTimes="0;1" calcMode="linear">
            <mpath href="#hikerPath" />
          </animateMotion>
        </circle>
        <path id="hikerPath" d={trailPath} fill="none" stroke="none" />

        {/* Decorative trees */}
        <g opacity="0.25" fill="var(--jade)">
          <polygon points="15,265 20,250 25,265" />
          <polygon points="160,250 165,238 170,250" />
          <polygon points="40,220 44,210 48,220" />
          <polygon points="145,180 149,170 153,180" />
        </g>
      </svg>
      <p className="trail-count">{daysUntilSummit > 0 ? `${daysUntilSummit} days until summit` : 'Summit day has arrived!'}</p>
    </div>
  );
}

// ── Photo Slot ─────────────────────────────────────────────
function PhotoSlot({ dateKey, photo, onUpload, onView, onUpdateCaption, onCloseViewer }) {
  const today = toDateKey(new Date());
  const isFuture = dateKey > today;
  const dayNum = getDayNumber(dateKey);
  const rotation = getRotation(dateKey);
  const tapeClass = getTapeStyle(dateKey);
  const tapeColor = getTapeColor(dateKey);
  const fileInputRef = useRef(null);
  const [captionInput, setCaptionInput] = useState('');
  const [promptStep, setPromptStep] = useState(null); // null | 'caption'
  const [editingCaption, setEditingCaption] = useState(false);
  const [editCaptionValue, setEditCaptionValue] = useState('');
  const captionInputRef = useRef(null);
  const pendingFile = useRef(null);
  const replacingRef = useRef(false);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    replacingRef.current = false;
    if (!file) return;
    // Close fullscreen if it's open
    onCloseViewer();
    // If replacing an existing photo, skip caption prompt — keep existing caption
    if (photo) {
      onUpload(dateKey, file, photo.caption || '', photo.notes || '');
      e.target.value = '';
      return;
    }
    pendingFile.current = file;
    setPromptStep('caption');
  };

  const handleSave = () => {
    if (pendingFile.current) {
      onUpload(dateKey, pendingFile.current, captionInput.trim(), '');
      pendingFile.current = null;
      setCaptionInput('');
      setPromptStep(null);
    }
  };

  const handleSkipCaption = () => {
    if (pendingFile.current) {
      onUpload(dateKey, pendingFile.current, '', '');
      pendingFile.current = null;
      setCaptionInput('');
      setPromptStep(null);
    }
  };

  // Filled slot
  if (photo && !promptStep) {
    const isToday = dateKey === today;
    const handleReplace = (e) => {
      e.stopPropagation();
      e.preventDefault();
      replacingRef.current = true;
      fileInputRef.current?.click();
    };
    const handleCaptionTap = (e) => {
      e.stopPropagation();
      if (!isToday) return;
      setEditCaptionValue(photo.caption || '');
      setEditingCaption(true);
      setTimeout(() => captionInputRef.current?.focus(), 50);
    };
    const handleSaveCaption = (e) => {
      e?.stopPropagation();
      onUpdateCaption(dateKey, editCaptionValue.trim());
      setEditingCaption(false);
    };
    const handleCaptionKeyDown = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); handleSaveCaption(e); }
    };
    return (
      <div className={`photo-slot filled ${tapeClass}`} style={{ '--rotation': `${rotation}deg`, '--tape-color': tapeColor }}
        onClick={() => !editingCaption && !replacingRef.current && onView({ ...photo, dateKey })} role="button" tabIndex={0}
        onKeyDown={(e) => !editingCaption && !replacingRef.current && e.key === 'Enter' && onView({ ...photo, dateKey })}>
        <div className="polaroid">
          <img src={photo.url} alt={`Day ${dayNum}`} loading="lazy" />
          <div className="polaroid-footer" onClick={isToday && !editingCaption ? handleCaptionTap : undefined}>
            {editingCaption ? (
              <div className="inline-caption-edit" onClick={(e) => e.stopPropagation()}>
                <input
                  ref={captionInputRef}
                  type="text"
                  value={editCaptionValue}
                  onChange={(e) => setEditCaptionValue(e.target.value)}
                  onKeyDown={handleCaptionKeyDown}
                  onBlur={handleSaveCaption}
                  maxLength={100}
                  placeholder="What's the story?"
                  className="inline-caption-input"
                />
              </div>
            ) : (
              <p className={`photo-caption ${isToday ? 'tappable' : ''}`}>{photo.caption || 'Add a caption'}</p>
            )}
          </div>
          {isToday && (
            <button className="replace-btn" onClick={handleReplace}
              onTouchEnd={(e) => { e.stopPropagation(); }}
              aria-label="Replace photo">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </button>
          )}
        </div>
        {isToday && (
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
            onChange={handleFileSelect} hidden />
        )}
      </div>
    );
  }

  // Caption prompt after upload
  if (promptStep === 'caption') {
    return (
      <div className="photo-slot caption-prompt" style={{ '--rotation': '0deg' }}>
        <div className="caption-prompt-inner">
          <p className="caption-prompt-title">Add a caption? (optional)</p>
          <input type="text" maxLength={100} value={captionInput}
            onChange={(e) => setCaptionInput(e.target.value)}
            placeholder="What's the story?" className="caption-input" autoFocus />
          <div className="caption-buttons">
            <button onClick={handleSkipCaption} className="btn-skip">Skip</button>
            <button onClick={handleSave} className="btn-save">Save</button>
          </div>
        </div>
      </div>
    );
  }

  // Missed day (past, no photo, not today)
  const isPast = dateKey < today;
  if (isPast && !photo) {
    return (
      <div className={`photo-slot empty missed ${tapeClass}`}
        style={{ '--rotation': `${rotation}deg`, '--tape-color': tapeColor }}>
        <div className="polaroid">
          <div className="polaroid-image-area empty-image-area missed-area">
            <div className="empty-inner">
              <span style={{ fontSize: '2rem' }}>😢</span>
              <span className="empty-label">The summit missed you on {formatDateLabel(dateKey)}</span>
            </div>
          </div>
          <div className="polaroid-footer">
            <p className="photo-caption">Add a caption</p>
          </div>
        </div>
      </div>
    );
  }

  // Empty slot
  return (
    <div className={`photo-slot empty ${isFuture ? 'future' : 'ready'} ${tapeClass}`}
      style={{ '--rotation': `${rotation}deg`, '--tape-color': tapeColor }}
      onClick={() => !isFuture && fileInputRef.current?.click()}
      role={isFuture ? undefined : 'button'}
      tabIndex={isFuture ? undefined : 0}
      onKeyDown={(e) => !isFuture && e.key === 'Enter' && fileInputRef.current?.click()}>
      <div className="polaroid">
        <div className="polaroid-image-area empty-image-area">
          <div className="empty-inner">
            <svg className="mountain-icon" viewBox="0 0 40 40" width="40" height="40">
              <path d="M5 35 L20 10 L35 35 Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
              <path d="M12 35 L22 20 L32 35" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" opacity="0.5"/>
              <circle cx="30" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            <span className="empty-label">
              {isFuture ? `Day ${dayNum} — awaiting adventure` : `Day ${dayNum} — tap to add`}
            </span>
          </div>
        </div>
        <div className="polaroid-footer">
          <p className="photo-caption">Add a caption</p>
        </div>
      </div>
      {!isFuture && (
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
          onChange={handleFileSelect} hidden />
      )}
    </div>
  );
}

// ── Peek Card (miniature polaroid on the sides) ──
function PeekCard({ dateKey, photo }) {
  const dayNum = getDayNumber(dateKey);
  const rotation = getRotation(dateKey);
  const tapeClass = getTapeStyle(dateKey);
  const tapeColor = getTapeColor(dateKey);

  return (
    <div className={`peek-card ${tapeClass}`} style={{ '--rotation': `${rotation}deg`, '--tape-color': tapeColor }}>
      <div className="polaroid">
        {photo ? (
          <img src={photo.url} alt={`Day ${dayNum}`} />
        ) : (
          <div className="polaroid-image-area empty-image-area">
            <div className="empty-inner">
              <svg className="mountain-icon" viewBox="0 0 40 40" width="40" height="40">
                <path d="M5 35 L20 10 L35 35 Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                <path d="M12 35 L22 20 L32 35" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" opacity="0.5"/>
                <circle cx="30" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
              <span className="empty-label">Day {dayNum}</span>
            </div>
          </div>
        )}
        <div className="polaroid-footer">
          <p className="photo-caption">{photo?.caption || 'Add a caption'}</p>
        </div>
      </div>
    </div>
  );
}

// ── Day Carousel ───────────────────────────────────────────
function DayCarousel({ dates, photos, onUpload, onView, onUpdateCaption, onCloseViewer }) {
  // Chronological order — left is past, right is future
  const today = toDateKey(new Date());
  const initialIndex = useMemo(() => {
    const todayIdx = dates.findIndex((d) => d >= today);
    return todayIdx >= 0 ? todayIdx : dates.length - 1;
  }, [dates, today]);

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const touchStart = useRef({ x: 0, y: 0 });
  const touchDelta = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const containerRef = useRef(null);

  const goTo = useCallback((idx) => {
    setCurrentIndex(Math.max(0, Math.min(idx, dates.length - 1)));
  }, [dates.length]);

  const handleTouchStart = (e) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    touchDelta.current = 0;
    setDragging(true);
  };

  const handleTouchMove = (e) => {
    const dx = e.touches[0].clientX - touchStart.current.x;
    const dy = e.touches[0].clientY - touchStart.current.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      e.preventDefault();
      touchDelta.current = dx;
      setDragOffset(dx);
    }
  };

  const handleTouchEnd = () => {
    setDragging(false);
    setDragOffset(0);
    const threshold = 50;
    if (touchDelta.current < -threshold) {
      goTo(currentIndex + 1); // swipe left → forward in time
    } else if (touchDelta.current > threshold) {
      goTo(currentIndex - 1); // swipe right → back in time
    }
    touchDelta.current = 0;
  };

  const mouseStart = useRef(null);
  const handleMouseDown = (e) => {
    mouseStart.current = e.clientX;
    touchDelta.current = 0;
    setDragging(true);
  };

  const handleMouseMove = (e) => {
    if (mouseStart.current === null) return;
    const dx = e.clientX - mouseStart.current;
    touchDelta.current = dx;
    setDragOffset(dx);
  };

  const handleMouseUp = () => {
    if (mouseStart.current === null) return;
    setDragging(false);
    setDragOffset(0);
    const threshold = 50;
    if (touchDelta.current < -threshold) {
      goTo(currentIndex + 1);
    } else if (touchDelta.current > threshold) {
      goTo(currentIndex - 1);
    }
    mouseStart.current = null;
    touchDelta.current = 0;
  };

  const currentDate = dates[currentIndex];
  const prevDate = currentIndex > 0 ? dates[currentIndex - 1] : null;
  const nextDate = currentIndex < dates.length - 1 ? dates[currentIndex + 1] : null;

  return (
    <section className="carousel-section">
      <div
        className="carousel-track-wrapper"
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={dragging ? handleMouseMove : undefined}
        onMouseUp={handleMouseUp}
        onMouseLeave={dragging ? handleMouseUp : undefined}
      >
        <div className="carousel-track" style={{
          transform: `translateX(${dragOffset}px)`,
          transition: dragging ? 'none' : 'transform 0.3s ease',
        }}>
          {/* Left peek */}
          <div className="carousel-peek">
            {prevDate && <PeekCard dateKey={prevDate} photo={photos[prevDate] || null} />}
          </div>

          {/* Active card */}
          <div className="carousel-slide-active">
            <PhotoSlot dateKey={currentDate}
              photo={photos[currentDate] || null}
              onUpload={onUpload} onView={onView} onUpdateCaption={onUpdateCaption} onCloseViewer={onCloseViewer} />
          </div>

          {/* Right peek */}
          <div className="carousel-peek">
            {nextDate && <PeekCard dateKey={nextDate} photo={photos[nextDate] || null} />}
          </div>
        </div>
      </div>

      {/* Navigation — left = back, right = forward */}
      <div className="carousel-nav">
        <button
          className="carousel-arrow"
          onClick={() => goTo(currentIndex - 1)}
          disabled={currentIndex === 0}
          aria-label="Previous day"
        >
          <svg width="12" height="15" viewBox="0 0 14 18"><polygon points="14,0 0,9 14,18" fill="currentColor"/></svg>
        </button>
        <span className="carousel-indicator">
          {formatDateLabel(currentDate)}
        </span>
        <button
          className="carousel-arrow"
          onClick={() => goTo(currentIndex + 1)}
          disabled={currentIndex === dates.length - 1}
          aria-label="Next day"
        >
          <svg width="12" height="15" viewBox="0 0 14 18"><polygon points="0,0 14,9 0,18" fill="currentColor"/></svg>
        </button>
      </div>
    </section>
  );
}

// ── Fullscreen Viewer ──────────────────────────────────────
function formatStickyDate(dateKey) {
  if (!dateKey) return '';
  const d = new Date(dateKey + 'T12:00:00');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}.${dd}.${yy}`;
}

function FullscreenViewer({ photo, onClose, onUpdateNotes }) {
  const [editing, setEditing] = useState(false);
  const [notesInput, setNotesInput] = useState('');
  const textareaRef = useRef(null);
  const today = toDateKey(new Date());
  const isToday = photo?.dateKey === today;

  if (!photo) return null;

  const handleStickyTap = (e) => {
    e.stopPropagation();
    if (!isToday || editing) return;
    setNotesInput(photo.notes || '');
    setEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleSaveNotes = () => {
    onUpdateNotes(photo.dateKey, notesInput.trim());
    setEditing(false);
  };

  return (
    <div className="fullscreen-overlay" onClick={onClose}>
      <button className="fullscreen-close" onClick={onClose} aria-label="Close">&times;</button>
      <div className="fullscreen-content" onClick={(e) => e.stopPropagation()}>
        <div className="fullscreen-polaroid">
          <img src={photo.url} alt="Full view" className="fullscreen-img" />
          <p className="fullscreen-caption">{photo.caption || 'Add a caption'}</p>
        </div>
        <div className={`sticky-note ${isToday ? 'editable' : ''}`} onClick={handleStickyTap}>
          <div className="sticky-tape" />
          <span className="sticky-date">{formatStickyDate(photo.dateKey)}</span>
          {editing ? (
            <div className="sticky-edit" onClick={(e) => e.stopPropagation()}>
              <textarea
                ref={textareaRef}
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                maxLength={150}
                placeholder="Write a note..."
                className="sticky-textarea"
                rows={3}
              />
              <button className="sticky-save-btn" onClick={handleSaveNotes}>Save</button>
            </div>
          ) : (
            <p className="sticky-text">
              {photo.notes || (isToday ? 'Tap to add a note...' : '\u00A0')}
            </p>
          )}
          <div className="sticky-fold" />
        </div>
      </div>
    </div>
  );
}

// ── Weekly Accordion ────────────────────────────────────────
function getWeeks(dates) {
  const weeks = [];
  for (let i = 0; i < dates.length; i += 7) {
    const chunk = dates.slice(i, i + 7);
    const weekNum = Math.floor(i / 7) + 1;
    const startLabel = formatDateLabel(chunk[0]);
    const endLabel = formatDateLabel(chunk[chunk.length - 1]);
    weeks.push({ weekNum, dates: chunk, label: `${startLabel} – ${endLabel}` });
  }
  return weeks;
}

function WeeklyAccordion({ dates, photos, onView }) {
  const today = toDateKey(new Date());
  const weeks = useMemo(() => getWeeks(dates), [dates]);

  // Find which week has today's date, default open that week
  const currentWeekIdx = useMemo(() => {
    return weeks.findIndex((w) => w.dates.some((d) => d >= today)) || 0;
  }, [weeks, today]);

  const [openWeek, setOpenWeek] = useState(currentWeekIdx);

  const toggleWeek = (idx) => {
    setOpenWeek(openWeek === idx ? -1 : idx);
  };

  return (
    <section className="weekly-section">
      <h2 className="weekly-title">Weekly Recap</h2>
      {weeks.map((week, idx) => {
        const isOpen = openWeek === idx;
        const hasFutureOnly = week.dates.every((d) => d > today);
        const filledInWeek = week.dates.filter((d) => photos[d]).length;

        return (
          <div key={week.weekNum} className={`week-accordion ${isOpen ? 'open' : ''} ${hasFutureOnly ? 'future-week' : ''}`}>
            <button className="week-header" onClick={() => toggleWeek(idx)}>
              <span className="week-label">
                Week {week.weekNum}
                <span className="week-range">{week.label}</span>
              </span>
              <span className="week-meta">
                {filledInWeek > 0 && <span className="week-count">{filledInWeek} photo{filledInWeek !== 1 ? 's' : ''}</span>}
                <span className={`week-chevron ${isOpen ? 'open' : ''}`}>▸</span>
              </span>
            </button>
            {isOpen && (
              <div className="week-grid">
                {week.dates.map((dateKey) => {
                  const photo = photos[dateKey];
                  const isFuture = dateKey > today;
                  const isPast = dateKey < today;
                  const dayNum = getDayNumber(dateKey);
                  const rotation = getRotation(dateKey);
                  const tapeClass = getTapeStyle(dateKey);
                  const tapeColor = getTapeColor(dateKey);

                  return (
                    <div
                      key={dateKey}
                      className={`week-polaroid ${tapeClass} ${photo ? 'filled' : ''} ${isFuture ? 'future' : ''} ${isPast && !photo ? 'missed' : ''}`}
                      style={{ '--rotation': `${rotation}deg`, '--tape-color': tapeColor }}
                      onClick={() => photo && onView({ ...photo, dateKey })}
                    >
                      <div className="week-polaroid-inner">
                        {photo ? (
                          <img src={photo.url} alt={`Day ${dayNum}`} loading="lazy" />
                        ) : (
                          <div className="week-polaroid-empty">
                            {isFuture ? (
                              <span className="week-polaroid-day">Day {dayNum}</span>
                            ) : (
                              <>
                                <span style={{ fontSize: '1.1rem' }}>😢</span>
                                <span className="week-polaroid-day" style={{ fontSize: '0.6rem' }}>Missed</span>
                              </>
                            )}
                          </div>
                        )}
                        <div className="week-polaroid-footer">
                          <span>{new Date(dateKey + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

// ── Access Gate ──────────────────────────────────────────────
function AccessGate({ children }) {
  const [authorized, setAuthorized] = useState(() => sessionStorage.getItem('scrapbook_auth') === 'true');
  const [pinInput, setPinInput] = useState('');
  const [error, setError] = useState(false);

  if (authorized) return children;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (pinInput === VIEW_PIN) {
      sessionStorage.setItem('scrapbook_auth', 'true');
      setAuthorized(true);
    } else {
      setError(true);
      setPinInput('');
    }
  };

  return (
    <div className="access-gate">
      <div className="access-card">
        <h1 className="access-title">Road to Acatenango <span>🌋</span></h1>
        <p className="access-subtitle">Enter the code to view this scrapbook</p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={pinInput}
            onChange={(e) => { setPinInput(e.target.value); setError(false); }}
            placeholder="Enter code"
            className="access-input"
            autoFocus
          />
          {error && <p className="access-error">Incorrect code</p>}
          <button type="submit" className="access-btn">Enter</button>
        </form>
      </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────
export default function App() {
  const [photos, setPhotos] = useState({});
  const [viewerPhoto, setViewerPhoto] = useState(null);

  const allDates = useMemo(() => getAllDates(), []);
  const totalDays = allDates.length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startNoon = new Date(toDateKey(START_DATE) + 'T12:00:00');
  const summitNoon = new Date(toDateKey(SUMMIT_DAY) + 'T12:00:00');
  const todayNoon = new Date(toDateKey(today) + 'T12:00:00');
  const totalTripDays = getDaysBetween(startNoon, summitNoon) + 1;
  const elapsed = getDaysBetween(startNoon, todayNoon);
  const daysUntilSummit = Math.max(0, totalTripDays - elapsed);

  // Load photos from Supabase
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from('photos').select('*');
      if (error) { console.error('Failed to load photos:', error); return; }
      const map = {};
      for (const entry of data) {
        const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(entry.image_path);
        map[entry.date] = { url: publicUrl, caption: entry.caption || '', notes: entry.notes || '', dateKey: entry.date };
      }
      setPhotos(map);
    }
    load();
  }, []);

  const filledCount = Object.keys(photos).length;
  const progress = totalDays > 0 ? filledCount / totalDays : 0;

  const handleUpload = async (dateKey, file, caption, notes = '') => {
    const cleanFile = await stripExif(file);
    const path = `${dateKey}.jpg`;

    // Upload image to storage (upsert)
    const { error: storageError } = await supabase.storage.from('photos').upload(path, cleanFile, { upsert: true });
    if (storageError) { console.error('Upload failed:', storageError); return; }

    // Upsert row in photos table
    const { error: dbError } = await supabase.from('photos').upsert({ date: dateKey, caption, notes, image_path: path }, { onConflict: 'date' });
    if (dbError) { console.error('DB insert failed:', dbError); return; }

    const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(path);
    // Add cache-buster so browser doesn't show stale image after replacement
    const freshUrl = `${publicUrl}?t=${Date.now()}`;
    setPhotos((prev) => ({ ...prev, [dateKey]: { url: freshUrl, caption, notes, dateKey } }));
  };

  const handleUpdateCaption = async (dateKey, caption) => {
    const existing = photos[dateKey];
    if (!existing) return;
    const { error } = await supabase.from('photos').update({ caption }).eq('date', dateKey);
    if (error) { console.error('Update caption failed:', error); return; }
    setPhotos((prev) => ({ ...prev, [dateKey]: { ...prev[dateKey], caption } }));
  };

  const handleUpdateNotes = async (dateKey, notes) => {
    const existing = photos[dateKey];
    if (!existing) return;
    const { error } = await supabase.from('photos').update({ notes }).eq('date', dateKey);
    if (error) { console.error('Update notes failed:', error); return; }
    setPhotos((prev) => ({ ...prev, [dateKey]: { ...prev[dateKey], notes } }));
    setViewerPhoto((prev) => prev ? { ...prev, notes } : null);
  };

  return (
    <AccessGate>
      <div className="app">
        <header className="header">
          <h1 className="title">Road to Acatenango <span className="title-emoji">🌋</span></h1>
        </header>

        <MountainTrail progress={progress} filled={filledCount} total={totalDays} daysUntilSummit={daysUntilSummit} />

        <DayCarousel dates={allDates} photos={photos} onUpload={handleUpload} onView={setViewerPhoto} onUpdateCaption={handleUpdateCaption} onCloseViewer={() => setViewerPhoto(null)} />

        <WeeklyAccordion dates={allDates} photos={photos} onView={setViewerPhoto} />

        <section className="itinerary">
          <h2 className="itinerary-title">Trip Itinerary</h2>
          <ul className="itinerary-list">
            {ITINERARY.map((item) => (
              <li key={item.date} className="itinerary-item">
                <span className="itinerary-date">{item.date}</span>
                <span className="itinerary-label">{item.label}</span>
              </li>
            ))}
          </ul>
        </section>

        <FullscreenViewer photo={viewerPhoto} onClose={() => setViewerPhoto(null)} onUpdateNotes={handleUpdateNotes} />
      </div>
    </AccessGate>
  );
}
