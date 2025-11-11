// content-scripts/form-assistant.js
(function() {
  // Check if form assistant is enabled before initializing
  chrome.storage.sync.get(['enableFormAssistant', 'showGlobalButton', 'showFieldButtons'], (settings) => {
    return;
    if (settings.enableFormAssistant === false) {
      console.log('[Form Assistant] Disabled in settings');
      return;
    }
    
    // Store settings for later use
    const showGlobalButton = settings.showGlobalButton !== false;
    const showFieldButtons = settings.showFieldButtons !== false;
    
    // Initialize form assistant with settings
    initFormAssistant(showGlobalButton, showFieldButtons);
  });

  function initFormAssistant(showGlobalButton, showFieldButtons) {
    // Run when page loads
    detectForms(showFieldButtons);
    
    
    // Listen for dynamic form additions
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length) {
          detectForms(showFieldButtons);
        }
      }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Add global button if enabled
    if (showGlobalButton) {
      setTimeout(() => addGlobalAssistButton(), 1000);
    }
  }

  function detectForms(showFieldButtons) {
    const forms = document.querySelectorAll('form');
    if (forms.length === 0) return;
    
    console.log(`[Form Assistant] Detected ${forms.length} forms on page`);
    
    forms.forEach((form, index) => {
      if (form.dataset.aiAssistantProcessed) return;
      form.dataset.aiAssistantProcessed = "true";
      
      analyzeForm(form, index, showFieldButtons);
    });
  }
  
  function analyzeForm(form, formIndex, showFieldButtons) {
    const formData = {
      formIndex,
      action: form.action,
      method: form.method,
      fields: []
    };
    
    // Collect all input fields, textareas, and selects
    const fields = form.querySelectorAll('input, textarea, select');
    
    fields.forEach(field => {
      // Skip hidden, submit, button, etc.
      if (['hidden', 'submit', 'button', 'image', 'file', 'reset'].includes(field.type)) {
        return;
      }
      
      // Get field context (label or placeholder)
      let fieldName = field.name || field.id || '';
      let label = '';
      
      // Try to find associated label
      if (field.id) {
        const labelElement = document.querySelector(`label[for="${field.id}"]`);
        if (labelElement) label = labelElement.textContent.trim();
      }
      
      // If no label found, try parent label
      if (!label && field.closest('label')) {
        label = field.closest('label').textContent.trim();
      }
      
      // Fallback to placeholder
      if (!label && field.placeholder) {
        label = field.placeholder;
      }
      
      formData.fields.push({
        type: field.type || field.tagName.toLowerCase(),
        name: fieldName,
        id: field.id,
        label: label,
        placeholder: field.placeholder || '',
        required: field.required,
        options: field.tagName === 'SELECT' ? Array.from(field.options).map(o => o.text) : []
      });
      
      // Add AI assist button next to the field if enabled
      if (showFieldButtons) {
        addAssistButton(field, formData.fields.length - 1, formIndex);
      }
    });
    
    // Send form data to background script for analysis
    chrome.runtime.sendMessage({
      type: "ANALYZE_FORM",
      formData
    });
  }
  
  function addAssistButton(field, fieldIndex, formIndex) {
    // Only add if not already added
    if (field.nextElementSibling?.classList.contains('ai-form-assist')) return;
    
    const button = document.createElement('button');
    button.textContent = "🤖";
    button.title = "AI Assist";
    button.className = 'ai-form-assist';
    button.style.cssText = `
      margin-left: 5px;
      background: #6e57e0;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      padding: 2px 8px;
      font-size: 14px;
    `;
    
    button.addEventListener('click', (e) => {
      e.preventDefault();
      handleFieldAssist(field, fieldIndex, formIndex);
    });
    
    // Insert after the field
    if (field.nextSibling) {
      field.parentNode.insertBefore(button, field.nextSibling);
    } else {
      field.parentNode.appendChild(button);
    }
  }
  
  function handleFieldAssist(field, fieldIndex, formIndex) {
    // Get page context
    const pageTitle = document.title;
    const pageUrl = window.location.href;
    const pageContext = getPageContext();
    
    chrome.runtime.sendMessage({
      type: "ASSIST_FORM_FIELD",
      fieldIndex,
      formIndex,
      pageContext: {
        title: pageTitle,
        url: pageUrl,
        content: pageContext
      }
    }, response => {
      if (response && response.suggestion) {
        field.value = response.suggestion;
        field.focus();
        // Trigger change event to activate any listeners
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  }
  
  function getPageContext() {
    // Get relevant text from the page
    const mainContent = document.querySelector('main') || document.body;
    const headings = Array.from(mainContent.querySelectorAll('h1, h2, h3'))
      .map(h => h.textContent.trim())
      .join('\n');
      
    const paragraphs = Array.from(mainContent.querySelectorAll('p'))
      .slice(0, 5) // Limit to first 5 paragraphs
      .map(p => p.textContent.trim())
      .join('\n');
      
    return `${headings}\n\n${paragraphs}`;
  }
  
  function addGlobalAssistButton() {
    const button = document.createElement('button');
    button.textContent = "🤖 Fill Form";
    button.id = 'ai-global-form-assist';
    button.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      z-index: 10000;
      background: #6e57e0;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      padding: 8px 16px;
      font-size: 14px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    
    button.addEventListener('click', () => {
      const forms = document.querySelectorAll('form');
      console.log(forms.length)
      if (forms.length === 0) return;
      
      // If multiple forms, ask which one
      let formIndex = 0;
      if (forms.length > 1) {
        const formOptions = Array.from(forms).map((form, idx) => {
          const formName = form.id || form.name || `Form ${idx + 1}`;
          const firstInput = form.querySelector('input:not([type="hidden"])');
          const firstLabel = firstInput && firstInput.id ? 
            document.querySelector(`label[for="${firstInput.id}"]`)?.textContent : '';
          return `${formName} ${firstLabel ? `(contains ${firstLabel})` : ''}`;
        });
        
        // Simple dropdown to select form
        const select = document.createElement('select');
        select.innerHTML = formOptions.map((opt, idx) => 
          `<option value="${idx}">${opt}</option>`).join('');
        
        const dialog = document.createElement('div');
        dialog.style.cssText = `
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
          z-index: 10001;
        `;
        dialog.innerHTML = `
          <h3>Select a form to fill</h3>
          <div id="form-select-container"></div>
          <div style="margin-top: 15px; display: flex; justify-content: flex-end;">
            <button id="cancel-form-select" style="margin-right: 10px;">Cancel</button>
            <button id="confirm-form-select">Fill Form</button>
          </div>
        `;
        
        document.body.appendChild(dialog);
        document.getElementById('form-select-container').appendChild(select);
        
        document.getElementById('cancel-form-select').addEventListener('click', () => {
          dialog.remove();
        });
        
        document.getElementById('confirm-form-select').addEventListener('click', () => {
          formIndex = parseInt(select.value);
          dialog.remove();
          fillEntireForm(formIndex);
        });
      } else {
        fillEntireForm(0);
      }
    });
    
    document.body.appendChild(button);
  }
  
  function fillEntireForm(formIndex) {
    // Get page context
    const pageTitle = document.title;
    const pageUrl = window.location.href;
    const pageContext = getPageContext();
    
    chrome.runtime.sendMessage({
      type: "ASSIST_ENTIRE_FORM",
      formIndex,
      pageContext: {
        title: pageTitle,
        url: pageUrl,
        content: pageContext
      }
    }, response => {
      if (response && response.fieldValues) {
        const form = document.querySelectorAll('form')[formIndex];
        
        // Fill each field
        response.fieldValues.forEach(field => {
          const element = form.querySelector(`#${field.id}`) || 
                          form.querySelector(`[name="${field.name}"]`);
          
          if (element) {
            element.value = field.value;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
      }
    });
  }
})();
