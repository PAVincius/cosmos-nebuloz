/* ════════════════════════════════════════════════════════════
   NEBULA SHADERS — GLSL1, ported verbatim from the design
   prototype's src/nebula.jsx.

   The noise library is substituted into each program once, at
   module load. The prototype ran `.replace("__NOISE__", …)`
   inline in JSX, i.e. on every render.

   One deliberate change: the prototype's dust vertex shader
   opened with `vec3 restBase = mix(position, aTarget, uMorph)`
   for a formation-morph feature that only the (unported) v2
   narrative page drives. With uMorph pinned at 0 that mix is
   the identity, so `position` is used directly — which also
   drops a dead 132 KB `aTarget` attribute upload.
   ════════════════════════════════════════════════════════════ */

const NOISE = /* glsl */ `
  float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float hash1(float n){ return fract(sin(n) * 43758.5453); }
  float noise(vec3 p){
    vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }`;

export const DUST_VERT = /* glsl */ `
  uniform float uTime, uBuild, uSize, uPixelRatio, uAxisFocus;
  uniform float uBreath, uThink, uMagStr, uShock;
  uniform float uFocus, uAperture, uMaxCoc, uMaxSize;
  uniform vec3 uMagnet, uShockPt;
  uniform float uAxes[5];
  attribute float aActivate, aSeed, aRadius, aSector;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;
  /* Circle of confusion, 0 = sharp, 1 = fully defocused. Drives the bokeh
     disc in the fragment stage. */
  varying float vCoc;
  /* Matches BODY_RADIUS in nebula.tsx — the glass body the dust rings. */
  const float BODY_R = 1.24;
  ${NOISE}
  void main(){
    float vis = smoothstep(aActivate - 0.10, aActivate + 0.10, uBuild);
    vec3 restBase = position;
    /* idle breathing — 20s cycle, outer shell moves more */
    restBase *= 1.0 + uBreath * (0.012 + 0.05 * aRadius);
    vec3 p = mix(restBase * 0.24, restBase, smoothstep(0.0, 1.0, vis));
    /* coherent flow — curl-style tangential swirl from a drifting noise
       gradient. Neighbours share the field: motion reads as one medium. */
    vec3 q = restBase * 0.85 + vec3(uTime * 0.045, uTime * 0.031, -uTime * 0.038);
    float e = 0.35;
    float n0 = noise(q);
    vec3 grad = vec3(noise(q + vec3(e, 0.0, 0.0)) - n0,
                     noise(q + vec3(0.0, e, 0.0)) - n0,
                     noise(q + vec3(0.0, 0.0, e)) - n0) / e;
    vec3 radial = normalize(restBase + vec3(1e-4));
    vec3 flow = normalize(cross(grad, radial) + vec3(1e-5));
    float amp = (0.03 + 0.05 * aRadius) * (1.0 + uThink * 1.8);
    p += flow * amp * (0.65 + 0.35 * sin(uTime * 0.5 + aSeed * 6.2831));
    /* magnetic surge — depth-aware: far particles react less */
    if (uMagStr > 0.01) {
      vec3 dm = uMagnet - p;
      float pull = exp(-dot(dm, dm) * 1.4) * uMagStr * mix(1.15, 0.3, aRadius);
      p += dm * pull * 0.32;
    }
    /* click shockwave — an expanding ring pushes and ignites the dust */
    float ring = 0.0;
    if (uShock >= 0.0) {
      float dsh = distance(p, uShockPt);
      float front = dsh - uShock * 2.6;
      ring = exp(-front * front * 22.0) * exp(-uShock * 1.15);
      p += normalize(p - uShockPt + vec3(1e-4)) * ring * 0.34;
    }
    /* readiness shape: each sector condenses toward the body (strong
       axis) or loosens outward (weak axis) */
    int si = int(aSector);
    float ax = uAxes[si];
    float condense = mix(1.28, 0.62, ax);
    p = mix(p, p * condense, smoothstep(0.15, 1.0, aRadius));
    float focus = (uAxisFocus > -0.5 && abs(uAxisFocus - aSector) < 0.5) ? 1.0 : 0.0;
    p += p * focus * 0.04 * sin(uTime * 3.0 + aSeed * 12.0);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float depth = -mv.z;

    /* ── lens: circle of confusion from the focal plane ──
       A thin-lens CoC, normalised. Particles at uFocus stay pinpoint; the
       further they sit from that plane the wider they open up. */
    float coc = clamp(abs(depth - uFocus) / uAperture, 0.0, 1.0);
    vCoc = coc;

    float twinkle = 0.78 + 0.34 * sin(uTime * (1.3 + uThink * 2.2) + aSeed * 30.0);

    /* ── sparkle ──
       About a third of the field catches the light now and then: each of those
       grains runs its own slow cycle and flares briefly. Deterministic per
       particle, so the field never flickers as a whole. */
    float takesPart = step(0.70, hash1(aSeed * 91.7));
    float sparkRate = 0.09 + hash1(aSeed * 13.3) * 0.17;
    float sparkPhase = fract(uTime * sparkRate + hash1(aSeed * 7.1));
    float spark = takesPart * pow(max(1.0 - abs(sparkPhase - 0.5) * 7.0, 0.0), 3.0);

    /* Note on sizing: this expression saturates. At uSize 10.5 and depth ~6 the
       perspective term alone puts it around 500px, so the CLAMP — not uSize —
       has always been the real size control. uMaxSize is that clamp, exposed. */
    float base = uSize * (0.35 + vis) * (0.55 + 0.9 * aSeed) * twinkle * (220.0 / depth) * uPixelRatio;
    /* Defocused points spread into discs rather than getting brighter. */
    float spread = 1.0 + coc * uMaxCoc;
    gl_PointSize = clamp(
      base * spread * (1.0 + spark * 2.2),
      0.0,
      uMaxSize * uPixelRatio * spread
    );

    vColor = aColor + vec3(0.25, 0.2, 0.1) * focus + vec3(0.32, 0.28, 0.16) * ring
           + vec3(0.45, 0.44, 0.38) * spark;
    /* Energy is conserved as the disc grows: a blurred point is dimmer, which
       is what stops the out-of-focus field from turning into milk. */
    float spreadFade = 1.0 / (1.0 + coc * coc * 2.6);

    /* ── hollow shell, measured on screen rather than in 3D ──
       Radius alone cannot tell "at the silhouette" from "in front of the
       face": a grain at r = 1.33 is at the limb when it sits off to the side
       and directly over the body when it does not. Both used to be brightened,
       which is what filled the disc with milk.

       So work perpendicular to the view axis through the sphere centre. The
       dust group shares the body's origin, so the centre in view space is just
       the origin through modelViewMatrix. */
    vec3 cView = (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    float perpR = length(mv.xy - cView.xy);
    /* Nearer the camera than the centre — i.e. in the layer that occludes. */
    float inFront = step(cView.z, mv.z);
    float overFace = 1.0 - smoothstep(0.45, BODY_R, perpR);
    /* Hold back the grains crossing the face, keep the ones ringing it. */
    float faceDim = 1.0 - inFront * overFace * 0.86;
    float limbRing = exp(-pow((perpR - BODY_R * 1.06) / 0.30, 2.0));

    vAlpha = vis * mix(0.55, 0.16, smoothstep(0.2, 1.0, aRadius))
           * faceDim * (1.0 + limbRing * 1.5)
           * (1.0 + focus * 0.5) * (1.0 + ring * 1.5) * spreadFade
           * (1.0 + spark * 3.0);
  }`;

export const DUST_FRAG = /* glsl */ `
  uniform float uLayer;
  varying vec3 vColor; varying float vAlpha; varying float vCoc;
  void main(){
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c) * 2.0;          // 0 at centre, 1 at the sprite edge
    if (d > 1.0) discard;

    /* In focus: a tight gaussian-ish point.
       Out of focus: a real bokeh disc — flat inside, hard-ish edge, and a
       brighter rim, which is what a lens actually does to a highlight. */
    float sharp = 1.0 - smoothstep(0.10, 1.0, d);

    float edge = fwidth(d) * 1.5 + 0.02;
    float disc = 1.0 - smoothstep(1.0 - edge, 1.0, d);
    float rim = smoothstep(0.55, 0.96, d) * (1.0 - smoothstep(0.96, 1.0, d));
    float bokeh = disc * (0.55 + rim * 1.35);

    float shape = mix(sharp, bokeh, smoothstep(0.12, 0.55, vCoc));

    /* Defocused highlights lose saturation the way a lens washes them out. */
    vec3 col = mix(vColor, vColor * 0.82 + vec3(0.06, 0.07, 0.09), vCoc * 0.6);

    gl_FragColor = vec4(col, shape * vAlpha * 0.82 * uLayer);
  }`;

/** Shared by every shell (body / energy / wave / halo). */
export const SPHERE_VERT = /* glsl */ `
  varying vec3 vN; varying vec3 vV; varying vec3 vW;
  void main(){
    vN = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vV = normalize(-mv.xyz);
    vW = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * mv;
  }`;

/** Dark glass: two crossed FBM octave sets, 4 baked ripples, specular. Writes
 *  depth, so it genuinely occludes the dust behind it. */
export const BODY_FRAG = /* glsl */ `
  uniform float uTime, uPresence, uHit, uEnergy;
  uniform vec3 uA, uB, uC, uMouseL, uCenter;
  varying vec3 vN, vV, vW;
  ${NOISE}
  void main(){
    if (uPresence < 0.02) discard;
    float fres = pow(1.0 - clamp(dot(vN, vV), 0.0, 1.0), 3.0);
    /* Near-black ambient. Anything above this and bloom lifts the whole disc
       into grey, which is exactly what the references do not do. */
    vec3 col = vec3(0.005, 0.007, 0.012);
    vec3 pn = normalize(vW - uCenter);
    vec3 q = pn * 2.3 + vec3(uTime * (0.018 + uEnergy * 0.02));
    float n = fbm(q);
    float micro = fbm(pn * 9.0 + n * 2.0 + uTime * 0.01);
    /* Held well down from the prototype's 0.17 / 0.10: the references keep the
       interior close to empty and let the rim carry the read. A filled body
       turns the sphere into a grey ball the moment bloom touches it. */
    col += mix(uA, uB, n) * n * (0.038 + uEnergy * 0.05);
    col += mix(uB, uC, micro) * micro * micro * 0.026;

    /* Fine animated speckle — photographic grain rather than plastic. Sampled
       in surface space so it sits ON the glass and turns with it. */
    float grain = hash(vec3(pn * 420.0 + floor(uTime * 24.0) * 1.7));
    col += (grain - 0.5) * 0.030 * (0.35 + uEnergy);
    float ripple = 0.0;
    for (int i = 0; i < 4; i++){
      float fi = float(i);
      float th = hash1(fi * 3.1) * 6.2832, ph = hash1(fi * 7.3) * 3.14159;
      vec3 src = vec3(sin(ph) * cos(th), sin(ph) * sin(th), cos(ph));
      float dist = acos(clamp(dot(pn, src), -1.0, 1.0));
      float t = mod(uTime * 0.38 + hash1(fi * 17.0) * 3.8, 3.8);
      float front = dist - t * 0.65;
      ripple += exp(-front * front * 60.0) * smoothstep(3.8, 1.0, t) * smoothstep(0.0, 0.12, t) * 0.28;
    }
    col += ripple * mix(uA, uB, 0.6) * (0.85 + uEnergy * 0.5);
    /* What the interior gives up, the edge takes back. */
    col += fres * mix(uA, uC, 0.32) * (1.75 + uEnergy * 0.55);
    /* touch — like a finger on water: clearer, cleaner, ringed */
    if (uHit > 0.01) {
      float ad = acos(clamp(dot(pn, normalize(uMouseL)), -1.0, 1.0));
      float prox = exp(-ad * ad * 7.5) * uHit;
      float wave = 0.5 + 0.5 * sin(ad * 30.0 - uTime * 5.2);
      float touch = prox * (0.5 + 0.5 * wave * exp(-ad * ad * 12.0));
      col = mix(col, col * 1.6 + mix(uB, uC, 0.45) * 0.22, prox);
      col += touch * mix(uB, uC, 0.5) * 0.55;
    }
    vec3 L = normalize(vec3(0.45, 0.85, 0.7));
    col += pow(max(dot(reflect(-vV, vN), L), 0.0), 46.0) * uC * 0.22;
    gl_FragColor = vec4(col, uPresence);
  }`;

/** Additive FBM wisps. */
export const ENERGY_FRAG = /* glsl */ `
  uniform float uTime, uPresence, uHit;
  uniform vec3 uA, uB, uC, uMouseL, uCenter;
  varying vec3 vN, vV, vW;
  ${NOISE}
  void main(){
    /* Exponent 2.8 -> 4.6. At 2.8 the fresnel still carries real weight halfway
       across the face, so the wisps washed the whole disc; tightening it pins
       them to the limb. The additive term below is raised to compensate, so the
       edge keeps its brightness while the middle goes dark. */
    float fres = pow(1.0 - clamp(dot(vN, vV), 0.0, 1.0), 4.6);
    vec3 q = (vW - uCenter) * 1.5 + vec3(0.0, uTime * 0.04, uTime * 0.06);
    float n = fbm(q);
    float n2 = fbm(q * 2.1 + n);
    vec3 col = mix(uA, uB, smoothstep(0.3, 0.75, n2));
    col = mix(col, uC, smoothstep(0.6, 0.9, n));
    col = mix(col * 0.04, col, fres) + fres * uC * 0.98;
    /* Base drops 0.32 -> 0.06: the wisps belong at the limb, not spread as a
       flat veil across the face. The fres term still carries the edge. */
    float alpha = clamp((0.06 + fres * 0.92), 0.0, 1.0) * uPresence * 0.62;
    if (uHit > 0.01) {
      float ad = acos(clamp(dot(normalize(vW - uCenter), normalize(uMouseL)), -1.0, 1.0));
      float prox = exp(-ad * ad * 7.5) * uHit;
      col += prox * uC * 0.35;
      alpha *= (1.0 + prox * 0.9);
    }
    gl_FragColor = vec4(col, alpha);
  }`;

/** Expanding rings from 9 sources. Nine `acos` per fragment — the most
 *  expensive shell, and the first one the mid tier drops. */
export const WAVE_FRAG = /* glsl */ `
  uniform float uTime, uPresence;
  uniform vec3 uA, uC;
  varying vec3 vN, vV, vW;
  ${NOISE}
  void main(){
    vec3 p = normalize(vW);
    float total = 0.0;
    for (int i = 0; i < 9; i++){
      float fi = float(i);
      float th = hash1(fi * 17.3 + 4.5) * 6.2832;
      float phv = acos(clamp(2.0 * hash1(fi * 9.1 + 1.2) - 1.0, -1.0, 1.0));
      vec3 src = vec3(sin(phv) * cos(th), sin(phv) * sin(th), cos(phv));
      float dist = acos(clamp(dot(p, src), -0.9999, 0.9999));
      float t = mod(uTime * 0.52 + hash1(fi * 23.7) * 4.0, 4.2);
      float front = dist - t * 0.62;
      total += exp(-front * front * 45.0) * smoothstep(0.0, 0.18, t) * smoothstep(4.2, 1.8, t);
    }
    /* Ripples read as travelling lines, not as a haze — halved so they stop
       contributing a constant floor across the disc. */
    gl_FragColor = vec4(mix(uA, uC, clamp(total, 0.0, 1.0)), clamp(total * 0.13, 0.0, 0.085) * uPresence);
  }`;

/**
 * The halo is a screen-facing quad, not a sphere. Three rewrites went into a
 * spherical shell before that changed, and all three failed the same way, so
 * the reason is worth keeping.
 *
 * A sphere cannot carry this falloff. Parameterise it on anything derived from
 * the surface normal — fresnel, or `sqrt(1 - dot(N,V)^2)` — and the parameter
 * stops being single-valued in screen space near the limb, because the surface
 * turns away and its projection folds back on itself. Concretely, for radius R
 * at distance D the projected radius peaks at p = R^2 / D and *decreases* after
 * it: at R 1.78 and D 6.443 the outermost pixel is 305px at p 1.70, while
 * p 1.78 lands back at 293px. Two surface points, one pixel, summed by additive
 * blending. Emitting the parameter as a colour and reading it back off the
 * frame showed it saturating near 0.95 instead of reaching 1.0 at the outline.
 *
 * What that cost, measured: a hard 2px step near the end of the fade, dropping
 * luminance ~51 to ~14 against a black floor of 12. Renormalising the varyings
 * did not move it. Reparameterising on exact perpendicular distance did not
 * move it. Pulling the falloff's end inward only moved the step inward with it
 * — 262px at OUT 0.93, 252px at OUT 0.87, same magnitude both times — because
 * the step is the fade running out of usable parameter, not hitting an edge.
 *
 * A camera-facing quad has none of that. Screen radius is the parameter, it is
 * exactly linear in pixels, and the geometry's own edge is never reached
 * because the curve is already at zero well inside it.
 */
export const HALO_VERT = /* glsl */ `
  uniform float uExtent;
  varying vec2 vUv;
  void main(){
    vUv = uv;
    /* The quad is built in view space from the mesh origin, so it faces the
       camera whatever the parent group is doing. That matters here: this mesh
       lives inside the rotating sphere group, and a plane that inherited that
       rotation would foreshorten into an ellipse. */
    vec3 c = (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vec2 off = (uv - 0.5) * 2.0 * uExtent;
    gl_Position = projectionMatrix * vec4(c.xy + off, c.z, 1.0);
  }`;
export const HALO_FRAG = /* glsl */ `
  uniform float uPresence, uExtent; uniform vec3 uA, uC;
  varying vec2 vUv;

  /* Both bounds are distances from the view axis, in world units, on a plane
     through the sphere's centre. Screen radius is r / dist / tan(fov/2) * H/2,
     so they scale with the camera exactly as the sphere does — CameraRig can
     move and the halo stays pinned to the glass.

     RIM is the body's outline. Not BODY_RADIUS itself: what the eye sees is the
     sphere's horizon, which sits at BODY_RADIUS / sqrt(1 - (BODY_RADIUS/dist)^2)
     when measured on this plane — 1.264 at dist 6.443, and within 2% of that
     across any distance this scene uses. Measured, the body's outline lands at
     208px and so does this. */
  const float RIM = 1.264;
  /* Where the fade is spent. 1.82 puts it at ~300 screen px, a 92px band. It is
     inside uExtent by design: the quad's own edge must never be reachable, or
     the plate-with-an-edge problem comes straight back as a square. */
  const float OUT = 1.82;

  void main(){
    /* The whole point of the quad: this is a real screen radius. It is linear
       in pixels, single-valued, and needs no normal — so a curve on it spans
       the number of pixels the arithmetic says it does. */
    float r = length(vUv - 0.5) * 2.0 * uExtent;
    float t = clamp((r - RIM) / (OUT - RIM), 0.0, 1.0);

    /* Atmospheric falloff. pow with an exponent above 1 lands on zero with zero
       slope, so the halo ends in black on its own terms. The coefficient is
       load-bearing rather than cosmetic: both bloom passes run at
       luminanceThreshold 0, so every unit of light emitted here gets smeared
       over the whole frame. An earlier version carried a ten-pixel shell's 0.42
       across a band nine times wider and measured a black floor of 63.7 against
       the correct 10.4 — the page went grey. */
    float glow = pow(1.0 - t, 2.2);
    /* The power curve alone is not enough, and the reason is perceptual rather
       than arithmetic: its tail is tiny in alpha but sRGB expands exactly that
       range, so it still reads. Painted red and measured on its own, the curve
       was still at 27% of peak luminance where the band ran out, which showed
       in the composite as a 2px step from 54 to 15 against a floor of 12. This
       spends the last 45% of the band so the curve arrives at OUT already at
       zero, with zero slope. */
    glow *= 1.0 - smoothstep(0.55, 1.0, t);
    /* Off the glass. This plane sits at the sphere's centre depth, so the body
       already depth-rejects it across the face; this gate is what keeps the
       transition at the rim smooth rather than letting it start on a hard
       depth boundary. */
    float face = smoothstep(RIM - 0.10, RIM, r);

    /* No rim term. There was one — a tight pow(f, 11) limb — and it is gone on
       purpose: BODY_FRAG's fresnel and ENERGY_FRAG's both peak at the body's own
       silhouette and already draw the crisp edge. A limb here drew a *second*
       ring outside the glass, and once the halo grew it became a 25px blown-white
       torus whose light was what bloom was spreading. This layer's only job is
       the air outside the sphere. */
    vec3 col = mix(uA, uC, 0.30) * 1.35;
    float alpha = glow * 0.26 * face * uPresence;
    gl_FragColor = vec4(col, alpha);
  }`;
