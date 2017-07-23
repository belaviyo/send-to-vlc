/* globals commands */
'use strict';

function notify (message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: '/data/icons/48.png',
    title: 'Send to VLC media player',
    message
  });
}

function sendToVLC(urls) {
  chrome.storage.local.get('command', prefs => {
    chrome.runtime.sendNativeMessage('com.add0n.native_client', {
      permissions: ['crypto', 'fs', 'os', 'path', 'child_process'],
      args: [urls.join('\n'), prefs.command || commands.guess()],
      script: `
        const path = require('path');

        const filename = path.join(
          require('os').tmpdir(),
          'vlc-' + require('crypto').randomBytes(4).readUInt32LE(0) + '.m3u8'
        );
        require('fs').writeFile(filename, args[0], err => {
          if (err) {
            push({
              err: err.message || err
            });
            done();
          }
          else {
            let [command, ...param] = args[1].split(' ');
            command = command.replace(/%([^%]+)%/g, (_, n) => env[n]);

            const vlc = require('child_process').spawn(command, [...param, filename], {
              detached: true
            });
            let stdout = '', stderr = '';
            vlc.stdout.on('data', data => stdout += data);
            vlc.stderr.on('data', data => stderr += data);
            vlc.on('close', code => {
              push({code, stdout, stderr});
              done();
            });
          }
        });
      `
    }, res => {
      if (!res) {
        chrome.tabs.create({
          url: '/data/guide/index.html'
        });
      }
      if (res && res.code !== 0) {
        notify(res.stderr || res.error || res.err);
      }
    });
  });
}

chrome.runtime.onMessage.addListener((request, sender) => {
  if (request.method === 'show-button') {
    chrome.browserAction.setBadgeText({
      tabId: sender.tab.id,
      text: request.count + ''
    });
  }
  else if (request.method === 'send-to-vlc') {
    sendToVLC(request.urls);
  }
});

chrome.browserAction.onClicked.addListener(tab => {
  chrome.tabs.sendMessage(tab.id, {
    method: 'get-urls'
  });
});

// FAQs & Feedback
chrome.storage.local.get({
  'version': null,
  'faqs': navigator.userAgent.toLowerCase().indexOf('firefox') === -1 ? true : false
}, prefs => {
  let version = chrome.runtime.getManifest().version;

  if (prefs.version ? (prefs.faqs && prefs.version !== version) : true) {
    chrome.storage.local.set({version}, () => {
      chrome.tabs.create({
        url: 'http://add0n.com/send-to-vlc.html?version=' + version +
          '&type=' + (prefs.version ? ('upgrade&p=' + prefs.version) : 'install')
      });
    });
  }
});
(function () {
  let {name, version} = chrome.runtime.getManifest();
  chrome.runtime.setUninstallURL('http://add0n.com/feedback.html?name=' + name + '&version=' + version);
})();
