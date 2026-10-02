"use client";
import React, { useEffect, useMemo, useState } from "react";
import Card from "@/Component/Card";
import { apiUrl } from "@/lib/api";
const DAYS_TO_SHOW = 365;
const toLocalDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const freshFetchOptions = { cache: "no-store" };
const activityColor = (count, maximum) => {
  if (count === 0) return "#e5e7eb";
  const level = count / Math.max(maximum, 1);
  if (level <= 0.25) return "#bbf7d0";
  if (level <= 0.5) return "#86efac";
  if (level <= 0.75) return "#4ade80";
  return "#15803d";
};
const formatStudyTime = (totalSeconds = 0) => {
  const seconds = Math.max(0, Number(totalSeconds) || 0);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};
const sectionBase = "rounded-3xl border bg-white p-6 sm:p-7 shadow-sm";
const getApiError = async (response, fallback) => {
  try {
    const data = await response.json();
    return data?.detail || data?.error || fallback;
  } catch {
    return fallback;
  }
};
const Page = () => {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");
  const [hoveredDay, setHoveredDay] = useState(null);
  const [todayTasks, setTodayTasks] = useState([]);
  const [revisionTasks, setRevisionTasks] = useState([]);
  const [scheduleDate, setScheduleDate] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [testTopicFilter, setTestTopicFilter] = useState("All Tests");
  /* * ========================================================= * LOAD DASHBOARD * ========================================================= * * Backend: * * GET /api/dashboard/activity * GET /api/dashboard/today-schedule * GET /api/dashboard/revision-tasks * * All three requests are made in parallel. */ useEffect(() => {
    const email = localStorage.getItem("email");
    if (!email) {
      const timer = window.setTimeout(() => {
        setError("Please log in to view your activity.");
      }, 0);
      return () => window.clearTimeout(timer);
    }
    let cancelled = false;
    const loadDashboard = async () => {
      try {
        setError("");
        const [activityResponse, scheduleResponse, revisionResponse] =
          await Promise.all([
            fetch(
              apiUrl(
                `/api/dashboard/activity?email=${encodeURIComponent(email)}`,
              ),
              freshFetchOptions,
            ),
            fetch(
              apiUrl(
                `/api/dashboard/today-schedule?email=${encodeURIComponent(email)}`,
              ),
              freshFetchOptions,
            ),
            fetch(
              apiUrl(
                `/api/dashboard/revision-tasks?email=${encodeURIComponent(email)}`,
              ),
              freshFetchOptions,
            ),
          ]);
        if (!activityResponse.ok) {
          throw new Error(
            await getApiError(activityResponse, "Could not load activity."),
          );
        }
        if (!scheduleResponse.ok) {
          throw new Error(
            await getApiError(
              scheduleResponse,
              "Could not load today's schedule.",
            ),
          );
        }
        if (!revisionResponse.ok) {
          throw new Error(
            await getApiError(
              revisionResponse,
              "Could not load revision tasks.",
            ),
          );
        }
        const [activityData, scheduleData, revisionData] = await Promise.all([
          activityResponse.json(),
          scheduleResponse.json(),
          revisionResponse.json(),
        ]);
        if (cancelled) return;
        /* * /api/dashboard/activity returns: * * { * dailyActivity, * currentStreak, * longestStreak, * studyTime, * testPerformance * } */ setDashboard(
          activityData,
        );
        /* * /api/dashboard/today-schedule returns: * * { * date, * tasks * } */ setTodayTasks(
          scheduleData.tasks || [],
        );
        setScheduleDate(scheduleData.date || "");
        /* * /api/dashboard/revision-tasks returns revision tasks * from EVERY month of the planner. * * Do NOT filter these by today's date. */ setRevisionTasks(
          revisionData.tasks || [],
        );
      } catch (fetchError) {
        if (cancelled) return;
        console.error(fetchError);
        setError(
          fetchError?.message ||
            "Could not load your activity. Please try again.",
        );
      }
    };
    loadDashboard();
    /* * Refresh dashboard every 30 seconds. */ const refreshInterval =
      window.setInterval(loadDashboard, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(refreshInterval);
    };
  }, [refreshVersion]);
  /* * ========================================================= * TOGGLE DONE * ========================================================= * * Backend: * * POST /updateTask * * { * docId: "<plannerId>:<YYYY-MM>", * taskIndex, * updates: { * done: true/false * } * } * * Because docId already contains the month, the backend knows * exactly which month's schedule must be updated. */ const toggleTodayTask =
    async (taskToUpdate) => {
      const nextDone = !taskToUpdate.done;
      /* * Optimistic UI update. */ setTodayTasks((tasks) =>
        tasks.map((task) =>
          task.docId === taskToUpdate.docId &&
          task.taskIndex === taskToUpdate.taskIndex
            ? { ...task, done: nextDone }
            : task,
        ),
      );
      try {
        const response = await fetch(apiUrl("/updateTask"), {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            docId: taskToUpdate.docId,
            taskIndex: taskToUpdate.taskIndex,
            updates: { done: nextDone },
          }),
        });
        if (!response.ok) {
          throw new Error(
            await getApiError(response, "Could not update task."),
          );
        }
        /* * Backend rebuilds activity/streak data after /updateTask. * Reload dashboard so: * * - completed task count * - streak * - heatmap * - study/activity data * * are synchronized with MongoDB. */ setRefreshVersion(
          (version) => version + 1,
        );
      } catch (updateError) {
        console.error(updateError);
        /* * Rollback optimistic update. */ setTodayTasks((tasks) =>
          tasks.map((task) =>
            task.docId === taskToUpdate.docId &&
            task.taskIndex === taskToUpdate.taskIndex
              ? { ...task, done: taskToUpdate.done }
              : task,
          ),
        );
        setError(
          updateError?.message ||
            "Could not update the task. Please try again.",
        );
      }
    };
  /* * ========================================================= * TOGGLE REVISION * ========================================================= * * Backend: * * POST /updateTask * * { * docId, * taskIndex, * updates: { * revisionRequired: true/false * } * } */ const toggleRevisionTask =
    async (taskToUpdate) => {
      const nextRevisionRequired = !taskToUpdate.revisionRequired;
      /* * Optimistically update today's list if the task exists there. */ setTodayTasks(
        (tasks) =>
          tasks.map((task) =>
            task.docId === taskToUpdate.docId &&
            task.taskIndex === taskToUpdate.taskIndex
              ? { ...task, revisionRequired: nextRevisionRequired }
              : task,
          ),
      );
      /* * Optimistically update global revision list. * * If marked: * add it if it isn't already present. * * If unmarked: * remove it. */ setRevisionTasks(
        (tasks) => {
          const exists = tasks.some(
            (task) =>
              task.docId === taskToUpdate.docId &&
              task.taskIndex === taskToUpdate.taskIndex,
          );
          if (nextRevisionRequired) {
            if (exists) {
              return tasks.map((task) =>
                task.docId === taskToUpdate.docId &&
                task.taskIndex === taskToUpdate.taskIndex
                  ? { ...task, revisionRequired: true }
                  : task,
              );
            }
            return [...tasks, { ...taskToUpdate, revisionRequired: true }];
          }
          return tasks.filter(
            (task) =>
              task.docId !== taskToUpdate.docId ||
              task.taskIndex !== taskToUpdate.taskIndex,
          );
        },
      );
      try {
        const response = await fetch(apiUrl("/updateTask"), {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            docId: taskToUpdate.docId,
            taskIndex: taskToUpdate.taskIndex,
            updates: { revisionRequired: nextRevisionRequired },
          }),
        });
        if (!response.ok) {
          throw new Error(
            await getApiError(response, "Could not update revision status."),
          );
        }
        /* * Reload everything from backend so the frontend and * MongoDB remain synchronized. */ setRefreshVersion(
          (version) => version + 1,
        );
      } catch (updateError) {
        console.error(updateError);
        /* * Instead of manually trying to reconstruct the previous * revision list, reload from backend. */ setError(
          updateError?.message ||
            "Could not update the revision status. Please try again.",
        );
        setRefreshVersion((version) => version + 1);
      }
    };
  /* * ========================================================= * ACTIVITY HEATMAP DATA * ========================================================= * * Backend returns only completed task records. * * Example: * * dailyActivity: [ * { * date: "2026-10-01", * completedTasks: 3 * } * ] * * Frontend creates all 365 calendar dates and maps backend * values onto them. */ const {
    weeks,
    activityByDate,
    maxActivity,
    completedTasks,
    today,
  } = useMemo(() => {
    const records = dashboard?.dailyActivity || [];
    const byDate = new Map(
      records.map((record) => [
        record.date,
        Number(record.completedTasks) || 0,
      ]),
    );
    const maximum = Math.max(
      ...records.map((record) => Number(record.completedTasks) || 0),
      1,
    );
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - (DAYS_TO_SHOW - 1));
    const dates = Array.from({ length: DAYS_TO_SHOW }, (_, index) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index);
      return date;
    });
    const todayString = toLocalDateString(new Date());
    return {
      weeks: Array.from({ length: Math.ceil(dates.length / 7) }, (_, index) =>
        dates.slice(index * 7, index * 7 + 7),
      ),
      activityByDate: byDate,
      maxActivity: maximum,
      today: todayString,
      completedTasks: byDate.get(todayString) || 0,
    };
  }, [dashboard]);
  /* * ========================================================= * STUDY TIME * ========================================================= * * Backend: * * studyTime: { * todaySeconds, * totalSeconds, * dailyStudy, * weeklyStudyTime * } */ const weeklyStudyTime =
    dashboard?.studyTime?.weeklyStudyTime || [];
  const studyByDate = new Map(
    (dashboard?.studyTime?.dailyStudy || []).map((item) => [
      item.date,
      Number(item.totalSeconds) || 0,
    ]),
  );
  const maxWeeklySeconds = Math.max(
    ...weeklyStudyTime.map((day) => Number(day.totalSeconds) || 0),
    1,
  );
  /* * ========================================================= * TODAY TASKS * ========================================================= */ const pendingTasks =
    todayTasks.filter((task) => !task.done);
  const completedTodayTasks = todayTasks.filter((task) => task.done);
  /* * ========================================================= * TEST PERFORMANCE * ========================================================= * * Backend: * * testPerformance: { * points, * average, * best * } */ const testPoints =
    dashboard?.testPerformance?.points || [];
  const testTopics = [
    ...new Set(testPoints.map((point) => point.topic).filter(Boolean)),
  ];
  const visibleTestPoints = testPoints.filter(
    (point) =>
      testTopicFilter === "All Tests" || point.topic === testTopicFilter,
  );
  /* * Latest test attempt for every topic. * * Used only for study recommendations. */ const latestByTopic =
    [...testPoints]
      .reverse()
      .reduce(
        (map, point) =>
          map.has(point.topic) ? map : map.set(point.topic, point),
        new Map(),
      );
  const recommendations = [...latestByTopic.values()]
    .sort((a, b) => Number(a.accuracy) - Number(b.accuracy))
    .slice(0, 4);
  return (
    <div className="min-h-screen bg-pink-50">
      {" "}
      <div className="mx-auto max-w-7xl px-6 py-8 sm:px-10 sm:py-10">
        {" "}
        <div className="flex flex-col gap-6">
          {" "}
          {/* ===================================================== STAT CARDS ====================================================== */}{" "}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {" "}
            <Card
              title="Today's Study Time"
              value={formatStudyTime(dashboard?.studyTime?.todaySeconds || 0)}
              icon="⏱"
            />{" "}
            <Card title="Completed Tasks" value={completedTasks} icon="✓" />{" "}
            <Card
              title="Current Streak"
              value={`${dashboard?.currentStreak || 0} days`}
              icon="🔥"
            />{" "}
            <Card
              title="Longest Streak"
              value={`${dashboard?.longestStreak || 0} days`}
              icon="🏆"
            />{" "}
          </div>{" "}
          {/* ===================================================== TODAY'S SCHEDULE + REVISION ====================================================== */}{" "}
          <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
            {" "}
            {/* TODAY'S SCHEDULE */}{" "}
            <section className={`${sectionBase} border-pink-100`}>
              {" "}
              <div className="mb-5 flex items-end justify-between gap-3">
                {" "}
                <div>
                  {" "}
                  <h2 className="text-lg font-bold text-gray-800">
                    {" "}
                    Today&apos;s schedule{" "}
                  </h2>{" "}
                  <p className="mt-0.5 text-sm text-gray-500">
                    {" "}
                    {scheduleDate || today} · {pendingTasks.length} pending{" "}
                  </p>{" "}
                </div>{" "}
                <span className="shrink-0 text-sm font-semibold text-pink-500">
                  {" "}
                  {completedTodayTasks.length}/ {todayTasks.length} done{" "}
                </span>{" "}
              </div>{" "}
              {!dashboard ? (
                <p className="text-sm text-gray-500">
                  {" "}
                  Loading today&apos;s topics...{" "}
                </p>
              ) : todayTasks.length === 0 ? (
                <p className="text-sm text-gray-500">
                  {" "}
                  No topics are scheduled for today.{" "}
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {" "}
                  {/* PENDING TASKS */}{" "}
                  {pendingTasks.map((task) => (
                    <div
                      key={`${task.docId}-${task.taskIndex}`}
                      className="flex w-full items-center gap-3 rounded-2xl border border-pink-100 bg-pink-50 p-3 text-left transition-colors hover:bg-pink-100"
                    >
                      {" "}
                      <button
                        type="button"
                        onClick={() => toggleTodayTask(task)}
                        aria-label={`Mark ${task.task} as complete`}
                        className="h-5 w-5 shrink-0 rounded-full border-2 border-pink-300 bg-white"
                      />{" "}
                      <span className="min-w-0 flex-1">
                        {" "}
                        <span className="block font-semibold text-gray-800">
                          {" "}
                          {task.task}{" "}
                        </span>{" "}
                        {(task.start_time ||
                          task.end_time ||
                          task.description) && (
                          <span className="mt-0.5 block text-sm text-gray-500">
                            {" "}
                            {[task.start_time, task.end_time]
                              .filter(Boolean)
                              .join(" – ")}{" "}
                            {task.description
                              ? ` · ${task.description}`
                              : ""}{" "}
                          </span>
                        )}{" "}
                      </span>{" "}
                      <button
                        type="button"
                        onClick={() => toggleRevisionTask(task)}
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${task.revisionRequired ? "bg-amber-200 text-amber-800" : "border border-pink-100 bg-white text-pink-600"}`}
                      >
                        {" "}
                        {task.revisionRequired
                          ? "Marked for revision"
                          : "Mark for revision"}{" "}
                      </button>{" "}
                    </div>
                  ))}{" "}
                  {/* COMPLETED TASKS */}{" "}
                  {completedTodayTasks.length > 0 && (
                    <div className="mt-1 border-t border-pink-100 pt-3">
                      {" "}
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-green-600">
                        {" "}
                        Completed{" "}
                      </p>{" "}
                      <div className="flex flex-col gap-1">
                        {" "}
                        {completedTodayTasks.map((task) => (
                          <button
                            key={`${task.docId}-${task.taskIndex}`}
                            type="button"
                            onClick={() => toggleTodayTask(task)}
                            className="flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors hover:bg-green-50"
                            aria-label={`Mark ${task.task} as not complete`}
                          >
                            {" "}
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500 text-xs text-white">
                              {" "}
                              ✓{" "}
                            </span>{" "}
                            <span className="min-w-0 flex-1">
                              {" "}
                              <span className="block font-semibold text-gray-500 line-through">
                                {" "}
                                {task.task}{" "}
                              </span>{" "}
                              {(task.start_time ||
                                task.end_time ||
                                task.description) && (
                                <span className="mt-0.5 block text-sm text-gray-400">
                                  {" "}
                                  {[task.start_time, task.end_time]
                                    .filter(Boolean)
                                    .join(" – ")}{" "}
                                  {task.description
                                    ? ` · ${task.description}`
                                    : ""}{" "}
                                </span>
                              )}{" "}
                            </span>{" "}
                          </button>
                        ))}{" "}
                      </div>{" "}
                    </div>
                  )}{" "}
                </div>
              )}{" "}
            </section>{" "}
            {/* REVISION */}{" "}
            <section className={`${sectionBase} border-amber-100`}>
              {" "}
              <div className="mb-5">
                {" "}
                <h2 className="text-lg font-bold text-gray-800">
                  {" "}
                  Revision section{" "}
                </h2>{" "}
                <p className="mt-0.5 text-sm text-gray-500">
                  {" "}
                  Topics you marked to revisit.{" "}
                </p>{" "}
              </div>{" "}
              {revisionTasks.length === 0 ? (
                <p className="text-sm text-gray-500">
                  {" "}
                  No topics are marked for revision yet.{" "}
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {" "}
                  {revisionTasks.map((task) => (
                    <div
                      key={`${task.docId}-${task.taskIndex}`}
                      className="flex items-center gap-3 rounded-2xl border border-amber-100 bg-amber-50 p-3"
                    >
                      {" "}
                      <span className="shrink-0 text-lg"> 🔁 </span>{" "}
                      <span className="min-w-0 flex-1">
                        {" "}
                        <span className="block font-semibold text-gray-800">
                          {" "}
                          {task.task}{" "}
                        </span>{" "}
                        <span className="mt-0.5 block text-sm text-gray-500">
                          {" "}
                          {[task.date, task.start_time, task.end_time]
                            .filter(Boolean)
                            .join(" · ")}{" "}
                          {task.description
                            ? ` · ${task.description}`
                            : ""}{" "}
                        </span>{" "}
                      </span>{" "}
                      <button
                        type="button"
                        onClick={() => toggleRevisionTask(task)}
                        className="shrink-0 rounded-full bg-amber-200 px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-300"
                      >
                        {" "}
                        Marked for revision{" "}
                      </button>{" "}
                    </div>
                  ))}{" "}
                </div>
              )}{" "}
            </section>{" "}
          </div>{" "}
          {/* ===================================================== TEST SCORE + WEEKLY STUDY TIME ====================================================== */}{" "}
          <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
            {" "}
            {/* TEST SCORE TREND */}{" "}
            <section className={`${sectionBase} border-pink-100`}>
              {" "}
              <div className="mb-5 flex items-center justify-between gap-2">
                {" "}
                <div>
                  {" "}
                  <h2 className="text-lg font-bold text-gray-800">
                    {" "}
                    Test score trend{" "}
                  </h2>{" "}
                  <p className="mt-0.5 text-sm text-gray-500">
                    {" "}
                    Recent attempts{" "}
                  </p>{" "}
                </div>{" "}
                {/* Uncomment if topic filtering is required. <select value={testTopicFilter} onChange={(e) => setTestTopicFilter(e.target.value) } className="max-w-32 rounded-lg border border-pink-200 bg-pink-50 px-2 py-1 text-xs text-pink-700" > <option>All Tests</option> {testTopics.map((topic) => ( <option key={topic}> {topic} </option> ))} </select> */}{" "}
              </div>{" "}
              {visibleTestPoints.length > 0 ? (
                <div className="rounded-2xl bg-pink-50 px-4 pb-4 pt-6">
                  {" "}
                  {(() => {
                    const width = 300;
                    const height = 100;
                    const padX = 12;
                    const padY = 14;
                    const count = visibleTestPoints.length;
                    const coords = visibleTestPoints.map((point, index) => {
                      const accuracy = Math.max(
                        0,
                        Math.min(100, Number(point.accuracy) || 0),
                      );
                      const x =
                        count === 1
                          ? width / 2
                          : padX + (index / (count - 1)) * (width - padX * 2);
                      const y =
                        height - padY - (accuracy / 100) * (height - padY * 2);
                      return { ...point, x, y };
                    });
                    const linePoints = coords
                      .map((point) => `${point.x},${point.y}`)
                      .join(" ");
                    return (
                      <svg
                        viewBox={`0 0 ${width} ${height}`}
                        className="h-28 w-full overflow-visible"
                        role="img"
                        aria-label="Test score trend across recent attempts"
                      >
                        {" "}
                        <polyline
                          points={linePoints}
                          fill="none"
                          stroke="#f472b6"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />{" "}
                        {coords.map((point, index) => (
                          <g
                            key={`${point.attempt}-${index}`}
                            className="group"
                          >
                            {" "}
                            <circle
                              cx={point.x}
                              cy={point.y}
                              r="7"
                              fill="transparent"
                            >
                              {" "}
                              <title>
                                {" "}
                                {`${point.topic}: ${Math.round(Number(point.accuracy) || 0)}%`}{" "}
                              </title>{" "}
                            </circle>{" "}
                            <circle
                              cx={point.x}
                              cy={point.y}
                              r="4"
                              fill="#ec4899"
                              stroke="white"
                              strokeWidth="1.5"
                              className="transition-all group-hover:r-[5.5]"
                            />{" "}
                            <text
                              x={point.x}
                              y={point.y - 12}
                              textAnchor="middle"
                              fontSize="9"
                              fontWeight="600"
                              fill="#be185d"
                              className="opacity-0 transition-opacity group-hover:opacity-100"
                            >
                              {" "}
                              {Math.round(Number(point.accuracy) || 0)} %{" "}
                            </text>{" "}
                          </g>
                        ))}{" "}
                      </svg>
                    );
                  })()}{" "}
                  <p className="mt-2 text-xs text-gray-400">
                    {" "}
                    {visibleTestPoints.length} attempts · latest{" "}
                    {Math.round(
                      Number(
                        visibleTestPoints[visibleTestPoints.length - 1]
                          .accuracy,
                      ) || 0,
                    )}{" "}
                    %{" "}
                  </p>{" "}
                </div>
              ) : (
                <p className="rounded-2xl bg-pink-50 p-4 text-sm text-pink-600">
                  {" "}
                  Complete a test to see your trend.{" "}
                </p>
              )}{" "}
            </section>{" "}
            {/* WEEKLY STUDY TIME */}{" "}
            <section className={`${sectionBase} border-pink-100`}>
              {" "}
              <div className="mb-5">
                {" "}
                <h2 className="text-lg font-bold text-gray-800">
                  {" "}
                  Weekly progress{" "}
                </h2>{" "}
                <p className="mt-0.5 text-sm text-gray-500">
                  {" "}
                  Study time{" "}
                </p>{" "}
              </div>{" "}
              {error ? (
                <p className="text-sm text-red-500"> {error} </p>
              ) : !dashboard ? (
                <p className="text-sm text-gray-500"> Loading study time... </p>
              ) : (
                <div
                  className="flex h-40 items-end gap-2 px-1"
                  aria-label="Weekly study time from Monday to Sunday"
                >
                  {" "}
                  {weeklyStudyTime.map((day) => {
                    const seconds = Number(day.totalSeconds) || 0;
                    const height =
                      seconds === 0
                        ? 0
                        : Math.max((seconds / maxWeeklySeconds) * 100, 10);
                    const label = `${day.day}, ${day.date}: ${formatStudyTime(seconds)}`;
                    return (
                      <div
                        key={day.date}
                        className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
                      >
                        {" "}
                        <button
                          type="button"
                          title={label}
                          aria-label={label}
                          className="flex h-28 w-full items-end justify-center rounded-md focus:outline-none focus:ring-2 focus:ring-pink-400"
                        >
                          {" "}
                          <span
                            className="w-3 rounded-t-md bg-gradient-to-t from-pink-300 to-pink-200 transition-all hover:from-pink-400 hover:to-pink-300 sm:w-4"
                            style={{ height: `${height}%` }}
                          />{" "}
                        </button>{" "}
                        <span className="text-[10px] font-medium text-pink-400">
                          {" "}
                          {day.day}{" "}
                        </span>{" "}
                      </div>
                    );
                  })}{" "}
                </div>
              )}{" "}
            </section>{" "}
          </div>{" "}
          {/* ===================================================== STUDY RECOMMENDATION ====================================================== */}{" "}
          <section className={`${sectionBase} border-pink-100`}>
            {" "}
            <h2 className="text-lg font-bold text-gray-800">
              {" "}
              Study recommendation{" "}
            </h2>{" "}
            <p className="mt-1 text-sm text-gray-500">
              {" "}
              Based on your recent test performance.{" "}
            </p>{" "}
            {recommendations.length > 0 ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {" "}
                {recommendations.map((item) => {
                  const accuracy = Number(item.accuracy) || 0;
                  return (
                    <div
                      key={item.topic}
                      className="rounded-2xl bg-pink-50 p-4"
                    >
                      {" "}
                      <p className="font-semibold text-gray-800">
                        {" "}
                        {item.topic}{" "}
                      </p>{" "}
                      <p
                        className={`mt-1 text-sm ${accuracy >= 80 ? "text-emerald-600" : accuracy >= 60 ? "text-amber-600" : "text-rose-600"}`}
                      >
                        {" "}
                        {accuracy >= 80
                          ? "Strong area"
                          : accuracy >= 60
                            ? "Moderate focus"
                            : "Needs more focus"}{" "}
                      </p>{" "}
                      <p className="mt-1 text-xs text-gray-400">
                        {" "}
                        Latest accuracy: {Math.round(accuracy)}%{" "}
                      </p>{" "}
                    </div>
                  );
                })}{" "}
              </div>
            ) : (
              <p className="mt-4 rounded-2xl bg-pink-50 p-4 text-sm text-pink-700">
                {" "}
                Complete a test to receive personalized study
                recommendations.{" "}
              </p>
            )}{" "}
          </section>{" "}
          {/* ===================================================== ACTIVITY HEATMAP ====================================================== */}{" "}
          <section className={`${sectionBase} border-green-100`}>
            {" "}
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              {" "}
              <div>
                {" "}
                <h2 className="text-lg font-bold text-gray-800">
                  {" "}
                  Activity{" "}
                </h2>{" "}
                <p className="mt-0.5 text-sm text-gray-500">
                  {" "}
                  Completed scheduled tasks during the last year{" "}
                </p>{" "}
              </div>{" "}
              <p className="text-sm text-gray-600">
                {" "}
                Current streak:{" "}
                <span className="font-semibold text-green-700">
                  {" "}
                  {dashboard?.currentStreak || 0} days{" "}
                </span>{" "}
              </p>{" "}
            </div>{" "}
            {error ? (
              <p className="text-sm text-red-500"> {error} </p>
            ) : !dashboard ? (
              <p className="text-sm text-gray-500"> Loading activity... </p>
            ) : (
              <>
                {" "}
                <div className="overflow-x-auto pb-2">
                  {" "}
                  <div className="mb-2 flex min-w-max gap-1 text-[10px] text-gray-400">
                    {" "}
                    {weeks.map((week, weekIndex) => (
                      <span key={weekIndex} className="w-3 sm:w-3.5">
                        {" "}
                        {weekIndex === 0 ||
                        week[0].getMonth() !==
                          weeks[weekIndex - 1][0].getMonth()
                          ? week[0].toLocaleString("en", { month: "short" })
                          : ""}{" "}
                      </span>
                    ))}{" "}
                  </div>{" "}
                  <div
                    className="flex min-w-max gap-1"
                    aria-label="365-day activity heatmap"
                  >
                    {" "}
                    {weeks.map((week, weekIndex) => (
                      <div key={weekIndex} className="flex flex-col gap-1">
                        {" "}
                        {week.map((date) => {
                          const dateString = toLocalDateString(date);
                          const completedCount =
                            activityByDate.get(dateString) || 0;
                          const studySeconds = studyByDate.get(dateString) || 0;
                          const tooltip = `${dateString}: ${completedCount} completed task${completedCount === 1 ? "" : "s"} · ${formatStudyTime(studySeconds)} studied`;
                          return (
                            <button
                              key={dateString}
                              type="button"
                              title={tooltip}
                              aria-label={tooltip}
                              onMouseEnter={() =>
                                setHoveredDay({
                                  date: dateString,
                                  completedCount,
                                  studySeconds,
                                })
                              }
                              onFocus={() =>
                                setHoveredDay({
                                  date: dateString,
                                  completedCount,
                                  studySeconds,
                                })
                              }
                              className="h-3 w-3 rounded-sm transition-transform hover:scale-125 focus:scale-125 focus:outline-none focus:ring-2 focus:ring-green-600 sm:h-3.5 sm:w-3.5"
                              style={{
                                backgroundColor: activityColor(
                                  completedCount,
                                  maxActivity,
                                ),
                              }}
                            />
                          );
                        })}{" "}
                      </div>
                    ))}{" "}
                  </div>{" "}
                </div>{" "}
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
                  {" "}
                  <p>
                    {" "}
                    {hoveredDay
                      ? `${hoveredDay.date}: ${hoveredDay.completedCount} completed task${hoveredDay.completedCount === 1 ? "" : "s"} · ${formatStudyTime(hoveredDay.studySeconds || 0)} studied`
                      : "Hover over a day to see completed tasks and study time."}{" "}
                  </p>{" "}
                  <div
                    className="flex items-center gap-1.5"
                    aria-label="Activity intensity legend"
                  >
                    {" "}
                    <span>Less</span>{" "}
                    {[0, 0.25, 0.5, 0.75, 1].map((level) => (
                      <span
                        key={level}
                        className="h-3 w-3 rounded-sm"
                        style={{
                          backgroundColor:
                            level === 0
                              ? "#e5e7eb"
                              : activityColor(
                                  Math.ceil(maxActivity * level),
                                  maxActivity,
                                ),
                        }}
                      />
                    ))}{" "}
                    <span>More</span>{" "}
                  </div>{" "}
                </div>{" "}
              </>
            )}{" "}
          </section>{" "}
        </div>{" "}
      </div>{" "}
    </div>
  );
};
export default Page;
