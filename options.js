// Add to your options.js

// Form assistant settings
const enableFormAssistant = document.getElementById('enable-form-assistant');
const showGlobalButton = document.getElementById('show-global-button');
const showFieldButtons = document.getElementById('show-field-buttons');
const formDataSource = document.getElementById('form-data-source');
const editUserProfile = document.getElementById('edit-user-profile');
const userProfileModal = document.getElementById('user-profile-modal');
const closeModal = userProfileModal.querySelector('.close');
const saveProfile = document.getElementById('save-profile');

// Load form assistant settings
chrome.storage.sync.get([
  'enableFormAssistant', 
  'showGlobalButton', 
  'showFieldButtons',
  'formDataSource',
  'userProfile'
], (result) => {
  enableFormAssistant.checked = result.enableFormAssistant !== false;
  showGlobalButton.checked = result.showGlobalButton !== false;
  showFieldButtons.checked = result.showFieldButtons !== false;
  formDataSource.value = result.formDataSource || 'both';
  
  // Load user profile data
   
});

// Save form assistant settings
enableFormAssistant.addEventListener('change', () => {
  chrome.storage.sync.set({ enableFormAssistant: enableFormAssistant.checked });
});

showGlobalButton.addEventListener('change', () => {
  chrome.storage.sync.set({ showGlobalButton: showGlobalButton.checked });
});

showFieldButtons.addEventListener('change', () => {
  chrome.storage.sync.set({ showFieldButtons: showFieldButtons.checked });
});

formDataSource.addEventListener('change', () => {
  chrome.storage.sync.set({ formDataSource: formDataSource.value });
});
 
 
