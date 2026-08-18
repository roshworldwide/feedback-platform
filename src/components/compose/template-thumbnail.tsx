/**
 * A template, drawn with its own real colours.
 *
 * Fourteen templates differ mainly in colour, so a thumbnail that only draws
 * header shape and line count (all AURUM tokens, no template colour) makes
 * several of them look identical. `meta.swatch` — five literal hexes, see the
 * docblock in `templates.ts` — paints the artwork itself: header, body ink,
 * accent, call-to-action pill. Only the artwork uses those literal colours;
 * the frame around it (border, radius, elevation, the selected rim) stays
 * AURUM-token-driven, same as any other card in the product. The preview a
 * person actually scrutinises before choosing is still the real rendered
 * email in an iframe on the Review step, through the same renderer that sends.
 */

import type { TemplateMeta } from "@/lib/email/templates";

export type TemplateThumbnailProps = {
  meta: TemplateMeta;
  /** Overall width in pixels. Everything else is derived from it. */
  width?: number;
  /** Draws the rim in the accent role. The label states selection too. */
  selected?: boolean;
};

export function TemplateThumbnail({
  meta,
  width = 168,
  selected = false,
}: TemplateThumbnailProps) {
  const { sketch, swatch } = meta;
  const unit = width / 168;
  const px = (value: number) => `${Math.round(value * unit)}px`;

  const ground = swatch.ground;
  const ink = swatch.ink;
  const quiet = swatch.ink;
  const accent = swatch.accent;

  const line = (widthPercent: number, key: number) => (
    <span
      key={key}
      aria-hidden="true"
      style={{
        display: "block",
        height: px(4),
        width: `${widthPercent}%`,
        borderRadius: "var(--radius-capsule)",
        background: quiet,
        opacity: 0.55,
      }}
    />
  );

  return (
    <span
      aria-hidden="true"
      style={{
        display: "block",
        width: `${width}px`,
        borderRadius: "var(--radius-sm)",
        overflow: "hidden",
        background: ground,
        border: `1px solid ${selected ? "var(--content-accent)" : "var(--stroke-rim)"}`,
        boxShadow: "var(--e1)",
      }}
    >
      {/* Header — a full bar, a hairline rule, or nothing at all. */}
      {sketch.header === "bar" ? (
        <>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: `${px(8)} ${px(10)}`,
              background: swatch.headerBg,
            }}
          >
            <span
              style={{
                display: "block",
                width: px(46),
                height: px(5),
                borderRadius: "var(--radius-capsule)",
                background: swatch.headerInk,
              }}
            />
            <span
              style={{
                display: "block",
                width: px(24),
                height: px(4),
                borderRadius: "var(--radius-capsule)",
                background: swatch.headerInk,
                opacity: 0.6,
              }}
            />
          </span>
          <span style={{ display: "block", height: px(3), background: accent }} />
        </>
      ) : null}

      {sketch.header === "rule" ? (
        <span style={{ display: "block", padding: `${px(10)} ${px(10)} 0` }}>
          <span
            style={{
              display: "block",
              width: px(50),
              height: px(5),
              borderRadius: "var(--radius-capsule)",
              background: ink,
              marginBottom: px(8),
            }}
          />
          <span style={{ display: "block", height: px(2), background: accent }} />
        </span>
      ) : null}

      {sketch.header === "plain" ? (
        <span style={{ display: "block", padding: `${px(12)} ${px(10)} 0` }}>
          <span
            style={{
              display: "block",
              width: px(50),
              height: px(5),
              borderRadius: "var(--radius-capsule)",
              background: ink,
            }}
          />
        </span>
      ) : null}

      {/* Title, then the body at this template's density. */}
      <span
        style={{
          display: "flex",
          flexDirection: "column",
          gap: px(5),
          padding: `${px(10)} ${px(10)} ${px(8)}`,
        }}
      >
        <span
          style={{
            display: "block",
            width: "68%",
            height: px(8),
            borderRadius: "var(--radius-capsule)",
            background: ink,
          }}
        />
        {Array.from({ length: sketch.lines }, (_, index) =>
          line(index === sketch.lines - 1 ? 62 : 100, index),
        )}
      </span>

      {/* Call to action, then the rating row every template carries. */}
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: px(6),
          padding: `0 ${px(10)} ${px(10)}`,
        }}
      >
        <span
          style={{
            display: "block",
            width: px(58),
            height: px(14),
            borderRadius: "var(--radius-capsule)",
            background: swatch.ctaBg,
          }}
        />
        <span style={{ display: "flex", gap: px(3) }}>
          {Array.from({ length: 5 }, (_, index) => (
            <span
              key={index}
              style={{
                display: "block",
                width: px(6),
                height: px(6),
                borderRadius: "var(--radius-capsule)",
                background: quiet,
                opacity: 0.7,
              }}
            />
          ))}
        </span>
      </span>
    </span>
  );
}
