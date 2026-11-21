import { lazy } from 'react'
import { HashRouter, Route, Routes } from 'react-router'
import { ConfirmProvider } from './components/confirm'
import { Layout } from './components/Layout'
import { RestTimerProvider } from './components/RestTimer'
import { ToastProvider } from './components/toast'
import { NotFound } from './components/ui'
import { SettingsProvider } from './db/settings'

// Screens load on demand; the service worker precaches them all for offline use.
const TodayPage = lazy(() => import('./features/today/TodayPage'))
const WorkoutsPage = lazy(() => import('./features/workouts/WorkoutsPage'))
const WorkoutPage = lazy(() => import('./features/workouts/WorkoutPage'))
const RoutinePage = lazy(() => import('./features/workouts/RoutinePage'))
const ExercisesPage = lazy(() => import('./features/workouts/ExercisesPage'))
const ExerciseDetailPage = lazy(() => import('./features/workouts/ExerciseDetailPage'))
const CardioPage = lazy(() => import('./features/cardio/CardioPage'))
const BodyPage = lazy(() => import('./features/body/BodyPage'))
const NutritionPage = lazy(() => import('./features/nutrition/NutritionPage'))
const GoalPage = lazy(() => import('./features/goal/GoalPage'))
const SupplementsPage = lazy(() => import('./features/supplements/SupplementsPage'))
const AlarmPage = lazy(() => import('./features/alarm/AlarmPage'))
const DayCheckPage = lazy(() => import('./features/check/DayCheckPage'))
const WorkoutHistoryPage = lazy(() => import('./features/workouts/WorkoutHistoryPage'))
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'))

export default function App() {
  return (
    <SettingsProvider>
      <ToastProvider>
        <ConfirmProvider>
          <RestTimerProvider>
            {/* Hash routing works on any static host and from any sub-folder. */}
            <HashRouter>
              <Routes>
                <Route element={<Layout />}>
                  <Route index element={<TodayPage />} />
                  <Route path="workouts" element={<WorkoutsPage />} />
                  <Route path="workouts/history" element={<WorkoutHistoryPage />} />
                  <Route path="workouts/:id" element={<WorkoutPage />} />
                  <Route path="routines/:id" element={<RoutinePage />} />
                  <Route path="exercises" element={<ExercisesPage />} />
                  <Route path="exercises/:id" element={<ExerciseDetailPage />} />
                  <Route path="cardio" element={<CardioPage />} />
                  <Route path="body" element={<BodyPage />} />
                  <Route path="nutrition" element={<NutritionPage />} />
                  <Route path="goal" element={<GoalPage />} />
                  <Route path="supplements" element={<SupplementsPage />} />
                  <Route path="alarm" element={<AlarmPage />} />
                  <Route path="check" element={<DayCheckPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="*" element={<NotFound title="Page not found" />} />
                </Route>
              </Routes>
            </HashRouter>
          </RestTimerProvider>
        </ConfirmProvider>
      </ToastProvider>
    </SettingsProvider>
  )
}
