import{a as o}from"./index-oN1Lk7W6.js";let t=null;function n(){return new Promise(a=>{if(t)return a(!1);const e=document.createElement("div");e.className="modal",e.innerHTML=`
      <div class="sheet" style="max-width:420px;">
        <div class="head">
          <div class="title">
            <h2>BEGIN TUTORIAL?</h2>
            <div class="sub">Quick orientation · learn the basics</div>
          </div>
        </div>
        <div class="body" style="padding:20px 20px 8px; font-size:13px; color:var(--paper); line-height:1.65;">
          <p style="margin:0 0 10px;">
            Run a short training session to learn movement, combat, ore, building, and upgrades.
          </p>
          <p style="margin:0; color:var(--muted); font-size:11px;">
            You can replay this any time from the <strong style="color:var(--gold);">Home Screen → MENU → TUTORIAL</strong>.
            Skipping will take you straight to the Home Screen.
          </p>
        </div>
        <div class="foot">
          <button class="cta" id="tsp-no" style="background:rgba(255,46,136,0.12);border-color:var(--magenta);color:var(--magenta);">SKIP ✕</button>
          <div class="grow"></div>
          <button class="cta" id="tsp-yes" style="background:rgba(184,255,58,0.14);border-color:var(--lime);color:var(--lime);">START TRAINING ▶</button>
        </div>
      </div>
    `,document.getElementById("modal-root").appendChild(e),t=e,e.querySelector("#tsp-no").addEventListener("click",()=>{o(e).then(()=>{t=null,a(!1)})}),e.querySelector("#tsp-yes").addEventListener("click",()=>{o(e).then(()=>{t=null,a(!0)})})})}export{n as showTutorialStartPrompt};
//# sourceMappingURL=tutorialskip-CK18w5Ny.js.map
