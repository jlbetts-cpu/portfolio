(function(root,factory){
 var state=typeof module!=="undefined"&&module.exports?require("./site-theme-state.js"):root.SiteThemeState;
 var api=factory(state);
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(root)root.HeroTimeModel=api;
})(typeof window!=="undefined"?window:globalThis,function(SiteThemeState){
 "use strict";

 var MODES=SiteThemeState.MODES;
 var STATES=SiteThemeState.STATES;
 var COLORS={
  "pre-dawn":["#071329","#142C54","#243B79","#6B6FAF","#C7D6FF"],
  sunrise:["#F6F9FF","#BCD8FF","#FFD4B8","#F1A36B","#FFF0D4"],
  daytime:["#F8FBFF","#DCEEFF","#A9D6FF","#74B6F2","#EEF7FF"],
  dusk:["#10162A","#26365C","#676F9F","#B2A7D1","#E6D9E9"],
  sunset:["#19172B","#3C315D","#D56C76","#F0A06F","#FFD5B8"],
  night:["#050810","#0A1530","#102A58","#1D4A93","#6FA9FF"]
 };

 function deepFreeze(value){
  if(value&&typeof value==="object"&&!Object.isFrozen(value)){
   Object.keys(value).forEach(function(key){deepFreeze(value[key]);});
   Object.freeze(value);
  }
  return value;
 }

 function nodes(values){
  return values.map(function(value){
   return {x:value[0],y:value[1],size:value[2],len:value[3],ang:value[4]};
  });
 }

 function preset(colors,nodeValues,glow,expo,light){
  return {
   colors:colors.slice(),
   nodes:nodes(nodeValues),
   form:1,
   layer:.72,
   melt:.38,
   wob:.12,
   contour:.12,
   grain:.025,
   flow:.10,
   sweep:.18,
   fringe:0,
   orb:0,
   glass:.12,
   glow:glow,
   expo:expo,
   light:light.slice()
  };
 }

 var PRESETS=deepFreeze({
  "pre-dawn":preset(COLORS["pre-dawn"],[
   [.16,1.04,.78,.19,-.20],[.35,.88,.64,.22,.16],[.53,.98,.72,.18,-.08],[.72,.79,.48,.14,.28],[.88,.91,.42,.12,-.24]
  ],.28,.84,[.34,.84]),
  sunrise:preset(COLORS.sunrise,[
   [.14,.96,.68,.18,-.18],[.33,1.07,.82,.24,.10],[.51,.85,.56,.16,-.10],[.70,.74,.43,.13,.22],[.88,.93,.54,.15,-.20]
  ],.42,1.06,[.38,.82]),
  daytime:preset(COLORS.daytime,[
   [.13,.88,.58,.16,-.14],[.31,1.03,.75,.22,.12],[.50,.80,.50,.14,-.08],[.69,.92,.60,.17,.20],[.87,.74,.40,.12,-.22]
  ],.20,1.12,[.46,.76]),
  dusk:preset(COLORS.dusk,[
   [.15,1.01,.72,.20,-.18],[.34,.86,.58,.17,.14],[.52,.96,.68,.19,-.08],[.71,.77,.45,.13,.24],[.89,.90,.50,.14,-.22]
  ],.30,.90,[.38,.83]),
  sunset:preset(COLORS.sunset,[
   [.13,.98,.72,.20,-.16],[.32,1.09,.86,.24,.12],[.51,.88,.62,.18,-.10],[.70,.76,.46,.13,.22],[.89,.93,.56,.16,-.24]
  ],.48,.94,[.40,.85]),
  night:preset(COLORS.night,[
   [.15,1.08,.86,.23,-.18],[.34,.91,.62,.18,.14],[.52,1.00,.76,.21,-.08],[.71,.80,.46,.13,.24],[.88,.94,.54,.15,-.22]
  ],.36,.76,[.42,.86])
 });

 function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
 function linearFromSrgb(value){return value<=.04045?value/12.92:Math.pow((value+.055)/1.055,2.4);}
 function srgbFromLinear(value){return value<=.0031308?value*12.92:1.055*Math.pow(Math.max(value,0),1/2.4)-.055;}

 function hexToOklab(hex){
  var number=parseInt(hex.slice(1),16);
  var red=linearFromSrgb(((number>>16)&255)/255);
  var green=linearFromSrgb(((number>>8)&255)/255);
  var blue=linearFromSrgb((number&255)/255);
  var l=Math.cbrt(.4122214708*red+.5363325363*green+.0514459929*blue);
  var m=Math.cbrt(.2119034982*red+.6806995451*green+.1073969566*blue);
  var s=Math.cbrt(.0883024619*red+.2817188376*green+.6299787005*blue);
  return [
   .2104542553*l+.7936177850*m-.0040720468*s,
   1.9779984951*l-2.4285922050*m+.4505937099*s,
   .0259040371*l+.7827717662*m-.8086757660*s
  ];
 }

 function oklabToHex(oklab){
  var l=oklab[0]+.3963377774*oklab[1]+.2158037573*oklab[2];
  var m=oklab[0]-.1055613458*oklab[1]-.0638541728*oklab[2];
  var s=oklab[0]-.0894841775*oklab[1]-1.2914855480*oklab[2];
  l=l*l*l;m=m*m*m;s=s*s*s;
  var red=4.0767416621*l-3.3077115913*m+.2309699292*s;
  var green=-1.2684380046*l+2.6097574011*m-.3413193965*s;
  var blue=-.0041960863*l-.7034186147*m+1.7076147010*s;
  return "#"+[red,green,blue].map(function(value){
   var channel=Math.round(clamp(srgbFromLinear(value),0,1)*255).toString(16).toUpperCase();
   return channel.length===1?"0"+channel:channel;
  }).join("");
 }

 function mixNumber(from,to,t){return from+(to-from)*t;}
 function mixHex(from,to,t){
  var a=hexToOklab(from),b=hexToOklab(to);
  return oklabToHex([mixNumber(a[0],b[0],t),mixNumber(a[1],b[1],t),mixNumber(a[2],b[2],t)]);
 }
 function clone(value){
  if(Array.isArray(value))return value.map(clone);
  if(value&&typeof value==="object"){
   var result={};
   Object.keys(value).forEach(function(key){result[key]=clone(value[key]);});
   return result;
  }
  return value;
 }
 function mixNode(from,to,t){
  var result={};
  Object.keys(from).concat(Object.keys(to)).forEach(function(key){
   if(Object.prototype.hasOwnProperty.call(result,key))return;
   var a=from[key],b=to[key];
   result[key]=typeof a==="number"&&typeof b==="number"?mixNumber(a,b,t):clone(t<.5?a:b);
  });
  return result;
 }
 function mixValue(from,to,t){
  if(typeof from==="number"&&typeof to==="number")return mixNumber(from,to,t);
  if(Array.isArray(from)&&Array.isArray(to)&&from.length===to.length&&from.every(function(value){return typeof value==="number";})){
   return from.map(function(value,index){return mixNumber(value,to[index],t);});
  }
  return clone(t<.5?from:to);
 }

 function interpolatePreset(from,to,t){
  t=Number(t);
  t=isFinite(t)?clamp(t,0,1):0;
  if(t===0)return clone(from);
  if(t===1)return clone(to);
  var result={};
  Object.keys(from).concat(Object.keys(to)).forEach(function(key){
   if(Object.prototype.hasOwnProperty.call(result,key))return;
   if(key==="colors")result.colors=from.colors.map(function(color,index){return mixHex(color,to.colors[index],t);});
   else if(key==="nodes")result.nodes=from.nodes.map(function(node,index){return mixNode(node,to.nodes[index],t);});
   else result[key]=mixValue(from[key],to[key],t);
  });
  return result;
 }

 return {MODES:MODES,STATES:STATES,PRESETS:PRESETS,normalizeMode:SiteThemeState.normalizeMode,resolveAutomatic:SiteThemeState.resolveAutomatic,resolveState:SiteThemeState.resolveState,msUntilNextBoundary:SiteThemeState.msUntilNextBoundary,interpolatePreset:interpolatePreset};
});
