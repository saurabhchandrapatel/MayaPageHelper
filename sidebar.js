const chatContainer = document.getElementById("chatContainer");
const sendBtn = document.getElementById("sendBtn");
const userInput = document.getElementById("userInput");
const closeBtn = document.getElementById("closeBtn");
const settingsBtn = document.getElementById("settingsBtn");
const quickReplyBtns = document.querySelectorAll(".quick-reply-btn");

// Close sidebar functionality
closeBtn.addEventListener("click", () => {
  parent.postMessage({ type: "CLOSE_SIDEBAR" }, "*");
});

window.addEventListener("message", (event) => {
  if (event.data.type === "CLOSE_SIDEBAR") window.close();
});

// Settings button functionality
settingsBtn.addEventListener("click", () => {
  // Placeholder for settings functionality
  console.log("Settings clicked");
});

// Send message functionality
sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Auto-resize textarea as user types
userInput.addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = (this.scrollHeight) + 'px';
  if (this.scrollHeight > 100) {
    this.style.overflowY = 'auto';
  } else {
    this.style.overflowY = 'hidden';
  }
});


quickReplyBtns.forEach(btn => {
  btn.addEventListener('click', function() {
    const text = this.textContent;
    appendMessage(text, 'user');
    document.querySelector('.quick-reply-container').style.display = 'none';
    showTyping();
    askAboutPage(text); // Send quick reply as page-context question
  });
});

function appendMessage(text, sender) {
  const div = document.createElement("div");
  div.className = `message ${sender}`;
  div.innerHTML = sender === "bot" ? marked.parse(text) : text; // render Markdown for bot
  chatContainer.appendChild(div);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

let typingIndicator;

function showTyping() {
  typingIndicator = document.createElement("div");
  typingIndicator.className = "message bot typing";
  typingIndicator.innerHTML = "🤖 Thinking...";
  chatContainer.appendChild(typingIndicator);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function hideTyping() {
  if (typingIndicator) typingIndicator.remove();
  typingIndicator = null;
}

function sendMessage() {
  const text = userInput.value.trim();
  if (!text) return;

  appendMessage(text, "user");
  userInput.value = "";
  userInput.style.height = 'auto'; // Reset height

  // Decide action: "ask" for page Q&A or "default" for generic
  askAboutPage(text);
}
 
// Add attachment functionality
const attachmentBtns = document.querySelectorAll('.attachment-btn');
attachmentBtns.forEach(btn => {
  btn.addEventListener('click', function() {
    // Placeholder for attachment functionality
    const type = this.getAttribute('aria-label') || this.getAttribute('title');

    console.log(`${type} clicked`);
    
    if (type === "Add emoji") {
      // Simple emoji picker example
      const emojis = ["😊", "👍", "🎉", "🤔", "👋", "❤️", "🙏", "👏"];
      const emojiPicker = document.createElement("div");
      emojiPicker.className = "emoji-picker";
      emojiPicker.style.position = "absolute";
      emojiPicker.style.bottom = "80px";
      emojiPicker.style.left = "20px";
      emojiPicker.style.background = "white";
      emojiPicker.style.padding = "10px";
      emojiPicker.style.borderRadius = "8px";
      emojiPicker.style.boxShadow = "0 2px 10px rgba(0,0,0,0.1)";
      emojiPicker.style.display = "flex";
      emojiPicker.style.flexWrap = "wrap";
      emojiPicker.style.gap = "5px";
      emojiPicker.style.zIndex = "100";
      
      emojis.forEach(emoji => {
        const emojiBtn = document.createElement("button");
        emojiBtn.textContent = emoji;
        emojiBtn.style.background = "none";
        emojiBtn.style.border = "none";
        emojiBtn.style.fontSize = "20px";
        emojiBtn.style.cursor = "pointer";
        emojiBtn.style.padding = "5px";
        emojiBtn.style.borderRadius = "4px";
        emojiBtn.style.transition = "background 0.2s";
        
        emojiBtn.addEventListener("mouseover", () => {
          emojiBtn.style.background = "#f0f0f0";
        });
        
        emojiBtn.addEventListener("mouseout", () => {
          emojiBtn.style.background = "none";
        });
        
        emojiBtn.addEventListener("click", () => {
          userInput.value += emoji;
          emojiPicker.remove();
        });
        
        emojiPicker.appendChild(emojiBtn);
      });
      
      document.body.appendChild(emojiPicker);
      
      // Close emoji picker when clicking outside
      document.addEventListener("click", function closeEmojiPicker(e) {
        if (!emojiPicker.contains(e.target) && e.target !== btn) {
          emojiPicker.remove();
          document.removeEventListener("click", closeEmojiPicker);
        }
      });
    }

    // Future: handle other attachment types (files, images, etc.) and agents tools
  });
});


async function askAboutPage(question) {
  showTyping();
  console.log("Asking about page:", question);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  console.log("Active tab:", tab);

  // Get page content from content script
  chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_CONTEXT" }, (response) => {
    const pageContext = response?.context || "";
    const prompt = `Webpage content:\n${pageContext}\n\nUser question:\n${question}`;
    console.log("Sending prompt to background:", prompt);
    chrome.runtime.sendMessage({ type: "RUN_AI_ACTION", action: "ask", text: prompt }, (res) => {
      hideTyping();
      appendMessage(res?.result || "No response", "bot");
    });
  });
}


async function generateSuggestedQuestions() {
  console.log("Generating suggested questions based on page context");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Get page content from content script
  
  chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_CONTEXT" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Error sending message to tab:", chrome.runtime.lastError);
      return;
    }
    const pageContext = response?.context || "";
    if (!pageContext) return;

    // Send to background.js for suggested questions
    chrome.runtime.sendMessage(
      { type: "RUN_AI_ACTION", action: "suggest_questions", text: pageContext },
      (res) => {
        if (chrome.runtime.lastError) {
          console.error("Error sending message to background:", chrome.runtime.lastError);
          return;
        }
        const questions = parseQuestions(res?.result);
        if (questions?.length) showQuickReplies(questions);
      }
    );
  });


}

// Parse JSON or fallback
function parseQuestions(result) {
  if (!result) return [];

  // 1️⃣ Remove code block markers ``` and any language hints
  let cleaned = result.replace(/```json|```/g, "").trim();

  // 2️⃣ Try parsing as JSON
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // fallback: split by newlines and remove empty lines
    return cleaned.split('\n').map(q => q.trim()).filter(q => q);
  }
}

// Display quick reply buttons dynamically
function showQuickReplies(options) {
  const container = document.querySelector('.quick-reply-wrapper');
  container.innerHTML = '';
  container.style.display = 'flex';
  options.forEach(option => { 
     
    const btn = document.createElement('button');
    btn.className = 'quick-reply-btn';
    btn.textContent = option;
    btn.addEventListener('click', () => {
      appendMessage(option, 'user');
      container.style.display = 'none';
      askAboutPage(option); // Send question
    });
    container.appendChild(btn);
  });
}

window.addEventListener('DOMContentLoaded', () => {
  generateSuggestedQuestions();
});
