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
    chrome.runtime.sendNativeMessage('com.add0n.native-client', {
      permissions: ['crypto', 'fs', 'os', 'path', 'child_process'],
      script: `
        const path = require('path');

        const filename = path.join(
          require('os').tmpdir(),
          'vlc-' + require('crypto').randomBytes(4).readUInt32LE(0) + '.m3u8'
        );
        require('fs').writeFile(filename, \`${urls.join('\n')}\`, err => {
          if (err) {
            push({
              err: err.message || err
            });
            done();
          }
          else {
            const command = '${(prefs.command || commands.guess()).replace(/\\/g, '\\\\')}';
            let [exe, ...args] = command.split(' ');
            exe = exe.replace(/%([^%]+)%/g, (_, n) => env[n]);

            const vlc = require('child_process').spawn(exe, [...args, filename], {
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
      if (res.code !== 0) {
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
