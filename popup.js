document.addEventListener("DOMContentLoaded", () => {
  // Get references to UI elements
  const aiProvider = document.getElementById("aiProvider");
  const apiKey = document.getElementById("apiKey");
  const summaryCheckbox = document.getElementById("summary");
  const quizCheckbox = document.getElementById("quiz");
  const voiceCheckbox = document.getElementById("voice");
  const saveBtn = document.getElementById("saveConfig");

  // Load saved configuration
  chrome.storage.sync.get(
    ["provider", "apiKey", "features"],
    ({ provider, apiKey: key, features }) => {
      if (provider) aiProvider.value = provider;
      if (key) apiKey.value = key;
      if (features) {
        summaryCheckbox.checked = features.summary || false;
        quizCheckbox.checked = features.quiz || false;
        voiceCheckbox.checked = features.voice || false;
      }
    }
  );

  // Save configuration on button click
  saveBtn.addEventListener("click", () => {
    const provider = aiProvider.value;
    const key = apiKey.value;
    const features = {
      summary: summaryCheckbox.checked,
      quiz: quizCheckbox.checked,
      voice: voiceCheckbox.checked
    };

    chrome.storage.sync.set({ provider, apiKey: key, features }, () => {
      alert("✅ Configuration saved!");
    });
  });
});
