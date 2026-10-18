import{B as u,a as v}from"./index-oN1Lk7W6.js";const b=()=>document.getElementById("modal-root");let n=null;function y(e){return new Promise(s=>{n&&m();const d=u[e.biomeId]||{name:`Biome ${e.biomeId}`,nick:""},c=(e.levelIdx||0)+1,i=Math.max(0,Math.floor((Date.now()-(e.ts||0))/1e3)),p=i<60?`${i}s ago`:i<3600?`${Math.floor(i/60)}m ago`:i<86400?`${Math.floor(i/3600)}h ago`:`${Math.floor(i/86400)}d ago`,t=document.createElement("div");t.className="modal",t.innerHTML=`
      <div class="sheet" style="max-width: 520px;">
        <div class="head">
          <div class="title">
            <h2 style="color: #45e9ff;">CONTINUE LAST RUN?</h2>
            <div class="sub">Unfinished mission detected · saved ${l(p)}</div>
          </div>
        </div>
        <div class="body" style="padding: 16px;">
          <div style="
            background: rgba(18,10,31,0.85);
            border-left: 3px solid #45e9ff;
            padding: 12px 14px;
            border-radius: 6px;
            display: flex; flex-direction: column; gap: 6px;
            font-family: 'JetBrains Mono', ui-monospace, monospace;
            font-size: 12px;
            color: #f4ecd8;
          ">
            <div><span style="color:#9bb0c0;">WORLD</span> · ${l(d.name)} ${d.nick?"· "+l(d.nick):""}</div>
            <div><span style="color:#9bb0c0;">LEVEL</span> · ${c} / 20</div>
            <div><span style="color:#9bb0c0;">AUX LV</span> · ${e.stats.level||1}  ·  <span style="color:#9bb0c0;">KILLS</span> · ${e.stats.kills||0}</div>
            <div><span style="color:#9bb0c0;">HP</span> · ${e.player.hp} / ${e.player.hpMax}</div>
            <div><span style="color:#9bb0c0;">STRUCTURES</span> · ${e.structs.length}</div>
          </div>
        </div>
        <div class="foot" style="gap: 12px;">
          <button id="cp-no" class="hud-btn" style="
            background: rgba(20,12,32,0.85);
            border: 1.5px solid rgba(255,46,136,0.5);
            color: #ff2e88;
            padding: 10px 22px;
            font-family: 'JetBrains Mono', ui-monospace, monospace;
            font-weight: 700;
            font-size: 12px;
            letter-spacing: 0.8px;
            border-radius: 6px;
            cursor: pointer;
          ">NO · FRESH RUN</button>
          <div class="grow"></div>
          <button id="cp-yes" class="hud-btn primary" style="
            background: rgba(43,224,255,0.18);
            border: 1.5px solid #45e9ff;
            color: #45e9ff;
            padding: 10px 22px;
            font-family: 'JetBrains Mono', ui-monospace, monospace;
            font-weight: 800;
            font-size: 12px;
            letter-spacing: 0.8px;
            border-radius: 6px;
            cursor: pointer;
          ">YES · CONTINUE</button>
        </div>
      </div>
    `,b().appendChild(t),n=t,t.querySelector("#cp-yes").addEventListener("click",()=>a(!0)),t.querySelector("#cp-no").addEventListener("click",()=>a(!1));function a(o){n===t&&v(t).then(()=>{n=null,s(o)})}function r(o){n&&(o.code==="Escape"?(a(!1),o.preventDefault()):(o.code==="Enter"||o.code==="Space")&&(a(!0),o.preventDefault()))}window.addEventListener("keydown",r);const f=s;s=o=>{window.removeEventListener("keydown",r),f(o)}})}function m(){n&&(n.remove(),n=null)}function l(e){return String(e??"").replace(/[&<>"]/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[s])}export{y as showContinuePrompt};
//# sourceMappingURL=continueprompt-NUxIOwO_.js.map
