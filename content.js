// content.js — Lightweight, safer rewrite with voice playback controls
(() => {
  let selectedText = "";
  let ui = null;
  let lastRange = null;
  let rafId = null;

  // 🎤 Voice state
  let currentUtterance = null;
  let isPaused = false;
  let isMuted = false;

  const AI_ACTIONS = [
    { id: "summarize",  label: "🧾 Summarize" },
    { id: "quiz",       label: "🎯 Quiz" },
    { id: "voice",      label: "🔊 Voice" },
    { id: "paraphrase", label: "✍️ Paraphrase" },
    { id: "explain",    label: "💡 Explain" },
    { id: "highlight",  label: "🔑 Key Points" },
  ];

  // === Root (same as before) ===
  function ensureUIRoot() {
    if (ui) return ui;
    const root = document.createElement("div");
    root.id = "ou-assistant-root";
    root.style.all = "initial";
    root.style.position = "fixed";
    root.style.inset = "0";
    root.style.pointerEvents = "none";
    root.style.zIndex = "2147483647";
    const shadow = root.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
      :host {
        --ou-bg:#fff;--ou-fg:#0f172a;--ou-brand:#1976d2;--ou-accent:#c48506;
        --ou-border:#e5e7eb;--ou-elev:0 8px 24px rgba(0,0,0,0.25);
        --ou-radius:12px;--ou-font:ui-sans-serif,system-ui,Segoe UI,Roboto;
      }
      .ou-toolbar{position:absolute;background:var(--ou-bg);border:1px solid var(--ou-border);
        border-radius:var(--ou-radius);box-shadow:var(--ou-elev);display:flex;gap:6px;
        padding:6px 8px;pointer-events:auto;font-family:var(--ou-font);font-size:13px;}
      .ou-btn{cursor:pointer;border:0;border-radius:8px;padding:6px 10px;background:var(--ou-accent);
        color:#fff;font-size:12px;font-weight:600;transition:background .15s ease;}
      .ou-btn:hover{background:var(--ou-brand);}
      .ou-overlay{position:fixed;bottom:20px;right:20px;background:#000;color:#fff;
        border-radius:10px;padding:10px 14px;font-size:13px;pointer-events:auto;}
      .ou-spinner{width:18px;height:18px;border:3px solid rgba(255,255,255,0.2);
        border-top-color:#fff;border-radius:50%;animation:spin 1s linear infinite;}
      @keyframes spin{to{transform:rotate(360deg)}}
      .ou-bubble{position:fixed;bottom:24px;right:24px;width:min(420px,92vw);
        background:var(--ou-bg);color:var(--ou-fg);border-radius:var(--ou-radius);
        box-shadow:var(--ou-elev);overflow:hidden;pointer-events:auto;
        animation:fade .2s ease both;display:grid;grid-template-rows:auto 1fr auto;}
      @keyframes fade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
      .ou-bubble__header{background:var(--ou-brand);color:#fff;padding:10px 14px;
        display:flex;align-items:center;justify-content:space-between;font-weight:700;}
      .ou-iconbtn{background:transparent;border:0;color:inherit;cursor:pointer;
        font-size:18px;padding:2px 4px;}
      .ou-voice-controls{display:flex;gap:6px;padding:6px 12px;border-top:1px solid var(--ou-border);
        justify-content:flex-end;}
      .ou-voice-btn{border:none;background:var(--ou-brand);color:#fff;border-radius:6px;
        padding:4px 8px;cursor:pointer;font-size:13px;}
      .ou-voice-btn:hover{background:#155fa0;}
      .ou-bubble__content{padding:14px;overflow:auto;font-size:14px;line-height:1.55;}
      .ou-bubble__footer{padding:8px 12px;font-size:12px;color:#666;text-align:right;}
    `;
    shadow.appendChild(style);
    document.documentElement.appendChild(root);
    ui = { root, shadow, toolbar: null, bubble: null, overlay: null };
    return ui;
  }
  
  

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse)=>{
  if (msg.type==="PING") { sendResponse({status:"ready"}); return true; }
    if (msg.type==="GET_PAGE_CONTEXT") {
      const text = document.body?.innerText || "";
      sendResponse({ context: text.slice(0, 10000) });
      return true;
    }
  });

  // === Selection Handling ===
  document.addEventListener("selectionchange", () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(onSelectionChange);
  });

  function onSelectionChange() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim() || sel.rangeCount === 0) {
      removeToolbar();
      selectedText = "";
      return;
    }
    const text = sel.toString().trim();
    if (text.length > 10000) {
      removeToolbar();
      return;
    }
    selectedText = text;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    showToolbar(rect);
  }

  function showToolbar(rect) {
    const { shadow } = ensureUIRoot();
    if (!ui.toolbar) {
      ui.toolbar = document.createElement("div");
      ui.toolbar.className = "ou-toolbar";
      AI_ACTIONS.forEach(({ id, label }) => {
        const b = document.createElement("button");
        b.className = "ou-btn";
        b.textContent = label;
        b.onclick = () => handleAction(id);
        ui.toolbar.appendChild(b);
      });
      shadow.appendChild(ui.toolbar);
    }
    const top = Math.max(rect.top + window.scrollY - ui.toolbar.offsetHeight - 8, 8);
    const left = Math.min(rect.left + window.scrollX, window.innerWidth - ui.toolbar.offsetWidth - 8);
    ui.toolbar.style.top = `${top}px`;
    ui.toolbar.style.left = `${Math.max(left, 8)}px`;
  }
  // function removeToolbar() { ui?.toolbar?.remove(); ui.toolbar = null; }
  function removeToolbar() {
    ui?.toolbar?.remove?.();
    if (ui) ui.toolbar = null;
  }

  // === Overlay ===
  function showOverlay() {
    const { shadow } = ensureUIRoot();
    removeOverlay();
    const o = document.createElement("div");
    o.className = "ou-overlay";
    o.innerHTML = `<div style="display:flex;align-items:center;gap:8px">
      <div class="ou-spinner"></div><span>🤖 Thinking...</span></div>`;
    shadow.appendChild(o);
    ui.overlay = o;
  }
  function removeOverlay() { ui?.overlay?.remove(); ui.overlay = null; }

  // === Result Bubble + Voice ===
  function showResultBubble(result, action = "general") {
    const { shadow } = ensureUIRoot();
    removeBubble();

    const bubble = document.createElement("section");
    bubble.className = "ou-bubble";
    const header = document.createElement('header');
    header.className = 'ou-bubble__header';
    header.innerHTML = '<span>Orange Upskill AI Assistant</span><button class="ou-iconbtn" data-cmd="close">✖</button>';
    
    const content = document.createElement('div');
    content.className = 'ou-bubble__content';
    content.innerHTML = sanitizeHTML(result);
    
    const footer = document.createElement('footer');
    footer.className = 'ou-bubble__footer';
    footer.textContent = 'Powered by Orange Upskill AI';
    
    bubble.appendChild(header);
    bubble.appendChild(content);
    bubble.appendChild(footer);

    // Voice Control Buttons (only for "voice" action)
    if (action === "voice") {
      const vc = document.createElement("div");
      vc.className = "ou-voice-controls";
      const buttons = [
        { cmd: 'pause', text: '⏸ Pause' },
        { cmd: 'resume', text: '▶️ Resume' },
        { cmd: 'mute', text: '🔇 Mute' },
        { cmd: 'stop', text: '⏹ Stop' }
      ];
      buttons.forEach(({cmd, text}) => {
        const btn = document.createElement('button');
        btn.className = 'ou-voice-btn';
        btn.dataset.vc = cmd;
        btn.textContent = text;
        vc.appendChild(btn);
      });
      bubble.appendChild(vc);
      startVoice(stripHTML(result), vc);
    }

    shadow.appendChild(bubble);
    ui.bubble = bubble;

    // Event listeners
    bubble.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.dataset.cmd === "close") {
        stopVoice();
        removeBubble();
      }
    });
  }

  function removeBubble() {
    stopVoice();
    ui?.bubble?.remove?.();
    ui.bubble = null;
  }

  // === Voice Playback Management ===
  function startVoice(text, controls) {
    stopVoice();
    setTimeout(() => {
      currentUtterance = new SpeechSynthesisUtterance(text);
      currentUtterance.pitch = 1;
      currentUtterance.rate = 1;
      currentUtterance.volume = isMuted ? 0 : 1;
      window.speechSynthesis.speak(currentUtterance);
      attachVoiceControls(controls);
    }, 150);
  }
  function attachVoiceControls(controls) {
    controls.querySelectorAll("button").forEach(btn => {
      btn.onclick = () => handleVoiceControl(btn.dataset.vc, btn);
    });
  }
  function handleVoiceControl(cmd, btn) {
    switch (cmd) {
      case "pause": window.speechSynthesis.pause(); isPaused = true; break;
      case "resume": window.speechSynthesis.resume(); isPaused = false; break;
      case "mute":
        isMuted = !isMuted;
        btn.textContent = isMuted ? "🔈 Unmute" : "🔇 Mute";
        if (currentUtterance) currentUtterance.volume = isMuted ? 0 : 1;
        break;
      case "stop": stopVoice(); break;
    }
  }
  function stopVoice() {
    try { window.speechSynthesis.cancel(); } catch {}
    currentUtterance = null;
    isPaused = false;
  }

  // === AI Action ===
  function handleAction(action) {
    removeToolbar();
    if (!selectedText || selectedText.length > 10000) {
      showResultBubble('❌ Selected text is too long or invalid.');
      return;
    }
    showOverlay();
    try {
      chrome.runtime.sendMessage({ type: "RUN_AI_ACTION", action, text: selectedText }, (res) => {
        removeOverlay();
        if (chrome.runtime.lastError)
          return showResultBubble(`❌ ${chrome.runtime.lastError.message}`);
        showResultBubble(res?.result || "❌ No response from AI", action);
      });
    } catch (err) {
      removeOverlay();
      showResultBubble(`❌ ${err}`);
    }
  }

  // === Utils ===
  function sanitizeHTML(text = "") {
    if (typeof text !== 'string') return '';
    return escapeHTML(text).replace(/\n/g, "<br>");
  }
  function escapeHTML(s) { 
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); 
  }
  function stripHTML(s) { 
    const div = document.createElement("div"); 
    div.textContent = s; 
    return div.textContent || ""; 
  }

  // ESC closes everything
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      removeToolbar(); removeOverlay(); removeBubble(); stopVoice();
    }
  });
})();
