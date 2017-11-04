/* globals commands, Parser */
'use strict';

function notify(message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: '/data/icons/48.png',
    title: chrome.i18n.getMessage('appTitle'),
    message
  });
}

function copy(tabId) {
  if (/Firefox/.test(navigator.userAgent)) {
    chrome.tabs.executeScript(tabId, {
      allFrames: false,
      runAt: 'document_start',
      code: `
        document.oncopy = (event) => {
          event.clipboardData.setData('text/plain', '${copy.urls.join(', ')}');
          event.preventDefault();
        };
        window.focus();
        document.execCommand('Copy', false, null);
      `
    }, () => {
      notify(
        chrome.runtime.lastError ?
          chrome.i18n.getMessage('msgNoCopy') :
          chrome.i18n.getMessage('msgCopy') + ' ' + copy.urls.length
      );
      copy.urls = [];
    });
  }
  else {
    document.oncopy = e => {
      e.clipboardData.setData('text/plain', copy.urls.join('\n'));
      e.preventDefault();
      notify(chrome.i18n.getMessage('msgCopy') + ' ' + copy.urls.length);
      copy.urls = [];
    };
    document.execCommand('Copy', false, null);
  }
}
copy.urls = [];

function sendToVLC(urls) {
  chrome.storage.local.get({
    'command': '',
    'error': true
  }, prefs => {
    const p = new Parser();
    const termref = {
      lineBuffer: (prefs.command || commands.guess())
        .replace(/\\/g, '\\\\')
    };
    p.parseLine(termref);
    chrome.runtime.sendNativeMessage('com.add0n.native_client', {
      permissions: ['crypto', 'fs', 'os', 'path', 'child_process'],
      args: [urls.join('\n'), termref.argv],
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
            let [command, ...param] = args[1];
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
        if (prefs.error) {
          chrome.tabs.create({
            url: '/data/guide/index.html'
          });
        }
      }
      if (res && res.code !== 0) {
        const msg = res.stderr || res.error || res.err || res.stdout;
        if (msg) {
          console.error(res);
          if (prefs.error) {
            notify(msg);
          }
        }
      }
    });
  });
}

chrome.runtime.onMessage.addListener((request, sender) => {
  console.log(request)
  if (request.method === 'show-button') {
    chrome.storage.local.get({
      badge: true
    }, prefs => prefs.badge && chrome.browserAction.setBadgeText({
      tabId: sender.tab.id,
      text: String(request.count)
    }));
  }
  else if (request.method === 'send-to-vlc') {
    sendToVLC(request.urls);
  }
  else if (request.method === 'copy') {
    window.clearTimeout(copy.id);
    copy.urls = [...copy.urls, ...request.urls];
    copy.id = window.setTimeout(copy, 500, sender.tab.id);
  }
});

chrome.browserAction.onClicked.addListener(tab => {
  chrome.tabs.sendMessage(tab.id, {
    method: 'get-urls',
    pause: true,
    reply: 'send-to-vlc'
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'open-current') {
    sendToVLC([info.srcUrl || info.linkUrl]);
  }
  else if (info.menuItemId === 'copy') {
    chrome.tabs.sendMessage(tab.id, {
      method: 'get-urls',
      pause: false,
      reply: 'copy'
    });
  }
});

(function(callback) {
  chrome.runtime.onInstalled.addListener(callback);
  chrome.runtime.onStartup.addListener(callback);
})(function() {
  chrome.contextMenus.create({
    id: 'copy',
    title: chrome.i18n.getMessage('contextMenuCopy'),
    contexts: ['browser_action'],
    documentUrlPatterns: ['*://*/*']
  });
  chrome.storage.local.get({
    video: true,
    audio: true,
    link: true,
    color: '#6e6e6e'
  }, prefs => {
    if (prefs.video || prefs.audio || prefs.link) {
      chrome.contextMenus.create({
        id: 'open-current',
        title: chrome.i18n.getMessage('appTitle'),
        contexts: [
          prefs.video ? 'video' : '',
          prefs.audio ? 'audio' : '',
          prefs.link ? 'link' : ''
        ].filter(a => a),
        documentUrlPatterns: ['*://*/*']
      });
    }
    chrome.browserAction.setBadgeBackgroundColor({
      color: prefs.color
    });
  });
});

// FAQs & Feedback
chrome.storage.local.get({
  'version': null,
  'faqs': navigator.userAgent.indexOf('Firefox') === -1
}, prefs => {
  const version = chrome.runtime.getManifest().version;

  if (prefs.version ? (prefs.faqs && prefs.version !== version) : true) {
    chrome.storage.local.set({version}, () => {
      chrome.tabs.create({
        url: 'http://add0n.com/send-to.html?from=' + commands.tag + '&version=' + version +
          '&type=' + (prefs.version ? ('upgrade&p=' + prefs.version) : 'install')
      });
    });
  }
});
{
  const {name, version} = chrome.runtime.getManifest();
  chrome.runtime.setUninstallURL('http://add0n.com/feedback.html?name=' + name + '&version=' + version);
}
