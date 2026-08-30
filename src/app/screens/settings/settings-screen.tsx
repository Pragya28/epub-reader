import type { FC, ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  CaretLeftIcon,
  SunIcon,
  TextAaIcon,
  DatabaseIcon,
  ArrowsClockwiseIcon,
  HardDriveIcon,
  ShieldCheckIcon,
  DownloadSimpleIcon,
} from "@phosphor-icons/react";

import { cn } from "@/utils/cn";
import { ROUTES } from "@/utils/routes";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { StepperRow } from "@/components/ui/stepper-row";
import { Progress } from "@/components/ui/progress";
import { notify } from "@/components/toast/toast";
import {
  FONT_SCALE_MAX,
  FONT_SCALE_MIN,
  FONT_SCALE_STEP,
  KEEP_AWAKE_MINUTES_MAX,
  KEEP_AWAKE_MINUTES_MIN,
  KEEP_AWAKE_MINUTES_STEP,
  LINE_HEIGHT_MAX,
  LINE_HEIGHT_MIN,
  LINE_HEIGHT_STEP,
  preferencesStore,
} from "@/features/preferences/store/preferences-store";
import { searchMaintenanceStore } from "@/features/library/store/search-maintenance-store";
import { ThemeSelector } from "@/features/preferences/components/theme-selector";
import { FontSelector } from "@/features/preferences/components/font-selector";
import { useStorageSettings } from "@/features/pwa/hooks/use-storage-settings";
import { useInstallPrompt } from "@/features/pwa/hooks/use-install-prompt";
import { formatBytes } from "@/utils/format-bytes";

const SectionHeader: FC<{ icon: ReactNode; children: string }> = ({
  icon,
  children,
}) => (
  <div className="flex items-center gap-2 px-1">
    {icon}
    <h2 className="metadata">{children}</h2>
    <span className="h-px flex-1 bg-border" />
  </div>
);

export const SettingsScreen: FC = () => {
  const {
    theme,
    applyThemeToReader,
    readerFont,
    fontScale,
    lineHeight,
    paragraphSpacing,
    keepScreenAwake,
    keepScreenAwakeMinutes,
    setTheme,
    setApplyThemeToReader,
    setReaderFont,
    setFontScale,
    setLineHeight,
    setKeepScreenAwake,
    setKeepScreenAwakeMinutes,
  } = preferencesStore();

  const { status, progress, lastRebuiltAt, startRebuild } =
    searchMaintenanceStore();

  const { estimate, persisted, requestPersist } = useStorageSettings();
  const { canInstall, isInstalled, showIosHint, promptInstall } =
    useInstallPrompt();

  const handleRebuild = async () => {
    await startRebuild();
    const { failedCount } = searchMaintenanceStore.getState();
    if (failedCount > 0) {
      notify.error(`Rebuilt search index — ${failedCount} book(s) failed`);
    } else {
      notify.success("Search index rebuilt");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="folio-header sticky top-0 z-50 flex flex-col gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back to library"
          render={<Link to={ROUTES.LIBRARY} />}
        >
          <CaretLeftIcon weight="light" className="size-6" />
        </Button>
        <div className="flex flex-col gap-1 px-1 pb-1">
          <h1 className="section-title font-semibold text-foreground uppercase leading-none">
            Settings
          </h1>
          <p className="text-ui-sm text-muted-foreground">
            Customize your reading environment.
          </p>
        </div>
      </header>

      <main className="flex-1 px-4 pt-6 pb-12">
        <div className="flex flex-col gap-8">
          <section className="flex flex-col gap-3">
            <SectionHeader
              icon={
                <SunIcon
                  className="size-4 text-muted-foreground"
                  weight="light"
                />
              }
            >
              Appearance
            </SectionHeader>

            <div className="flex flex-col divide-y divide-border rounded-sm border border-border bg-card">
              <div className="flex flex-col gap-3 px-4 py-4">
                <span className="text-ui-sm font-semibold text-muted-foreground">
                  Visual Theme
                </span>
                <ThemeSelector value={theme} onChange={setTheme} />
              </div>

              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="flex flex-col">
                  <span className="text-ui font-semibold text-foreground">
                    Apply to Reader
                  </span>
                  <span className="text-ui-sm text-muted-foreground">
                    Use this theme while reading too
                  </span>
                </div>
                <Switch
                  checked={applyThemeToReader}
                  onCheckedChange={setApplyThemeToReader}
                  aria-label="Apply theme to reader"
                />
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeader
              icon={
                <TextAaIcon
                  className="size-4 text-muted-foreground"
                  weight="light"
                />
              }
            >
              Reading
            </SectionHeader>

            <div className="flex flex-col divide-y divide-border rounded-sm border border-border bg-card">
              <StepperRow
                className="px-4 py-3"
                label="Font size"
                value={fontScale}
                format={{ style: "percent" }}
                min={FONT_SCALE_MIN}
                max={FONT_SCALE_MAX}
                step={FONT_SCALE_STEP}
                onChange={setFontScale}
              />

              <StepperRow
                className="px-4 py-3"
                label="Line height"
                value={lineHeight}
                format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }}
                min={LINE_HEIGHT_MIN}
                max={LINE_HEIGHT_MAX}
                step={LINE_HEIGHT_STEP}
                onChange={setLineHeight}
              />

              <div className="px-4 py-4">
                <FontSelector
                  value={readerFont}
                  onChange={setReaderFont}
                  fontScale={fontScale}
                  lineHeight={lineHeight}
                  paragraphSpacing={paragraphSpacing}
                  collapsible
                />
              </div>

              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="flex flex-col">
                  <span className="text-ui font-semibold text-foreground">
                    Keep screen awake
                  </span>
                  <span className="text-ui-sm text-muted-foreground">
                    Stop the screen dimming while you read
                  </span>
                </div>
                <Switch
                  checked={keepScreenAwake}
                  onCheckedChange={setKeepScreenAwake}
                  aria-label="Keep screen awake"
                />
              </div>

              <StepperRow
                className="px-4 py-3"
                label="Screen-on limit"
                value={keepScreenAwakeMinutes}
                suffix="min"
                min={KEEP_AWAKE_MINUTES_MIN}
                max={KEEP_AWAKE_MINUTES_MAX}
                step={KEEP_AWAKE_MINUTES_STEP}
                onChange={setKeepScreenAwakeMinutes}
                disabled={!keepScreenAwake}
              />
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeader
              icon={
                <DatabaseIcon
                  className="size-4 text-muted-foreground"
                  weight="light"
                />
              }
            >
              Search Index
            </SectionHeader>

            <div className="flex flex-col gap-3 rounded-sm border border-border bg-card px-4 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col">
                  <span className="text-ui font-semibold text-foreground">
                    Rebuild Search Index
                  </span>
                  <span className="text-ui-sm text-muted-foreground">
                    {lastRebuiltAt
                      ? `Last rebuilt: ${new Date(lastRebuiltAt).toLocaleString()}`
                      : "Never rebuilt"}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={status === "running"}
                  onClick={handleRebuild}
                  aria-label={
                    status === "running"
                      ? "Rebuilding search index"
                      : "Rebuild search index"
                  }
                >
                  <ArrowsClockwiseIcon
                    weight="light"
                    className={cn(
                      "size-4",
                      status === "running" && "motion-safe:animate-spin",
                    )}
                  />
                </Button>
              </div>

              {status === "running" && <Progress value={progress} />}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeader
              icon={
                <HardDriveIcon
                  className="size-4 text-muted-foreground"
                  weight="light"
                />
              }
            >
              Storage
            </SectionHeader>

            <div className="flex flex-col divide-y divide-border rounded-sm border border-border bg-card">
              {estimate && (
                <div className="flex flex-col gap-2 px-4 py-4">
                  <div className="flex items-center justify-between">
                    <span className="text-ui font-semibold text-foreground">
                      Space used
                    </span>
                    <span className="text-ui-sm text-muted-foreground">
                      {formatBytes(estimate.usageBytes)} of{" "}
                      {formatBytes(estimate.quotaBytes)}
                    </span>
                  </div>
                  <Progress value={estimate.percentUsed} />
                </div>
              )}

              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="flex flex-col">
                  <span className="text-ui font-semibold text-foreground">
                    Protected storage
                  </span>
                  <span className="text-ui-sm text-muted-foreground">
                    {persisted
                      ? "The browser won't clear your library to free up space."
                      : "The browser may clear your library under storage pressure."}
                  </span>
                </div>
                {persisted ? (
                  <ShieldCheckIcon
                    className="size-5 shrink-0 text-muted-foreground"
                    weight="light"
                    aria-label="Protected"
                  />
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={requestPersist}
                  >
                    Protect
                  </Button>
                )}
              </div>

              {!isInstalled && (canInstall || showIosHint) && (
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="flex flex-col">
                    <span className="text-ui font-semibold text-foreground">
                      Install app
                    </span>
                    <span className="text-ui-sm text-muted-foreground">
                      {showIosHint
                        ? "Use Share → Add to Home Screen."
                        : "Add Librune to your home screen for offline use."}
                    </span>
                  </div>
                  {canInstall && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => void promptInstall()}
                    >
                      <DownloadSimpleIcon weight="light" className="size-4" />
                      Install
                    </Button>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};
