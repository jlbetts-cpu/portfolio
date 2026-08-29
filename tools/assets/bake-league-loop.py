"""Bake audio/league-loop.wav -- the bed that plays under the whole cup.

Jayden sent a voice memo for this. It arrived as an iOS item-provider temp path
which macOS had already cleaned up, so there was no file to import; rather than
ship the player with nothing to play, this bakes a stand-in that is good enough
to ship on its own. HIS FILE WINS THE MOMENT IT EXISTS: league-audio.js tries
audio/league-loop.m4a first and only falls back to this .wav, so dropping his
memo in at that name replaces this with no code change.

What it is: a distant-stadium bed. Filtered noise for the crowd, two slow swells
so it breathes rather than hisses, and a low room tone underneath. Deliberately
dull and un-melodic -- it sits under a match for several minutes and anything
with a tune would be unbearable by the third fixture.

SEAMLESS, which is the only hard requirement: every component's period divides
the loop length exactly, and the first and last 120ms are cross-faded, so
looping produces no click. The tail-vs-head delta is asserted at the end.

Mono, 22050 Hz -- the source material is noise, so nothing above 11 kHz is
missed, and it keeps the file small enough to serve.
"""
import math
import os
import random
import struct
import wave

RATE = 22050
SECONDS = 16
N = RATE * SECONDS
XF = int(RATE * 0.12)          # cross-fade length
OUT = "audio/league-loop.wav"

random.seed(20260828)

# ---- crowd: white noise pushed through a couple of one-pole low-passes, which
# is enough to turn hiss into a distant wash.
noise = [random.uniform(-1.0, 1.0) for _ in range(N)]
lp1 = lp2 = 0.0
A1, A2 = 0.030, 0.055
crowd = []
for v in noise:
    lp1 += A1 * (v - lp1)
    lp2 += A2 * (lp1 - lp2)
    crowd.append(lp2)

# normalise the wash
peak = max(abs(v) for v in crowd) or 1.0
crowd = [v / peak for v in crowd]

# ---- swells: periods chosen to divide N exactly, so the loop point is silent
def swell(cycles, depth):
    return [1.0 - depth + depth * 0.5 * (1.0 - math.cos(2.0 * math.pi * cycles * i / N))
            for i in range(N)]

s1 = swell(2, 0.35)
s2 = swell(5, 0.18)

# ---- room tone: two very low sines, again on integer cycle counts
def tone(cycles, amp):
    return [amp * math.sin(2.0 * math.pi * cycles * i / N) for i in range(N)]

# 16s loop -> 928 cycles = 58 Hz, 1392 = 87 Hz
room = [a + b for a, b in zip(tone(928, 0.030), tone(1392, 0.018))]

mix = [(crowd[i] * 0.52 * s1[i] * s2[i]) + room[i] for i in range(N)]

# ---- cross-fade head over tail so the seam is inaudible
for i in range(XF):
    f = i / XF
    mix[i] = mix[i] * f + mix[N - XF + i] * (1.0 - f)
del mix[N - XF:]

peak = max(abs(v) for v in mix) or 1.0
mix = [v / peak * 0.66 for v in mix]           # leave real headroom

os.makedirs("audio", exist_ok=True)
with wave.open(OUT, "wb") as f:
    f.setnchannels(1)
    f.setsampwidth(2)
    f.setframerate(RATE)
    f.writeframes(b"".join(struct.pack("<h", int(max(-1.0, min(1.0, v)) * 32767)) for v in mix))

seam = abs(mix[0] - mix[-1])
rms = math.sqrt(sum(v * v for v in mix) / len(mix))
print("  wrote %s  %.1fs  %d frames" % (OUT, len(mix) / RATE, len(mix)))
print("  peak %.3f   rms %.3f   loop seam delta %.5f %s"
      % (max(abs(v) for v in mix), rms, seam, "(inaudible)" if seam < 0.02 else "(AUDIBLE CLICK)"))
