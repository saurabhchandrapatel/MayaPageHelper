// Store analyzed forms
const analyzedForms = {};

// Common form patterns to help with identification
const formPatterns = {
  login: {
    fields: ['username', 'email', 'password'],
    keywords: ['login', 'sign in', 'signin', 'log in']
  },
  signup: {
    fields: ['name', 'email', 'password', 'confirm', 'agree', 'terms'],
    keywords: ['sign up', 'signup', 'register', 'create account', 'join']
  },
  contact: {
    fields: ['name', 'email', 'message', 'subject', 'phone'],
    keywords: ['contact', 'message', 'inquiry', 'get in touch']
  },
  checkout: {
    fields: ['card', 'credit', 'payment', 'billing', 'shipping', 'address'],
    keywords: ['checkout', 'payment', 'purchase', 'buy', 'order']
  },
  search: {
    fields: ['search', 'query', 'q', 'keyword'],
    keywords: ['search', 'find', 'lookup']
  }
};



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

  if (request.type === "ANALYZE_FORM") {
    analyzedForms[`${sender.tab.id}-${request.formData.formIndex}`] = request.formData;
    console.log("[DEBUG] Form analyzed:", request.formData);
    return true;
  }

  if (request.type === "ASSIST_FORM_FIELD") {
    const formKey = `${sender.tab.id}-${request.formIndex}`;
    const formData = analyzedForms[formKey];
    
    if (!formData) {
      sendResponse({ error: "Form data not found" });
      return true;
    }
    
    const field = formData.fields[request.fieldIndex];
    
    if (!field) {
      sendResponse({ error: "Field not found" });
      return true;
    }
    
    getFieldSuggestion(field, request.pageContext)
      .then(suggestion => {
        console.log("[DEBUG] AI suggestion for field:", suggestion);
        sendResponse({ suggestion });
      })
      .catch(err => {
        console.error("[DEBUG] Error getting field suggestion:", err);
        sendResponse({ error: err.message });
      });
    
    return true;
  }

  if (request.type === "ASSIST_ENTIRE_FORM") {
    const formKey = `${sender.tab.id}-${request.formIndex}`;
    const formData = analyzedForms[formKey];
    
    if (!formData) {
      sendResponse({ error: "Form data not found" });
      return true;
    }
    
    getFormSuggestions(formData, request.pageContext)
      .then(fieldValues => {
        console.log("[DEBUG] AI suggestions for form:", fieldValues);
        sendResponse({ fieldValues });
      })
      .catch(err => {
        console.error("[DEBUG] Error getting form suggestions:", err);
        sendResponse({ error: err.message });
      });
    
    return true;
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

  console.log("[DEBUG] Calling LLM:", provider, "with prompt:", prompt);

  try {
    let result = "No response";

    if (provider === "gemini") {
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/text-bison-001:generateText", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          temperature: 0.7,
          maxOutputTokens: 500
        }),
      });
      const data = await res.json();
      console.log("[DEBUG] Gemini API response:", data);
      result = data?.candidates?.[0]?.content || data?.output?.[0]?.content || "No response from Gemini";

    } else if (provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json();
      console.log("[DEBUG] OpenAI API response:", data);
      result = data?.choices?.[0]?.message?.content || "No response from OpenAI";
    }

    return result;

  } catch (e) {
    console.error("[DEBUG] Error calling LLM:", e);
    return `❌ Error calling ${provider}: ${e.message}`;
  }
}


// form background
 
/**
 * Gets AI suggestion for a single form field
 */
async function getFieldSuggestion(field, pageContext) {
  const storage = await new Promise(resolve =>
    chrome.storage.sync.get(["provider", "apiKey", "formDataSource", "userProfile"], resolve)
  );
  const provider = storage.provider || "gemini";
  const apiKey = storage.apiKey || "";
  const formDataSource = storage.formDataSource || "both";
  const userProfile = storage.userProfile || {};
  
  // Format user profile for the prompt if needed
  let userProfileText = "";
  if (formDataSource === "user-profile" || formDataSource === "both") {
    userProfileText = `
USER PROFILE:
Full Name: ${userProfile.name || 'Not provided'}
Email: ${userProfile.email || 'Not provided'}
Phone: ${userProfile.phone || 'Not provided'}
Address: ${userProfile.address || 'Not provided'}
Company: ${userProfile.company || 'Not provided'}
Job Title: ${userProfile.jobTitle || 'Not provided'}
`;
  }

  const prompt = `
You are an AI assistant helping a user fill out a form field.

FIELD INFORMATION:
Type: ${field.type}
Label: ${field.label || 'Not provided'}
Name: ${field.name || 'Not provided'}
Placeholder: ${field.placeholder || 'Not provided'}
Required: ${field.required ? 'Yes' : 'No'}
${field.options && field.options.length ? `Options: ${field.options.join(', ')}` : ''}

${userProfileText}

${formDataSource !== "user-profile" ? `
PAGE CONTEXT:
Title: ${pageContext.title}
URL: ${pageContext.url}
Content: ${pageContext.content.substring(0, 500)}...
` : ''}

Based on the field information ${formDataSource === "user-profile" ? 'and user profile' : formDataSource === "page-only" ? 'and page context' : 'user profile, and page context'}, provide a single appropriate value for this field.

If the field seems to match a user profile field (like name, email, etc.) and user profile data is available, prefer using that data.

Do not include explanations, just return the suggested value.
`;

  const result = await callLLM(provider, apiKey, prompt, 0.2, 100);
  return result.replace(/^["']|["']$/g, '').trim();
}

/**
 * Gets AI suggestions for all fields in a form
 */
async function getFormSuggestions(formData, pageContext) {
  const storage = await new Promise(resolve =>
    chrome.storage.sync.get(["provider", "apiKey", "formDataSource", "userProfile"], resolve)
  );
  const provider = storage.provider || "gemini";
  const apiKey = storage.apiKey || "";
  const formDataSource = storage.formDataSource || "both";
  const userProfile = storage.userProfile || {};
  
  // Format user profile for the prompt if needed
  let userProfileText = "";
  if (formDataSource === "user-profile" || formDataSource === "both") {
    userProfileText = `
USER PROFILE:
Full Name: ${userProfile.name || 'Not provided'}
Email: ${userProfile.email || 'Not provided'}
Phone: ${userProfile.phone || 'Not provided'}
Address: ${userProfile.address || 'Not provided'}
Company: ${userProfile.company || 'Not provided'}
Job Title: ${userProfile.jobTitle || 'Not provided'}
`;
  }

  // Format fields for the prompt
  const fieldsDescription = formData.fields.map((field, index) => `
Field ${index + 1}:
  ID: ${field.id || 'Not provided'}
  Name: ${field.name || 'Not provided'}
  Type: ${field.type}
  Label: ${field.label || 'Not provided'}
  Placeholder: ${field.placeholder || 'Not provided'}
  Required: ${field.required ? 'Yes' : 'No'}
  ${field.options && field.options.length ? `Options: ${field.options.join(', ')}` : ''}
`).join('');

  // Detect form type
  const formType = detectFormType(formData, pageContext);
  
  const prompt = `
You are an AI assistant helping a user fill out a form.

FORM INFORMATION:
Action: ${formData.action}
Method: ${formData.method}
Number of fields: ${formData.fields.length}
Detected form type: ${formType}

FIELDS:
${fieldsDescription}

${userProfileText}

${formDataSource !== "user-profile" ? `
PAGE CONTEXT:
Title: ${pageContext.title}
URL: ${pageContext.url}
Content: ${pageContext.content.substring(0, 500)}...
` : ''}

Based on the form information ${formDataSource === "user-profile" ? 'and user profile' : formDataSource === "page-only" ? 'and page context' : 'user profile, and page context'}, provide appropriate values for each field.

This appears to be a ${formType} form. Adjust your suggestions accordingly.

If a field seems to match a user profile field (like name, email, etc.) and user profile data is available, prefer using that data.

For login forms, suggest a username but use "********" for passwords.
For signup forms, suggest strong passwords like "StrongP@ss123!" but don't use real personal data if not in the user profile.
For payment forms, use "4111 1111 1111 1111" for credit card numbers and "123" for CVV codes.

Return your response as a JSON array with this format:
[
  {
    "id": "field-id",
    "name": "field-name",
    "value": "suggested value"
  },
  ...
]

Only include id and name if they exist in the original field data.
`;

  const result = await callLLM(provider, apiKey, prompt, 0.2, 1000);

  // Extract JSON from the response
  const jsonMatch = result.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error("[DEBUG] Error parsing JSON from LLM response:", e);
      return [];
    }
  }
  
  return [];
}

/**
 * Detects the type of form based on its fields and page context
 */
function detectFormType(formData, pageContext) {
  const scores = {};
  
  for (const [type, pattern] of Object.entries(formPatterns)) {
    scores[type] = 0;
    
    // Check fields
    formData.fields.forEach(field => {
      const fieldName = (field.name || '').toLowerCase();
      const fieldId = (field.id || '').toLowerCase();
      const fieldLabel = (field.label || '').toLowerCase();
      
      pattern.fields.forEach(patternField => {
        if (fieldName.includes(patternField) || 
            fieldId.includes(patternField) || 
            fieldLabel.includes(patternField)) {
          scores[type] += 1;
        }
      });
    });
    
    // Check page context for keywords
    pattern.keywords.forEach(keyword => {
      if (pageContext.title.toLowerCase().includes(keyword) || 
          pageContext.content.toLowerCase().includes(keyword)) {
        scores[type] += 0.5;
      }
    });
  }
  
  // Find the type with the highest score
  let maxScore = 0;
  let detectedType = 'unknown';
  
  for (const [type, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      detectedType = type;
    }
  }
  
  return maxScore >= 2 ? detectedType : 'unknown';
}

/**
 * Generic function to call LLM APIs
 */
/**
 * Generic function to call LLM APIs with rate limiting and caching
 */
async function callLLM(provider, apiKey, prompt, temperature = 0.7, maxTokens = 500) {
  console.log("[DEBUG] Calling LLM:", provider, "with prompt length:", prompt.length);

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
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/text-bison-001:generateText", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          temperature,
          maxOutputTokens: maxTokens
        }),
      });
      
      if (!res.ok) {
        throw new Error(`Gemini API error: ${res.status} ${res.statusText}`);
      }
      
      const data = await res.json();
      console.log("[DEBUG] Gemini API response:", data);
      result = data?.candidates?.[0]?.content || data?.output?.[0]?.content || "No response from Gemini";

    } else if (provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
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
      });
      
      if (!res.ok) {
        throw new Error(`OpenAI API error: ${res.status} ${res.statusText}`);
      }
      
      const data = await res.json();
      console.log("[DEBUG] OpenAI API response:", data);
      result = data?.choices?.[0]?.message?.content || "No response from OpenAI";
    }

    // Cache the successful response
    setCachedResponse(prompt, provider, result);
    
    return result;

   } catch (e) {
    console.error("[DEBUG] Error calling LLM:", e);
    throw new Error(`Error calling ${provider}: ${e.message}`);
  }
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



// Clean up form data when tabs are closed to prevent memory leaks
chrome.tabs.onRemoved.addListener((tabId) => {
  // Remove all form data for this tab
  Object.keys(analyzedForms).forEach(key => {
    if (key.startsWith(`${tabId}-`)) {
      delete analyzedForms[key];
      console.log("[DEBUG] Cleaned up form data for closed tab:", tabId);
    }
  });
});
 
// Add timestamp to form data when analyzing
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "ANALYZE_FORM") {
    // Add timestamp for cleanup purposes
    request.formData.timestamp = Date.now();
    analyzedForms[`${sender.tab.id}-${request.formData.formIndex}`] = request.formData;
    console.log("[DEBUG] Form analyzed with timestamp:", request.formData);
    return true;
  }
});