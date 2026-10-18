import{a as v}from"./index-oN1Lk7W6.js";const h=()=>document.getElementById("modal-root");let n=null;function $(e,o){return new Promise(a=>{n&&m();const s=document.createElement("div");s.className="modal",s.innerHTML=`
      <div class="sheet">
        <div class="head">
          <div class="title">
            <h2 style="color: #ff2bd6;">WEAPON CARD DROP</h2>
            <div class="sub">${l(o.toUpperCase())} · select 1 of ${e.length}</div>
          </div>
        </div>
        <div class="body" id="cp-body" style="padding: 12px;"></div>
        <div class="foot">
          <div class="ftxt">Tap a card to equip · cards stay on ground 60s</div>
          <div class="grow"></div>
          <button id="cp-skip" class="hud-btn" style="
            background: rgba(20,12,32,0.85);
            border: 1.5px solid rgba(160,160,180,0.4);
            color: #c8c8d8;
            padding: 8px 18px;
            font-family: 'JetBrains Mono', ui-monospace, monospace;
            font-weight: 700;
            font-size: 11px;
            letter-spacing: 0.8px;
            border-radius: 6px;
            cursor: pointer;
          ">SKIP</button>
        </div>
      </div>
    `,h().appendChild(s),n=s;const c=document.createElement("div");c.className="gcard-grid "+(e.length>=3?"cols-3":"cols-2"),s.querySelector("#cp-body").appendChild(c);const p=[];for(let t=0;t<e.length;t++){const i=e[t],d=document.createElement("div");d.className="gcard",d.innerHTML=`
        <div class="glyph" style="background: linear-gradient(135deg, ${i.color}33, ${i.color}11); display: flex; align-items: center; justify-content: center;">
          ${y(i.weaponId,i.color)}
        </div>
        <div class="info">
          <div class="name" style="color: ${i.color}; font-size: 14px;">${l(i.name.toUpperCase())}</div>
          <div class="sub" style="color:${i.color};opacity:0.9;font-weight:700;">${l(i.dpsLabel||"")}</div>
          <div style="
            margin-top: 8px;
            padding: 6px 8px;
            background: rgba(0,0,0,0.35);
            border-left: 3px solid ${i.color};
            border-radius: 4px;
            font-size: 10px;
            line-height: 1.5;
            color: var(--paper);
          ">
            ${x(i).map(f=>`<div>+ ${l(f)}</div>`).join("")}
          </div>
        </div>
        <div class="footer" style="
          color: ${i.color};
          font-weight: 700; letter-spacing: 0.4px;
          text-align: center;
          font-size: 11px;
        ">[${t+1}] TAP TO EQUIP</div>
      `,d.addEventListener("click",()=>r(i.id)),c.appendChild(d),p.push({id:i.id,el:d})}s.querySelector("#cp-skip").addEventListener("click",()=>r(null));function r(t){n===s&&v(s).then(()=>{n=null,a(t)})}function u(t){if(n){if(t.code==="Escape"){r(null),t.preventDefault();return}if(t.code==="Digit1"||t.code==="Digit2"||t.code==="Digit3"||t.code==="Digit4"){const i=parseInt(t.code.slice(-1),10)-1;p[i]&&r(p[i].id),t.preventDefault()}}}window.addEventListener("keydown",u);const g=a;a=t=>{window.removeEventListener("keydown",u),g(t)}})}function m(){n&&(n.remove(),n=null)}function x(e){const o=[];return e.statMods&&(e.statMods.fireRate&&o.push(`Fire Rate ×${e.statMods.fireRate.toFixed(2)}`),e.statMods.baseDmg&&o.push(`Damage ×${e.statMods.baseDmg.toFixed(2)}`),e.statMods.pierce&&o.push(`Pierce +${e.statMods.pierce}`),e.statMods.range&&o.push(`Range ×${e.statMods.range.toFixed(2)}`),e.statMods.projSpeed&&o.push(`Proj Speed ×${e.statMods.projSpeed.toFixed(2)}`),e.statMods.splash&&o.push(`Splash ×${e.statMods.splash.toFixed(2)}`)),e.signature&&o.push(`Signature: ${e.signature.replace(/_/g," ").toUpperCase()}`),o}function y(e,o){const s={compliance_carbine:"⌖",pyre_cell:"🜂",twin_smg:"⚔",nail_cannon:"⛏",aegis_pulser:"◉",lobber_7:"✪"}[e]||"⌖";return`<div style="font-size:42px; color:${o}; text-shadow:0 0 12px ${o};">${s}</div>`}function l(e){return String(e??"").replace(/[&<>"]/g,o=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[o])}export{$ as showCardPicker};
//# sourceMappingURL=cardpicker-gtGk2gGV.js.map
