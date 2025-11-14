document.addEventListener('DOMContentLoaded', () => {
  const provider = document.getElementById('provider');
  const apiKey = document.getElementById('apiKey');
  const saveBtn = document.getElementById('saveBtn');
  const status = document.getElementById('status');

  // Load settings
  chrome.storage.local.get(['provider', 'apiKey'], (result) => {
    if (result.provider) provider.value = result.provider;
    if (result.apiKey) apiKey.value = result.apiKey;
  });

  // Save settings
  saveBtn.addEventListener('click', () => {
    const settings = {
      provider: provider.value,
      apiKey: apiKey.value
    };
    
    chrome.storage.local.set(settings, () => {
      status.textContent = 'Settings saved!';
      setTimeout(() => status.textContent = '', 2000);
    });
  });
});
