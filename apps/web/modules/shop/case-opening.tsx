"use client"

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react"
import {
  FrameIcon,
  PackageOpenIcon,
  SkipForwardIcon,
  SparklesIcon,
} from "lucide-react"
import type { CurrentAccount } from "@/modules/account/api"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { coinLabel } from "./admin-api"
import { ShopFramePreview } from "./avatar-frame-shop"
import {
  caseWinnerIndex,
  caseLoopLength,
  caseCruiseDuration,
  caseBrakeDuration,
  createCaseReel,
  type CaseReward,
} from "./case-reel"
import type { GachaReceipt } from "./gacha-api"

function RewardArt({
  reward,
  account,
  animate = false,
}: {
  reward: CaseReward
  account: CurrentAccount | null
  animate?: boolean
}) {
  return reward.frame ? (
    <ShopFramePreview
      item={{ frame: reward.frame }}
      account={account}
      animate={animate}
    />
  ) : (
    <div className="flex size-40 items-center justify-center text-muted-foreground">
      <FrameIcon aria-hidden="true" className="size-20" />
    </div>
  )
}

export default function CaseOpening({
  receipt,
  winner,
  samples,
  account,
}: {
  receipt: GachaReceipt | null
  winner: CaseReward | null
  samples: CaseReward[]
  account: CurrentAccount | null
}) {
  const [round] = useState(() => createCaseReel(samples, null))
  const track = useRef<HTMLDivElement>(null)
  const [settling, setSettling] = useState(false)
  const [finished, setFinished] = useState(false)
  const [skipRequested, setSkipRequested] = useState(false)
  const hasResult = !!receipt && !!winner
  const revealed = hasResult && finished
  const duration = useRef(0)

  useLayoutEffect(() => {
    if (!hasResult || !track.current) return
    if (
      skipRequested ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFinished(true)
      return
    }
    const styles = window.getComputedStyle(track.current)
    const transform = styles.transform
    const x = transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m41
    duration.current = caseBrakeDuration(
      x,
      parseFloat(styles.getPropertyValue("--case-card-width")),
      parseFloat(styles.columnGap)
    )
    track.current.style.setProperty("--case-start-x", `${x}px`)
    track.current.style.setProperty("--case-duration", `${duration.current}ms`)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettling(true)
  }, [hasResult, skipRequested])

  useEffect(() => {
    if (!settling || finished) return
    // Background tabs may suppress animation events; the confirmed result must remain reachable.
    const timeout = window.setTimeout(
      () => setFinished(true),
      duration.current + 300
    )
    return () => window.clearTimeout(timeout)
  }, [settling, finished])

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Button
        variant="secondary"
        className="self-end"
        onClick={() => setSkipRequested(true)}
        disabled={revealed || skipRequested}
        size="sm"
      >
        <SkipForwardIcon data-icon="inline-start" />
        Bỏ qua
      </Button>
      <div
        className="gacha-case-stage rounded-md"
        data-phase={revealed ? "revealed" : settling ? "spinning" : "waiting"}
        data-rarity={revealed ? receipt?.frame.rarity : undefined}
      >
        <div className="gacha-case-window mx-0" aria-hidden="true">
          <div
            ref={track}
            className={cn(
              "gacha-case-track",
              !revealed &&
                (settling
                  ? "gacha-case-spinning"
                  : !skipRequested && "gacha-case-cruising")
            )}
            style={
              {
                "--case-stop": caseWinnerIndex,
                "--case-loop": caseLoopLength,
                "--case-cruise-duration": `${caseCruiseDuration}ms`,
              } as CSSProperties
            }
            onAnimationEnd={(event) => {
              if (
                event.target === event.currentTarget &&
                event.animationName === "gacha-case-roll"
              )
                setFinished(true)
            }}
          >
            {round.items.map((sample, index) => {
              const backdrop =
                sample.id === "pending" && samples.length
                  ? samples[(index % caseLoopLength) % samples.length]!
                  : sample
              const item =
                index === caseWinnerIndex && winner ? winner : backdrop
              return (
                <div
                  key={index}
                  className="gacha-case-card"
                  data-rarity={item.rarity}
                >
                  <span className="truncate px-3 pt-3 text-xs text-muted-foreground">
                    {item.topic?.name ?? "Khung Avatar"}
                  </span>
                  <div className="gacha-case-art">
                    <RewardArt
                      reward={winner && item.id === winner.id ? winner : item}
                      account={account}
                    />
                  </div>
                  <div className="gacha-case-caption">
                    <strong className="truncate text-xs">{item.name}</strong>
                    <span>{item.rarity}</span>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="gacha-case-marker">
            <span />
            <i />
            <span />
          </div>
        </div>
        <div
          className="gacha-case-result"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {revealed && receipt && winner ? (
            <CaseOpeningResult
              receipt={receipt}
              winner={winner}
              account={account}
            />
          ) : (
            <div className="flex items-center justify-center gap-4 p-5">
              <PackageOpenIcon
                aria-hidden="true"
                className="size-9 shrink-0 text-muted-foreground"
              />
              <p className="font-semibold">Đang mở hộp…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function CaseOpeningResult({
  receipt,
  winner,
  account,
}: {
  receipt: GachaReceipt
  winner: CaseReward
  account: CurrentAccount | null
}) {
  return (
    <div className="gacha-case-reveal">
      <div className="gacha-case-winner">
        <RewardArt reward={winner} account={account} animate />
      </div>
      <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
        <p className="text-xs text-muted-foreground">BẠN NHẬN ĐƯỢC</p>
        <h3 className="line-clamp-1 text-xl font-semibold wrap-anywhere">
          {receipt.frame.name}
        </h3>
        <Badge variant="outline">{receipt.frame.rarity}</Badge>
        <p className="line-clamp-1 text-sm text-muted-foreground">
          {receipt.duplicate
            ? `Khung đã sở hữu — hoàn ${coinLabel(receipt.refund)}.`
            : "Khung đã vào kho của bạn; chưa tự động trang bị."}
        </p>
      </div>
      {/* <SparklesIcon aria-hidden="true" className="gacha-case-sparkle size-6" /> */}
    </div>
  )
}
