/**
 * Inlined in the document head (app/layout.tsx), so the start sequence is skippable before React
 * hydrates. Two jobs:
 *
 *   land  measures where the hero's server-rendered drawing actually sits and hands that point
 *         to the intro car (`--land-x/y`). The CSS default assumes the hero stage fills the
 *         viewport; on narrow screens the stage is the hero section, which can be taller.
 *         If the drawing is off screen (a reload restored the scroll), the car drives off instead.
 *
 *   skip  any click, tap, key or wheel jumps every running animation forward to lights out, so
 *         the car still launches and the curtain still lifts: the hand-off is kept, only the
 *         wait is cut. Page entrances move by the same amount, so they still follow the curtain.
 *
 * Development only: `?intro=<ms>` freezes every animation at that moment of the timeline, so the
 * sequence can be screenshot frame by frame in a headless browser (like HeroStage's `?hero=`).
 */
const STILL = `var m=/[?&]intro=([0-9]+)/.exec(location.search);
function still(){d.getAnimations().forEach(function(a){a.pause();a.currentTime=+m[1]})}
if(m){d.addEventListener("DOMContentLoaded",still);addEventListener("load",still);setTimeout(still,3000)}`;

export const INTRO_BOOT = `(function(){
var d=document;
function land(){
var l=d.getElementById("intro"),c=l&&l.querySelector(".intro-car"),p=d.querySelector(".hero-poster");
if(!c||!p)return;
var f=l.getBoundingClientRect(),r=p.getBoundingClientRect(),y=r.top+r.height/2-f.top;
if(!r.width)return;
if(y<0||y>f.height){l.setAttribute("data-land","off");return}
l.removeAttribute("data-land");
c.style.setProperty("--land-x",(r.left+r.width/2-f.left)+"px");
c.style.setProperty("--land-y",y+"px");
}
function skip(){
var l=d.getElementById("intro");
if(!l||!l.getAnimations||!d.getAnimations||l.hasAttribute("data-skipped"))return;
var a=l.getAnimations()[0];if(!a)return;
var v=getComputedStyle(l).getPropertyValue("--intro-out").trim(),out=/ms$/.test(v)?parseFloat(v):parseFloat(v)*1e3,j=out-(Number(a.currentTime)||0);
if(!(j>0))return;
l.setAttribute("data-skipped","");
d.getAnimations().forEach(function(x){if(x.playState!=="finished"&&x.currentTime!==null)x.currentTime=Number(x.currentTime)+j});
}
["pointerdown","keydown","wheel","touchstart"].forEach(function(e){d.addEventListener(e,skip,{passive:true,capture:true})});
d.addEventListener("DOMContentLoaded",land);
addEventListener("load",land);
addEventListener("resize",land);
if(d.fonts)d.fonts.ready.then(land);
${process.env.NODE_ENV !== "production" ? STILL : ""}
})();`;
