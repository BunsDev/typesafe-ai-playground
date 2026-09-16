# Doom 3D upgrade

Implement a first-person WebGL renderer over the existing deterministic maze simulation. Preserve fixed Jev actions, all three controllers, fullscreen, key override and source-state inspection. Use original procedural geometry and textures, an optional tactical map, visible crosshair/HUD, lighting/fog and weapon feedback. Add pointer drag aiming and click firing through the same discrete action queue. Resize safely, dispose GPU resources, respect reduced motion, and provide an explicit tactical fallback if WebGL is unavailable.

Verification: typecheck/build, deterministic visibility tests, browser rendering/gameplay/fullscreen/resize/fallback, visual inspection on desktop and mobile. Live provider verification remains dependent on a funded key.
