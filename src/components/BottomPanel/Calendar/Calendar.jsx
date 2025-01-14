import { useState, useEffect, useRef, useMemo } from "react";
import { getRandomString, findFocusableElements, findRelativeFocusableElement } from "utils";
import * as chromeStorage from "services/chromeStorage";
import * as timeDateService from "services/timeDate";
import { useSettings } from "contexts/settings";
import Icon from "components/Icon";
import "./calendar.css";
import SelectedDay from "./SelectedDay";
import WorldClocks from "./WorldClocks";

export default function Calendar({ visible, locale, showIndicator }) {
  const { settings: { appearance: { animationSpeed }, timeDate: settings } } = useSettings();
  const [calendar, setCalendar] = useState(null);
  const [currentDay, setCurrentDay] = useState(null);
  const [currentYear, setCurrentYear] = useState();
  const [visibleMonth, setVisibleMonth] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [viewingYear, setViewingYear] = useState(false);
  const [transition, setTransition] = useState({ x: 0, y: 0 });
  const weekdays = useMemo(() => timeDateService.getWeekdays(settings.dateLocale, "short"), [settings.dateLocale, settings.firstWeekday]);
  const currentFirstWeekday = useRef(settings.firstWeekday);

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    if (currentFirstWeekday.current !== settings.firstWeekday) {
      currentFirstWeekday.current = settings.firstWeekday;
      reinitCalendar();
    }
  }, [settings.firstWeekday]);

  useEffect(() => {
    if (!calendar) {
      return;
    }
    reinitCalendar();
  }, [settings.dateLocale]);

  useEffect(() => {
    if (currentDay) {
      showIndicator("calendar", currentDay.reminders.length > 0);
    }
  }, [currentDay]);

  async function init() {
    const reminders = await chromeStorage.get("reminders");

    initCalendar(reminders);

    chromeStorage.subscribeToChanges(({ reminders }) => {
      if (!reminders) {
        return;
      }

      if (reminders.newValue) {
        initCalendar(reminders.newValue);
      }
      else {
        setSelectedDay(null);
        setViewingYear(false);
        initCalendar();
      }
    });
  }

  function initCalendar(reminders) {
    const currentDate = timeDateService.getCurrentDate();
    const { year, month } = currentDate;
    const calendar = {
      [year] : generateYear(year)
    };
    calendar[year][month].isCurrentMonth = true;

    setCurrentYear(year);
    setCurrentDay(getCurrentDay(calendar, currentDate));
    getVisibleMonth(calendar, currentDate);

    if (reminders?.length) {
      setReminders(reminders);
      createReminders(reminders, calendar);
    }
    else {
      setCalendar(calendar);
    }
  }

  function reinitCalendar() {
    const r = reminders.map(reminder => {
      delete reminder.nextRepeat;
      return reminder;
    });
    initCalendar(r);
  }

  function generateYear(year) {
    const months = [];

    for (let i = 0; i < 12; i++) {
      const date = new Date(`${year}-${i + 1}-01`);
      const daysInMonth = timeDateService.getDaysInMonth(year, i);
      const month = {
        firstDayIndex: timeDateService.getFirstDayIndex(year, i),
        name: timeDateService.getMonthName(i, settings.dateLocale),
        dateString: timeDateService.formatDate(date, {
          locale: settings.dateLocale,
          excludeDay: true
        }),
        days: []
      };

      for (let j = 0; j < daysInMonth; j++) {
        const date = new Date(`${year}-${i + 1}-${j + 1}`);

        month.days.push({
          id: getRandomString(),
          year,
          month: i,
          day: j + 1,
          dateString: timeDateService.formatDate(date, {
            locale: settings.dateLocale
          }),
          reminders: []
        });
      }
      months.push(month);
    }
    return months;
  }

  function getVisibleMonth(calendar, { year, month }) {
    const { days, firstDayIndex, name, dateString } = calendar[year][month];
    let previousMonth = month - 1;
    let nextMonth = month + 1;
    let isNewYear = false;

    if (previousMonth < 0) {
      year -= 1;
      previousMonth = 11;
    }
    else if (nextMonth > 11) {
      year += 1;
      nextMonth = 0;
    }

    if (!calendar[year]) {
      isNewYear = true;
      calendar[year] = generateYear(year);
    }
    const { days: previousMonthDays, name: previousMonthName } = calendar[year][previousMonth];
    const { days: nextMonthDays, name: nextMonthName } = calendar[year][nextMonth];

    setVisibleMonth({
      previous: {
        name: previousMonthName,
        days: firstDayIndex > 0 ? previousMonthDays.slice(-firstDayIndex) : []
      },
      next: {
        name: nextMonthName,
        days: nextMonthDays.slice(0, 42 - days.length - firstDayIndex)
      },
      current: { name, month, days, dateString }
    });

    if (isNewYear) {
      setCalendar({ ...calendar });
    }
  }

  function changeMonth(direction) {
    let year = currentYear;
    let month = visibleMonth.current.month + direction;

    if (month < 0) {
      month = 11;
      year -= 1;
    }
    else if (month > 11) {
      month = 0;
      year += 1;

      repeatFutureReminders(calendar);
      setCalendar({ ...calendar });
    }
    if (year !== currentYear) {
      setCurrentYear(year);
    }
    getVisibleMonth(calendar, { year, month });
  }

  function getCurrentDay(calendar, date) {
    const day = getCalendarDay(calendar, date);
    const weekday = timeDateService.getWeekday(day.year, day.month, day.day);

    day.isCurrentDay = true;
    day.weekdayName = timeDateService.getWeekdayName(weekday, settings.dateLocale);

    return day;
  }

  function resetCurrentDay() {
    const currentDate = timeDateService.getCurrentDate();

    setCurrentDay({
      ...currentDay,
      ...getCalendarDay(calendar, currentDate)
    });
  }

  function getCalendarDay(calendar, { year, month, day }) {
    return calendar[year][month].days[day - 1];
  }

  function transitionElement(element) {
    return new Promise(resolve => {
      setTransition({
        x: element.offsetLeft + element.offsetWidth / 2,
        y: element.offsetTop + element.offsetHeight / 2,
        active: true
      });

      setTimeout(() => {
        setTransition({ x: 0, y: 0 });
        resolve();
      }, 300 * animationSpeed);
    });
  }

  async function showDay(element, day, direction = 0) {
    await transitionElement(element);

    setSelectedDay({
      year: day.year,
      month: day.month,
      day: day.day
    });

    if (direction) {
      changeMonth(direction);
    }
  }

  function viewYear() {
    setViewingYear(true);
  }

  function setVisibleYear(direction) {
    const year = currentYear + direction;

    if (!calendar[year]) {
      calendar[year] = generateYear(year);

      if (direction === 1) {
        repeatFutureReminders(calendar);
      }
      setCalendar({ ...calendar });
    }
    setCurrentYear(year);
  }

  async function showMonth(element, index) {
    await transitionElement(element);

    getVisibleMonth(calendar, {
      year: currentYear,
      month: index
    });
    setViewingYear(false);
  }

  function hideSelectedDay() {
    setSelectedDay(null);
  }

  function getDayCountFromMonthCount(monthCount, repeatAtDay, nextRepeat) {
    let dayCount = 0;

    nextRepeat.leftoverDays ??= 0;

    for (let i = 1; i <= monthCount; i += 1) {
      const year = nextRepeat.year;
      const month = nextRepeat.month + i;
      const nextMonthDays = getDaysInMonth(year, month);

      if (repeatAtDay > nextMonthDays) {
        nextRepeat.leftoverDays = repeatAtDay - nextMonthDays;
        dayCount += nextMonthDays;
      }
      else {
        const days = timeDateService.getDaysInMonth(year, month - 1);
        dayCount += days + nextRepeat.leftoverDays;
        nextRepeat.leftoverDays = 0;
      }
    }
    return dayCount;
  }

  function getWeekdayRepeatGaps(reminder) {
    const { weekdays } = reminder.repeat;
    const gaps = [];
    let weekday = timeDateService.getWeekday(reminder.year, reminder.month, reminder.day);
    let gap = 1;
    let i = 0;

    while (i < 7) {
      if (weekday === 6) {
        weekday = 0;
      }
      else {
        weekday += 1;
      }

      if (weekdays.dynamic[weekday]) {
        gaps.push(gap);
        gap = 1;
      }
      else {
        gap += 1;
      }
      i += 1;
    }
    return gaps;
  }

  function getNextReminderDate(calendar, { year, month: monthIndex, day: dayIndex }) {
    let months = calendar[year];
    let month = months[monthIndex];

    while (dayIndex > month.days.length - 1) {
      monthIndex += 1;
      dayIndex -= month.days.length;

      if (monthIndex > 11) {
        year += 1;
        monthIndex = 0;
        months = calendar[year];

        if (!months) {
          break;
        }
      }
      month = months[monthIndex];
    }
    return {
      day: dayIndex,
      month: monthIndex,
      year
    };
  }

  function repeatReminder(calendar, reminder, shouldReplace) {
    reminder.nextRepeat ??= {
      repeats: reminder.repeat.count,
      gapIndex: 0,
      gaps: reminder.repeat.type === "weekday" ? getWeekdayRepeatGaps(reminder) : null,
      year: reminder.year,
      month: reminder.month,
      day:  reminder.day - 1
    };

    if (reminder.nextRepeat.done) {
      return;
    }
    const months = calendar[reminder.nextRepeat.year];
    let month = months[reminder.nextRepeat.month];
    let day = month.days[reminder.nextRepeat.day];

    while (true) {
      if (!day) {
        const date = getNextReminderDate(calendar, reminder.nextRepeat);

        if (date.year > reminder.nextRepeat.year) {
          reminder.nextRepeat = { ...reminder.nextRepeat, ...date };

          if (calendar[date.year]) {
            repeatReminder(calendar, reminder);
          }
          return;
        }
        reminder.nextRepeat.day = date.day;
        reminder.nextRepeat.month = date.month;
        month = months[reminder.nextRepeat.month];
        day = month.days[reminder.nextRepeat.day];
      }

      if (shouldReplace) {
        const index = day.reminders.findIndex(({ id }) => id === reminder.oldId);

        if (index < 0) {
          day.reminders.push(reminder);
        }
        else {
          day.reminders.splice(index, 1, reminder);
        }
      }
      else {
        day.reminders.push(reminder);
      }

      if (day.isCurrentDay) {
        setCurrentDay({ ...day });
      }

      if (reminder.nextRepeat.repeats > 0) {
        reminder.nextRepeat.repeats -= 1;

        if (!reminder.nextRepeat.repeats) {
          reminder.nextRepeat.done = true;
          return;
        }
      }

      if (reminder.repeat.type === "custom") {
        if (reminder.repeat.customTypeGapName === "days") {
          reminder.nextRepeat.day += reminder.repeat.gap;
        }
        else if (reminder.repeat.customTypeGapName === "weeks") {
          reminder.nextRepeat.day += reminder.repeat.gap * 7;
        }
        else if (reminder.repeat.customTypeGapName === "months") {
          reminder.nextRepeat.day += getDayCountFromMonthCount(reminder.repeat.gap, reminder.day, reminder.nextRepeat);
        }
      }
      else if (reminder.repeat.type === "weekday") {
        reminder.nextRepeat.day += reminder.nextRepeat.gaps[reminder.nextRepeat.gapIndex];
        reminder.nextRepeat.gapIndex += 1;

        if (reminder.nextRepeat.gapIndex === reminder.nextRepeat.gaps.length) {
          reminder.nextRepeat.gapIndex = 0;
        }
      }
      else if (reminder.repeat.type === "week") {
        reminder.nextRepeat.day += 7;
      }
      else if (reminder.repeat.type === "month") {
        const nextDays = getDaysInMonth(reminder.nextRepeat.year, reminder.nextRepeat.month + 1);

        reminder.nextRepeat.leftoverDays ??= 0;

        if (reminder.day > nextDays) {
          reminder.nextRepeat.leftoverDays = reminder.day - nextDays;
          reminder.nextRepeat.day += nextDays;
        }
        else {
          const days = timeDateService.getDaysInMonth(reminder.nextRepeat.year, reminder.nextRepeat.month);
          reminder.nextRepeat.day += days + reminder.nextRepeat.leftoverDays;
          reminder.nextRepeat.leftoverDays = 0;
        }
      }
      day = month.days[reminder.nextRepeat.day];
    }
  }

  function getDaysInMonth(year, month) {
    if (month > 11) {
      month = 0;
      year += 1;
    }
    return timeDateService.getDaysInMonth(year, month);
  }

  function repeatFutureReminders(calendar) {
    const repeatableReminders = reminders.reduce((reminders, reminder) => {
      if (reminder.repeat && calendar[reminder.nextRepeat.year] && !reminder.nextRepeat.done) {
        reminders.push(reminder);
      }
      return reminders;
    }, []);

    for (const reminder of repeatableReminders) {
      repeatReminder(calendar, reminder);
    }
  }

  function updateCalendar() {
    setReminders([...reminders]);
    setCalendar({ ...calendar });
    resetCurrentDay(calendar);
  }

  function createReminders(reminders, calendar) {
    reminders.forEach(reminder => createReminder(reminder, calendar));
  }

  function createReminder(reminder, calendar, shouldReplace) {
    const { year } = reminder;

    if (!calendar[year]) {
      calendar[year] = generateYear(year);
    }
    reminder.id ??= getRandomString();
    reminder.range ??= {};
    reminder.range.text = getReminderRangeString(reminder.range);

    if (reminder.repeat) {
      if (reminder.repeat.type === "weekday") {
        if (Array.isArray(reminder.repeat.weekdays)) {
          reminder.repeat.weekdays = { static: reminder.repeat.weekdays };
        }
        reminder.repeat.weekdays.dynamic = [...reminder.repeat.weekdays.static];

        if (reminder.repeat.firstWeekday !== currentFirstWeekday.current) {
          if (reminder.repeat.firstWeekday === 0) {
            reminder.repeat.weekdays.dynamic.unshift(reminder.repeat.weekdays.dynamic.pop());
          }
          else {
            reminder.repeat.weekdays.dynamic.push(reminder.repeat.weekdays.dynamic.shift());
          }
        }
      }
      reminder.repeat.tooltip = getReminderRepeatTooltip(reminder.repeat);
      repeatReminder(calendar, reminder, shouldReplace);
    }
    else {
      const day = getCalendarDay(calendar, reminder);

      if (shouldReplace) {
        day.reminders.splice(reminder.index, 1, reminder);
      }
      else {
        day.reminders.push(reminder);
      }

      if (day.isCurrentDay) {
        setCurrentDay({ ...day });
      }
    }
    setCalendar({ ...calendar });
  }

  function getReminderRangeString({ from, to }) {
    if (!from) {
      return "All day";
    }

    if (to) {
      const fromString = timeDateService.getTimeString(from);
      const toString = timeDateService.getTimeString(to);

      return `${fromString} - ${toString}`;
    }
    return timeDateService.getTimeString(from);
  }

  function getReminderRepeatTooltip({ type, gap, count, weekdays, customTypeGapName }) {
    if (type === "custom") {
      return `Repeating ${count > 1 ? `${count} times ` : ""}every ${gap === 1 ? customTypeGapName.slice(0, -1) : `${gap} ${customTypeGapName}`}`;
    }
    else if (type === "week") {
      return "Repeating every week";
    }
    else if (type === "month") {
      return "Repeating every month";
    }
    else if (type === "weekday") {
      const fullySelected = weekdays.dynamic.every(weekday => weekday);

      if (fullySelected) {
        return "Repeating every weekday";
      }
      else {
        return getWeekdayRepeatTooltip(weekdays.dynamic);
      }
    }
  }

  function getWeekdayRepeatTooltip(weekdayStates) {
    const weekdays = timeDateService.getWeekdays(settings.dateLocale);
    const formatter = new Intl.ListFormat(settings.dateLocale, {
      style: "long",
      type: "conjunction"
    });
    const arr = weekdayStates.reduce((arr, weekday, index) => {
      if (weekday) {
        arr.push(weekdays[index]);
      }
      return arr;
    }, []);
    const str = formatter.format(arr);
    return `Repeating every ${str}`;
  }

  function resetSelectedDay() {
    setSelectedDay({ ...selectedDay });
  }

  function showCurrentDateView() {
    const currentDate = timeDateService.getCurrentDate();

    setCurrentYear(currentDate.year);
    getVisibleMonth(calendar, currentDate);

    if (selectedDay) {
      hideSelectedDay();
    }
    else if (viewingYear) {
      setViewingYear(false);
    }
  }

  function findNextFocusableElement(element, shiftKey) {
    if (shiftKey) {
      return findRelativeFocusableElement(element.parentElement.firstElementChild, -1);
    }
    else {
      return findRelativeFocusableElement(element.parentElement.lastElementChild, 1);
    }
  }

  function focusGridElement(key, gridElement, columnCount) {
    const elements = [...gridElement.parentElement.children];
    const index = elements.indexOf(gridElement);
    let element = null;

    if (key === "ArrowRight") {
      element = elements[index + 1];
    }
    else if (key === "ArrowLeft") {
      element = elements[index - 1];
    }
    else if (key === "ArrowDown") {
      element = elements[index + columnCount];
    }
    else if (key === "ArrowUp") {
      element = elements[index - columnCount];
    }

    if (element) {
      element.focus();
    }
  }

  function handleDaysKeyDown(event) {
    const { key, target } = event;

    if (key === "Tab") {
      const element = findNextFocusableElement(target, event.shiftKey);

      if (element) {
        event.preventDefault();
        element.focus();
      }
      else {
        const elements = findFocusableElements();

        if (elements.length) {
          event.preventDefault();
          elements[0].focus();
        }
      }
    }
    else if (key.startsWith("Arrow")) {
      focusGridElement(key, target, 7);
    }
    else if (key === "Enter") {
      const index = target.getAttribute("data-index");
      const month = target.getAttribute("data-month");
      let direction = 0;

      if (month === "previous") {
        direction = -1;
      }
      else if (month === "next") {
        direction = 1;
      }
      showDay(target, visibleMonth[month].days[index], direction);
    }
  }

  function handleMonthsKeyDown(event) {
    const { key, target } = event;

    if (key === "Tab") {
      const element = findNextFocusableElement(target, event.shiftKey);

      if (element) {
        event.preventDefault();
        element.focus();
      }
      else {
        const elements = findFocusableElements();

        if (elements.length) {
          event.preventDefault();
          elements[0].focus();
        }
      }
    }
    else if (key.startsWith("Arrow")) {
      focusGridElement(key, target, 4);
    }
    else if (key === "Enter") {
      const index = target.getAttribute("data-index");

      showMonth(target, index);
    }
  }

  if (!calendar) {
    return null;
  }
  return (
    <>
      <div className="container-body calendar-current-date">
        <button className="btn text-btn calendar-current-date-btn" onClick={showCurrentDateView}>
          <div className="calendar-current-date-weekday">{currentDay.weekdayName}</div>
          <div>{currentDay.dateString}</div>
        </button>
      </div>
      <div className="container-body calendar-wrapper" style={{ "--x": `${transition.x}px`, "--y": `${transition.y}px` }}>
        {selectedDay ? (
          <SelectedDay calendar={calendar} selectedDay={selectedDay} reminders={reminders} locale={locale}
            updateCalendar={updateCalendar} createReminder={createReminder} resetSelectedDay={resetSelectedDay} hide={hideSelectedDay}/>
        ) : viewingYear ? (
          <div className={`calendar${transition.active ? " transition" : ""}`}>
            <div className="calendar-header">
              <button className="btn icon-btn" onClick={() => setVisibleYear(-1)} title={locale.calendar.prevoius_year_title}>
                <Icon id="chevron-left"/>
              </button>
              <span className="calendar-title">{currentYear}</span>
              <button className="btn icon-btn" onClick={() => setVisibleYear(1)} title={locale.calendar.next_year_title}>
                <Icon id="chevron-right"/>
              </button>
            </div>
            <ul className={`calendar-months${settings.worldClocksHidden ? "" : " world-clocks-visible"}`} onKeyDown={handleMonthsKeyDown}>
              {calendar[currentYear].map((month, index) => (
                <li className={`calendar-month${month.isCurrentMonth ? " current" : ""}`}
                  onClick={({ target }) => showMonth(target, index)} key={month.name}
                  tabIndex="0" data-index={index}>
                  <div className="calendar-month-inner">{month.name}</div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className={`calendar${transition.active ? " transition" : ""}`}>
            <div className="calendar-header">
              <button className="btn icon-btn" onClick={() => changeMonth(-1)} title={locale.calendar.prevoius_month_title}>
                <Icon id="chevron-left"/>
              </button>
              <button className="btn text-btn calendar-title" onClick={viewYear}>{visibleMonth.current.dateString}</button>
              <button className="btn icon-btn" onClick={() => changeMonth(1)} title={locale.calendar.next_month_title}>
                <Icon id="chevron-right"/>
              </button>
            </div>
            <ul className="calendar-week-days">
              {weekdays.map(weekday => <li className="calendar-cell" key={weekday}>{weekday}</li>)}
            </ul>
            <ul className={`calendar-days${settings.worldClocksHidden ? "" : " world-clocks-visible"}`} onKeyDown={handleDaysKeyDown}>
              {visibleMonth.previous.days.map((day, index) => (
                <li className="calendar-cell calendar-day" onClick={({ target }) => showDay(target, day, -1)} key={day.id}
                  tabIndex="0" aria-label={day.dateString} data-month="previous" data-index={index}>
                  <div>{day.day}</div>
                </li>
              ))}
              {visibleMonth.current.days.map((day, index) => (
                <li className={`calendar-cell calendar-day current-month-day${day.isCurrentDay ? " current" : ""}`}
                  onClick={({ target }) => showDay(target, day)} key={day.id}
                  tabIndex="0" aria-label={day.dateString} data-month="current" data-index={index}>
                  <div>{day.day}</div>
                  {day.reminders.length > 0 && (
                    <div className="day-reminders">
                      {day.reminders.map(reminder => (
                        <div className="day-reminder" style={{ "backgroundColor": reminder.color }} key={reminder.id}></div>
                      ))}
                    </div>
                  )}
                </li>
              ))}
              {visibleMonth.next.days.map((day, index) => (
                <li className="calendar-cell calendar-day" onClick={({ target }) => showDay(target, day, 1)} key={day.id}
                  tabIndex="0" aria-label={day.dateString} data-month="next" data-index={index}>
                  <div>{day.day}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {settings.worldClocksHidden ? null : <WorldClocks parentVisible={visible} locale={locale}/>}
    </>
  );
}
