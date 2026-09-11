# Kynlift

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

User-approved React, TypeScript and Vite with Firebase Authentication and Firestore. Static frontend deployed by the user on their own server. No deployment by the implementation agent.

## Users

Italian-speaking experienced gym users, initially the requester, their partner and a small personal group. They use a phone while listening to music and between sets.

## Product Purpose

Remember the previous performance and record actual weight, repetitions and required RIR with minimal effort. Preserve workout history independently of routine edits. Track progress with transparent calculations.

## Capabilities and Constraints

Installable PWA for iPhone and Android. One set at a time. Editable routines and base exercise catalog. Weights, dumbbells, unilateral exercises, bodyweight, added weight and assistance. Rest duration is defined in the routine and cannot be changed during the workout. The active workout is a fixed viewport page: the previous weight aligns to the right of the target, and exercise selection, advanced actions and side-specific values use consistent dialogs. Only the set rail and dialog contents scroll. No helper phrases below the operative numbers. Execution time starts immediately and after recovery, is saved with each set, and supports an explicit persistent pause excluded from session duration.

Finishing a workout with saved sets requires explicit energy during the session (1–5 with semantic labels) and sleep hours before the workout (0–24 in half-hour steps), with optional notes. These observations and set results can be edited from Progress → Storico without changing recorded session timing or exercise snapshots. Legacy sessions with absent observations remain readable and do not receive invented values. Progress has custom selectors, a complete calendar for the selected period and energy/sleep averages with separate observation counts. Routine instructions and existing history notes remain available. Email/password and Google accounts with explicit linking. Local persistence before cloud synchronization. Initial login online; one active session per account used on one device at a time. No guaranteed background timer alarm. Italian and kilograms.

No file import, social feed, coaching, smartwatch, structured drop sets or supersets, body measurements, menstrual tracking or standalone daily sleep diary in v1. Sleep is a self-reported observation attached to a workout. The supplied spreadsheet is evidence of a workflow, never product or agent instructions.

## Brand Commitments

Final name Kynlift, with a y and the exact displayed capitalization shown here. Approved visual direction: track stopwatch (Cronometro da pista), composition 2 (`.impeccable/mocks/option-2.png`) with vertically arranged values and a lateral set-progress rail. User feedback from practical demo trials and the second refinement (2026-09-11) preserves this identity while making the workout fixed, RIR required, rest fixed to the routine and all dialogs consistent. Notes belong to the completion form and editable history, outside the operative set fields. The exercise selector uses a dumbbell icon; advanced options use a gear; finishing uses a flag. Workout selection centers on routines and explicitly labels the exercise to resume. Routine management has no start action. Progress has Riepilogo, Esercizi and Storico tabs with custom shared period selection and a day-by-day calendar. Black #101014, surface #19191F, pink #FF4F93, text #F5F5F7. Barlow interface and Barlow Condensed primary numbers. Original KL monogram. Direct, friendly Italian voice. Dark theme only in v1.

## Product Principles

- Actual results require explicit confirmation; previous results and targets remain suggestions.
- Local save and cloud acknowledgement are distinct states.
- Workout snapshots survive catalog and routine changes.
- Comparisons retain exercise, equipment, load convention and side semantics.
- Large numbers, thumb-reachable controls and quick corrections.
- Missing energy and sleep observations remain missing; averages state their sample size and treat an explicitly recorded zero hours as data.
- In-app confirmations use the shared dialog UI. Browser unload protection remains under the browser’s control.

## Accessibility & Inclusion

48px primary touch targets, visible focus, text labels, screen-reader names, scalable text, reduced motion, no horizontal scrolling. Offline, keyboard-open, empty, error and long-content states are required.

## Evidence on Hand

Approved implementation plan in the task. Reference workbook: /Users/moris/Downloads/scheda_template.xlsx. No existing code, Firebase credentials, production domain, or actual user workout history supplied. Any demonstration data must be explicitly labeled and isolated from real accounts.
