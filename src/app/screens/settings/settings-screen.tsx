import type { FC } from "react";
import { Link } from "react-router-dom";
import {
  ChevronLeft,
  Sun,
  CaseSensitive,
  DatabaseZap,
  RefreshCw,
  HardDrive,
  ShieldCheck,
  Download,
} from "lucide-react";

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
import {
  formatBytes,
  useStorageSettings,
} from "@/features/pwa/hooks/use-storage-settings";
import { useInstallPrompt } from "@/features/pwa/hooks/use-install-prompt";

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
      <header className="folio-header sticky top-0 z-50 px-5 flex items-center">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back to library"
          render={<Link to={ROUTES.LIBRARY} />}
        >
          <ChevronLeft strokeWidth={1.5} className="size-6" />
        </Button>
      </header>

      <main className="flex-1 px-4 pt-5 pb-10">
        <h1 className="section-title font-semibold text-foreground mb-1 leading-tight">
          Settings
        </h1>
        <p className="text-ui-sm text-muted-foreground mb-6">
          Customize your reading environment.
        </p>

        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-6 rounded-sm border border-border bg-card p-6">
            <div className="flex items-center gap-2">
              <Sun className="size-4 text-muted-foreground" strokeWidth={1.5} />
              <h2 className="metadata">Appearance</h2>
            </div>

            <div className="flex flex-col gap-3">
              <span className="text-ui-sm font-semibold text-muted-foreground">
                Visual Theme
              </span>
              <ThemeSelector value={theme} onChange={setTheme} />
            </div>

            <div className="flex items-center justify-between">
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
          </section>

          <section className="flex flex-col gap-6 rounded-sm border border-border bg-card p-6">
            <div className="flex items-center gap-2">
              <CaseSensitive
                className="size-4 text-muted-foreground"
                strokeWidth={1.5}
              />
              <h2 className="metadata">Reading</h2>
            </div>

            <StepperRow
              label="Font size"
              value={fontScale}
              format={{ style: "percent" }}
              min={FONT_SCALE_MIN}
              max={FONT_SCALE_MAX}
              step={FONT_SCALE_STEP}
              onChange={setFontScale}
            />

            <StepperRow
              label="Line height"
              value={lineHeight}
              format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }}
              min={LINE_HEIGHT_MIN}
              max={LINE_HEIGHT_MAX}
              step={LINE_HEIGHT_STEP}
              onChange={setLineHeight}
            />

            <FontSelector
              value={readerFont}
              onChange={setReaderFont}
              fontScale={fontScale}
              lineHeight={lineHeight}
              paragraphSpacing={paragraphSpacing}
              collapsible
            />

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
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

              {keepScreenAwake && (
                <StepperRow
                  label="Screen-on limit"
                  value={keepScreenAwakeMinutes}
                  suffix="min"
                  min={KEEP_AWAKE_MINUTES_MIN}
                  max={KEEP_AWAKE_MINUTES_MAX}
                  step={KEEP_AWAKE_MINUTES_STEP}
                  onChange={setKeepScreenAwakeMinutes}
                />
              )}
            </div>
          </section>

          <section className="flex flex-col gap-6 rounded-sm border border-border bg-card p-6">
            <div className="flex items-center gap-2">
              <DatabaseZap
                className="size-4 text-muted-foreground"
                strokeWidth={1.5}
              />
              <h2 className="metadata">Search Index</h2>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
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
                  <RefreshCw
                    strokeWidth={1.5}
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

          <section className="flex flex-col gap-6 rounded-sm border border-border bg-card p-6">
            <div className="flex items-center gap-2">
              <HardDrive
                className="size-4 text-muted-foreground"
                strokeWidth={1.5}
              />
              <h2 className="metadata">Storage</h2>
            </div>

            {estimate && (
              <div className="flex flex-col gap-2">
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

            <div className="flex items-center justify-between gap-4">
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
                <ShieldCheck
                  className="size-5 shrink-0 text-muted-foreground"
                  strokeWidth={1.5}
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
              <div className="flex items-center justify-between gap-4">
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
                    <Download strokeWidth={1.5} className="size-4" />
                    Install
                  </Button>
                )}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};
