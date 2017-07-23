/* globals commands */
'use strict';

function save () {
  const command = document.getElementById('command').value;
  chrome.storage.local.set({command}, () => {
    const status = document.getElementById('status');
    status.textContent = 'Options saved.';
    setTimeout(() => status.textContent = '', 750);
  });
}

function restore () {
  // Use default value color = 'red' and likesColor = true.
  chrome.storage.local.get({
    command: commands.guess()
  }, prefs => {
    document.getElementById('command').value = prefs.command;
  });
}
document.addEventListener('DOMContentLoaded', restore);
document.getElementById('save').addEventListener('click', save);
