'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { formatDuration } from '@/lib/jalali';
import { PauseIcon, PlayIcon } from '@/components/icons';

export interface VoicePlayerProps {
  readonly durationSec: number;
  readonly waveform: readonly number[];
  /** Real media URL when the recording has finished uploading; `null` while it is pending. */
  readonly src: string | null;
  readonly outgoing: boolean;
  readonly label: string;
}

/**
 * Voice-memo player with a scrubbable waveform.
 *
 * Two transports, one UI:
 *  - `src` present  → a real `HTMLAudioElement` drives `currentTime`, seeking and duration.
 *  - `src` null     → the message is still uploading/transcoding, so playback runs off a
 *                     `requestAnimationFrame` clock over the known duration. The user still
 *                     gets scrubbing and progress; only the audio output is absent.
 */
export function VoicePlayer({ durationSec, waveform, src, outgoing, label }: VoicePlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const offsetRef = useRef<number>(0);

  const stopClock = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // Simulated transport: advance `elapsed` from a monotonic clock until the memo ends.
  const runClock = useCallback(() => {
    const tick = () => {
      const seconds = offsetRef.current + (performance.now() - startedAtRef.current) / 1000;
      if (seconds >= durationSec) {
        setElapsed(durationSec);
        setPlaying(false);
        offsetRef.current = 0;
        stopClock();
        return;
      }
      setElapsed(seconds);
      rafRef.current = requestAnimationFrame(tick);
    };
    startedAtRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
  }, [durationSec, stopClock]);

  useEffect(() => stopClock, [stopClock]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;

    if (playing) {
      if (audio) {
        audio.pause();
      } else {
        offsetRef.current = elapsed;
        stopClock();
      }
      setPlaying(false);
      return;
    }

    if (audio) {
      void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      return;
    }

    offsetRef.current = elapsed >= durationSec ? 0 : elapsed;
    setPlaying(true);
    runClock();
  }, [playing, elapsed, durationSec, runClock, stopClock]);

  const seekTo = useCallback(
    (ratio: number) => {
      const seconds = Math.min(durationSec, Math.max(0, ratio * durationSec));
      setElapsed(seconds);
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = seconds;
        return;
      }
      offsetRef.current = seconds;
      if (playing) {
        stopClock();
        runClock();
      }
    },
    [durationSec, playing, runClock, stopClock],
  );

  const progress = durationSec > 0 ? elapsed / durationSec : 0;
  const remaining = Math.max(0, durationSec - elapsed);

  return (
    <div className={cn('flex w-60 items-center gap-2.5 sm:w-72')}>
      {src && (
        <audio
          ref={audioRef}
          src={src}
          preload="metadata"
          onTimeUpdate={(event) => setElapsed(event.currentTarget.currentTime)}
          onEnded={() => {
            setPlaying(false);
            setElapsed(0);
          }}
          onPause={() => setPlaying(false)}
          onPlay={() => setPlaying(true)}
        />
      )}

      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? `توقف ${label}` : `پخش ${label}`}
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full transition-colors',
          outgoing
            ? 'bg-white/20 text-fg-on-brand hover:bg-white/30'
            : 'bg-brand-solid text-fg-on-brand hover:bg-brand-700',
        )}
      >
        {playing ? <PauseIcon size={18} /> : <PlayIcon size={18} className="ms-0.5" />}
      </button>

      <div
        role="slider"
        tabIndex={0}
        aria-label={`جایگاه پخش ${label}`}
        aria-valuemin={0}
        aria-valuemax={Math.round(durationSec)}
        aria-valuenow={Math.round(elapsed)}
        aria-valuetext={`${formatDuration(elapsed)} از ${formatDuration(durationSec)}`}
        onKeyDown={(event) => {
          // RTL: ArrowLeft advances, ArrowRight rewinds — matching the visual direction.
          const step = 1 / Math.max(durationSec, 1);
          if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            event.preventDefault();
            seekTo(progress + step * 5);
          } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
            event.preventDefault();
            seekTo(progress - step * 5);
          } else if (event.key === 'Home') {
            event.preventDefault();
            seekTo(0);
          } else if (event.key === 'End') {
            event.preventDefault();
            seekTo(1);
          } else if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault();
            toggle();
          }
        }}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          // The track is laid out RTL, so distance is measured from the right edge.
          const ratio = (rect.right - event.clientX) / rect.width;
          seekTo(ratio);
        }}
        className="flex h-9 flex-1 cursor-pointer items-center gap-[2px] rounded-md"
      >
        {waveform.map((amplitude, index) => {
          const played = index / waveform.length <= progress;
          return (
            <span
              key={index}
              aria-hidden="true"
              className={cn(
                'w-[2px] shrink-0 rounded-full transition-colors duration-100',
                outgoing
                  ? played
                    ? 'bg-white'
                    : 'bg-white/35'
                  : played
                    ? 'bg-brand-600'
                    : 'bg-gray-300',
              )}
              style={{ height: `${Math.round(amplitude * 24) + 4}px` }}
            />
          );
        })}
      </div>

      <span
        className={cn(
          'numeric shrink-0 text-micro font-medium',
          outgoing ? 'text-fg-on-brand/80' : 'text-fg-tertiary',
        )}
      >
        {formatDuration(playing || elapsed > 0 ? remaining : durationSec)}
      </span>
    </div>
  );
}
