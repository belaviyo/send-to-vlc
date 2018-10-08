/* globals commands */
'use strict';

function save() {
  const command = document.getElementById('command').value;
  const tmp = document.getElementById('tmp').value;
  const passphrase = document.getElementById('passphrase').value;
  const video = document.getElementById('video').checked;
  const audio = document.getElementById('audio').checked;
  const link = document.getElementById('link').checked;
  const error = document.getElementById('error').checked;
  const badge = document.getElementById('badge').checked;
  const color = document.getElementById('color').value;
  const faqs = document.getElementById('faqs').checked;
  chrome.storage.local.set({
    command,
    tmp,
    passphrase,
    video,
    audio,
    link,
    error,
    badge,
    color,
    faqs
  }, () => {
    const status = document.getElementById('status');
    status.textContent = chrome.i18n.getMessage('optionsMSG');
    setTimeout(() => status.textContent = '', 750);
  });
  chrome.browserAction.setBadgeBackgroundColor({
    color
  });
  if (badge === false) {
    chrome.tabs.query({
      url: ['*://*/*']
    }, tabs => tabs.forEach(tab => chrome.browserAction.setBadgeText({
      text: '',
      tabId: tab.id
    })));
  }
}

chrome.storage.local.get({
  command: commands.guess(),
  tmp: '',
  passphrase: '',
  video: true,
  audio: true,
  link: true,
  error: true,
  badge: true,
  color: '#6e6e6e',
  faqs: true
}, prefs => {
  document.getElementById('command').value = prefs.command;
  document.getElementById('tmp').value = prefs.tmp;
  document.getElementById('passphrase').value = prefs.passphrase;
  document.getElementById('video').checked = prefs.video;
  document.getElementById('audio').checked = prefs.audio;
  document.getElementById('link').checked = prefs.link;
  document.getElementById('error').checked = prefs.error;
  document.getElementById('badge').checked = prefs.badge;
  document.getElementById('color').value = prefs.color;
  document.getElementById('faqs').checked = prefs.faqs;
});
document.getElementById('save').addEventListener('click', save);

// localization
[...document.querySelectorAll('[data-i18n]')].forEach(e => {
  e.textContent = chrome.i18n.getMessage(e.dataset.i18n);
});

// support
document.getElementById('support').addEventListener('click', () => chrome.tabs.create({
  url: chrome.runtime.getManifest().homepage_url + '&rd=donate'
}));
