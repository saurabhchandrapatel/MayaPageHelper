// Create floating bubble

let aiBubble = document.createElement("div");
aiBubble.id = "ai-floating-bubble";

// Use the extension icon instead of emoji
let iconUrl = chrome.runtime.getURL("icons/icon128.png");
aiBubble.innerHTML = `<img src="${iconUrl}" style="width:70%; height:70%; border-radius:50%;">`;

aiBubble.style.position = "fixed";
aiBubble.style.bottom = "40px";
aiBubble.style.right = "40px";
aiBubble.style.width = "80px";
aiBubble.style.height = "80px";
aiBubble.style.background = "#fe6100"; // optional, can keep or remove
aiBubble.style.borderRadius = "50%";
aiBubble.style.display = "flex";
aiBubble.style.alignItems = "center";
aiBubble.style.justifyContent = "center";
aiBubble.style.cursor = "pointer";
aiBubble.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
aiBubble.style.zIndex = "999999";
aiBubble.style.transition = "transform 0.2s ease";
document.body.appendChild(aiBubble);
// Hover effect
aiBubble.addEventListener("mouseenter", () => aiBubble.style.transform = "scale(1.1)");
aiBubble.addEventListener("mouseleave", () => aiBubble.style.transform = "scale(1)");

// // Open sidebar on click
// aiBubble.addEventListener("click", () => {
//   openSidebar();
// });



// Open sidebar on click
aiBubble.addEventListener("click", () => {
  openSidebar();
  aiBubble.style.display = "none"; // hide bubble when sidebar opens
});


let sidebarFrame = null;

function openSidebar() {
  if (sidebarFrame) return;

  const url = chrome.runtime.getURL("sidebar.html");
  sidebarFrame = document.createElement("iframe");
  sidebarFrame.src = url;

  Object.assign(sidebarFrame.style, {
    position: "fixed",
    bottom: "16px",
    right: "16px",
    width: "400px",
    height: "560px",          // bottom dock-style panel
    maxHeight: "80vh",
    border: "none",
    borderRadius: "14px",
    zIndex: "2147483647",
    boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
    background: "transparent",
    overflow: "hidden"
  });

  sidebarFrame.id = "ai-sidebar-frame";
  document.documentElement.appendChild(sidebarFrame);

  // ✨ Make iframe draggable after it loads
  // sidebarFrame.addEventListener("load", () => {
  //   makeIframeDraggable(sidebarFrame);
  // });
  // Listen for messages from the sidebar to close it
  window.addEventListener("message", (event) => {
    // if (event.origin !== chrome.runtime.getURL("")) return; // or check specific origin
    handleSidebarMessage(event);
  });

}



function handleSidebarMessage(event) {
  if (event.data.type === "CLOSE_SIDEBAR") {
    if (sidebarFrame) {
      sidebarFrame.remove();
      sidebarFrame = null;
    }
    window.removeEventListener("message", handleSidebarMessage);

    // Show the bubble again
    aiBubble.style.display = "flex";
  }
}




// 🧲 Make the injected chat iframe draggable (content script side)

function makeIframeDraggable(frame) {
  console.log("Making iframe draggable");
  // --- Create a transparent drag handle ---
  const dragHandle = document.createElement("div");
  dragHandle.id = "ou-drag-handle";
  dragHandle.style.background = "rgba(0,0,0,0.1)";
  dragHandle.style.borderTopLeftRadius = "16px";
  dragHandle.style.borderTopRightRadius = "16px";

  Object.assign(dragHandle.style, {
    position: "fixed",
    top: "auto",
    left: "auto",
    right: "20px",
    bottom: "580px", // just above iframe top (adjust if needed)
    width: "400px",
    height: "30px", // header drag zone
    zIndex: "2147483648", // above iframe
    cursor: "move",
    background: "transparent",
  });
  document.body.appendChild(dragHandle);

  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  // Store the current position
  let currentLeft = window.innerWidth - 420;
  let currentTop = window.innerHeight - 580;

  // Make sure iframe starts visible
  Object.assign(frame.style, {
    position: "fixed",
    left: `${currentLeft}px`,
    top: `${currentTop}px`,
    width: "400px",
    height: "560px",
    border: "none",
    borderRadius: "16px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
    zIndex: "2147483647",
    background: "transparent",
  });

  // ---- Drag events ----
  dragHandle.addEventListener("mousedown", (e) => {
    isDragging = true;
    offsetX = e.clientX - currentLeft;
    offsetY = e.clientY - currentTop;
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    currentLeft = Math.min(Math.max(0, e.clientX - offsetX), window.innerWidth - frame.offsetWidth);
    currentTop = Math.min(Math.max(0, e.clientY - offsetY), window.innerHeight - frame.offsetHeight);

    frame.style.left = `${currentLeft}px`;
    frame.style.top = `${currentTop}px`;
    dragHandle.style.left = `${currentLeft}px`;
    dragHandle.style.top = `${currentTop - 30}px`;
  });

  document.addEventListener("mouseup", () => {
    if (!isDragging) return;
    isDragging = false;

    // Optional snap to nearest corner
    const snapRight = currentLeft > window.innerWidth / 2;
    const snapBottom = currentTop > window.innerHeight / 2;

    frame.style.left = snapRight ? "auto" : "20px";
    frame.style.right = snapRight ? "20px" : "auto";
    frame.style.top = snapBottom ? "auto" : "20px";
    frame.style.bottom = snapBottom ? "20px" : "auto";

    dragHandle.style.left = frame.style.left;
    dragHandle.style.right = frame.style.right;
    dragHandle.style.top = `calc(${frame.style.top} - 30px)`;
    dragHandle.style.bottom = frame.style.bottom;
  });
}

// End of floating bubble code