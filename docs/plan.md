# Quiet Trail Implementation Plan
Execution: native; user approved design and requested implementation.
Goal: two-player forest game. Architecture: authoritative rooms and puzzle state, separate render/UI/audio. Stack: TS, Three, Rapier, Node/ws.
Spec: design.md
Constraints: two players, Russian UI, original assets, three cooperative puzzles, link invitations.
Review focus: room full, disconnect and resume, invalid messages, solo bypass, pointer-lock loss.
1. shared/game.ts + server/rooms.ts + server/index.ts: protocol, puzzle rules, authoritative ball physics. tests/rooms.test.ts covers room limits, resume, isolation, cooperative actions. npm test.
2. src/world.ts + src/avatar.ts: forest, props, water shader, light, friendly avatars. Check rendered screenshots.
3. src/main.ts + src/audio.ts: FPS controls, collision, jump, network interpolation, interactions, generated ambience. Two-browser playtest.
4. index.html + src/style.css: lobby, HUD, pause/settings. README + Dockerfile: reproducible deployment. npm run build; browser console, screenshots, resize.
