// Add to your options.js

// Form assistant settings
const showGlobalButton = document.getElementById('show-global-button');
const formDataSource = document.getElementById('form-data-source');
const editUserProfile = document.getElementById('edit-user-profile');
const userProfileModal = document.getElementById('user-profile-modal');
const closeModal = userProfileModal.querySelector('.close');
const saveProfile = document.getElementById('save-profile');

// Load form assistant settings
chrome.storage.sync.get([
  
  'showGlobalButton',  
  'formDataSource',
  'userProfile'
], (result) => {
   showGlobalButton.checked = result.showGlobalButton !== false;
   formDataSource.value = result.formDataSource || 'both';
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
 
 
