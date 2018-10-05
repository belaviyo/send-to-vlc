/* globals commands, Parser */
'use strict';

var notify = message => chrome.notifications.create({
  type: 'basic',
  iconUrl: '/data/icons/48.png',
  title: chrome.i18n.getMessage('appTitle'),
  message
});

var copy = (tabId, urls) => {
  if (/Firefox/.test(navigator.userAgent)) {
    chrome.tabs.executeScript(tabId, {
      allFrames: false,
      runAt: 'document_start',
      code: `
        document.oncopy = (event) => {
          event.clipboardData.setData('text/plain', '${urls.join(', ')}');
          event.preventDefault();
        };
        window.focus();
        document.execCommand('Copy', false, null);
      `
    }, () => {
      notify(
        chrome.runtime.lastError ?
          chrome.i18n.getMessage('msgNoCopy') :
          chrome.i18n.getMessage('msgCopy') + ' ' + urls.length
      );
    });
  }
  else {
    document.oncopy = e => {
      e.clipboardData.setData('text/plain', urls.join('\n'));
      e.preventDefault();
      notify(chrome.i18n.getMessage('msgCopy') + ' ' + urls.length);
    };
    document.execCommand('Copy', false, null);
  }
};

function sendToVLC(urls) {
  // mark links as visited
  // https://github.com/belaviyo/send-to-vlc/issues/15
  urls.forEach(url => chrome.history.addUrl({url}));
  //
  chrome.storage.local.get({
    'command': '',
    'tmp': '',
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
      args: [urls.join('\n'), termref.argv, prefs.tmp],
      script: `
        const path = require('path');

        const filename = path.join(
          args[2] || require('os').tmpdir(),
          'media-' + require('crypto').randomBytes(4).readUInt32LE(0) + '.m3u8'
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

            const player = require('child_process').spawn(command, [...param, filename], {
              detached: true
            });
            let stdout = '', stderr = '';
            player.stdout.on('data', data => stdout += data);
            player.stderr.on('data', data => stderr += data);
            player.on('close', code => {
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
            if (msg.indexOf('ENOENT') === -1) {
              notify(msg);
            }
            else {
              notify(chrome.i18n.getMessage('msgNotFound'));
            }
          }
        }
      }
    });
  });
}

chrome.runtime.onMessage.addListener((request, sender) => {
  if (request.method === 'show-button') {
    chrome.storage.local.get({
      badge: true
    }, prefs => prefs.badge && chrome.browserAction.setBadgeText({
      tabId: sender.tab.id,
      text: String(request.count)
    }));
  }
});

/* collect all the links from a web page */
const collect = (tabId, callback) => chrome.tabs.executeScript(tabId, {
  matchAboutBlank: true,
  allFrames: true,
  code: `[typeof urls === 'object' ? urls : [], location.href]`
}, arr => {
  const lastError = chrome.runtime.lastError;
  if (lastError) {
    return notify(lastError.message);
  }
  if (!arr || arr.length === 0) {
    return notify(chrome.i18n.getMessage('msgUnexpected'));
  }
  const links = [];
  arr.forEach(a => links.push(...a[0]));
  if (links.length) {
    return callback(links);
  }
  const yt = [];
  yt.push(...arr.map(a => a[1]).filter(l => l.indexOf('www.youtube.com') !== -1));
  if (yt.length) {
    return callback([yt.shift()]);
  }
  // no link detected, let's send the page URL
  callback([arr[0][1]]);
});

chrome.browserAction.onClicked.addListener(tab => collect(tab.id, urls => {
  sendToVLC(urls);
  // pause all the playing players
  chrome.tabs.executeScript(tab.id, {
    allFrames: false,
    runAt: 'document_start',
    code: `{
      if (typeof players === 'object') {
        players.forEach(player => {
          try {
            player.pause();
          }
          catch(e) {}
        })
      }
    }`
  });
}));

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'open-link') {
    sendToVLC([info.linkUrl || info.srcUrl]);
  }
  else if (info.menuItemId === 'open-media') {
    sendToVLC([info.srcUrl || info.linkUrl]);
  }
  else if (info.menuItemId === 'copy') {
    collect(tab.id, urls => copy(tab.id, urls));
  }
});

{
  const callback = () => {
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
        if (prefs.link) {
          chrome.contextMenus.create({
            id: 'open-link',
            title: chrome.i18n.getMessage('appTitle'),
            contexts: ['link'],
            documentUrlPatterns: ['*://*/*']
          });
        }
        if (prefs.video || prefs.audio) {
          chrome.contextMenus.create({
            id: 'open-media',
            title: chrome.i18n.getMessage('appTitle'),
            contexts: [
              prefs.video ? 'video' : '',
              prefs.audio ? 'audio' : ''
            ].filter(a => a),
            documentUrlPatterns: ['*://*/*']
          });
        }
      }
      chrome.browserAction.setBadgeBackgroundColor({
        color: prefs.color
      });
    });
  };
  chrome.runtime.onInstalled.addListener(callback);
  chrome.runtime.onStartup.addListener(callback);
}

// FAQs & Feedback
chrome.storage.local.get({
  'version': null,
  'faqs': true,
  'last-update': 0
}, prefs => {
  const version = chrome.runtime.getManifest().version;

  if (prefs.version ? (prefs.faqs && prefs.version !== version) : true) {
    const now = Date.now();
    const doUpdate = (now - prefs['last-update']) / 1000 / 60 / 60 / 24 > 45;
    chrome.storage.local.set({
      version,
      'last-update': doUpdate ? Date.now() : prefs['last-update']
    }, () => {
      // do not display the FAQs page if last-update occurred less than 45 days ago.
      if (doUpdate) {
        const p = Boolean(prefs.version);
        chrome.tabs.create({
          url: chrome.runtime.getManifest().homepage_url + '?version=' + version +
            '&type=' + (p ? ('upgrade&p=' + prefs.version) : 'install'),
          active: p === false
        });
      }
    });
  }
});

{
  const {name, version} = chrome.runtime.getManifest();
  chrome.runtime.setUninstallURL(
    chrome.runtime.getManifest().homepage_url + '?rd=feedback&name=' + name + '&version=' + version
  );
}
