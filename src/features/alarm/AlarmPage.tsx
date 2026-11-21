import { AlarmClock, AlarmClockPlus, BedDouble, ChevronRight, Dumbbell, Info, Sunrise, Utensils } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { buttonClass, Card, IconChip, PageHeader, SectionHeader, Switch, TimeField } from '../../components/ui'
import { updateSettings, useSettings } from '../../db/settings'
import type { AlarmKind, Settings } from '../../db/types'
import { combineDateTime, formatTime, todayStr } from '../../lib/dates'
import { isIOS } from '../../lib/device'
import { clockMinus, isClock } from '../../lib/meals'
import { MealsSheet } from '../nutrition/MealsSheet'

/** Name of the one Shortcut you make (steps below). It takes lines of "HH:MM|Label" and makes an alarm for each. */
const SHORTCUT = 'VFit Alarms'
/** Gym alarms ring this long before the session, so you have time to get there. */
const GYM_LEAD_MIN = 30
const DEFAULT_WAKE = '05:30'

interface AlarmLine {
  time: string
  label: string
}

const shortcutUrl = (lines: AlarmLine[]) =>
  `shortcuts://run-shortcut?name=${encodeURIComponent(SHORTCUT)}&input=text&text=${encodeURIComponent(
    lines.map((l) => `${l.time}|${l.label}`).join('\n'),
  )}`

const pretty = (time: string) => formatTime(combineDateTime(todayStr(), time))

/** Every alarm VFit can set, grouped by kind. */
function alarmLines(s: Settings): Record<AlarmKind, AlarmLine[]> {
  return {
    wake: [{ time: s.wakeTime ?? DEFAULT_WAKE, label: 'VFit · Wake up' }],
    gymMorning: [
      { time: clockMinus(s.sessions.morning, GYM_LEAD_MIN), label: `VFit · Morning gym at ${pretty(s.sessions.morning)}` },
    ],
    gymEvening: [
      { time: clockMinus(s.sessions.evening, GYM_LEAD_MIN), label: `VFit · Evening gym at ${pretty(s.sessions.evening)}` },
    ],
    meals: s.meals.filter((m) => isClock(m.time)).map((m) => ({ time: m.time!, label: `VFit · ${m.name}: log your food` })),
    bed: [{ time: s.bedTime, label: 'VFit · Bedtime: do your day check' }],
  }
}

export default function AlarmPage() {
  const s = useSettings()
  const [mealsOpen, setMealsOpen] = useState(false)
  const ios = isIOS()
  const lines = alarmLines(s)
  const picked = (Object.keys(lines) as AlarmKind[]).filter((k) => s.alarms[k]).flatMap((k) => lines[k])
  const toggle = (k: AlarmKind, on: boolean) => void updateSettings({ alarms: { ...s.alarms, [k]: on } })
  const timedMeals = s.meals.filter((m) => isClock(m.time))

  return (
    <>
      <PageHeader back="/settings" title="Alarms" />
      <p className="-mt-1 mb-2 text-subhead text-ink-2">
        Your iPhone's Clock app rings these, so they work when VFit is closed and when your phone is on silent.
      </p>

      <SectionHeader title="Your alarms" className="mt-3" />
      <Card padded={false}>
        <ul className="divide-y-[0.5px] divide-bar-line">
          <AlarmRow
            icon={<Sunrise aria-hidden />}
            color="var(--body)"
            title="Wake up"
            detail={`Alarm ${pretty(lines.wake[0].time)}`}
            on={s.alarms.wake}
            onToggle={(v) => toggle('wake', v)}
            single={lines.wake}
          >
            <TimeInput label="Wake-up time" value={s.wakeTime ?? DEFAULT_WAKE} onChange={(v) => void updateSettings({ wakeTime: v })} />
          </AlarmRow>
          <AlarmRow
            icon={<Dumbbell aria-hidden />}
            color="var(--strength)"
            title="Morning gym"
            detail={`Alarm ${pretty(lines.gymMorning[0].time)}, ${GYM_LEAD_MIN} min before`}
            on={s.alarms.gymMorning}
            onToggle={(v) => toggle('gymMorning', v)}
            single={lines.gymMorning}
          >
            <TimeInput
              label="Morning gym time"
              value={s.sessions.morning}
              onChange={(v) => void updateSettings({ sessions: { ...s.sessions, morning: v } })}
            />
          </AlarmRow>
          <AlarmRow
            icon={<Dumbbell aria-hidden />}
            color="var(--strength)"
            title="Evening gym"
            detail={`Alarm ${pretty(lines.gymEvening[0].time)}, ${GYM_LEAD_MIN} min before`}
            on={s.alarms.gymEvening}
            onToggle={(v) => toggle('gymEvening', v)}
            single={lines.gymEvening}
          >
            <TimeInput
              label="Evening gym time"
              value={s.sessions.evening}
              onChange={(v) => void updateSettings({ sessions: { ...s.sessions, evening: v } })}
            />
          </AlarmRow>
          <AlarmRow
            icon={<Utensils aria-hidden />}
            color="var(--nutrition)"
            title="Meals"
            detail={
              timedMeals.length
                ? timedMeals.map((m) => `${m.name} ${pretty(m.time!)}`).join(' · ')
                : 'No meal times set'
            }
            on={s.alarms.meals}
            onToggle={(v) => toggle('meals', v)}
            single={lines.meals.length ? lines.meals : undefined}
          >
            <button type="button" onClick={() => setMealsOpen(true)} className={buttonClass('secondary', 'sm')}>
              Edit times
            </button>
          </AlarmRow>
          <AlarmRow
            icon={<BedDouble aria-hidden />}
            color="var(--cardio)"
            title="Bedtime"
            detail={`Alarm ${pretty(s.bedTime)} · for your before-bed check`}
            on={s.alarms.bed}
            onToggle={(v) => toggle('bed', v)}
            single={lines.bed}
          >
            <TimeInput label="Bedtime" value={s.bedTime} onChange={(v) => void updateSettings({ bedTime: v })} />
          </AlarmRow>
        </ul>
      </Card>

      <a
        href={picked.length ? shortcutUrl(picked) : undefined}
        aria-disabled={picked.length === 0}
        className={buttonClass('primary', 'lg', true) + ' mt-4' + (picked.length ? '' : ' pointer-events-none opacity-45')}
      >
        <AlarmClock />
        Send {picked.length} {picked.length === 1 ? 'alarm' : 'alarms'} to iPhone Clock
      </a>
      <p className="mt-2 text-footnote text-ink-2">
        Changed a time? Send them again. With the optional replace step below, your old VFit alarms are swapped for the new
        ones; otherwise switch the old ones off in the Clock app. Use <AlarmClockPlus className="inline size-4" aria-label="add" />{' '}
        on a row to send just that one.
      </p>
      {!ios && (
        <p className="mt-3 flex gap-2 rounded-xl bg-surface px-3 py-2.5 text-footnote text-ink-2">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          These buttons work on your iPhone. On other devices, set the alarms in your Clock app.
        </p>
      )}

      <details className="group mt-4 rounded-xl bg-surface" open={!s.wakeTime}>
        <summary className="flex list-none items-center gap-2 px-4 py-3.5 font-semibold [&::-webkit-details-marker]:hidden">
          <ChevronRight className="size-4 text-ink-2 transition-transform group-open:rotate-90" aria-hidden />
          One-time setup on your iPhone (about 4 minutes)
        </summary>
        <div className="px-4 pb-4 text-subhead">
          <p className="mb-3 text-footnote text-ink-2">
            iPhone only lets the Clock app ring alarms, so VFit hands the times to one Shortcut you make once. VFit sends one
            line per alarm, like <code className="rounded bg-fill px-1">06:00|VFit · Wake up</code>.
          </p>
          <ol className="flex list-decimal flex-col gap-2.5 pl-5 marker:text-ink-2">
            <li>
              Open <strong>Shortcuts</strong>, tap <strong>+</strong>, and rename the new shortcut <strong>{SHORTCUT}</strong>{' '}
              (exactly).
            </li>
            <li>
              Add <strong>Split Text</strong>: split <strong>Shortcut Input</strong> by <strong>New Lines</strong>.
            </li>
            <li>
              Add <strong>Repeat with Each</strong> (it uses Split Text). Put the next steps inside the repeat.
            </li>
            <li>
              Add <strong>Split Text</strong> again: split <strong>Repeat Item</strong> by <strong>Custom</strong>, and type{' '}
              <strong>|</strong>.
            </li>
            <li>
              Add <strong>Get Item from List</strong> set to <strong>First Item</strong>, then <strong>Get Dates from Input</strong>.
            </li>
            <li>
              Add <strong>Get Item from List</strong> set to <strong>Last Item</strong> of the second Split Text.
            </li>
            <li>
              Add <strong>Create Alarm</strong> (or <strong>Add Alarm</strong>): <strong>Time</strong> = Dates,{' '}
              <strong>Label</strong> = the last Item from List, <strong>Repeat</strong> = every day.
            </li>
            <li>
              Tap <strong>Done</strong>, come back, and tap <strong>Send … to iPhone Clock</strong>. Allow Shortcuts to change your
              alarms the first time.
            </li>
          </ol>
          <p className="mt-3 text-footnote text-ink-2">
            Optional replace step: right after step 1, add <strong>Find Alarms</strong> where Label contains{' '}
            <strong>VFit</strong>, then <strong>Delete Alarms</strong>, so sending again replaces your old VFit alarms. Action
            names can differ a little between iOS versions; search for "alarm" or "split".
          </p>
        </div>
      </details>

      <Card className="mt-3 text-footnote text-ink-2">
        <p className="font-medium text-ink">Rather do it by hand?</p>
        <p className="mt-1">In the Clock app tap Alarms, then +, set the time and a label, choose Repeat, and Save.</p>
      </Card>

      <MealsSheet open={mealsOpen} onClose={() => setMealsOpen(false)} />
    </>
  )
}

function AlarmRow({
  icon,
  color,
  title,
  detail,
  on,
  onToggle,
  single,
  children,
}: {
  icon: ReactNode
  color: string
  title: string
  detail: string
  on: boolean
  onToggle: (v: boolean) => void
  single?: AlarmLine[]
  children: ReactNode
}) {
  return (
    <li className="flex flex-col gap-2.5 px-4 py-3">
      <div className="flex items-center gap-3">
        <IconChip color={color} size="sm">
          {icon}
        </IconChip>
        <div className="min-w-0 flex-1">
          <p className="text-body">{title}</p>
          <p className="truncate text-footnote text-ink-2">{detail}</p>
        </div>
        <Switch label={`Include ${title.toLowerCase()} alarm`} checked={on} onChange={onToggle} />
      </div>
      <div className="flex items-center gap-2 pl-11">
        {children}
        {single && (
          <a
            href={shortcutUrl(single)}
            aria-label={`Send only the ${title.toLowerCase()} alarm to iPhone Clock`}
            title="Send only this alarm"
            className="ml-auto grid size-9 place-items-center rounded-full text-accent-ink hover:bg-fill/60 active:bg-fill"
          >
            <AlarmClockPlus className="size-5" />
          </a>
        )}
      </div>
    </li>
  )
}

function TimeInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <TimeField label={label} value={value} onChange={(v) => v && onChange(v)} />
}
