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

// function appendMessage(text, sender) {
//   const div = document.createElement("div");
//   div.className = `message ${sender}`;
//   div.innerHTML = sender === "bot" ? marked.parse(text) : text; // render Markdown for bot
//   chatContainer.appendChild(div);
//   chatContainer.scrollTop = chatContainer.scrollHeight;
// }

function appendMessage(text, sender){
  const div=document.createElement("div");
  div.className=`message ${sender}`;
  div.textContent=text; // safe default (see note above for Markdown)
  chatContainer.appendChild(div);
  chatContainer.scrollTop=chatContainer.scrollHeight;
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

// In your content script
function getPageContext() {
  // Get the main content of the page
  // This is a simple implementation - you might need to customize this
  // to better target the main content of different websites
  const mainContent = document.body.innerText.substring(0, 10000); // Limit to 10K chars
  
  chrome.runtime.sendMessage(
    { 
      type: "GET_PAGE_CONTEXT", 
      pageContent: mainContent 
    },
    response => {
      if (response && response.suggestions && response.suggestions.length > 0) {
        displaySuggestions(response.suggestions);
      } else if (response && response.error) {
        console.error("Error getting suggestions:", response.error);
      }
    }
  );
}

function displaySuggestions(suggestions) {
  // Implement UI to display the suggestions
  // This will depend on your extension's UI design
  console.log("Suggestions to display:", suggestions);
  
  // Example: Create a floating suggestions panel
  const panel = document.createElement('div');
  panel.className = 'quick-reply-suggestions';
  panel.style.cssText = 'position:fixed; bottom:20px; right:20px; background:white; border:1px solid #ccc; border-radius:8px; padding:10px; z-index:10000; box-shadow:0 2px 10px rgba(0,0,0,0.2);';
  
  const header = document.createElement('div');
  header.textContent = 'Quick Reply Suggestions';
  header.style.cssText = 'font-weight:bold; margin-bottom:10px; padding-bottom:5px; border-bottom:1px solid #eee;';
  panel.appendChild(header);
  
  suggestions.forEach(suggestion => {
    const btn = document.createElement('button');
    btn.textContent = suggestion;
    btn.style.cssText = 'display:block; width:100%; text-align:left; margin:5px 0; padding:8px; border:none; background:#f5f5f5; border-radius:4px; cursor:pointer;';
    btn.onclick = () => {
      // Copy to clipboard or insert into active input field
      navigator.clipboard.writeText(suggestion)
        .then(() => {
          btn.style.background = '#e6f7e6';
          setTimeout(() => { btn.style.background = '#f5f5f5'; }, 500);
        });
    };
    panel.appendChild(btn);
  });
  
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = 'position:absolute; top:5px; right:5px; border:none; background:none; cursor:pointer;';
  closeBtn.onclick = () => panel.remove();
  panel.appendChild(closeBtn);
  
  document.body.appendChild(panel);
}

async function askAboutPage(question){
  if (typingIndicator) hideTyping();
  showTyping();
  try{
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    if(!tab?.id) throw new Error("No active tab");
    chrome.tabs.sendMessage(tab.id,{type:"GET_PAGE_CONTEXT"},(response)=>{
      if (chrome.runtime.lastError){
        hideTyping();
        appendMessage("I couldn't read this page. Try reloading or check permissions.", "bot");
        console.error(chrome.runtime.lastError);
        return;
      }
      const pageContext=response?.context||"";
      const prompt=`Webpage content:\n${pageContext}\n\nUser question:\n${question}`;
      chrome.runtime.sendMessage({type:"RUN_AI_ACTION",action:"ask",text:prompt},(res)=>{
        hideTyping();
        appendMessage(res?.result||"No response","bot");
      });
    });
  }catch(e){
    hideTyping();
    appendMessage(`❌ ${e.message}`,"bot");
  }
}

// Update your generateSuggestedQuestions function
 async function generateSuggestedQuestions() {
  console.log("Generating suggested questions based on page context");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log("Active tab for suggestions:", tab);
    if (!tab || !tab.id) {
      console.error("No active tab found");
      return;
    }

    // First check if content script is ready
    checkContentScriptStatus(tab.id, (isReady) => {
      if (!isReady) {
        console.log("Content script not ready, injecting it now");
        injectContentScript(tab.id, () => {
          // Try again after injection
          setTimeout(() => getPageContextFromTab(tab.id), 500);
        });
      } else {
        getPageContextFromTab(tab.id);
      }
    });
  } catch (error) {
    console.error("Error in generateSuggestedQuestions:", error);
  }
}

// Check if content script is ready
function checkContentScriptStatus(tabId, callback) {
  chrome.tabs.sendMessage(tabId, { type: "PING" }, response => {
    const isReady = !chrome.runtime.lastError && response && response.status === "ready";
    callback(isReady);
  });
}

// Inject content script if not already present
function injectContentScript(tabId, callback) {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: ["content.js"]
  }).then(() => {
    console.log("Content script injected successfully");
    callback();
  }).catch(err => {
    console.error("Error injecting content script:", err);
  });
}

// Get page context once we know content script is ready
function getPageContextFromTab(tabId) {
  chrome.tabs.sendMessage(tabId, { type: "GET_PAGE_CONTEXT" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Error getting page context:", chrome.runtime.lastError);
      showQuickReplies(["Tell me about this page", "What's the main point here?", "Summarize this content"]);
      return;
    }
    
    const pageContext = response?.context || "";
    if (!pageContext) {
      console.log("No page context received, using fallback suggestions");
      showQuickReplies(["Tell me about this page", "What's the main point here?", "Summarize this content"]);
      return;
    }

    // Send to background.js for suggested questions
    chrome.runtime.sendMessage(
      { type: "GET_PAGE_CONTEXT", pageContent: pageContext },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("Error getting suggestions from background:", chrome.runtime.lastError);
          showQuickReplies(["Tell me about this page", "What's the main point here?", "Summarize this content"]);
          return;
        }
        
        if (response && response.suggestions && response.suggestions.length > 0) {
          showQuickReplies(response.suggestions);
        } else {
          // Fallback to the old method
          chrome.runtime.sendMessage(
            { type: "RUN_AI_ACTION", action: "suggest_questions", text: pageContext },
            (res) => {
              const questions = parseQuestions(res?.result);
              if (questions?.length) {
                showQuickReplies(questions);
              } else {
                showQuickReplies(["Tell me about this page", "What's the main point here?", "Summarize this content"]);
              }
            }
          );
        }
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

   // 👇 scroll to beginning
  container.scrollTo({ left: 0, behavior: 'smooth' });
}


const quickWrapper = document.querySelector('.quick-reply-wrapper');
const scrollLeftBtn = document.getElementById('scrollLeftBtn');
const scrollRightBtn = document.getElementById('scrollRightBtn');

scrollLeftBtn.onclick = () => {
  quickWrapper.scrollBy({ left: -150, behavior: 'smooth' });
};
scrollRightBtn.onclick = () => {
  quickWrapper.scrollBy({ left: 150, behavior: 'smooth' });
};

window.addEventListener('DOMContentLoaded', () => {
  generateSuggestedQuestions();
});
