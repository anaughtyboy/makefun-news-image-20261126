# makefun-news-image-20261126

[![make.fun · news-image-20261126](https://make.fun/badge/news-image-20261126.svg)](https://make.fun/bounty/news-image-20261126?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261126)
[![rank](https://make.fun/badge/news-image-20261126/anaughtyboy/makefun-news-image-20261126/rank.svg)](https://make.fun/bounty/news-image-20261126/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261126)
[![reward](https://make.fun/badge/news-image-20261126/anaughtyboy/makefun-news-image-20261126/reward.svg)](https://make.fun/bounty/news-image-20261126?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261126)

World news in one image — Thursday 26 November 2026. A newspaper front page
drawn entirely in code: the Macy's Thanksgiving Day Parade is postponed for
the first time ever as a storm hits New York, Kim Jong Un vows more nuclear
weapons, the Philippines says it will raise a Chinese bomber's close pass
with Beijing, Elon Musk promises two SpaceX shares for every American child,
the U.S. Army blows up its ageing explosives stockpile in Iowa, and a FedEx
cargo plane runs off the runway in Miami.

## The six stories (all 26 November 2026)

1. **New York — Macy's parade postponed.** Organisers postpone the Macy's
   Thanksgiving Day Parade for the first time ever because powerful winds
   are expected while marchers and spectators would be on the streets.
   Source: Associated Press, 26 Nov 2026.
2. **Pyongyang — Kim vows more nuclear weapons.** North Korean leader Kim
   Jong Un inspects nuclear materials production facilities and vows to
   build more nuclear weapons, ignoring Washington's overtures.
   Source: Economic Times / Reuters, 26 Nov 2026.
3. **Manila — bomber flight to be raised with Beijing.** Philippine Defense
   Secretary Gilbert Teodoro says the Philippines should raise the flight
   of a Chinese H-6 bomber — monitored 45 nautical miles off Luzon, its
   closest pass yet — with China.
   Source: The Manila Times, 26 Nov 2026.
4. **Business — Musk: two SpaceX shares for every child.** Elon Musk says
   he will give two SpaceX shares to every child in America.
   Source: Economic Times, 26 Nov 2026.
5. **Iowa — Army blows up toxic explosives stockpile.** The U.S. Army
   detonates the nation's entire stockpile of deteriorating lead azide, a
   chemical used in explosives, and calls the detonation a success.
   Source: Associated Press, 26 Nov 2026.
6. **Miami — FedEx plane overshoots the runway.** A FedEx cargo plane runs
   off the end of the runway at Miami airport.
   Source: South China Morning Post; New Straits Times, 26 Nov 2026.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` draws the 1024x1024 front page in code — a hand-rolled 5x7 bitmap
font, a small software rasterizer with per-illustration clipping, and a
from-scratch PNG encoder — and writes `entry.png` to `MAKEFUN_OUTPUT_DIR`
(default `/output`). Two runs produce identical bytes.
