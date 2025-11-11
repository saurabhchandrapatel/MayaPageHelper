 


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("[DEBUG] Background received message:", request);

  if (request.type === "RUN_AI_ACTION") {
    handleAction(request.action, request.text)
      .then(result => {
        console.log("[DEBUG] Result from AI:", result);
        sendResponse({ result });
      })
      .catch(err => {
        console.error("[DEBUG] Error in handleAction:", err);
        sendResponse({ result: `❌ Error: ${err.message}` });
      });
    return true; // keep channel open for async
  } 
  // Add this new handler
  if (request.type === "GET_PAGE_CONTEXT") {
    generateReplySuggestions(request.pageContent)
      .then(suggestions => {
        console.log("[DEBUG] Generated reply suggestions:", suggestions);
        sendResponse({ suggestions });
      })
      .catch(err => {
        console.error("[DEBUG] Error generating suggestions:", err);
        sendResponse({ suggestions: [], error: err.message });
      });
    return true; // keep channel open for async
  }

});

async function handleAction(action, text) {
  console.log("[DEBUG] Handling action in background:", action);

  // Load user configuration from storage
  const storage = await new Promise(resolve =>
    chrome.storage.sync.get(["provider", "apiKey", "features"], resolve)
  );
  const provider = storage.provider || "gemini";
  const apiKey = storage.apiKey || "";
  const features = storage.features || {};

  console.log("[DEBUG] Storage loaded:", storage);

  // Optional: check if feature enabled
  if (action === "summarize" && !features.summary) return "❌ Summary feature not enabled.";
  if (action === "quiz" && !features.quiz) return "❌ Quiz feature not enabled.";
  if (action === "voice" && !features.voice) return "❌ Voice feature not enabled.";
  
  // Build prompt
  let prompt = "";
  switch (action) {
    case "summarize":
      prompt = `📘 Summarize this text for a student. Make it clear, simple, and easy to understand:\n${text}`;
      break;
    case "quiz":
      prompt = `📝 Create 3 quiz questions from this text suitable for students to practice learning. Include 4 options each and indicate the correct answer:\n${text}`;
      break;
    case "voice":
      prompt = `🔊 Read this text aloud clearly and in an engaging way for a student:\n${text}`;
      break;
    case "ask":
      prompt = `🤔 Answer this as a friendly tutor would, using simple explanations and examples:\n${text}`;
      break;
    case "suggest_questions":
      prompt = `❓ From this content, generate 3-5 thoughtful questions a student might ask to understand it better. Return only a JSON array of strings:\n${text}`;
      break;
    default:
      prompt = text;
  }

  console.log("[DEBUG] Preparing to call LLM with prompt");
  
  try {
    // Use the callLLM function with appropriate parameters
    const result = await callLLM(provider, apiKey, prompt, 0.7, 500);
    return result;
  } catch (e) {
    console.error("[DEBUG] Error in handleAction:", e);
    return `❌ ${e.message}`;
  }
}


 

/**
 * Generic function to call LLM APIs
 */
/**
 * Generic function to call LLM APIs with rate limiting and caching
 */
async function callLLM(provider, apiKey, prompt, temperature = 0.7, maxTokens = 500) {
  console.log("[DEBUG] Calling LLM:", provider, "with prompt length:", prompt.length);

  // Validate API key
  if (!apiKey) {
    throw new Error(`No API key provided for ${provider}. Please add your API key in the extension settings.`);
  }

  // Check input size
  if (prompt.length > 100000) {
    console.warn("[DEBUG] Very large prompt detected, truncating...");
    prompt = prompt.substring(0, 100000) + "... [content truncated due to length]";
  }

  try {
    // Check cache first
    const cachedResponse = getCachedResponse(prompt, provider);
    if (cachedResponse) {
      console.log("[DEBUG] Cache hit for", provider);
      return cachedResponse;
    }

    // Apply rate limiting
    checkRateLimit(apiKey);
    
    let result = "No response";

    if (provider === "gemini") {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      try {
        const res = await fetchWithRetry(
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent", 
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature,
                maxOutputTokens: maxTokens
              }
            }),
            signal: controller.signal
          }
        );
        
        clearTimeout(timeoutId);
        
        if (!res.ok) {
          throw new Error(`Gemini API error: ${res.status} ${res.statusText}`);
        }
        
        const data = await res.json();
        console.log("[DEBUG] Gemini API response:", data);
        result = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response from Gemini";
      } catch (e) {
        clearTimeout(timeoutId);
        if (e.name === 'AbortError') {
          throw new Error('Request timed out after 30 seconds');
        }
        throw e;
      }
    } else if (provider === "openai") {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      try {
        const res = await fetchWithRetry(
          "https://api.openai.com/v1/chat/completions", 
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [{ role: "user", content: prompt }],
              temperature,
              max_tokens: maxTokens
            }),
            signal: controller.signal
          }
        );
        
        clearTimeout(timeoutId);
        
        if (!res.ok) {
          throw new Error(`OpenAI API error: ${res.status} ${res.statusText}`);
        }
        
        const data = await res.json();
        console.log("[DEBUG] OpenAI API response:", data);
        result = data?.choices?.[0]?.message?.content || "No response from OpenAI";
      } catch (e) {
        clearTimeout(timeoutId);
        if (e.name === 'AbortError') {
          throw new Error('Request timed out after 30 seconds');
        }
        throw e;
      }
    }

    // Cache the successful response
    setCachedResponse(prompt, provider, result);
    
    return result;

  } catch (e) {
    console.error("[DEBUG] Error calling LLM:", e);
    throw new Error(`Error calling ${provider}: ${e.message}`);
  }
}


/**
 * Generate quick reply suggestions based on page content
 */
async function generateReplySuggestions(pageContent) {
  console.log("[DEBUG] Generating reply suggestions from page content");
  
  // Load user configuration
  const storage = await new Promise(resolve =>
    chrome.storage.sync.get(["provider", "apiKey", "features"], resolve)
  );
  const provider = storage.provider || "gemini";
  const apiKey = storage.apiKey || "";
  
  // Create a prompt for generating reply suggestions
  const prompt = `
Based on the following content, generate 3-5 short, helpful reply suggestions that a user might want to use in a conversation about this topic. 
Each suggestion should be concise (under 140 characters) and ready to use.
Return ONLY a JSON array of strings with no additional text.

Content:
${pageContent.substring(0, 5000)}
`;

  try {
    const result = await callLLM(provider, apiKey, prompt, 0.7, 300);
    
    // Try to parse the result as JSON
    try {
      // Handle cases where the model might add explanatory text before/after the JSON
      const jsonMatch = result.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const suggestions = JSON.parse(jsonMatch[0]);
        return Array.isArray(suggestions) ? suggestions : [];
      }
      return [];
    } catch (parseError) {
      console.error("[DEBUG] Failed to parse suggestions as JSON:", parseError);
      // Fallback: try to extract suggestions line by line if JSON parsing fails
      return result
        .split('\n')
        .filter(line => line.trim().startsWith('"') || line.trim().startsWith('-'))
        .map(line => line.replace(/^["-]\s*/, '').replace(/"[,.]?$/, ''))
        .filter(line => line.length > 0 && line.length < 140)
        .slice(0, 5);
    }
  } catch (e) {
    console.error("[DEBUG] Error generating suggestions:", e);
    throw new Error(`Failed to generate suggestions: ${e.message}`);
  }
}


async function fetchWithRetry(url, options, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      console.log(`Attempt ${attempt + 1} failed:`, err);
      lastError = err;
      
      // Only retry on network errors, not on 4xx responses
      if (!err.message.includes('fetch failed') && !err.message.includes('network')) {
        throw err;
      }
      
      // Wait before retrying (exponential backoff)
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
  
  throw lastError;
}

// Rate limiting implementation
const apiCallTracker = {};

function checkRateLimit(apiKey) {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const maxCalls = 60; // Max calls per minute (adjust based on API limits)
  
  if (!apiCallTracker[apiKey]) {
    apiCallTracker[apiKey] = [];
  }
  
  // Remove old calls outside the window
  apiCallTracker[apiKey] = apiCallTracker[apiKey].filter(time => now - time < windowMs);
  
  if (apiCallTracker[apiKey].length >= maxCalls) {
    throw new Error('Rate limit exceeded. Please wait before making more requests.');
  }
  
  // Record this call
  apiCallTracker[apiKey].push(now);
}

// Caching implementation
const responseCache = new Map();

function getCacheKey(prompt, provider) {
  // Use a hash or truncated version of the prompt to create a reasonable key
  return `${provider}:${prompt.substring(0, 100)}`;
}

function getCachedResponse(prompt, provider) {
  const key = getCacheKey(prompt, provider);
  const cached = responseCache.get(key);
  
  if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5 minute cache
    return cached.response;
  }
  
  return null;
}

function setCachedResponse(prompt, provider, response) {
  const key = getCacheKey(prompt, provider);
  responseCache.set(key, {
    response,
    timestamp: Date.now()
  });
  
  // Limit cache size to prevent memory issues
  if (responseCache.size > 100) {
    // Remove oldest entry
    const firstKey = responseCache.keys().next().value;
    responseCache.delete(firstKey);
  }
}

// Optional: Clean up rate limit trackers periodically
setInterval(() => {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  
  Object.keys(apiCallTracker).forEach(key => {
    apiCallTracker[key] = apiCallTracker[key].filter(time => now - time < windowMs);
    
    // Remove empty trackers
    if (apiCallTracker[key].length === 0) {
      delete apiCallTracker[key];
    }
  });
}, 5 * 60 * 1000); // Run every 5 minutes


 