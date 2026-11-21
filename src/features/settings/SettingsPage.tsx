import { useLiveQuery } from 'dexie-react-hooks'
import { AlarmClock, Check, Download, Share2, ShieldCheck, Target, Trash, Upload } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useConfirm } from '../../components/confirm'
import { useToast } from '../../components/toast'
import { Button, GroupLabel, List, ListRow, PageHeader, Segmented, Switch } from '../../components/ui'
import { backupBlob, downloadBackup, eraseAllData, markBackedUp, restoreBackup } from '../../db/backup'
import { backupSummary, parseBackup, type BackupFile } from '../../db/backupFormat'
import { db } from '../../db/db'
import { getLastBackup } from '../../db/queries'
import { updateSettings, usePhases, useSettings } from '../../db/settings'
import { combineDateTime, dateStrFromTs, dayLabel, formatTime, formatTs, todayStr } from '../../lib/dates'
import { cn } from '../../lib/cn'
import { isIOS, isStandalone, useInstallPrompt } from '../../lib/device'
import { goalLabel, phaseProgressLabel } from '../../lib/phases'
import { fmtNum } from '../../lib/units'

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${fmtNum(n / 1024)} KB`
  return `${fmtNum(n / 1024 / 1024, 1)} MB`
}

export default function SettingsPage() {
  const s = useSettings()
  const { current, upcoming } = usePhases()
  const toast = useToast()
  const confirm = useConfirm()
  const { canInstall, install } = useInstallPrompt()
  const fileInput = useRef<HTMLInputElement>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [usage, setUsage] = useState<number | null>(null)

  const lastBackup = useLiveQuery(getLastBackup, [])
  const counts = useLiveQuery(
    async () => ({
      workouts: await db.workouts.count(),
      cardio: await db.cardio.count(),
      body: await db.body.count(),
      foods: await db.foods.count(),
      supplements: await db.supplements.count(),
      phases: await db.phases.count(),
    }),
    [],
  )

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted)
    void navigator.storage?.estimate?.().then((e) => setUsage(e.usage ?? null))
  }, [counts])

  const set = (patch: Parameters<typeof updateSettings>[0]) => void updateSettings(patch)

  const canShareFiles = (() => {
    try {
      return (
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [new File(['{}'], 'backup.json', { type: 'application/json' })] })
      )
    } catch {
      return false
    }
  })()

  const exportBackup = async () => {
    await downloadBackup()
    toast('Backup downloaded')
  }

  const shareBackup = async () => {
    const { blob, name } = await backupBlob()
    try {
      await navigator.share({ files: [new File([blob], name, { type: 'application/json' })], title: 'VFit backup' })
      await markBackedUp()
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast("Couldn't share. Try Download instead.")
    }
  }

  const importBackup = async (file: File) => {
    let backup: BackupFile
    try {
      backup = parseBackup(await file.text())
    } catch (e) {
      toast((e as Error).message)
      return
    }
    const saved = backup.exportedAt ? Date.parse(backup.exportedAt) : NaN
    const ok = await confirm({
      title: 'Restore this backup?',
      message: (
        <>
          It contains {backupSummary(backup)}
          {Number.isFinite(saved) ? `, saved ${formatTs(saved, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}.
          <strong className="mt-3 block text-ink">Everything currently on this device will be replaced.</strong>
        </>
      ),
      confirmText: 'Replace my data',
      danger: true,
    })
    if (!ok) return
    try {
      await restoreBackup(backup)
      toast('Backup restored')
    } catch {
      toast("Couldn't restore that backup. Your data wasn't changed.")
    }
  }

  const eraseEverything = async () => {
    const ok = await confirm({
      title: 'Delete all data?',
      message:
        'Every workout, routine, cardio session, body entry, food log, supplement and setting on this device will be permanently deleted. Download a backup first if you might want it back.',
      confirmText: 'Delete everything',
      danger: true,
    })
    if (!ok) return
    await eraseAllData()
    toast('All data deleted')
  }

  const protectStorage = async () => {
    const granted = (await navigator.storage?.persist?.()) ?? false
    setPersisted(granted)
    toast(granted ? 'Storage protected' : 'The browser declined. Installing the app usually allows it.')
  }

  const installed = isStandalone()

  return (
    <>
      <PageHeader title="Settings" back="/" />

      <GroupLabel className="mt-2">You</GroupLabel>
      <List>
        <ListRow
          to="/goal"
          icon={<Target />}
          iconColor="var(--nutrition)"
          title="Goal & phases"
          subtitle={
            current
              ? [
                  `${goalLabel(current.goal)} · ${phaseProgressLabel(current, todayStr()).toLowerCase()}`,
                  `${fmtNum(current.targets.calories)} kcal a day`,
                  upcoming[0] ? `next: ${goalLabel(upcoming[0].goal)}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : 'Set your goal'
          }
        />
        <ListRow
          to="/alarm"
          icon={<AlarmClock />}
          iconColor="var(--accent-ink)"
          title="Alarms"
          subtitle={[
            s.wakeTime ? `Wake-up ${formatTime(combineDateTime(todayStr(), s.wakeTime))}` : 'Wake-up',
            'gym',
            'meals',
            `bedtime ${formatTime(combineDateTime(todayStr(), s.bedTime))}`,
          ].join(' · ')}
        />
      </List>

      <GroupLabel>Workouts</GroupLabel>
      <List>
        <ControlRow label="Rest timer" hint="Starts when you tick off a set.">
          <Switch label="Start rest timer automatically" checked={s.autoRest} onChange={(v) => set({ autoRest: v })} />
        </ControlRow>
        <ControlRow label="Rest length" stacked>
          <Segmented
            full
            ariaLabel="Rest length"
            value={s.restSeconds}
            onChange={(v) => set({ restSeconds: v })}
            options={[60, 90, 120, 180].map((sec) => ({ value: sec, label: sec < 120 ? `${sec} s` : `${sec / 60} min` }))}
          />
        </ControlRow>
      </List>

      <GroupLabel>Appearance</GroupLabel>
      <List>
        <ControlRow label="Theme" stacked>
          <Segmented
            full
            ariaLabel="Theme"
            value={s.theme}
            onChange={(v) => set({ theme: v, themeChosen: true })}
            options={[
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' },
              { value: 'system', label: 'Auto' },
            ]}
          />
        </ControlRow>
        <ControlRow label="Week starts on">
          <Segmented
            ariaLabel="Week starts on"
            value={s.weekStartsOn}
            onChange={(v) => set({ weekStartsOn: v })}
            options={[
              { value: 1, label: 'Mon' },
              { value: 0, label: 'Sun' },
            ]}
          />
        </ControlRow>
      </List>

      <GroupLabel>Install</GroupLabel>
      <List>
        <ControlRow
          label="Home Screen app"
          hint={
            installed
              ? 'Installed. It opens full screen and works offline.'
              : canInstall
                ? 'Install it to open full screen and work offline.'
                : isIOS()
                  ? 'In Safari, tap Share (or ••• then Share), then “Add to Home Screen”.'
                  : 'Use your browser menu: “Install app” or “Add to Home screen”.'
          }
        >
          {installed ? (
            <span className="flex items-center gap-1 text-subhead font-semibold text-good-ink">
              <Check className="size-4" aria-hidden />
              Installed
            </span>
          ) : (
            canInstall && (
              <Button size="sm" variant="primary" onClick={() => void install()}>
                Install
              </Button>
            )
          )}
        </ControlRow>
      </List>

      <GroupLabel>Your data</GroupLabel>
      <List>
        <ListRow
          title="Stored on this device"
          value={usage != null ? formatBytes(usage) : undefined}
          subtitle={
            counts
              ? `${counts.workouts} workouts · ${counts.cardio} cardio · ${counts.body} body · ${counts.foods} food · ${counts.supplements} supplements · ${counts.phases} ${counts.phases === 1 ? 'phase' : 'phases'}`
              : undefined
          }
        />
        <ListRow
          title="Last backup"
          value={lastBackup ? `${dayLabel(dateStrFromTs(lastBackup))}, ${formatTime(lastBackup)}` : 'Never'}
        />
        <ListRow icon={<Download />} iconColor="var(--accent-ink)" title="Download backup" onClick={() => void exportBackup()} chevron={false} />
        {canShareFiles && (
          <ListRow icon={<Share2 />} iconColor="var(--accent-ink)" title="Share backup" onClick={() => void shareBackup()} chevron={false} />
        )}
        <ListRow icon={<Upload />} iconColor="var(--accent-ink)" title="Restore backup" onClick={() => fileInput.current?.click()} chevron={false} />
      </List>
      <p className="mt-1.5 px-4 text-footnote text-ink-2">
        Everything stays on this device, in this browser; nothing is uploaded. Download a backup now and then, and use it
        to move your data to another device.
      </p>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void importBackup(file)
        }}
      />

      <List className="mt-6">
        <ControlRow label="Backup reminder" hint="Today reminds you when your last backup is older than this." stacked>
          <Segmented
            full
            ariaLabel="Backup reminder"
            value={s.backupReminderDays}
            onChange={(v) => set({ backupReminderDays: v })}
            options={[
              { value: 7, label: 'Weekly' },
              { value: 14, label: '2 weeks' },
              { value: 30, label: 'Monthly' },
            ]}
          />
        </ControlRow>
        <ControlRow
          label="Protect from clean-up"
          hint={
            persisted
              ? 'This browser will keep your data even when storage runs low.'
              : isIOS() && !installed
                ? 'Safari can delete data for websites you don’t open for a while. Add VFit to your Home Screen to keep it, and back up.'
                : 'Browsers may clear site data when storage runs low. Ask to keep it.'
          }
        >
          {persisted ? (
            <span className="flex items-center gap-1 text-subhead font-semibold text-good-ink">
              <ShieldCheck className="size-4" aria-hidden />
              Protected
            </span>
          ) : (
            <Button size="sm" variant="tinted" onClick={() => void protectStorage()}>
              Protect
            </Button>
          )}
        </ControlRow>
      </List>

      <List className="mt-6">
        <ListRow
          icon={<Trash />}
          iconColor="var(--critical)"
          title="Delete all data"
          subtitle="Removes everything on this device, including settings."
          destructive
          onClick={() => void eraseEverything()}
          chevron={false}
        />
      </List>

      <p className="mt-8 text-center text-caption text-ink-2">
        VFit {__APP_VERSION__} · kg, km and cm · works offline · no account, no tracking
      </p>
    </>
  )
}

/**
 * A settings row with a control: the label (and hint) on the left and the control on the right,
 * or, with `stacked`, the control full width under the label. Same inset hairline as ListRow.
 */
function ControlRow({ label, hint, stacked, children }: { label: string; hint?: string; stacked?: boolean; children?: ReactNode }) {
  return (
    <li className="relative px-4 py-3 not-first:before:absolute not-first:before:top-0 not-first:before:right-0 not-first:before:left-4 not-first:before:h-px not-first:before:scale-y-50 not-first:before:bg-bar-line not-first:before:content-['']">
      <div className={cn('flex gap-x-4 gap-y-2.5', stacked ? 'flex-col' : 'items-center justify-between')}>
        <div className="min-w-0 flex-1">
          <p className="text-body">{label}</p>
          {hint && <p className="mt-0.5 text-footnote text-ink-2">{hint}</p>}
        </div>
        {children && <div className={stacked ? '' : 'shrink-0'}>{children}</div>}
      </div>
    </li>
  )
}
