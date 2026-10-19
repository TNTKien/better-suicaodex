import { readFile } from "node:fs/promises"
import { Transformer } from "@napi-rs/image"
import satori from "satori"
import type { Group, Manga } from "./upstream"

export const size = { width: 1200, height: 630 }
const [regularFont, boldFont, logo, fallbackAvatar] = await Promise.all([
  readFile(new URL("../assets/NotoSans-Regular.ttf", import.meta.url)),
  readFile(new URL("../assets/NotoSans-Bold.ttf", import.meta.url)),
  readFile(new URL("../assets/suicaodex.webp", import.meta.url)).then((bytes) =>
    new Transformer(bytes).invert().png()
  ),
  readFile(new URL("../assets/kokkoro-avt.png", import.meta.url)).then(
    (bytes) => `data:image/png;base64,${bytes.toString("base64")}`
  ),
])

export async function renderImage(
  subject: Manga | Group,
  cover: string | null,
  host: string
) {
  const isGroup = "avatarUrl" in subject
  const { title } = subject
  const creators = isGroup ? subject.description : subject.creators
  if (isGroup && !cover) cover = fallbackAvatar
  const svg = await satori(
    <div
      style={{
        display: "flex",
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: "#13131a",
        color: "#fff",
        fontFamily: "Noto Sans",
      }}
    >
      {cover ? (
        <img
          alt=""
          src={cover}
          width={1200}
          height={630}
          style={{
            position: "absolute",
            objectFit: "cover",
            filter: "blur(20px)",
            opacity: 0.55,
            transform: "scale(1.08)",
          }}
        />
      ) : null}
      <div
        style={{
          display: "flex",
          position: "absolute",
          width: "100%",
          height: "100%",
          background:
            "linear-gradient(90deg, rgba(19,19,26,0.8), rgba(19,19,26,0.4))",
        }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "relative",
          boxSizing: "border-box",
          flexShrink: 0,
          width: 750,
          height: 630,
          padding: "36px 40px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {isGroup ? (
            <div style={{ fontSize: 24, color: "#dedee6" }}>Nhóm dịch</div>
          ) : null}
          <div
            style={{
              fontSize: title.length > 100 ? 48 : 60,
              fontWeight: 700,
              lineHeight: 1.15,
              lineClamp: isGroup ? 3 : 4,
              maxHeight: isGroup ? 210 : 280,
              overflow: "hidden",
            }}
          >
            {title}
          </div>
          {creators ? (
            <div
              style={{
                fontSize: 28,
                color: "#dedee6",
                lineHeight: 1.4,
                lineClamp: isGroup ? 3 : 2,
                maxHeight: isGroup ? 120 : 80,
                overflow: "hidden",
              }}
            >
              {creators}
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <img
            alt="SuicaoDex"
            src={`data:image/png;base64,${logo.toString("base64")}`}
            width={319}
            height={60}
          />
          <div style={{ fontSize: 22, color: "#b8b8c5" }}>{host}</div>
        </div>
      </div>
      {cover ? (
        <img
          alt={isGroup ? `Avatar nhóm dịch ${title}` : `Bìa truyện ${title}`}
          src={cover}
          width={isGroup ? 400 : 450}
          height={isGroup ? 400 : 630}
          style={{
            position: "absolute",
            right: isGroup ? 25 : 0,
            top: isGroup ? 115 : 0,
            borderRadius: isGroup ? 28 : 0,
          }}
        />
      ) : (
        <div
          style={{
            display: "flex",
            position: "absolute",
            right: 0,
            top: 0,
            width: 450,
            height: 630,
            alignItems: "center",
            justifyContent: "center",
            background: "#23232e",
            color: "#b8b8c5",
            fontSize: 26,
          }}
        >
          Chưa có ảnh bìa
        </div>
      )}
    </div>,
    {
      ...size,
      fonts: [
        { name: "Noto Sans", data: regularFont, weight: 400, style: "normal" },
        { name: "Noto Sans", data: boldFont, weight: 700, style: "normal" },
      ],
    }
  )
  return Transformer.fromSvg(svg).png()
}
