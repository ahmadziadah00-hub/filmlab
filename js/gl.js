/* gl.js — WebGL2 engine v2.
   S24 Ultra input profile -> scene (stills) code -> HDR gain-map highlights -> WB / exposure / DR / tone
   -> measured stills tone remap -> Fujifilm LUT -> colour settings -> Basic + look match; then finish:
   sharpen, clarity, halation, glow, expired film, vignette, light leak, grain. */
(function (root) {
  'use strict';

  const VS = `#version 300 es
in vec2 aPos; out vec2 vUV; uniform bool uFlipY;
void main(){ vUV = vec2(aPos.x*0.5+0.5, uFlipY ? aPos.y*0.5+0.5 : 0.5-aPos.y*0.5); gl_Position = vec4(aPos,0.0,1.0); }`;

  const COMMON = `
const mat3 M_P3_2020 = mat3(0.7538330,0.0457438,-0.0012103,0.1985974,0.9417772,0.0176017,0.0475696,0.0124789,0.9836086);
const mat3 M_709_2020 = mat3(0.6274039,0.0690973,0.0163914,0.3292830,0.9195404,0.0880133,0.0433131,0.0113623,0.8955953);
const mat3 M_P3_709 = mat3(1.2249402,-0.0420570,-0.0196376,-0.2249402,1.0420570,-0.0786360,0.0,0.0,1.0982736);
const vec3 Y2020 = vec3(0.2627, 0.677998, 0.059302);
const vec3 Y709 = vec3(0.212639, 0.715169, 0.072192);
float s2l(float v){ return v <= 0.04045 ? v/12.92 : pow((v+0.055)/1.055, 2.4); }
vec3 s2l(vec3 v){ return vec3(s2l(v.r), s2l(v.g), s2l(v.b)); }
float l2s(float x){ x = max(x, 0.0); return x <= 0.0031308 ? x*12.92 : 1.055*pow(x, 1.0/2.4) - 0.055; }
vec3 l2s(vec3 x){ return vec3(l2s(x.r), l2s(x.g), l2s(x.b)); }
const float FA=5.555556, FB=0.064829, FC=0.245281, FD=0.384316, FE=8.799461, FF=0.092864, FCUT=0.000889;
float fenc(float x){ return x >= FCUT ? FC*log(FA*x+FB)*0.4342944819 + FD : FE*x + FF; }
float fdec(float v){ return v >= FE*FCUT+FF ? (pow(10.0,(v-FD)/FC) - FB)/FA : (v-FF)/FE; }
vec3 fenc(vec3 x){ return vec3(fenc(x.r), fenc(x.g), fenc(x.b)); }
vec3 fdec(vec3 v){ return vec3(fdec(v.r), fdec(v.g), fdec(v.b)); }
vec3 toLab(vec3 c){
  vec3 lms = mat3(0.4122214708,0.2119034982,0.0883024619, 0.5363325363,0.6806995451,0.2817188376, 0.0514459929,0.1073969566,0.6299787005) * max(c, 0.0);
  lms = pow(lms, vec3(1.0/3.0));
  return mat3(0.2104542553,1.9779984951,0.0259040371, 0.7936177850,-2.4285922050,0.7827717662, -0.0040720468,0.4505937099,-0.8086757660) * lms;
}
vec3 fromLab(vec3 lab){
  vec3 lms = mat3(1.0,1.0,1.0, 0.3963377774,-0.1055613458,-0.0894841775, 0.2158037573,-0.0638541728,-1.2914855480) * lab;
  lms = lms*lms*lms;
  return mat3(4.0767416621,-1.2684380046,-0.0041960863, -3.3077115913,2.6097574011,-0.7034186147, 0.2309699292,-0.3413193965,1.7076147010) * lms;
}`;

  const FS_DEVELOP = `#version 300 es
precision highp float; precision highp sampler3D;
in vec2 vUV; out vec4 outColor;
uniform sampler2D uSrc; uniform sampler2D uInv; uniform sampler3D uLut;
uniform sampler2D uPTab; uniform sampler2D uPinv; uniform sampler2D uImp; uniform sampler2D uGain;
uniform vec4 uCrop; uniform float uSat[17]; uniform float uHL0, uHL1, uPDom, uKnee;
uniform bool uIsP3, uBypass, uMono, uHasGain;
uniform float uGainMin, uGainMax, uGainGammaInv, uGainBase, uHdr; uniform int uGainOrient;
uniform vec3 uGains; uniform float uDR, uShadow, uHigh, uColor; uniform int uCC, uCCB; uniform vec2 uTone;
uniform float uLutN, uDom; uniform bool uSceneLut;
uniform bool uBasicOn, uHslOn; uniform vec4 uB1, uB2; uniform float uHH[8], uHS[8], uHL[8];
// radial masks (up to 3): geometry in short-side units, rotation/feather/invert, exposure+warmth gain, tone, saturation, clarity
uniform int uMaskN, uMaskShow; uniform vec2 uMaskAsp; uniform vec4 uMGeo[4], uMRot[4], uMB1[4]; uniform vec3 uMGain[4];
uniform float uMSat[4], uMClar[4]; uniform bool uAlphaClar;
${COMMON}
const float HC[8] = float[](0.506, 1.047, 1.833, 2.478, 3.403, 4.538, 5.149, 5.760);
float inv1(float y){ float x = clamp(y,0.0,1.0)*1023.0; return texture(uInv, vec2((x+0.5)/1024.0, 0.5)).r; }
float pinv(float v){ float x = clamp(v,0.0,1.0)*511.0; return texture(uPinv, vec2((x+0.5)/512.0, 0.5)).r; }
float ptab(float v){ float x = clamp(v/uPDom,0.0,1.0)*511.0; return texture(uPTab, vec2((x+0.5)/512.0, 0.5)).r; }
float impAt(float y){ float x = clamp(y,0.0,1.0)*64.0; return texture(uImp, vec2((x+0.5)/65.0, 0.5)).r; }
float satAt(float y){ float x = clamp(y,0.0,1.0)*16.0; int i = int(min(floor(x),15.0)); return mix(uSat[i], uSat[i+1], x-float(i)); }
vec2 guv(vec2 uv){
  if (uGainOrient == 6) return vec2(uv.y, 1.0-uv.x);
  if (uGainOrient == 8) return vec2(1.0-uv.y, uv.x);
  if (uGainOrient == 3) return vec2(1.0-uv.x, 1.0-uv.y);
  return uv;
}
float maskW(int i, vec2 uv){
  vec2 p = uv*uMaskAsp - uMGeo[i].xy;
  float w;
  if (uMGeo[i].w < 0.0){
    // linear: full effect behind the start line, none past the end line, a smooth band in between
    w = 1.0 - smoothstep(-0.5, 0.5, dot(p, uMRot[i].xy) / max(uMGeo[i].z, 1e-4));
  } else {
    vec2 r = vec2(uMRot[i].x*p.x + uMRot[i].y*p.y, -uMRot[i].y*p.x + uMRot[i].x*p.y) / max(uMGeo[i].zw, vec2(1e-4));
    w = 1.0 - smoothstep(1.0 - max(uMRot[i].z, 0.02), 1.0, length(r));
  }
  return uMRot[i].w > 0.5 ? 1.0 - w : w;
}
void main(){
  vec2 uv = uCrop.xy + vUV*uCrop.zw;
  vec3 c = texture(uSrc, uv).rgb;
  float wm[4]; for (int i = 0; i < 4; i++) wm[i] = i < uMaskN ? maskW(i, uv) : 0.0;
  vec3 lin = s2l(c);
  if (uBypass){ outColor = vec4(l2s(clamp(uIsP3 ? M_P3_709*lin : lin, 0.0, 1.0)), 1.0); return; }
  // ---- S24 Ultra input profile: display-referred P3 -> video LUT code (PROVIA-anchored) ----
  vec3 l2 = max(uIsP3 ? M_P3_2020*lin : M_709_2020*lin, 0.0);
  float Y = dot(l2, Y2020); float yd = l2s(Y);
  l2 = max(vec3(Y) + satAt(yd)*(l2 - vec3(Y)), 0.0);
  vec3 en = l2s(l2);
  vec3 vpc = vec3(inv1(en.r), inv1(en.g), inv1(en.b));
  vec3 vrp = fenc(l2 * (fdec(inv1(yd)) / max(Y, 1e-6)));
  vec3 v = mix(vpc, vrp, smoothstep(uHL0, uHL1, yd));
  // ---- to stills scene code (inverse of the stills tone remap measured on X100VI) ----
  vec3 vs = vec3(pinv(v.r), pinv(v.g), pinv(v.b));
  // ---- HDR gain map: recover highlight range Samsung compressed beyond the stills shoulder ----
  if (uHasGain && uHdr > 0.0){
    float g = texture(uGain, guv(uv)).r;
    float lb = mix(uGainMin, uGainMax, pow(g, uGainGammaInv));
    float re = max(max(lb - uGainBase, 0.0)*uHdr - impAt(yd), 0.0);
    if (re > 0.0) vs = fenc(fdec(vs) * exp2(re));
  }
  // ---- scene-linear: white balance + exposure (and each mask's own exposure and warmth) ----
  vec3 gg = uGains;
  for (int i = 0; i < 4; i++) if (i < uMaskN) gg *= mix(vec3(1.0), uMGain[i], wm[i]);
  vs = fenc(max(fdec(vs) * gg, vec3(0.0)));
  // ---- dynamic range (DR200/400): stretch the highlight shoulder by 1/2 stops ----
  if (uDR < 0.999){ vec3 x = vs - uKnee; vs -= (1.0-uDR) * 0.5*(x + sqrt(x*x + 0.0016)); }
  // ---- highlight / shadow tone ----
  vec3 d = vs - 0.391; vec3 t = smoothstep(-0.06, 0.06, d);
  vs = 0.391 + d * ((1.0-t)*(1.0+0.07*uShadow) + t*(1.0+0.07*uHigh));
  // ---- stills tone remap -> Fujifilm film simulation LUT ----
  // (Kodak looks are baked on the scene code itself: their own film + print response does the tone mapping)
  vec3 v2 = uSceneLut ? vs : vec3(ptab(vs.r), ptab(vs.g), ptab(vs.b));
  vec3 q = clamp(v2, 0.0, uDom)/uDom; q = q*((uLutN-1.0)/uLutN) + 0.5/uLutN;
  vec3 o = texture(uLut, q).rgb;
  // ---- display-space colour settings ----
  if (!uMono){
    if (uColor != 1.0 || uCC > 0 || uCCB > 0){
      vec3 lab = toLab(s2l(o)); float C = length(lab.yz); float h = atan(lab.z, lab.y);
      lab.yz *= uColor;
      if (uCC > 0){ float k = uCC==1 ? 0.07 : 0.14; float f = smoothstep(0.07,0.18,C)*smoothstep(-0.55,-0.2,h)*(1.0-smoothstep(2.75,3.05,h)); lab.x -= k*f*lab.x; lab.yz *= 1.0+0.35*k*f; }
      if (uCCB > 0){ float k = uCCB==1 ? 0.07 : 0.14; float f = smoothstep(0.05,0.15,C)*smoothstep(-2.95,-2.55,h)*(1.0-smoothstep(-1.15,-0.75,h)); lab.x -= k*f*lab.x; lab.yz *= 1.0+0.35*k*f; }
      o = l2s(clamp(fromLab(lab), 0.0, 1.0));
    }
  } else if (uTone != vec2(0.0)){
    vec3 lab = toLab(s2l(o));
    float m = smoothstep(0.02,0.25,lab.x)*(1.0-0.4*smoothstep(0.7,1.0,lab.x));
    lab.z += uTone.x*0.0035*m; lab.y += uTone.y*0.0028*m;
    o = l2s(clamp(fromLab(lab), 0.0, 1.0));
  }
  // ---- Basic adjustments (your own corrections, kept apart from the film settings) ----
  vec4 b1 = uB1, b2 = uB2;
  for (int i = 0; i < 4; i++) if (i < uMaskN){ b1 += wm[i]*uMB1[i]; b2.z += wm[i]*uMSat[i]; }
  if (uBasicOn || uMaskN > 0 || (uHslOn && !uMono)){
    vec3 lab = toLab(s2l(o));
    if (uBasicOn || uMaskN > 0){
      float x = clamp(lab.x, 0.0, 1.0), y = x; const float PV = 0.565;
      y += 1.6*b1.x * x*(x-PV)*(1.0-x);                                      // contrast around mid grey
      float u = clamp((x-PV)/(1.0-PV), 0.0, 1.0); y += b1.y*0.64*u*(1.0-u)*(1.0-PV);    // highlights
      float w = clamp(x/PV, 0.0, 1.0);          y += b1.z*0.64*w*(1.0-w)*PV;            // shadows
      y += b1.w*0.12*x*x*x;                                                    // whites
      y += b2.x*0.10*(1.0-x)*(1.0-x)*(1.0-x);                                  // blacks
      y = max(y, 0.0);
      lab.yz *= mix(1.0, clamp(y/max(x, 1e-4), 0.0, 2.0), 0.5);
      lab.x = y;
      if (!uMono){
        float C = length(lab.yz), h = atan(lab.z, lab.y);
        float skin = smoothstep(0.35, 0.65, h)*(1.0 - smoothstep(1.05, 1.35, h));
        float vb = b2.y*(1.0 - smoothstep(0.02, 0.20, C))*(1.0 - 0.5*skin);
        lab.yz *= max(0.0, 1.0 + b2.z + vb);
        if (b2.w > 0.0){                                                         // look match: roll off the most saturated colours
          float Cr = length(lab.yz);
          if (Cr > 0.09){ float xr = Cr - 0.09; lab.yz *= mix(1.0, (0.09 + xr/(1.0 + xr/0.09))/Cr, b2.w); }
        }
      }
    }
    if (uHslOn && !uMono){
      float C = length(lab.yz), h = atan(lab.z, lab.y); if (h < 0.0) h += 6.2831853;
      float dh = 0.0, ds = 0.0, dl = 0.0, ws = 0.0;
      for (int i = 0; i < 8; i++){
        float d = abs(h - HC[i]); d = min(d, 6.2831853 - d);
        float wg = cos(clamp(d/0.55, 0.0, 1.5707963)); wg *= wg;
        dh += wg*uHH[i]; ds += wg*uHS[i]; dl += wg*uHL[i]; ws += wg;
      }
      if (ws > 1.0){ dh /= ws; ds /= ws; dl /= ws; }
      float g = smoothstep(0.015, 0.06, C);
      h += dh*0.52*g; C *= max(0.0, 1.0 + ds*g);
      lab.x += dl*0.12*g*smoothstep(0.0, 0.25, lab.x);
      lab.yz = C*vec2(cos(h), sin(h));
    }
    o = l2s(clamp(fromLab(lab), 0.0, 1.0));
  }
  // the selected mask shown in red while you place it (never in an export)
  if (uMaskShow >= 0 && uMaskShow < uMaskN) o = mix(o, vec3(0.93, 0.16, 0.2), 0.5*wm[uMaskShow]);
  float ca = 0.0; for (int i = 0; i < 4; i++) if (i < uMaskN) ca += wm[i]*uMClar[i];
  outColor = vec4(clamp(o,0.0,1.0), uAlphaClar ? ca : 1.0);
}`;

  // per-pixel energy at full size: r = luminance (clarity), g = highlight energy (halation), b = light energy (glow).
  // It is mipmapped before the downsample, so every pixel counts — a small lamp glows the same at any output size.
  const FS_ENERGY = `#version 300 es
precision highp float; in vec2 vUV; out vec4 outColor; uniform sampler2D uTex;
const vec3 Y709 = vec3(0.212639, 0.715169, 0.072192);
void main(){
  vec3 c = texture(uTex, vUV).rgb;
  float m = max(max(c.r, c.g), c.b);
  outColor = vec4(dot(c, Y709), pow(smoothstep(0.62, 1.0, m), 1.6), pow(smoothstep(0.86, 1.0, m), 2.0), 1.0);
}`;

  // downsample (the energy map's mip levels already hold the averages)
  const FS_DOWN = `#version 300 es
precision highp float; in vec2 vUV; out vec4 outColor; uniform sampler2D uTex; uniform vec2 uStep;
void main(){
  vec3 s = vec3(0.0);
  for (int j=-1;j<=1;j+=2) for (int i=-1;i<=1;i+=2) s += texture(uTex, vUV + vec2(float(i),float(j))*uStep).rgb;
  outColor = vec4(s*0.25, 1.0);
}`;

  const FS_BLUR = `#version 300 es
precision highp float; in vec2 vUV; out vec4 outColor; uniform sampler2D uTex; uniform vec2 uDir;
void main(){
  float w[5] = float[](0.2270270, 0.1945946, 0.1216216, 0.0540540, 0.0162162);
  vec3 s = texture(uTex, vUV).rgb * w[0];
  for (int i=1;i<5;i++){ s += texture(uTex, vUV + uDir*float(i)).rgb*w[i]; s += texture(uTex, vUV - uDir*float(i)).rgb*w[i]; }
  outColor = vec4(s, 1.0);
}`;

  const FS_FINISH = `#version 300 es
precision highp float; in vec2 vUV; out vec4 outColor;
uniform sampler2D uColor; uniform sampler2D uBlur; uniform vec2 uTexel;
uniform float uClarity, uSharp, uSeed; uniform bool uUseBlur, uPlain, uMaskClar;
uniform float uGrainAmt, uGrainCell, uGrainRough, uGrainChroma; uniform vec3 uGrainW;
uniform float uHal, uBloom, uVig, uLeak, uExp, uAspect; uniform int uLeakStyle, uExpTint;
const vec3 Y709 = vec3(0.212639, 0.715169, 0.072192);
uint hash(uvec3 x){ x = x*1664525u + 1013904223u; x.x += x.y*x.z; x.y += x.z*x.x; x.z += x.x*x.y; x ^= x>>16u; x.x += x.y*x.z; x.y += x.z*x.x; x.z += x.x*x.y; return x.x ^ x.y ^ x.z; }
float rnd(vec2 p){ return float(hash(uvec3(uvec2(ivec2(floor(p)) + 32768), uint(uSeed)))) / 4294967295.0; }
float gnoise(vec2 p){ return (rnd(p) + rnd(p+vec2(91.0,17.0)) + rnd(p+vec2(-33.0,57.0)) - 1.5) * 2.0; }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(gnoise(i), gnoise(i+vec2(1,0)), f.x), mix(gnoise(i+vec2(0,1)), gnoise(i+vec2(1,1)), f.x), f.y); }
float h1(float n){ return fract(sin(n*12.9898 + 78.233)*43758.5453); }
vec3 tintLo(int k){ return k==1 ? vec3(0.45,-0.35,0.25) : k==2 ? vec3(-0.45,0.15,0.35) : vec3(0.5,0.12,-0.6); }
vec3 tintHi(int k){ return k==1 ? vec3(0.30,-0.20,0.05) : k==2 ? vec3(0.25,0.20,-0.45) : vec3(0.35,0.25,-0.6); }
void main(){
  vec3 c = texture(uColor, vUV).rgb;
  if (uPlain){ outColor = vec4(c,1.0); return; }
  if (uSharp != 0.0){
    vec3 n = texture(uColor, vUV+vec2(uTexel.x,0.0)).rgb + texture(uColor, vUV-vec2(uTexel.x,0.0)).rgb
           + texture(uColor, vUV+vec2(0.0,uTexel.y)).rgb + texture(uColor, vUV-vec2(0.0,uTexel.y)).rgb;
    vec3 b = (c*4.0 + n)/8.0;
    c = uSharp > 0.0 ? c + 0.32*uSharp*(c-b) : mix(c, b, -0.16*uSharp);
  }
  float L = dot(c, Y709);
  vec3 bl = uUseBlur ? texture(uBlur, vUV).rgb : vec3(L, 0.0, 0.0);
  vec2 asp = vec2(min(uAspect, 1.0)/uAspect, min(uAspect, 1.0)) ;
  float cla = uClarity + (uMaskClar ? texture(uColor, vUV).a : 0.0);
  if (uUseBlur && cla != 0.0) c += cla*0.11*(L-bl.x)*clamp(4.0*L*(1.0-L), 0.0, 1.0);
  // halation: red-orange bloom bleeding from bright highlights into their surroundings
  if (uUseBlur && uHal > 0.0){
    float Lc = clamp(dot(c, Y709), 0.0, 1.0);
    float hl = pow(smoothstep(0.62, 1.0, max(max(c.r, c.g), c.b)), 1.6);
    float spill = max(bl.y - hl, 0.0);                     // light scattered past the highlight's own edge
    c += uHal * (1.25 * spill * (1.0 - 0.9*Lc) + 0.03 * hl) * vec3(1.0, 0.27, 0.10);
  }
  // glow: light from lamps and blown highlights spreading softly, like a diffusion filter (warm white)
  if (uUseBlur && uBloom > 0.0){
    float own = pow(smoothstep(0.86, 1.0, max(max(c.r, c.g), c.b)), 2.0);
    float wide = 0.0;
    for (int k = 0; k < 8; k++){ float a = float(k)*0.785398; wide += texture(uBlur, vUV + vec2(cos(a), sin(a))*asp*0.045).b; }
    float spill = max(0.55*bl.z + 0.45*wide*0.125 - 0.35*own, 0.0);
    vec3 add = clamp(uBloom * 1.6 * spill * vec3(1.0, 0.86, 0.68), 0.0, 1.0);
    c = 1.0 - (1.0 - clamp(c, 0.0, 1.0)) * (1.0 - add);
  }
  // expired film: faded blacks, lower saturation, cross-processed tints
  if (uExp > 0.0){
    float e = uExp; float Lx = clamp(dot(c, Y709), 0.0, 1.0);
    c = mix(c, vec3(Lx), 0.24*e);
    c = c*(1.0 - 0.11*e) + 0.075*e;
    c += e*(tintLo(uExpTint)*(1.0-Lx)*(1.0-Lx)*0.11 + tintHi(uExpTint)*Lx*Lx*0.07);
  }
  // vignette (negative = lighter corners)
  if (uVig != 0.0){
    vec2 p = (vUV - 0.5)*2.0;
    float r2 = dot(p, p)*0.5;
    float m = smoothstep(0.18, 1.05, r2);
    c = uVig > 0.0 ? c * (1.0 - 0.62*uVig*m) : mix(c, vec3(1.0), -0.45*uVig*m);
  }
  // light leak: warm exposure creeping in from an edge
  if (uLeak > 0.0){
    float sd = uSeed*0.618;
    int st = uLeakStyle;
    if (st == 4) st = int(floor(h1(sd)*4.0));
    vec2 p = vUV; float dd, al;
    if (st == 0){ dd = p.x; al = p.y; } else if (st == 1){ dd = 1.0-p.x; al = p.y; }
    else if (st == 2){ dd = p.y; al = p.x; } else { dd = length((p - vec2(1.0, 0.0))*vec2(uAspect, 1.0))/max(uAspect,1.0)*0.9; al = atan(p.y, 1.0-p.x)/1.5708; }
    float wv = 0.05*sin(al*7.0 + sd*9.1) + 0.035*sin(al*17.0 + sd*3.7);
    float w = 0.22 + 0.10*h1(sd+1.7) + wv;
    float core = exp(-pow(max(dd, 0.0)/max(w, 0.05), 1.6));
    float cen = 0.2 + 0.6*h1(sd+4.2);
    float along = st == 3 ? 1.0 : exp(-pow((al - cen)/0.42, 2.0));
    float a = clamp(uLeak * core * (0.45 + 0.55*along), 0.0, 1.0);
    vec3 col = mix(vec3(0.95,0.18,0.10), vec3(1.0,0.72,0.36), core*core);
    c = 1.0 - (1.0-clamp(c,0.0,1.0))*(1.0 - col*a);
  }
  // grain: multi-scale organic noise, separate response in shadows / midtones / highlights
  if (uGrainAmt > 0.0){
    vec2 px = vUV/uTexel; float cell = max(uGrainCell, 0.35);
    float n1 = vnoise(px/cell), n2 = vnoise(px/(cell*2.2)+vec2(17.3,5.1)), n3 = vnoise(px/(cell*4.7)-vec2(41.7,9.3));
    float r = uGrainRough;
    float n = n1*(0.55+0.45*r) + n2*(0.45-0.15*r) + n3*(0.25-0.15*r);
    float clump = 0.78 + 0.44*clamp(vnoise(px/(cell*9.0)+vec2(93.1,7.7))*0.5+0.5, 0.0, 1.0);
    float Lg = clamp(dot(c, Y709), 0.0, 1.0);
    float ws = 1.0 - smoothstep(0.08, 0.45, Lg), wh = smoothstep(0.55, 0.92, Lg), wm = max(1.0 - ws - wh, 0.0);
    float tone = dot(vec3(ws, wm, wh), uGrainW) * smoothstep(0.0, 0.05, Lg) * (1.0 - smoothstep(0.965, 1.0, Lg));
    vec3 g = vec3(n);
    if (uGrainChroma > 0.0){
      vec3 cn = vec3(vnoise(px/cell+vec2(11.1,3.3)), vnoise(px/cell+vec2(23.7,8.9)), vnoise(px/cell+vec2(37.3,1.9)));
      g += uGrainChroma*0.85*(cn - vec3((cn.r+cn.g+cn.b)/3.0));
    }
    c += g * uGrainAmt * tone * clump;
  }
  outColor = vec4(clamp(c,0.0,1.0), 1.0);
}`;

  class Engine {
    constructor(canvas) {
      const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
      if (!gl) throw new Error('WebGL2 is not available in this browser.');
      this.gl = gl; this.canvas = canvas;
      this.floatRT = !!gl.getExtension('EXT_color_buffer_float');
      gl.getExtension('OES_texture_float_linear');
      this.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      this.progs = { develop: this._prog(FS_DEVELOP), energy: this._prog(FS_ENERGY), down: this._prog(FS_DOWN), blur: this._prog(FS_BLUR), finish: this._prog(FS_FINISH) };
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      this.vao = gl.createVertexArray(); gl.bindVertexArray(this.vao);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      this.luts = {}; this.rts = {};
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      this.dummy = this._tex1d([0]);
    }
    _prog(fs) {
      const gl = this.gl;
      const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      const p = gl.createProgram();
      gl.attachShader(p, mk(gl.VERTEX_SHADER, VS)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
      gl.bindAttribLocation(p, 0, 'aPos'); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); const name = a.name.replace('[0]', ''); u[name] = gl.getUniformLocation(p, a.name); }
      return { p, u };
    }
    _tex1d(vals) {
      const gl = this.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, vals.length, 1, 0, gl.RED, gl.FLOAT, new Float32Array(vals));
      this._params(gl.TEXTURE_2D, gl.LINEAR);
      return t;
    }
    setInputProfile(p) {
      this.invTex = this._tex1d(p.inv);
      this.pTex = this._tex1d(p.P); this.pinvTex = this._tex1d(p.Pinv); this.impTex = this._tex1d(p.imp);
      this.sat = new Float32Array(p.sat); this.hl0 = p.hl0; this.hl1 = p.hl1; this.pDom = p.pDom; this.knee = p.knee;
      this.drSig = { 100: 1, 200: p.dr200, 400: p.dr400 };
    }
    _params(target, filter, mip) {
      const gl = this.gl;
      gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : filter);
      gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(target, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(target, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (target === gl.TEXTURE_3D) gl.texParameteri(target, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    }
    loadLut(id, u16, n, dom, scene) {
      if (this.luts[id]) this.gl.deleteTexture(this.luts[id].tex);   // a film replaced (e.g. by the pack)
      const gl = this.gl; const f = new Float32Array(u16.length);
      for (let i = 0; i < u16.length; i++) f[i] = u16[i] / 65535;
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_3D, t);
      gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGB16F, n, n, n, 0, gl.RGB, gl.FLOAT, f);
      this._params(gl.TEXTURE_3D, gl.LINEAR);
      this.luts[id] = { tex: t, n, dom, scene: !!scene };
    }
    texFromBitmap(bmp, mip) {
      const gl = this.gl; const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, bmp);
      if (mip) gl.generateMipmap(gl.TEXTURE_2D);
      this._params(gl.TEXTURE_2D, gl.LINEAR, mip);
      return { tex: t, w: bmp.width, h: bmp.height };
    }
    deleteTex(t) { if (t && t.tex) this.gl.deleteTexture(t.tex); }
    _rt(key, w, h, float, mip) {
      const gl = this.gl; let r = this.rts[key];
      if (r && r.w === w && r.h === h && r.float === float && r.mip === !!mip) return r;
      if (r) { gl.deleteTexture(r.tex); gl.deleteFramebuffer(r.fb); }
      const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      const useF = float && this.floatRT;
      const levels = mip ? Math.floor(Math.log2(Math.max(w, h))) + 1 : 1;
      gl.texStorage2D(gl.TEXTURE_2D, levels, useF ? gl.RGBA16F : gl.RGBA8, w, h);
      this._params(gl.TEXTURE_2D, gl.LINEAR, mip);
      const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      r = this.rts[key] = { tex, fb, w, h, float, mip: !!mip };
      return r;
    }
    releaseRT(key) { const r = this.rts[key]; if (r) { this.gl.deleteTexture(r.tex); this.gl.deleteFramebuffer(r.fb); delete this.rts[key]; } }
    _draw(target, w, h, vp) {
      const gl = this.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
      if (vp) gl.viewport(vp[0], vp[1], vp[2], vp[3]); else gl.viewport(0, 0, w, h);
      gl.bindVertexArray(this.vao); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    develop(src, P, target, w, h, opts) {
      const gl = this.gl, pr = this.progs.develop, u = pr.u; opts = opts || {};
      const lut = this.luts[P.lut] || this.luts.provia;
      gl.useProgram(pr.p);
      const bind = (unit, target, tex, loc) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(target, tex); gl.uniform1i(loc, unit); };
      bind(0, gl.TEXTURE_2D, src.tex, u.uSrc);
      bind(1, gl.TEXTURE_2D, this.invTex, u.uInv);
      bind(2, gl.TEXTURE_3D, lut.tex, u.uLut);
      bind(3, gl.TEXTURE_2D, this.pTex, u.uPTab);
      bind(4, gl.TEXTURE_2D, this.pinvTex, u.uPinv);
      bind(5, gl.TEXTURE_2D, this.impTex, u.uImp);
      const gm = P.gain;
      bind(6, gl.TEXTURE_2D, gm && gm.tex ? gm.tex.tex : this.dummy, u.uGain);
      const c = opts.crop || [0, 0, 1, 1];
      gl.uniform4f(u.uCrop, c[0], c[1], c[2], c[3]);
      gl.uniform1fv(u.uSat, this.sat); gl.uniform1f(u.uHL0, this.hl0); gl.uniform1f(u.uHL1, this.hl1);
      gl.uniform1f(u.uPDom, this.pDom); gl.uniform1f(u.uKnee, this.knee);
      gl.uniform1i(u.uIsP3, P.isP3 ? 1 : 0); gl.uniform1i(u.uBypass, opts.bypass ? 1 : 0); gl.uniform1i(u.uMono, P.mono ? 1 : 0);
      gl.uniform1i(u.uHasGain, gm && gm.tex ? 1 : 0);
      gl.uniform1f(u.uGainMin, gm ? gm.min : 0); gl.uniform1f(u.uGainMax, gm ? gm.max : 0); gl.uniform1f(u.uGainGammaInv, gm ? 1 / (gm.gamma || 1) : 1);
      gl.uniform1f(u.uGainBase, gm ? gm.base : 0); gl.uniform1f(u.uHdr, P.hdr || 0); gl.uniform1i(u.uGainOrient, gm ? gm.orient : 1);
      gl.uniform3fv(u.uGains, P.gains); gl.uniform1f(u.uDR, this.drSig[P.dr] || 1); gl.uniform1f(u.uShadow, P.shadow); gl.uniform1f(u.uHigh, P.highlight);
      gl.uniform1f(u.uColor, P.colorScale); gl.uniform1i(u.uCC, P.cc); gl.uniform1i(u.uCCB, P.ccb);
      gl.uniform2f(u.uTone, P.wc, P.mg); gl.uniform1f(u.uLutN, lut.n); gl.uniform1f(u.uDom, lut.dom); gl.uniform1i(u.uSceneLut, lut.scene ? 1 : 0);
      const B = P.basic || [0, 0, 0, 0, 0, 0, 0], H = P.hsl;
      gl.uniform1i(u.uBasicOn, B.some(v => v !== 0) ? 1 : 0);
      gl.uniform4f(u.uB1, B[0], B[1], B[2], B[3]); gl.uniform4f(u.uB2, B[4], B[5], B[6], B[7] || 0);
      gl.uniform1i(u.uHslOn, H ? 1 : 0);
      if (H) { gl.uniform1fv(u.uHH, H[0]); gl.uniform1fv(u.uHS, H[1]); gl.uniform1fv(u.uHL, H[2]); }
      const MK = ((!opts.bypass && P.masks) || []).slice(0, 4);
      gl.uniform1i(u.uMaskN, MK.length); gl.uniform1i(u.uMaskShow, P.maskShow != null && MK.length ? P.maskShow : -1);
      gl.uniform1i(u.uAlphaClar, opts.alphaClar ? 1 : 0);
      if (MK.length) {
        const f = (k, n) => { const a = []; for (let i = 0; i < 4; i++) { const m = MK[i]; for (let j = 0; j < n; j++) a.push(m ? (n === 1 ? m[k] : m[k][j]) : 0); } return a; };
        gl.uniform2f(u.uMaskAsp, P.maskAsp[0], P.maskAsp[1]);
        gl.uniform4fv(u.uMGeo, f('geo', 4)); gl.uniform4fv(u.uMRot, f('rot', 4)); gl.uniform4fv(u.uMB1, f('b1', 4));
        gl.uniform3fv(u.uMGain, f('gain', 3)); gl.uniform1fv(u.uMSat, f('sat', 1)); gl.uniform1fv(u.uMClar, f('clar', 1));
      }
      gl.uniform1i(u.uFlipY, opts.flipY ? 1 : 0);
      this._draw(target, w, h);
    }
    // blur maps at a fixed size relative to the picture (short side 128), so clarity, halation and glow
    // look the same in the preview and in every export size
    blurMaps(colorRT, w, h) {
      const gl = this.gl, sc = Math.min(1, 128 / Math.min(w, h));
      const bw = Math.max(8, Math.round(w * sc)), bh = Math.max(8, Math.round(h * sc));
      // create every target first: creating a texture binds it to the active unit
      const e = this._rt('energy', w, h, false, true), a = this._rt('blurA', bw, bh, true), b = this._rt('blurB', bw, bh, true);
      let pr = this.progs.energy; gl.useProgram(pr.p);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, colorRT.tex); gl.uniform1i(pr.u.uTex, 0); gl.uniform1i(pr.u.uFlipY, 1);
      this._draw(e, w, h);
      gl.bindTexture(gl.TEXTURE_2D, e.tex); gl.generateMipmap(gl.TEXTURE_2D);
      pr = this.progs.down; gl.useProgram(pr.p);
      gl.uniform1i(pr.u.uTex, 0); gl.uniform2f(pr.u.uStep, 0.25 / bw, 0.25 / bh); gl.uniform1i(pr.u.uFlipY, 1);
      this._draw(a, bw, bh);
      pr = this.progs.blur; gl.useProgram(pr.p); gl.uniform1i(pr.u.uFlipY, 1);
      gl.bindTexture(gl.TEXTURE_2D, a.tex); gl.uniform1i(pr.u.uTex, 0); gl.uniform2f(pr.u.uDir, 1 / bw, 0); this._draw(b, bw, bh);
      gl.bindTexture(gl.TEXTURE_2D, b.tex); gl.uniform2f(pr.u.uDir, 0, 1 / bh); this._draw(a, bw, bh);
      return a;
    }
    finish(colorRT, blurRT, P, target, w, h, opts) {
      const gl = this.gl, pr = this.progs.finish, u = pr.u; opts = opts || {};
      gl.useProgram(pr.p);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, colorRT.tex); gl.uniform1i(u.uColor, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, blurRT ? blurRT.tex : colorRT.tex); gl.uniform1i(u.uBlur, 1);
      gl.uniform2f(u.uTexel, 1 / w, 1 / h);
      gl.uniform1f(u.uClarity, P.clarity); gl.uniform1f(u.uSharp, (P.sharp || 0) + (opts.extraSharp || 0));
      gl.uniform1i(u.uUseBlur, blurRT ? 1 : 0); gl.uniform1i(u.uPlain, opts.plain ? 1 : 0);
      gl.uniform1i(u.uMaskClar, !opts.bypass && P.masks && P.masks.some(m => m.clar) ? 1 : 0);
      // grain is defined relative to the picture, so every output size shows the same texture
      const short = Math.min(w, h), cellPx = (P.grainSize || 1) * short / 2000;
      const amt = (P.grain || 0) / 100 * 0.06 * Math.min(1, Math.max(cellPx, 0.35) / 1.0);
      gl.uniform1f(u.uGrainAmt, amt); gl.uniform1f(u.uGrainCell, cellPx);
      gl.uniform1f(u.uGrainRough, (P.grainRough == null ? 50 : P.grainRough) / 100); gl.uniform1f(u.uGrainChroma, (P.grainColor || 0) / 100);
      gl.uniform3f(u.uGrainW, (P.grainS == null ? 90 : P.grainS) / 100, (P.grainM == null ? 100 : P.grainM) / 100, (P.grainH == null ? 45 : P.grainH) / 100);
      gl.uniform1f(u.uHal, (P.hal || 0) / 100); gl.uniform1f(u.uBloom, (P.bloom || 0) / 100); gl.uniform1f(u.uVig, (P.vig || 0) / 100); gl.uniform1f(u.uLeak, (P.leak || 0) / 100);
      gl.uniform1i(u.uLeakStyle, P.leakStyle || 0); gl.uniform1f(u.uExp, (P.expd || 0) / 100); gl.uniform1i(u.uExpTint, P.expTint || 0);
      gl.uniform1f(u.uAspect, w / h);
      gl.uniform1f(u.uSeed, opts.seed || 7); gl.uniform1i(u.uFlipY, opts.flipY ? 1 : 0);
      this._draw(target, w, h, opts.vp);
    }
    static needsBlur(P) { return P.clarity !== 0 || (P.hal || 0) > 0 || (P.bloom || 0) > 0 || !!(P.masks && P.masks.some(m => m.clar)); }
    // full pipeline into the canvas (opts.toCanvas, optional opts.vp + opts.clear) or into pixels
    renderTo(src, P, w, h, opts) {
      opts = opts || {};
      const gl = this.gl;
      const color = this._rt(opts.key || 'color', opts.colorW || w, opts.colorH || h, true, !!opts.mip);
      this.develop(src, P, color, color.w, color.h, { crop: opts.crop, bypass: opts.bypass, flipY: true, alphaClar: true });
      if (opts.mip) { gl.bindTexture(gl.TEXTURE_2D, color.tex); gl.generateMipmap(gl.TEXTURE_2D); }
      const blur = !opts.bypass && Engine.needsBlur(P) ? this.blurMaps(color, color.w, color.h) : null;
      const fo = { plain: opts.bypass, extraSharp: opts.extraSharp, seed: opts.seed };
      if (opts.toCanvas) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        if (opts.clear) {
          gl.viewport(0, 0, this.canvas.width, this.canvas.height);
          gl.clearColor(opts.clear[0], opts.clear[1], opts.clear[2], 1); gl.clear(gl.COLOR_BUFFER_BIT);
        }
        if (opts.scissor) { gl.enable(gl.SCISSOR_TEST); gl.scissor(opts.scissor[0], opts.scissor[1], opts.scissor[2], opts.scissor[3]); }
        this.finish(color, blur, P, null, w, h, Object.assign(fo, { vp: opts.vp }));
        if (opts.scissor) gl.disable(gl.SCISSOR_TEST);
        return null;
      }
      const out = this._rt(opts.outKey || 'out', w, h, false);
      this.finish(color, blur, P, out, w, h, Object.assign(fo, { flipY: true }));
      const px = new Uint8Array(w * h * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, out.fb); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return px;
    }
    // develop only (thumbnails, histogram, analysis)
    quick(src, P, w, h, opts) {
      const gl = this.gl; opts = opts || {};
      const out = this._rt('quick' + w + 'x' + h, w, h, false);
      this.develop(src, P, out, w, h, { crop: opts.crop, bypass: opts.bypass, flipY: true });
      const px = new Uint8Array(w * h * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, out.fb); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return px;
    }
  }
  root.Engine = Engine;
})(window);
